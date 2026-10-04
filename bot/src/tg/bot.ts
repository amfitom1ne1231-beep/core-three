import { and, eq } from 'drizzle-orm';
import { Bot, GrammyError, InlineKeyboard, type Context } from 'grammy';
import type { Message, UserFromGetMe } from 'grammy/types';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { prompts } from '../db/schema';
import {
  addNote,
  cardlessLeads,
  leadView,
  markLost,
  openLeads,
  reopenLead,
  setCard,
  setStage,
  takeLead,
  type Lead,
  type Member
} from '../domain/leads';
import { addFile, getProject, listProjects, type Deadlines, type Material, type NewFile } from '../domain/projects';
import { getGroup, getSetting, setGroup, setSetting } from '../domain/settings';
import type { Morning, Weekly } from '../domain/digest';
import { FUNNEL, KIND_LABEL, LOST_REASONS, STAGE_LABEL, type LostReason } from '../domain/stages';
import { acceptInvite, createInvite, ensureOwner, memberByTg, team } from '../domain/team';
import { dayKey, shortTime } from '../domain/worktime';
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

/** Сколько заявка без карточки считается «ещё не доехавшей», а не разобранной без неё. */
const PENDING_MS = 48 * 60 * 60 * 1000;

export function createBot({ db, config, now = () => new Date(), botInfo }: Deps) {
  const bot = new Bot<Ctx>(config.BOT_TOKEN ?? 'offline', {
    ...(botInfo ? { botInfo } : {}),
    // свой адрес Bot API — когда с сервера до Telegram напрямую не достать
    ...(config.TELEGRAM_API_ROOT ? { client: { apiRoot: config.TELEGRAM_API_ROOT.replace(/\/+$/, '') } } : {})
  });
  const tz = config.work.tz;
  /** Что происходит в группе — в лог: при первом прогоне это единственное окно. Без имён. */
  const log = config.NODE_ENV === 'test' ? () => {} : (line: string) => console.info(`[bot] ${line}`);

  /* ---------- мини-приложение ---------- */

  /** Адрес приложения; его нет, пока сервис не виден снаружи по HTTPS. */
  const appBase = config.PUBLIC_URL ? `${config.PUBLIC_URL.replace(/\/+$/, '')}/app/` : null;

  /**
   * «Открыть» под карточкой в группе. Кнопка, которая открывает
   * мини-приложение прямо из сообщения (web_app), работает только в личке,
   * поэтому в группе это обычная ссылка: либо сразу в приложение — когда
   * его адрес постоянный и вписан у @BotFather, — либо в личку бота,
   * где он отвечает кнопкой на эту заявку.
   */
  function openLink(id: number) {
    if (!appBase) return null;
    const me = bot.botInfo.username;
    return config.MINI_APP_LINK === 'direct' ? `https://t.me/${me}?startapp=lead_${id}` : `https://t.me/${me}?start=lead_${id}`;
  }

  /** Кнопка меню в личке у каждого из команды: открывает приложение. Нет адреса — обычный список команд. */
  async function setMenu(tgId: number) {
    await bot.api
      .setChatMenuButton({
        chat_id: tgId,
        menu_button: appBase ? { type: 'web_app', text: 'Студия', web_app: { url: appBase } } : { type: 'commands' }
      })
      // человек ещё не открывал личку с ботом — кнопку поставим, когда напишет /start
      .catch(() => {});
  }

  async function syncMenu() {
    for (const m of await team(db)) await setMenu(m.tgId);
  }

  /**
   * «Открыть» под карточкой есть, только пока у приложения есть адрес.
   * Адрес появился или пропал — открытые карточки перерисовываются один
   * раз; при обычном перезапуске Telegram зря не дёргаем.
   */
  async function syncCards() {
    const has = Boolean(appBase);
    if ((await getSetting<boolean>(db, 'cards_open_button')) === has) return;
    for (const lead of await openLeads(db)) await refreshCard(lead.id).catch((e) => console.error('[bot] карточка', lead.id, e));
    await setSetting(db, 'cards_open_button', has);
  }

  /* ---------- карточки ---------- */

  async function render(id: number, menu: Menu = 'main') {
    const v = await leadView(db, id);
    if (!v) return null;
    return { v, text: cardText(v, now(), tz), keyboard: cardKeyboard(v, menu, openLink(id)) };
  }

  /** Карточки, которые отправляются прямо сейчас: вторую на ту же заявку не ставим. */
  const publishing = new Set<number>();

  /** Новая заявка — карточкой в рабочую группу. Без группы молчит: заявка уже в базе. */
  async function publishLead(id: number) {
    // Telegram ещё ни разу не ответил (имя бота нужно ссылке «Открыть») — карточка встанет позже
    if (!bot.isInited() || publishing.has(id)) return false;
    publishing.add(id);
    try {
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
    } finally {
      publishing.delete(id);
    }
  }

  /**
   * Догнать карточки заявок, которые пришли, пока Telegram был недоступен.
   * Заявка в таком случае уже в базе — сайт получил ответ, человек ничего
   * не заметил; здесь она доезжает до группы. Зовётся по расписанию.
   * Только свежие (двое суток): давняя заявка без карточки — не сбой.
   */
  async function publishPending(at = now()) {
    if (!bot.isInited() || !(await getGroup(db))) return 0;
    let sent = 0;
    for (const lead of await cardlessLeads(db, new Date(at.getTime() - PENDING_MS))) {
      try {
        if (await publishLead(lead.id)) sent++;
      } catch (e) {
        // связи всё ещё нет — остальные ждут следующего захода, Telegram зря не дёргаем
        log(`карточка #${lead.id} не ушла: ${e instanceof Error ? e.message : e}`);
        break;
      }
    }
    if (sent) log(`догнали карточек: ${sent}`);
    return sent;
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
    if (!chatId) return null;
    return bot.api.sendMessage(chatId, html, {
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
    const msg = await replyToCard(
      lead,
      `Заявка #${lead.id} ждёт уже час — никто не взял. ${who}`,
      new InlineKeyboard().text('Беру', cb(lead.id, 'take'))
    );
    log(`#${lead.id} напоминание — ${msg?.is_topic_message ? `тема ${msg.message_thread_id}` : 'общая лента'}`);
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
    log(`вечерняя тревога: ${list.length}`);
  }

  /* ---------- проекты: сроки и файлы ---------- */

  const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  /** «сегодня» или «с 3 окт» — срок прошёл, и видно, давно ли. */
  const dueLabel = (dueOn: string | null, today: string) => {
    if (!dueOn || dueOn === today) return 'сегодня';
    const [, m, d] = dueOn.split('-').map(Number);
    return `с ${d} ${MON[m! - 1]}`;
  };

  /** Сроки дня: задачи по исполнителям, каждый отмечен; этапы — с отметкой того, кто ведёт проект. */
  function deadlineLines(due: Deadlines, today: string) {
    const lines: string[] = [];
    const byPerson = new Map<number | null, Deadlines['tasks']>();
    for (const t of due.tasks) byPerson.set(t.assigneeId, [...(byPerson.get(t.assigneeId) ?? []), t]);
    for (const [, list] of byPerson) {
      const who = list[0]!.assignee;
      lines.push('', who ? mention(who) : 'Без исполнителя');
      for (const t of list) lines.push(`— ${esc(t.title)} · ${esc(t.project)} · ${dueLabel(t.dueOn, today)}`);
    }
    if (due.stages.length) {
      lines.push('', 'Этапы');
      for (const st of due.stages) {
        lines.push(`— «${esc(st.title)}» · ${esc(st.project)} · ${dueLabel(st.dueOn, today)}${st.owner ? ` · ${mention(st.owner)}` : ''}`);
      }
    }
    return lines;
  }

  const WEEKDAY = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  /** «2026-10-05» → «5 окт». */
  const dayLabel = (day: string) => {
    const [, m, d] = day.split('-').map(Number);
    return `${d} ${MON[m! - 1]}`;
  };
  /** Номер заявки ссылкой на её карточку в группе. */
  const leadRef = (l: Pick<Lead, 'id' | 'cardChatId' | 'cardMessageId'>) => {
    const link = cardLink(l);
    return link ? `<a href="${link}">#${l.id}</a>` : `#${l.id}`;
  };
  const MORE = 8;
  const more = (n: number) => (n > MORE ? [`…и ещё ${n - MORE}`] : []);

  /**
   * Утренняя сводка — одним сообщением в начале рабочего дня: кому не
   * ответили, что стоит без движения, чьи сроки сегодня. Нечего сказать —
   * молчит: сообщение «всё спокойно» каждое утро перестают читать.
   * Отмечаются только исполнители задач: остальное — к сведению.
   */
  async function morningDigest(m: Morning, today: string) {
    const group = await getGroup(db);
    const hasDue = m.due.tasks.length > 0 || m.due.stages.length > 0;
    if (!group || (!m.waiting.length && !m.stale.length && !hasDue)) return false;

    const dow = WEEKDAY[new Date(`${today}T00:00:00Z`).getUTCDay()];
    const lines: string[] = [`<b>Утро, ${dow} ${dayLabel(today)}</b>`];
    if (m.arrived) lines.push(`Заявок с прошлого рабочего дня: ${m.arrived}`);

    if (m.waiting.length) {
      lines.push('', `<b>Ждут ответа — ${m.waiting.length}</b>`);
      for (const l of m.waiting.slice(0, MORE)) {
        lines.push(`— ${leadRef(l)} ${esc(l.name)} · ${esc(KIND_LABEL[l.kind] ?? l.kind)} · ${l.ownerName ? `ведёт ${esc(l.ownerName)}` : 'никто не взял'}`);
      }
      lines.push(...more(m.waiting.length));
    }

    if (m.stale.length) {
      lines.push('', `<b>Без движения — ${m.stale.length}</b>`);
      for (const l of m.stale.slice(0, MORE)) {
        lines.push(`— ${leadRef(l)} ${esc(l.name)} · ${STAGE_LABEL[l.stage]} · ${l.idleDays} раб. дн.${l.ownerName ? ` · ${esc(l.ownerName)}` : ''}`);
      }
      lines.push(...more(m.stale.length));
    }

    if (hasDue) lines.push('', '<b>Сроки на сегодня</b>', ...deadlineLines(m.due, today).slice(1));

    await bot.api.sendMessage(group.chatId, lines.join('\n'), {
      parse_mode: 'HTML',
      message_thread_id: group.threadId ?? undefined,
      link_preview_options: { is_disabled: true }
    });
    log(`утренняя сводка: ждут ${m.waiting.length}, без движения ${m.stale.length}, задач ${m.due.tasks.length}, этапов ${m.due.stages.length}`);
    return true;
  }

  const minutes = (min: number) => (min < 60 ? `${min} мин` : `${Math.floor(min / 60)} ч${min % 60 ? ` ${min % 60} мин` : ''}`);

  /**
   * Итоги недели — в её первый рабочий день: те же цифры, что в приложении,
   * за прошлую неделю. Никого не отмечает. Пустую неделю без проектов пропускает.
   */
  async function weeklyDigest({ monday, sunday, metrics: x }: Weekly) {
    const group = await getGroup(db);
    if (!group || (!x.leads.total && !x.projects.active && !x.projects.done)) return false;

    const lines: string[] = [`<b>Итоги недели · ${dayLabel(monday)} – ${dayLabel(sunday)}</b>`, ''];
    lines.push(`Заявок: ${x.leads.total}${x.previous ? ` (неделей раньше — ${x.previous.total})` : ''}`);
    if (x.leads.total) {
      const steps = x.funnel.slice(1).map((f) => `${STAGE_LABEL[f.stage].toLowerCase()} ${f.reached}`);
      lines.push(`Дошли: ${steps.join(' · ')}`);
      const reasons = x.lostReasons.map((r) => `${r.label.toLowerCase()} — ${r.count}`).join(', ');
      lines.push(`Договоров: ${x.leads.won} · отказов: ${x.leads.lost}${reasons ? ` (${reasons})` : ''}`);
      if (x.firstReply.medianMin !== null) {
        lines.push(`Первый ответ: обычно за ${minutes(x.firstReply.medianMin)}, в срок — ${x.firstReply.withinSla} из ${x.firstReply.answered}`);
      }
      if (x.firstReply.waiting) lines.push(`Без ответа до сих пор: ${x.firstReply.waiting}`);
      lines.push(`Откуда: ${x.bySource.slice(0, 5).map((s) => `${esc(s.label)} — ${s.count}`).join(', ')}`);
    }
    const p = x.projects;
    const late = p.overdueTasks + p.overdueStages;
    lines.push(`Проекты: в работе ${p.active}${p.done ? `, завершено за неделю ${p.done}` : ''}${late ? `, просрочено задач и этапов — ${late}` : ''}`);

    await bot.api.sendMessage(group.chatId, lines.join('\n'), {
      parse_mode: 'HTML',
      message_thread_id: group.threadId ?? undefined,
      link_preview_options: { is_disabled: true }
    });
    log(`итоги недели ${monday}: заявок ${x.leads.total}`);
    return true;
  }

  /** Файл проекта хранится в самом Telegram — бот присылает его в личку по file_id. */
  async function sendFile(tgId: number, m: Material) {
    if (!m.fileId) return;
    const other = { caption: m.title };
    switch (m.fileKind) {
      case 'photo':
        return bot.api.sendPhoto(tgId, m.fileId, other);
      case 'video':
        return bot.api.sendVideo(tgId, m.fileId, other);
      case 'audio':
        return bot.api.sendAudio(tgId, m.fileId, other);
      case 'voice':
        return bot.api.sendVoice(tgId, m.fileId, other);
      default:
        return bot.api.sendDocument(tgId, m.fileId, other);
    }
  }

  /** Что за файл в сообщении: документ, фото (берём самое большое), видео, звук. */
  function fileOf(msg: Message | undefined): NewFile | null {
    if (!msg) return null;
    const title = msg.caption?.trim() || undefined;
    if (msg.document) return { fileId: msg.document.file_id, fileKind: 'document', fileName: msg.document.file_name ?? null, fileSize: msg.document.file_size ?? null, title };
    if (msg.photo?.length) {
      const p = msg.photo[msg.photo.length - 1]!;
      return { fileId: p.file_id, fileKind: 'photo', fileName: 'Фото', fileSize: p.file_size ?? null, title };
    }
    if (msg.video) return { fileId: msg.video.file_id, fileKind: 'video', fileName: msg.video.file_name ?? 'Видео', fileSize: msg.video.file_size ?? null, title };
    if (msg.audio) return { fileId: msg.audio.file_id, fileKind: 'audio', fileName: msg.audio.file_name ?? msg.audio.title ?? 'Аудио', fileSize: msg.audio.file_size ?? null, title };
    if (msg.voice) return { fileId: msg.voice.file_id, fileKind: 'voice', fileName: 'Голосовое', fileSize: msg.voice.file_size ?? null, title };
    return null;
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
    'Файл к проекту — перешлите его сюда, в личку: спрошу, к какому.',
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
    await setMenu(ctx.from!.id);

    // пришли по «Открыть» с карточки в группе — отвечаем кнопкой на эту заявку
    const leadId = Number(payload.match(/^lead_(\d{1,9})$/)?.[1]);
    if (leadId) {
      const r = await render(leadId);
      if (!r) return ctx.reply(`Заявки #${leadId} нет.`);
      const kb = appBase ? new InlineKeyboard().webApp(`Открыть заявку #${leadId}`, `${appBase}leads/${leadId}`) : undefined;
      return ctx.reply(r.text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
    }
    const projectId = Number(payload.match(/^project_(\d{1,9})$/)?.[1]);
    if (projectId) {
      const p = await getProject(db, projectId);
      if (!p) return ctx.reply(`Проекта #${projectId} нет.`);
      const kb = appBase ? new InlineKeyboard().webApp('Открыть проект', `${appBase}projects/${projectId}`) : undefined;
      return ctx.reply(`<b>${esc(p.title)}</b>`, { parse_mode: 'HTML', reply_markup: kb });
    }
    return ctx.reply(appBase ? `${HELP}\n\nВсё то же и подробнее — в приложении: кнопка «Студия» слева от поля ввода.` : HELP, { parse_mode: 'HTML' });
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

  /** «К какому проекту?» — ответ на файл, присланный в личку. Сам файл — в сообщении, на которое отвечали. */
  bot.callbackQuery(/^m:(\d{1,9})$/, async (ctx) => {
    if (!ctx.member) return ctx.answerCallbackQuery({ text: 'Кнопки — только для команды.', show_alert: true });
    const projectId = Number(ctx.match[1]);
    if (!projectId) {
      await ctx.editMessageText('Не прикрепляю.');
      return ctx.answerCallbackQuery();
    }
    const file = fileOf(ctx.callbackQuery.message?.reply_to_message);
    const m = file ? await addFile(db, projectId, ctx.member.id, file, now()) : null;
    if (!m) {
      await ctx.editMessageText('Не получилось: файла или проекта уже нет. Пришлите файл ещё раз.');
      return ctx.answerCallbackQuery();
    }
    const p = await getProject(db, projectId);
    log(`проект #${projectId}: файл — участник ${ctx.member.id}`);
    await ctx.editMessageText(`Прикреплено к проекту «${esc(p?.title ?? '')}»: ${esc(m.title)}`, {
      parse_mode: 'HTML',
      reply_markup: appBase ? new InlineKeyboard().webApp('Открыть проект', `${appBase}projects/${projectId}`) : undefined
    });
    return ctx.answerCallbackQuery({ text: 'Прикреплено' });
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
        await reopenLead(db, p.id, me.id, at);
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

  /** Файл в личку от своего — материал проекта: спрашиваем, какого. */
  bot.on('message', async (ctx, next) => {
    if (ctx.chat.type !== 'private' || !ctx.member || !fileOf(ctx.msg)) return next();
    const list = (await listProjects(db, 'active', dayKey(now(), tz))).slice(0, 12);
    if (!list.length) return ctx.reply('Проектов в работе нет — прикрепить не к чему. Проект заводится из заявки на «Договоре» или в приложении.');
    const kb = new InlineKeyboard();
    for (const p of list) kb.text(p.title.slice(0, 48), `m:${p.id}`).row();
    kb.text('Не прикреплять', 'm:0');
    return ctx.reply('К какому проекту прикрепить?', { reply_markup: kb, reply_parameters: { message_id: ctx.msg.message_id } });
  });

  bot.on('message', async (ctx) => {
    if (ctx.chat.type === 'private' && !ctx.member) await outsider(ctx);
  });

  bot.catch((err) => console.error('[bot]', err.error));

  return { bot, publishLead, publishPending, refreshCard, remind, alarm, morningDigest, weeklyDigest, sendFile, syncMenu, syncCards };
}

/** Ссылка на карточку в супергруппе: t.me/c/<id без -100>/<сообщение>. */
export function cardLink(l: Pick<Lead, 'cardChatId' | 'cardMessageId'>) {
  if (!l.cardChatId || !l.cardMessageId) return null;
  const s = String(l.cardChatId);
  if (!s.startsWith('-100')) return null;
  return `https://t.me/c/${s.slice(4)}/${l.cardMessageId}`;
}
