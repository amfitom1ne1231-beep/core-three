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

/**
 * Одна строка, которую страница выполняет до первой отрисовки. Если тема
 * выбрана вручную, строка браузера перекрашивается под неё, когда теги
 * разметки уже на месте: иначе у тёмной темы на светлой системе строка
 * оставалась светлой до первого переключения.
 */
export const THEME_BOOT = `(function(){try{var s=localStorage.getItem('${KEY}');var m=window.matchMedia('(prefers-color-scheme: light)').matches;var t=(s==='light'||s==='dark')?s:(m?'light':'dark');document.documentElement.dataset.theme=t;if(s===t){document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(e){e.setAttribute('content',t==='light'?'#f4f5f7':'#050608')})})}}catch(e){}})()`;

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
  // Строка браузера — по той же теме. Тегов два, по одному на системную
  // настройку, и браузер берёт тот, чей media совпал. Правили раньше
  // только первый (тёмный): у кого система светлая, выбор тёмной темы
  // строку не перекрашивал.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', next === 'light' ? '#f4f5f7' : '#050608');
  });
  listeners.forEach((fn) => fn(next));
}
