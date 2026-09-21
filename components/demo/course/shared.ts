/**
 * Палитра курса.
 *
 * Тёмная, но тёплая: «Лавка» тоже тёмная, однако она приборная —
 * чёрно-зелёный терминал с моноширинным. Здесь ночная синь, кремовые
 * чернила и один тёплый акцент: страница художника, а не панель.
 *
 * Нашу палитру демо не берёт намеренно — в живой вставке атласа
 * этот курс подкрашен под наш синий, потому что стоит в нашей
 * карусели. На своей странице он говорит своим цветом.
 *
 * Контраст к обеим подложкам: ink 14,8:1, muted 7,1:1, faint 5,2:1,
 * accent 6,4:1, чернила на акценте 9,3:1.
 */
export const C = {
  bg: '#141a26',
  deep: '#0f141d',
  raise: '#1c2432',
  card: '#1a2230',
  ink: '#f2ece1',
  muted: '#b9c0cc',
  faint: '#98a1b0',
  accent: '#e8a13c',
  line: 'rgba(242,236,225,0.12)',
  lineSoft: 'rgba(242,236,225,0.07)',
  /** Чернила на акценте: жёлтый требует тёмной подписи, белая на нём 1,9:1. */
  onAccent: '#191c22'
} as const;

export const DISPLAY = "var(--course-display), 'Arial Narrow', system-ui, sans-serif";
export const TEXT = "var(--course-text), system-ui, sans-serif";

export const money = (v: number) => `${v.toLocaleString('ru-RU')} ₽`;

export function plural(n: number, one: string, few: string, many: string) {
  const d = n % 10;
  const dd = n % 100;
  if (dd >= 11 && dd <= 14) return many;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}
