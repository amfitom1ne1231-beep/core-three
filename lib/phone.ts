/**
 * Телефонная оболочка (MOBILE.md): что считать телефоном и как сменяются экраны.
 *
 * Телефон — экран уже 640 px, та же граница, что у `max-sm:` в вёрстке.
 * Экраны сменяются переходом браузера (View Transitions): вкладки — мягкой
 * сменой, а из плитки новый экран вырастает. Где перехода нет (старый браузер,
 * «уменьшение движения»), страница просто меняется.
 */

export const PHONE_QUERY = '(max-width: 639.98px)';

export const isPhone = () => typeof window !== 'undefined' && matchMedia(PHONE_QUERY).matches;

/**
 * Какая сцена главной сейчас на экране. Главная листается внутри своей
 * рамки, и снаружи об этом не узнать — а карточке «?» в верхней строке
 * нужно знать, про какой экран рассказывать.
 */
let homeScene = 0;
export const setHomeScene = (n: number) => {
  homeScene = n;
};
export const getHomeScene = () => homeScene;

type Kind = 'tab' | 'grow';
type Transition = { finished: Promise<void> };

let settle: (() => void) | null = null;

/** Зовёт оболочка, когда новый экран уже нарисован: переход можно показывать. */
export function navSettled() {
  settle?.();
  settle = null;
}

/**
 * Сменить экран с переходом. `push` — сама навигация; `from` — плитка,
 * из которой вырастает новый экран (для `grow`).
 *
 * Вырастание — обрезка нового экрана: от рамки плитки до всего окна.
 * Рамка передаётся в стили числами (`--grow-*`), а не общим именем перехода
 * у плитки и у экрана: экран бывает во много раз выше окна, и превращение
 * плитки в такую полосу выглядело бы поломкой.
 */
export function navigate(push: () => void, kind: Kind = 'tab', from?: HTMLElement | null) {
  const start = (document as Document & { startViewTransition?: (cb: () => Promise<void>) => Transition }).startViewTransition;
  if (!start || !isPhone() || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    push();
    return;
  }
  const root = document.documentElement;
  const box = kind === 'grow' ? from?.getBoundingClientRect() : null;
  root.dataset.nav = box ? 'grow' : 'tab';
  if (box) {
    root.style.setProperty('--grow-t', `${Math.max(box.top, 0)}px`);
    root.style.setProperty('--grow-l', `${Math.max(box.left, 0)}px`);
    root.style.setProperty('--grow-r', `${Math.max(innerWidth - box.right, 0)}px`);
    root.style.setProperty('--grow-b', `${Math.max(innerHeight - box.bottom, 0)}px`);
  }
  const transition = start.call(
    document,
    () =>
      new Promise<void>((resolve) => {
        settle = resolve;
        // экран не успел за отведённое время — переход не держим, страница сменится без него
        setTimeout(() => {
          if (settle === resolve) navSettled();
        }, 700);
        push();
      })
  );
  transition.finished.finally(() => {
    delete root.dataset.nav;
  });
}
