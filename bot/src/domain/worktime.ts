/**
 * Рабочее время студии: сроки по заявкам считаются только в нём.
 * Заявка, пришедшая в пятницу в 23:00, не должна будить команду ночью
 * и «просрочиться» к утру субботы — её час начинается в понедельник в 10:00.
 *
 * Всё считается в поясе студии (WORK_TZ), а не в поясе сервера.
 */

export type WorkHours = {
  tz: string;
  /** Дни недели, 0 — воскресенье. */
  days: number[];
  /** Начало и конец дня, минуты от местной полуночи. */
  start: number;
  end: number;
};

export type LocalParts = { y: number; m: number; d: number; dow: number; min: number };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Местные дата, день недели и минута суток. */
export function localParts(date: Date, tz: string): LocalParts {
  const p: Record<string, string> = {};
  for (const part of fmt(tz).formatToParts(date)) p[part.type] = part.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    dow: DOW[p.weekday ?? 'Mon'] ?? 1,
    min: Number(p.hour) * 60 + Number(p.minute)
  };
}

/** «2026-10-05» в поясе студии — ключ дня для расписаний. */
export function dayKey(date: Date, tz: string) {
  const { y, m, d } = localParts(date, tz);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Мгновение, когда в поясе tz на дату y-m-d наступает минута `min`. */
export function zoned(y: number, m: number, d: number, min: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, 0, min);
  // смещение пояса в этот момент; второй проход — на случай перехода на летнее время
  let at = guess;
  for (let i = 0; i < 2; i++) {
    const lp = localParts(new Date(at), tz);
    const asUtc = Date.UTC(lp.y, lp.m - 1, lp.d, 0, lp.min);
    at = guess - (asUtc - at);
  }
  return new Date(at);
}

export function isWorkTime(date: Date, w: WorkHours) {
  const p = localParts(date, w.tz);
  return w.days.includes(p.dow) && p.min >= w.start && p.min < w.end;
}

/** Сколько рабочих минут прошло между двумя моментами. */
export function workMinutesBetween(from: Date, to: Date, w: WorkHours): number {
  if (to <= from) return 0;
  let total = 0;
  const first = localParts(from, w.tz);
  // идём по местным дням: у каждого — окно [start, end), пересекаем с [from, to)
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.UTC(first.y, first.m - 1, first.d + i));
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    const open = zoned(y, m, d, w.start, w.tz);
    if (open >= to) break;
    if (!w.days.includes(day.getUTCDay())) continue;
    const close = zoned(y, m, d, w.end, w.tz);
    const a = Math.max(open.getTime(), from.getTime());
    const b = Math.min(close.getTime(), to.getTime());
    if (b > a) total += (b - a) / 60000;
  }
  return Math.floor(total);
}

/** «14:32» или «вчера, 14:32» / «3 окт, 14:32» — для карточек. */
export function shortTime(date: Date, now: Date, tz: string) {
  const p = localParts(date, tz);
  const t = `${Math.floor(p.min / 60)}:${String(p.min % 60).padStart(2, '0')}`;
  const today = dayKey(now, tz);
  const that = dayKey(date, tz);
  if (that === today) return t;
  const yesterday = dayKey(new Date(now.getTime() - 86400000), tz);
  if (that === yesterday) return `вчера, ${t}`;
  const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${p.d} ${MON[p.m - 1]}, ${t}`;
}
