/**
 * Тема оформления: тёмная матовая и светлая молочная.
 *
 * Состояние живёт на `<html data-theme>` — от него пляшут все токены,
 * и всё оформление меняется одной строкой. Отдельно об этом знают только
 * двое: рантайм материала (у шейдера своя палитра, CSS туда не достаёт)
 * и цвет строки браузера.
 *
 * Выбор запоминается в localStorage. Пока человек не выбрал сам, тема
 * идёт за системной настройкой: навязывать светлую тому, у кого всё
 * тёмное, — невежливо.
 */

export type Theme = 'dark' | 'light';

const KEY = 'ct-theme';

/** Одна строка, которую страница выполняет до первой отрисовки. */
export const THEME_BOOT = `(function(){try{var s=localStorage.getItem('${KEY}');var m=window.matchMedia('(prefers-color-scheme: light)').matches;document.documentElement.dataset.theme=(s==='light'||s==='dark')?s:(m?'light':'dark')}catch(e){}})()`;

export function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

const listeners = new Set<(t: Theme) => void>();

export function onThemeChange(fn: (t: Theme) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setTheme(next: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* приватный режим: выбор проживёт до перезагрузки */
  }
  // строка браузера и системные элементы формы — по той же теме
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', next === 'light' ? '#f4f5f7' : '#050608');
  listeners.forEach((fn) => fn(next));
}
