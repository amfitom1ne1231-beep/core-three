import { INCIDENTS, type Health, type Incident } from '@/content/concepts/status';

/**
 * Палитра демо. Своя, не наша: демо — сайт клиента, и наши токены внутрь
 * не заходят. Жанр узнаваемый — приборная панель: тёмный фон, данные
 * моноширинным, цвет только у состояний.
 *
 * Контраст к фону проверен: dim 8,0:1, faint 5,6:1, состояния 6,1–11,1:1.
 */
export const C = {
  bg: '#080b0a',
  panel: '#0d100f',
  raise: '#121615',
  line: 'rgba(227,236,231,0.09)',
  lineStrong: 'rgba(227,236,231,0.18)',
  fg: '#e3ece7',
  dim: '#9aa8a1',
  faint: '#7d8b85',
  ok: '#3ddc84',
  warn: '#f5b83d',
  err: '#f0605d',
  plan: '#5b9ad6'
} as const;

export const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
export const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const HEALTH_COLOR: Record<Health, string> = {
  ok: C.ok,
  degraded: C.warn,
  down: C.err,
  maintenance: C.plan
};

export const HEALTH_LABEL: Record<Health, string> = {
  ok: 'Работает',
  degraded: 'Работает с перебоями',
  down: 'Не работает',
  maintenance: 'Плановые работы'
};

/** Глубина истории на полосах и в расчёте аптайма. */
export const DAYS = 90;

/**
 * Детерминированный шум. Math.random разошёлся бы между сервером
 * и браузером и сломал бы гидратацию; здесь на одном seed всегда
 * получается один ряд.
 */
export function noise(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Полосы аптайма строятся ровно по журналу инцидентов — ни одной
 * «декоративной» жёлтой клетки. Полоса, под которой нет записи
 * в журнале, означает, что о сбое не рассказали: такая страница
 * вреднее отсутствующей.
 */
export function barsOf(serviceId: string): Health[] {
  const bars: Health[] = Array.from({ length: DAYS }, () => 'ok');
  INCIDENTS.forEach((inc) => {
    if (!inc.services.includes(serviceId)) return;
    const i = DAYS - 1 - inc.daysAgo;
    if (i < 0 || i >= DAYS) return;
    // худшее состояние за день побеждает: за день бывает не один сбой
    const rank: Record<Health, number> = { ok: 0, maintenance: 1, degraded: 2, down: 3 };
    if (rank[inc.kind] > rank[bars[i]]) bars[i] = inc.kind;
  });
  return bars;
}

/**
 * Аптайм. Метод объявлен на самой странице, и это не формальность:
 * «99,99%» без указания, что считали, — цифра ни о чём. Полный отказ
 * считается целиком, перебои — половиной времени, плановые работы,
 * о которых предупредили заранее, не считаются вовсе.
 */
export const MINUTES = DAYS * 24 * 60;

export function downtimeOf(serviceId: string) {
  return INCIDENTS.reduce((sum, inc) => {
    if (!inc.services.includes(serviceId) || inc.daysAgo >= DAYS) return sum;
    if (inc.kind === 'maintenance') return sum;
    return sum + (inc.kind === 'down' ? inc.minutes : inc.minutes / 2);
  }, 0);
}

export function uptimeOf(serviceId: string) {
  return (1 - downtimeOf(serviceId) / MINUTES) * 100;
}

/**
 * «100%» печатается только при нулевом простое.
 *
 * Шесть минут перебоев за 90 дней — это 99,9977%, и при двух знаках после
 * запятой округлилось бы до ровной сотни. Рядом с жёлтой полосой в той же
 * строке такая сотня выглядит подделкой, поэтому знаки добавляются до тех
 * пор, пока число не перестанет притворяться круглым.
 */
export function fmtUptime(serviceId: string) {
  if (downtimeOf(serviceId) === 0) return '100%';
  const v = uptimeOf(serviceId);
  for (const digits of [2, 3, 4]) {
    const s = v.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (!/^100/.test(s)) return `${s}%`;
  }
  return '99,99%';
}

/** «2 дня назад» — склонение обязательное, иначе выдаёт машину. */
export function daysAgoLabel(days: number) {
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  const d = days % 10;
  const dd = days % 100;
  const word = dd >= 11 && dd <= 14 ? 'дней' : d === 1 ? 'день' : d >= 2 && d <= 4 ? 'дня' : 'дней';
  return `${days} ${word} назад`;
}

export function minutesLabel(m: number) {
  if (m < 60) {
    const d = m % 10;
    const dd = m % 100;
    const word = dd >= 11 && dd <= 14 ? 'минут' : d === 1 ? 'минута' : d >= 2 && d <= 4 ? 'минуты' : 'минут';
    return `${m} ${word}`;
  }
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} ч ${rest} мин` : `${h} ч`;
}

export const KIND_LABEL: Record<Incident['kind'], string> = {
  down: 'Отказ',
  degraded: 'Перебои',
  maintenance: 'Плановые работы'
};

/**
 * Время ответа за 90 дней. Ровная линия с суточным дыханием и одним
 * настоящим всплеском — в день инцидента №13, когда каталог тормозил.
 * График и журнал показывают одно и то же событие.
 */
export function latencySeries() {
  const rnd = noise(41);
  const slow = INCIDENTS.find((i) => i.n === 13);
  const slowAt = slow ? DAYS - 1 - slow.daysAgo : -1;
  return Array.from({ length: DAYS }, (_, i) => {
    // перенос на новый сервер (#12) уронил время ответа и оставил его ниже
    const moved = DAYS - 1 - 23;
    const base = i < moved ? 84 : 61;
    const daily = Math.sin(i * 0.9) * 4 + Math.sin(i * 2.3) * 2.5;
    const v = base + daily + (rnd() - 0.5) * 5;
    return i === slowAt ? 900 : v;
  });
}

/**
 * Потолок графика. Всплеск в 900 мс при честной шкале от нуля прижимает
 * всю остальную линию к дну: девяносто дней превращаются в прямую, и
 * график перестаёт что-либо показывать, кроме одного дня. Линия обрезана
 * по 160 мс, а выброс подписан числом — так видно и суточное дыхание,
 * и ступеньку от переезда на новый сервер, и сам всплеск.
 */
export const LAT_CAP = 160;
