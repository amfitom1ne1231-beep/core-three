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
