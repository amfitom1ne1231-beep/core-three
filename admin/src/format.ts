import type { Day, LeadEvent, Me, ProjectEvent, ProjectStatus } from './api';

/**
 * Время и подписи. Время показывается в поясе студии — том же, что
 * на карточках в группе: «14:32» в приложении и в чате должно совпадать,
 * где бы ни находился телефон.
 */

const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function parts(date: Date, tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    fmtCache.set(tz, f);
  }
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(date)) p[part.type] = part.value;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), time: `${Number(p.hour)}:${p.minute}` };
}

const dayKey = (p: { y: number; m: number; d: number }) => `${p.y}-${p.m}-${p.d}`;

/** «14:32», «вчера, 14:32», «3 окт, 14:32» — как на карточке в группе. */
export function shortTime(iso: string, tz: string, now = new Date()) {
  const p = parts(new Date(iso), tz);
  const key = dayKey(p);
  if (key === dayKey(parts(now, tz))) return p.time;
  if (key === dayKey(parts(new Date(now.getTime() - 86400000), tz))) return `вчера, ${p.time}`;
  return `${p.d} ${MON[p.m - 1]}, ${p.time}`;
}

/** День без времени — для закрытых заявок в списке. */
export function shortDay(iso: string, tz: string, now = new Date()) {
  const p = parts(new Date(iso), tz);
  const key = dayKey(p);
  if (key === dayKey(parts(now, tz))) return 'сегодня';
  if (key === dayKey(parts(new Date(now.getTime() - 86400000), tz))) return 'вчера';
  return `${p.d} ${MON[p.m - 1]}`;
}

/** Сколько заявка ждёт: «5 мин», «2 ч», «3 дн». */
export function age(iso: string, now = new Date()) {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'сейчас';
  if (min < 60) return `${min} мин`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} ч`;
  return `${Math.floor(min / 1440)} дн`;
}

export type ContactLink = { kind: 'tg' | 'phone' | 'mail' | 'text'; href: string | null; label: string };

/** Контакт из заявки — одно поле на выбор; делаем из него ссылку, по которой можно ответить. */
export function contactLink(contact: string): ContactLink {
  const c = contact.trim();
  const tg = c.match(/^(?:@|(?:https?:\/\/)?t\.me\/)?([a-zA-Z][a-zA-Z0-9_]{4,31})$/);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)) return { kind: 'mail', href: `mailto:${c}`, label: c };
  if ((c.match(/\d/g) ?? []).length >= 7 && /^[\d\s()+\-.]+$/.test(c)) return { kind: 'phone', href: `tel:${c.replace(/[^\d+]/g, '')}`, label: c };
  if (tg) return { kind: 'tg', href: `https://t.me/${tg[1]}`, label: `@${tg[1]}` };
  return { kind: 'text', href: null, label: c };
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Строка истории: кто и что сделал. Заметка возвращается отдельно — её показывают целиком. */
export function eventText(e: LeadEvent, dict: Me['dict']): { text: string; note?: string } {
  const who = e.who ?? 'Кто-то';
  const stage = (id: unknown) => dict.stages.find((s) => s.id === id)?.label ?? str(id);
  switch (e.type) {
    case 'created': {
      const source = str(e.data?.source) as keyof Me['dict']['sources'];
      return { text: source === 'manual' ? 'Заявку завели вручную' : `Заявка пришла ${dict.sources[source] ?? ''}`.trim() };
    }
    case 'taken':
      return { text: `${who} — ведёт заявку` };
    case 'released':
      return { text: 'Заявка снова ничья' };
    case 'stage':
      return { text: `${who}: этап «${stage(e.data?.to)}»` };
    case 'reopened':
      return { text: `${who}: снова в работе, этап «${stage(e.data?.to)}»` };
    case 'lost':
      return { text: `${who}: отказ — ${str(e.data?.label) || str(e.data?.reason)}` };
    case 'note':
      return { text: who, note: str(e.data?.text) };
    case 'reminded':
      return { text: 'Бот напомнил группе: заявку никто не взял' };
    case 'alarmed':
      return { text: 'Бот предупредил владельцев: клиенту не ответили к вечеру' };
  }
}

/* ---------- проекты ---------- */

export const PROJECT_STATUS: Record<ProjectStatus, string> = {
  active: 'В работе',
  paused: 'На паузе',
  done: 'Завершён',
  cancelled: 'Отменён'
};

/** Сегодняшний день в поясе студии — от него считаются «сегодня» и «просрочено». */
export function todayIn(tz: string, now = new Date()): Day {
  const p = parts(now, tz);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

const dayDiff = (a: Day, b: Day) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

/** Срок рядом с сегодняшним днём: «сегодня», «завтра», «вчера», «3 окт». */
export function dueLabel(day: Day, today: Day) {
  const diff = dayDiff(day, today);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === -1) return 'вчера';
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MON[m! - 1]}${y !== Number(today.slice(0, 4)) ? ` ${y}` : ''}`;
}

export const isOverdue = (day: Day | null, today: Day) => !!day && day < today;

export function fileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1048576).toFixed(1).replace('.', ',')} МБ`;
}

/** «1 задача», «2 задачи», «5 задач». */
export function plural(n: number, one: string, few: string, many: string) {
  const tens = n % 100;
  const ones = n % 10;
  if (tens > 10 && tens < 20) return many;
  if (ones === 1) return one;
  if (ones >= 2 && ones <= 4) return few;
  return many;
}

/** Строка истории проекта. */
export function projectEventText(e: ProjectEvent): string {
  const who = e.who ?? 'Кто-то';
  const title = `«${str(e.data?.title)}»`;
  switch (e.type) {
    case 'created':
      return e.data?.leadId ? `Проект вырос из заявки #${String(e.data.leadId)}` : `${who}: проект заведён`;
    case 'status':
      return `${who}: ${{ active: 'проект снова в работе', paused: 'проект на паузе', done: 'проект завершён', cancelled: 'проект отменён' }[str(e.data?.to)] ?? 'состояние изменено'}`;
    case 'stage_done':
      return `${who}: этап ${title} выполнен`;
    case 'stage_reopened':
      return `${who}: этап ${title} снова в работе`;
    case 'stage_added':
      return `${who}: добавлен этап ${title}`;
    case 'stage_removed':
      return `${who}: удалён этап ${title}`;
    case 'task_added':
      return `${who}: задача ${title}`;
    case 'task_done':
      return `${who}: выполнена ${title}`;
    case 'task_reopened':
      return `${who}: снова открыта ${title}`;
    case 'task_removed':
      return `${who}: удалена задача ${title}`;
    case 'material_added':
      return `${who}: ${e.data?.kind === 'file' ? 'файл' : 'ссылка'} ${title}`;
    case 'material_removed':
      return `${who}: удалён материал ${title}`;
    case 'secret_added':
      return `${who}: добавлен доступ ${title}`;
    case 'secret_changed':
      return `${who}: изменён доступ ${title}`;
    case 'secret_viewed':
      return `${who}: просмотр доступа ${title}`;
    case 'secret_removed':
      return `${who}: удалён доступ ${title}`;
    default:
      return who;
  }
}

const WEEKDAY = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** «пн · 6 окт» — день в шапке «Сегодня». */
export function dayTitle(day: Day) {
  const [, m, d] = day.split('-').map(Number);
  return `${WEEKDAY[new Date(`${day}T00:00:00Z`).getUTCDay()]} · ${d} ${MON[m! - 1]}`;
}

/** Минуты от полуночи ↔ «10:00» — для полей времени в настройках. */
export const clock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m! : null;
};

/** «час», «30 мин», «1 ч 30 мин» — теми же словами, что бот. */
export function span(min: number) {
  if (min === 60) return 'час';
  if (min < 60) return `${min} мин`;
  return min % 60 ? `${Math.floor(min / 60)} ч ${min % 60} мин` : `${min / 60} ч`;
}

