/**
 * Расписание барбершопа из демо «Бритва».
 *
 * Занятость мастеров не нарисована, а выращена из даты: один и тот же
 * день у всех выглядит одинаково и не прыгает между перезагрузками.
 * Окна в мини-приложении считаются по той же сетке, что стоит в панели
 * владельца, — поэтому запись встаёт ровно в ту дыру, которую видел
 * клиент.
 */

import type { Master, Service } from '../content/concepts/barber';

/**
 * Салон, по которому считается расписание. Данные приходят параметром,
 * а не импортом: так модуль собирается в тесты без бандлера.
 */
export type Book = {
  masters: Master[];
  services: Service[];
  clients: string[];
  /** Часы работы, минуты от полуночи. */
  open: number;
  close: number;
};

/** Шаг сетки окон, минуты. */
export const STEP = 30;

export type Busy = {
  id: string;
  master: string;
  /** Начало, минуты от полуночи. */
  start: number;
  min: number;
  service: string;
  client: string;
};

/** Детерминированный генератор: одно зерно — одна и та же последовательность. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Число вида 20261010: зерно дня. */
export const dateKey = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

/** Что чаще записывают: стрижку, потом комплекс, бритьё реже всего. */
const WEIGHTS: Record<string, number> = { cut: 5, combo: 3, beard: 2, buzz: 2, shave: 1 };

function pickService(services: Service[], rnd: () => number): Service {
  const total = services.reduce((s, x) => s + (WEIGHTS[x.id] ?? 1), 0);
  let r = rnd() * total;
  for (const s of services) {
    r -= WEIGHTS[s.id] ?? 1;
    if (r < 0) return s;
  }
  return services[0];
}

/** Записи дня у всех мастеров: без наложений, в пределах часов работы. */
export function seedDay(book: Book, date: Date): Busy[] {
  const key = dateKey(date);
  const out: Busy[] = [];
  book.masters.forEach((m, mi) => {
    const rnd = mulberry32(key * 7 + mi * 101);
    let t = book.open;
    let n = 0;
    while (t < book.close) {
      if (rnd() < m.load) {
        const s = pickService(book.services, rnd);
        if (t + s.min <= book.close) {
          out.push({
            id: `${key}-${m.id}-${n++}`,
            master: m.id,
            start: t,
            min: s.min,
            service: s.id,
            client: book.clients[Math.floor(rnd() * book.clients.length)]
          });
          t += s.min;
          continue;
        }
      }
      t += STEP;
    }
  });
  return out;
}

/**
 * Свободные начала для услуги длиной `min` у мастера. `notBefore` —
 * сегодня записаться можно не раньше чем через час; `skip` — своя запись
 * при переносе: она не должна загораживать сама себя.
 */
export function freeStarts(
  book: Book,
  busy: Busy[],
  master: string,
  min: number,
  notBefore = 0,
  skip?: string
): number[] {
  const taken = busy.filter((b) => b.master === master && b.id !== skip);
  const from = Math.max(book.open, Math.ceil(notBefore / STEP) * STEP);
  const out: number[] = [];
  for (let t = from; t + min <= book.close; t += STEP) {
    if (taken.every((b) => t + min <= b.start || t >= b.start + b.min)) out.push(t);
  }
  return out;
}

/**
 * «Любой мастер»: для каждого окна — первый свободный по порядку
 * в списке мастеров, то есть самый доступный по цене.
 */
export function anyStarts(book: Book, busy: Busy[], min: number, notBefore = 0, skip?: string): Map<number, string> {
  const out = new Map<number, string>();
  book.masters.forEach((m) => {
    freeStarts(book, busy, m.id, min, notBefore, skip).forEach((t) => {
      if (!out.has(t)) out.set(t, m.id);
    });
  });
  return new Map([...out.entries()].sort((a, b) => a[0] - b[0]));
}

/** Цена у мастера: надбавка старшего, округление до сотни. */
export function priceFor(service: Service, master: Master) {
  return Math.round((service.price * master.k) / 100) * 100;
}

/** С какой минуты сегодня ещё можно записаться: через час от «сейчас». */
export const notBeforeToday = (now: Date) => now.getHours() * 60 + now.getMinutes() + 60;

export const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const DOW_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** «пт» */
export const dow = (d: Date) => DOW[d.getDay()];
/** «пятница, 10 октября» */
export const dayLong = (d: Date) => `${DOW_FULL[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;
/** «пт, 10 октября»; сегодня и завтра — словами */
export function dayShort(d: Date, offset: number) {
  if (offset === 0) return 'сегодня';
  if (offset === 1) return 'завтра';
  return `${DOW[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;
}

/** Цена с неразрывным пробелом перед рублём: перенос уродует строку. */
export const money = (v: number) => `${v.toLocaleString('ru-RU')} ₽`;

export function plural(n: number, one: string, few: string, many: string) {
  const d = n % 10;
  const dd = n % 100;
  if (dd >= 11 && dd <= 14) return many;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}

/** «1 ч 30 мин», «45 мин» */
export function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
