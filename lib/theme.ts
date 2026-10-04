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

/** `instant` — тема меняется под волной: свои плавные переходы слушателям не нужны. */
const listeners = new Set<(t: Theme, instant: boolean) => void>();

export function onThemeChange(fn: (t: Theme, instant: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setTheme(next: Theme, instant = false) {
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
  listeners.forEach((fn) => fn(next, instant));
}

/**
 * Смена темы волной от переключателя.
 *
 * Тема меняется не щелчком: новая расходится по странице кругом из той
 * точки, где её включили, — с мягкой кромкой и полосой света на фронте.
 * Браузер снимает страницу в старой теме, под снимком она перекрашивается
 * целиком, и новая проявляется маской (View Transitions). Поэтому волна
 * проходит по всему сразу — по материалу, тексту, рендерам, видео, —
 * и ничего не надо учить переходу по отдельности.
 *
 * То, что от темы зависит картинками (кадры схемы), качается до волны:
 * `onThemePrepare`. Иначе под фронтом на мгновение оказалась бы пустота.
 *
 * Без поддержки в браузере и при reduced motion тема меняется сразу.
 */
const preparers = new Set<(next: Theme) => Promise<unknown> | void>();

export function onThemePrepare(fn: (next: Theme) => Promise<unknown> | void) {
  preparers.add(fn);
  return () => {
    preparers.delete(fn);
  };
}

const WAVE_MS = 1050;
/** Ширина мягкой кромки волны. */
const WAVE_EDGE = 150;
/** Сколько ждём картинки новой темы, прежде чем пустить волну без них. */
const PREPARE_MS = 700;

type Transition = { ready: Promise<void>; finished: Promise<void> };
let switching = false;

export async function switchTheme(next: Theme, origin?: { x: number; y: number }) {
  if (typeof document === 'undefined' || switching || readTheme() === next) return;
  const start = (document as Document & { startViewTransition?: (cb: () => Promise<void>) => Transition }).startViewTransition;
  if (!start || !origin || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setTheme(next);
    return;
  }

  switching = true;
  const root = document.documentElement;
  const rim = document.createElement('div');
  rim.className = 'theme-rim';
  rim.setAttribute('aria-hidden', 'true');
  try {
    await Promise.race([Promise.all([...preparers].map((fn) => fn(next))), new Promise((ok) => setTimeout(ok, PREPARE_MS))]);

    // радиус — до дальнего угла экрана, плюс кромка: волна должна уйти за край целиком
    const reach = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y)) + WAVE_EDGE;
    root.style.setProperty('--wave-x', `${origin.x}px`);
    root.style.setProperty('--wave-y', `${origin.y}px`);
    root.style.setProperty('--wave-edge', `${WAVE_EDGE}px`);
    root.dataset.themeWave = next;
    document.body.appendChild(rim);

    const vt = start.call(document, async () => {
      setTheme(next, true);
      // слушатели темы — состояние React: даём ему дойти до страницы,
      // прежде чем браузер снимет её в новой теме
      await new Promise((ok) => setTimeout(ok, 60));
    });
    await vt.ready;
    // Волна отвечает на нажатие сразу: стартует уже видимым пятном под
    // подписью и без долгого разгона — пауза после клика читалась задержкой
    const timing: KeyframeAnimationOptions = { duration: WAVE_MS, easing: 'cubic-bezier(0.36, 0, 0.18, 1)', fill: 'both' };
    const wave = { '--wave': [`${WAVE_EDGE * 0.7}px`, `${reach}px`] } as unknown as Keyframe[];
    root.animate(wave, { ...timing, pseudoElement: '::view-transition-new(root)' });
    rim.animate(wave, timing);
    await vt.finished;
  } catch {
    // волна не обязательна, тема — обязательна
    if (readTheme() !== next) setTheme(next);
  } finally {
    rim.remove();
    delete root.dataset.themeWave;
    switching = false;
  }
}
