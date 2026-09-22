/**
 * Сигналы загрузки для прелоадера. Счётчик идёт по настоящим событиям,
 * а не по таймеру: шрифты и первый кадр шейдера.
 */

let resolveSilk: (() => void) | null = null;

export const silkReady: Promise<void> =
  typeof window === 'undefined'
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        resolveSilk = resolve;
      });

let silkDone = false;

/** Зовётся рантаймом материала после первого отрисованного кадра. */
export function markSilkReady() {
  if (silkDone) return;
  silkDone = true;
  resolveSilk?.();
}

export function isSilkReady() {
  return silkDone;
}

/** Шрифты: без них заголовок дёрнется уже после того, как его показали. */
export function fontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  return document.fonts.ready.then(() => undefined);
}

/* ------------------------------------------------------------------ */

let resolveReveal: (() => void) | null = null;
let revealDone = false;

/** Разрешение показывать контент: прелоадер ушёл (или его не было). */
export const revealReady: Promise<void> =
  typeof window === 'undefined'
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        resolveReveal = resolve;
      });

export function markRevealed() {
  if (revealDone) return;
  revealDone = true;
  resolveReveal?.();
}

export function isRevealed() {
  return revealDone;
}

/** Таймаут-страховка: на скрытой вкладке кадр шейдера может не прийти вовсе. */
export function withTimeout(p: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([
    p.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms))
  ]);
}

/* ------------------------------------------------------------------ */

let resolveLeave: ((rect: DOMRect | null) => void) | null = null;

/**
 * Прелоадер уходит: отдаёт прямоугольник своего знака, чтобы знак
 * первого экрана мог «перелететь» из этой точки. null — прелоадера
 * не было или он снят без анимации.
 */
export const preloaderLeaving: Promise<DOMRect | null> =
  typeof window === 'undefined'
    ? Promise.resolve(null)
    : new Promise((resolve) => {
        resolveLeave = resolve;
      });

export function markLeaving(rect: DOMRect | null) {
  resolveLeave?.(rect);
  resolveLeave = null;
}
