import { InlineKeyboard } from 'grammy';
import type { Stage } from '../db/schema';
import type { LeadView, Member } from '../domain/leads';
import { CLOSED, FUNNEL, KIND_LABEL, LOST_REASONS, SOURCE_LABEL, STAGE_LABEL, type LostReason } from '../domain/stages';
import { shortTime } from '../domain/worktime';

/**
 * Карточка заявки в рабочей группе. Одно сообщение на заявку, и бот
 * правит его на месте: этап, кто ведёт, последние заметки. Лента группы
 * не превращается в поток «Илья взял заявку», «Илья сменил этап».
 *
 * Разметка — HTML: в имени и брифе может быть что угодно, поэтому всё
 * пользовательское экранируется.
 */

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Упоминание, которое Telegram доставит уведомлением. */
export const mention = (m: Pick<Member, 'tgId' | 'name'>) => `<a href="tg://user?id=${m.tgId}">${esc(m.name)}</a>`;

/** Ник в Telegram — ссылкой; телефон и почту клиенты Telegram подсвечивают сами. */
export function contactHtml(contact: string) {
  const c = contact.trim();
  const tg = c.match(/^(?:@|(?:https?:\/\/)?t\.me\/)([a-zA-Z][\w]{3,31})$/);
  if (tg) return `<a href="https://t.me/${tg[1]}">@${esc(tg[1]!)}</a>`;
  return esc(c);
}

export type Menu = 'main' | 'stages' | 'lost';

/** Данные кнопки: `l:<заявка>:<действие>[:<аргумент>]` — в пределах 64 байт Telegram. */
export const cb = (id: number, act: string, arg?: string) => `l:${id}:${act}${arg ? `:${arg}` : ''}`;

export function parseCb(data: string): { id: number; act: string; arg?: string } | null {
  const m = data.match(/^l:(\d+):([a-z]+)(?::([a-z_]+))?$/);
  if (!m) return null;
  return { id: Number(m[1]), act: m[2]!, arg: m[3] };
}

const TASK_MAX = 1400;

export function cardText(v: LeadView, now: Date, tz: string) {
  const { lead, owner, notes } = v;
  const lines: string[] = [];
  lines.push(
    `<b>#${lead.id} · ${esc(KIND_LABEL[lead.kind] ?? lead.kind)}</b> · ${SOURCE_LABEL[lead.source]} · ${shortTime(lead.createdAt, now, tz)}`
  );
  lines.push(`<b>${esc(lead.name)}</b> · ${contactHtml(lead.contact)}`);
  // «Мы напишем сами»: звонок был бы ровно тем, чего человек не просил
  if (lead.source === 'help') lines.push('<b>Нужна помощь</b> — написать по номеру в Telegram, Max или WhatsApp, не звонить');
  if (lead.spam) lines.push('', '<i>Сработала ловушка для ботов. Проверьте: она ошибается на тех, кто вставил текст из буфера.</i>');

  const task = lead.task.length > TASK_MAX ? `${lead.task.slice(0, TASK_MAX)}…` : lead.task;
  lines.push('', `<blockquote expandable>${esc(task)}</blockquote>`);
  if (lead.page) lines.push(`Страница: ${esc(lead.page)}`);

  let status = `<b>${STAGE_LABEL[lead.stage]}</b>`;
  if (lead.stage === 'lost' && lead.lostReason) status += `: ${esc(LOST_REASONS[lead.lostReason as LostReason] ?? lead.lostReason)}`;
  status += owner ? ` · ведёт ${esc(owner.name)}` : ' · никто не взял';
  lines.push('', status);
  if (v.project) lines.push(`Проект: ${esc(v.project.title)}`);

  for (const n of notes.slice(0, 2).reverse()) {
    const text = n.text.length > 300 ? `${n.text.slice(0, 300)}…` : n.text;
    lines.push(`— ${n.who ? `${esc(n.who)}: ` : ''}${esc(text)}`);
  }
  return lines.join('\n');
}

/**
 * `open` — ссылка «Открыть» на заявку в мини-приложении; её нет, пока
 * у сервиса нет публичного адреса.
 */
export function cardKeyboard(v: LeadView, menu: Menu = 'main', open?: string | null) {
  const { lead } = v;
  const kb = new InlineKeyboard();
  const id = lead.id;

  if (menu === 'stages') {
    FUNNEL.filter((s) => s !== lead.stage).forEach((s, i) => {
      kb.text(STAGE_LABEL[s], cb(id, 'st', s));
      if (i % 2 === 1) kb.row();
    });
    return kb.row().text('‹ Назад', cb(id, 'back'));
  }

  if (menu === 'lost') {
    (Object.keys(LOST_REASONS) as LostReason[]).forEach((r, i) => {
      kb.text(LOST_REASONS[r], cb(id, 'lr', r));
      if (i % 2 === 1) kb.row();
    });
    return kb.row().text('‹ Назад', cb(id, 'back'));
  }

  if (CLOSED.includes(lead.stage)) {
    kb.text('Вернуть в работу', cb(id, 'reopen')).text('Заметка', cb(id, 'note'));
  } else {
    if (!lead.ownerId) kb.text('Беру', cb(id, 'take'));
    kb.text(nextStepLabel(lead.stage), cb(id, 'st', nextStage(lead.stage))).row();
    kb.text('Этап…', cb(id, 'stages')).text('Заметка', cb(id, 'note')).text('Отказ', cb(id, 'lost'));
  }
  if (open) kb.row().url('Открыть', open);
  return kb;
}

/** Самое частое действие — шаг вперёд по воронке — одной кнопкой. */
export function nextStage(stage: Stage): Stage {
  const i = FUNNEL.indexOf(stage);
  return FUNNEL[Math.min(i + 1, FUNNEL.length - 1)]!;
}

const nextStepLabel = (stage: Stage) => `→ ${STAGE_LABEL[nextStage(stage)]}`;
