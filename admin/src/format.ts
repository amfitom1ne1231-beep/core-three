import type { LeadEvent, Me } from './api';

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
