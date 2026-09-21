/**
 * Палитра «Мотка».
 *
 * Холодная светлая: «Сорока» тёплая и бумажная, «Лавка» тёмная
 * и приборная. Третье демо уходит в третью сторону — белый магазин
 * с одним густым цветом, чтобы товар на витрине был единственным
 * ярким пятном. У магазина пряжи это не приём, а условие: цвет —
 * и есть товар.
 *
 * Контраст к обеим подложкам: ink 15,9:1, muted 6,7:1, faint 5,3:1,
 * accent 8,2:1, белый на accent 8,6:1.
 */
export const C = {
  paper: '#f7f8fa',
  paperDeep: '#eef0f4',
  card: '#ffffff',
  ink: '#16181d',
  muted: '#575d69',
  faint: '#646b78',
  accent: '#5b3a8c',
  ok: '#2f6b46',
  warn: '#9a5a12',
  line: 'rgba(22,24,29,0.12)',
  lineSoft: 'rgba(22,24,29,0.07)'
} as const;

export const DISPLAY = "var(--shop-display), system-ui, sans-serif";
export const TEXT = "var(--shop-text), system-ui, sans-serif";

/** Цена всегда с неразрывным пробелом перед рублём: перенос уродует строку. */
export const money = (v: number) => `${v.toLocaleString('ru-RU')} ₽`;

export function plural(n: number, one: string, few: string, many: string) {
  const d = n % 10;
  const dd = n % 100;
  if (dd >= 11 && dd <= 14) return many;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Разбор #rrggbb в каналы. Цвета приходят из каталога и всегда в этом виде. */
export function rgbOf(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Светлота по sRGB — по ней решаем, темнить нить или светлить. */
export function lumaOf(hex: string) {
  const [r, g, b] = rgbOf(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** k < 1 — темнее, k > 1 — светлее. Нить мотка красится от цвета самой пряжи. */
export function shade(hex: string, k: number) {
  const [r, g, b] = rgbOf(hex);
  return `#${[r * k, g * k, b * k].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Нить на мотке: у светлой пряжи темнее самой пряжи, у тёмной — светлее.
 * Без этого «Графит» превращался в чёрный круг без фактуры.
 */
export function strandOf(hex: string) {
  return lumaOf(hex) > 0.45 ? shade(hex, 0.72) : shade(hex, 1.55);
}

/** Кромка мотка на белой карточке: у «Молока» без неё пропадал силуэт. */
export function edgeOf(hex: string) {
  return lumaOf(hex) > 0.82 ? shade(hex, 0.84) : 'transparent';
}

export type StockLevel = 'ok' | 'low' | 'out';

/** Порог «мало» — три мотка: на свитер не хватит, и это надо сказать заранее. */
export function stockOf(left: number): StockLevel {
  if (left <= 0) return 'out';
  if (left <= 3) return 'low';
  return 'ok';
}
