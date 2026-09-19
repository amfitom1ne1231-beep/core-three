import type Lenis from 'lenis';

/**
 * Единая точка программной прокрутки.
 *
 * Пока жив Lenis, нативный window.scrollTo бесполезен: Lenis держит
 * собственную цель и возвращает страницу назад. Поэтому любой код,
 * который хочет куда-то увезти страницу, идёт через этот модуль.
 */

let instance: Lenis | null = null;

export function setLenis(next: Lenis | null) {
  instance = next;
}

export function scrollToY(y: number) {
  if (instance) {
    instance.scrollTo(y, { duration: 1.1 });
    return;
  }
  scrollTo({ top: y, behavior: 'smooth' });
}

export function scrollToEl(el: Element, offset = 0) {
  const y = el.getBoundingClientRect().top + scrollY + offset;
  scrollToY(y);
}

/**
 * Заморозка страницы под перекрытием (мобильное меню).
 *
 * Одного `overflow: hidden` мало: Lenis двигает страницу своим циклом и
 * продолжит листать её под открытой панелью. Поэтому останавливаем и его,
 * а `overflow` оставляем для случая, когда Lenis выключен
 * (prefers-reduced-motion).
 */
export function lockScroll(on: boolean) {
  if (on) instance?.stop();
  else instance?.start();
  document.documentElement.style.overflow = on ? 'hidden' : '';
}
