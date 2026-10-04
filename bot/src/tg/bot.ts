import { and, eq } from 'drizzle-orm';
import { Bot, GrammyError, InlineKeyboard, type Context } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { prompts } from '../db/schema';
import {
  addNote,
  leadView,
  markLost,
  openLeads,
  setCard,
  setStage,
  takeLead,
  type Lead,
  type Member
} from '../domain/leads';
import { getGroup, setGroup } from '../domain/settings';
import { FUNNEL, LOST_REASONS, STAGE_LABEL, type LostReason } from '../domain/stages';
import { acceptInvite, createInvite, ensureOwner, memberByTg, team } from '../domain/team';
import { shortTime } from '../domain/worktime';
import { cardKeyboard, cardText, cb, esc, mention, parseCb, type Menu } from './card';

/**
 * Бот студии. Работает в двух местах:
 * — в рабочей группе: карточки заявок с кнопками, заметки ответом
 *   на сообщение, напоминания и тревоги;
 * — в личке: вход в команду, приглашения, список открытых заявок.
 *
 * Посторонним бот вежливо отвечает ссылкой на сайт и больше ничего
 * не показывает: это рабочий инструмент, а не витрина.
 */

type Ctx = Context & { member?: Member | null };

export type Deps = {
  db: Db;
  config: Config;
  now?: () => Date;
  /** Для тестов: бот без запроса getMe к Telegram. */
  botInfo?: UserFromGetMe;
};

export type StudioBot = ReturnType<typeof createBot>;

export function createBot({ db, config, now = () => new Date(), botInfo }: Deps) {
  const bot = new Bot<Ctx>(config.BOT_TOKEN ?? 'offline', botInfo ? { botInfo } : undefined);
  const tz = config.work.tz;
  /** Что происходит в группе — в лог: при первом прогоне это единственное окно. Без имён. */
  const log = config.NODE_ENV === 'test' ? () => {} : (line: string) => console.info(`[bot] ${line}`);

  /* ---------- карточки ---------- */

  async function render(id: number, menu: Menu = 'main') {
    const v = await leadView(db, id);
    if (!v) return null;
    return { v, text: cardText(v, now(), tz), keyboard: cardKeyboard(v, menu) };
  }

  /** Новая заявка — карточкой в рабочую группу. Без группы молчит: заявка уже в базе. */
  async function publishLead(id: number) {
    const group = await getGroup(db);
    const r = await render(id);
    if (!group || !r) return false;
    const msg = await bot.api.sendMessage(group.chatId, r.text, {
      parse_mode: 'HTML',
      reply_markup: r.keyboard,
      message_thread_id: group.threadId ?? undefined,
      link_preview_options: { is_disabled: true }
    });
    await setCard(db, id, msg.chat.id, msg.message_id);
    return true;
  }

  async function refreshCard(id: number, menu: Menu = 'main') {
    const r = await render(id, menu);
    if (!r?.v.lead.cardChatId || !r.v.lead.cardMessageId) return;
    try {
      await bot.api.editMessageText(r.v.lead.cardChatId, r.v.lead.cardMessageId, r.text, {
        parse_mode: 'HTML',
        reply_markup: r.keyboard,
        link_preview_options: { is_disabled: true }
      });
    } catch (e) {
      // нажали ту же кнопку дважды — карточка уже такая
      if (!(e instanceof GrammyError && e.description.includes('message is not modified'))) throw e;
    }
  }

  /** Ответом на карточку: так в группе видно, о какой заявке речь. */
  async function replyToCard(lead: Lead, html: string, keyboard?: InlineKeyboard) {
    const group = await getGroup(db);
    const chatId = lead.cardChatId ?? group?.chatId;
    if (!chatId) return;
    await bot.api.sendMessage(chatId, html, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
      message_thread_id: lead.cardChatId ? undefined : (group?.threadId ?? undefined),
      reply_parameters: lead.cardMessageId ? { message_id: lead.cardMessageId, allow_sending_without_reply: true } : undefined,
      link_preview_options: { is_disabled: true }
    });
  }

  /** Час без «Беру»: зовём всех. */
  async function remind(lead: Lead) {
    const people = await team(db);
    const who = people.map(mention).join(', ');
    await replyToCard(
      lead,
      `Заявка #${lead.id} ждёт уже час — никто не взял. ${who}`,
      new InlineKeyboard().text('Беру', cb(lead.id, 'take'))
    );
  }

  /** К вечеру без ответа клиенту — список владельцам. */
  async function alarm(list: Lead[]) {
    const group = await getGroup(db);
    if (!group || !list.length) return;
    const owners = (await team(db)).filter((m) => m.role === 'owner');
    const lines = list.map((l) => `#${l.id} · ${esc(l.name)} · с ${shortTime(l.createdAt, now(), tz)}`);
    await bot.api.sendMessage(
      group.chatId,
      [`<b>К вечеру клиентам не ответили</b> — ${list.length}:`, ...lines, '', owners.map(mention).join(', ')].join('\n'),
      { parse_mode: 'HTML', message_thread_id: group.threadId ?? undefined, link_preview_options: { is_disabled: true } }
    );
  }

  /* ---------- кто пишет ---------- */

  bot.use(async (ctx, next) => {
    if (ctx.from && !ctx.from.is_bot) {
      ctx.member = (await memberByTg(db, ctx.from)) ?? (await ensureOwner(db, ctx.from, config.OWNER_TG_IDS));
    }
    await next();
  });

  const outsider = (ctx: Ctx) =>
    ctx.reply(`Это рабочий бот студии CoreThree. Оставить заявку можно на сайте: ${config.SITE_URL}/contact`, {
      link_preview_options: { is_disabled: true }
    });

  /* ---------- личка ---------- */

  const HELP = [
    '<b>Бот студии CoreThree</b>',
    '',
    'Заявки приходят карточками в рабочую группу: «Беру», шаг по воронке, заметка, отказ — кнопками под карточкой.',
    '',
    '/leads — открытые заявки',
    '/team — команда',
    '/invite — пригласить в команду (владельцы)',
    '/bind — в группе: присылать заявки сюда'
  ].join('\n');

  bot.command('start', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const payload = ctx.match?.trim() ?? '';
    if (payload.startsWith('inv_') && !ctx.member) {
      const m = await acceptInvite(db, payload.slice(4), ctx.from!);
      if (!m) return ctx.reply('Приглашение не действует: его уже использовали или прошло двое суток. Попросите новое.');
      ctx.member = m;
      for (const o of (await team(db)).filter((x) => x.role === 'owner')) {
        await bot.api.sendMessage(o.tgId, `${mention(m)} вошёл в команду.`, { parse_mode: 'HTML' }).catch(() => {});
      }
    }
    if (!ctx.member) return outsider(ctx);
    return ctx.reply(HELP, { parse_mode: 'HTML' });
  });

  bot.command('help', (ctx) => (ctx.member ? ctx.reply(HELP, { parse_mode: 'HTML' }) : outsider(ctx)));

  bot.command('invite', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (!ctx.member) return outsider(ctx);
    if (ctx.member.role !== 'owner') return ctx.reply('Приглашать могут владельцы.');
    const code = await createInvite(db, ctx.member);
    const link = `https://t.me/${ctx.me.username}?start=inv_${code}`;
    return ctx.reply(`Ссылка для входа в команду — действует двое суток и один раз:\n${link}`, {
      link_preview_options: { is_disabled: true }
    });
  });

  bot.command('team', async (ctx) => {
    if (!ctx.member) return outsider(ctx);
    const people = await team(db);
    const lines = people.map((m) => `${esc(m.name)}${m.username ? ` · @${esc(m.username)}` : ''}${m.role === 'owner' ? ' · владелец' : ''}`);
    return ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  bot.command('leads', async (ctx) => {
    if (!ctx.member) return outsider(ctx);
    const list = await openLeads(db);
    if (!list.length) return ctx.reply('Открытых заявок нет.');
    const lines = list.slice(0, 30).map((l) => {
      const link = cardLink(l);
      const head = link ? `<a href="${link}">#${l.id}</a>` : `#${l.id}`;
      return `${head} · ${esc(l.name)} · ${STAGE_LABEL[l.stage]} · ${shortTime(l.createdAt, now(), tz)}`;
    });
    return ctx.reply(lines.join('\n'), { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  });

  /* ---------- группа ---------- */

  bot.command('bind', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply('Команду /bind отправьте в рабочей группе — туда и пойдут заявки.');
    if (!ctx.member) return;
    const threadId = ctx.msg.is_topic_message ? (ctx.msg.message_thread_id ?? null) : null;
    await setGroup(db, { chatId: ctx.chat.id, threadId, title: 'title' in ctx.chat ? (ctx.chat.title ?? null) : null });
    log(`/bind: ${threadId ? `тема ${threadId}` : 'группа без темы'}`);
    return ctx.reply(threadId ? 'Готово: заявки будут приходить в эту тему.' : 'Готово: заявки будут приходить в эту группу.');
  });

  bot.on('callback_query:data', async (ctx) => {
    const p = parseCb(ctx.callbackQuery.data);
    if (!p) return ctx.answerCallbackQuery();
    if (!ctx.member) return ctx.answerCallbackQuery({ text: 'Кнопки — только для команды.', show_alert: true });
    const me = ctx.member;
    const at = now();
    log(`#${p.id} ${p.act}${p.arg ? ` ${p.arg}` : ''} — участник ${me.id}`);

    switch (p.act) {
      case 'take': {
        await takeLead(db, p.id, me.id, at);
        await refreshCard(p.id);
        return ctx.answerCallbackQuery({ text: `#${p.id} ведёте вы` });
      }
      case 'st': {
        const stage = FUNNEL.find((s) => s === p.arg);
        if (!stage) return ctx.answerCallbackQuery();
        await setStage(db, p.id, me.id, stage, at);
        await refreshCard(p.id);
        return ctx.answerCallbackQuery({ text: STAGE_LABEL[stage] });
      }
      case 'reopen': {
        const v = await leadView(db, p.id);
        await setStage(db, p.id, me.id, v?.lead.firstReplyAt ? 'contacted' : 'new', at);
        await refreshCard(p.id);
        return ctx.answerCallbackQuery({ text: 'Снова в работе' });
      }
      case 'lr': {
        if (!p.arg || !(p.arg in LOST_REASONS)) return ctx.answerCallbackQuery();
        await markLost(db, p.id, me.id, p.arg as LostReason, at);
        await refreshCard(p.id);
        return ctx.answerCallbackQuery({ text: 'Отказ записан' });
      }
      case 'stages':
      case 'lost':
      case 'back': {
        await refreshCard(p.id, p.act === 'back' ? 'main' : p.act);
        return ctx.answerCallbackQuery();
      }
      case 'note': {
        const chatId = ctx.chat?.id;
        if (!chatId) return ctx.answerCallbackQuery();
        const msg = await ctx.reply(`Заметка к заявке #${p.id} — ${esc(me.name)}, ответьте на это сообщение текстом.`, {
          parse_mode: 'HTML',
          reply_markup: { force_reply: true, selective: true, input_field_placeholder: 'Текст заметки' },
          reply_parameters: ctx.callbackQuery.message ? { message_id: ctx.callbackQuery.message.message_id } : undefined
        });
        await db.insert(prompts).values({ chatId, messageId: msg.message_id, kind: 'note', leadId: p.id, memberId: me.id });
        return ctx.answerCallbackQuery();
      }
      default:
        return ctx.answerCallbackQuery();
    }
  });

  /** Ответ на «ответьте на это сообщение» — заметка в историю заявки. */
  bot.on('message:text', async (ctx, next) => {
    const reply = ctx.msg.reply_to_message;
    if (!reply || !ctx.member) return next();
    const [prompt] = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.chatId, ctx.chat.id), eq(prompts.messageId, reply.message_id)));
    if (!prompt?.leadId) return next();
    await addNote(db, prompt.leadId, ctx.member.id, ctx.msg.text, now());
    log(`#${prompt.leadId} заметка — участник ${ctx.member.id}`);
    await db.delete(prompts).where(eq(prompts.id, prompt.id));
    await refreshCard(prompt.leadId);
    // чистим за собой, если у бота есть право удалять; нет — не страшно
    await ctx.api.deleteMessage(ctx.chat.id, reply.message_id).catch(() => {});
    await ctx.api.deleteMessage(ctx.chat.id, ctx.msg.message_id).catch(() => {});
  });

  bot.on('message', async (ctx) => {
    if (ctx.chat.type === 'private' && !ctx.member) await outsider(ctx);
  });

  bot.catch((err) => console.error('[bot]', err.error));

  return { bot, publishLead, refreshCard, remind, alarm };
}

/** Ссылка на карточку в супергруппе: t.me/c/<id без -100>/<сообщение>. */
export function cardLink(l: Pick<Lead, 'cardChatId' | 'cardMessageId'>) {
  if (!l.cardChatId || !l.cardMessageId) return null;
  const s = String(l.cardChatId);
  if (!s.startsWith('-100')) return null;
  return `https://t.me/c/${s.slice(4)}/${l.cardMessageId}`;
}
