/**
 * Тема оформления: тёмная матовая и светлая молочная.
 *
 * Состояние живёт на `<html data-theme>` — от него пляшут все токены,
 * и всё оформление меняется одной строкой. Отдельно об этом знают только
 * двое: рантайм материала (у шейдера своя палитра, CSS туда не достаёт)
 * и цвет строки браузера.
 *
 * По умолчанию — светлая, какая бы ни стояла в системе: так решил заказчик
 * (04.10.2026). Раньше сайт шёл за системной настройкой, и у большинства
 * открывался тёмным. Выбор, сделанный кнопкой света, запоминается
 * в localStorage и с этого момента главнее умолчания.
 */

export type Theme = 'dark' | 'light';

export const DEFAULT_THEME: Theme = 'light';

/**
 * Ключ сменён вместе с умолчанием: прежние выборы делались, когда сайт
 * шёл за системой, и на новое умолчание их переносить незачем.
 */
const KEY = 'ct-theme-2';

/**
 * Одна строка, которую страница выполняет до первой отрисовки. Разметка
 * сервера уже светлая (`data-theme` на `<html>`, светлая строка браузера);
 * строке остаётся одно — вернуть тёмную тому, кто выбрал её сам.
 *
 * Цвет строки браузера — своим тегом в начале `<head>`: браузер берёт
 * первый по порядку. Править тег, который отрисовал сервер, нельзя —
 * React при оживлении страницы не узнаёт его и ставит рядом второй.
 */
export const THEME_BOOT = `(function(){try{if(localStorage.getItem('${KEY}')==='dark'){var d=document;d.documentElement.dataset.theme='dark';var m=d.createElement('meta');m.name='theme-color';m.content='#050608';d.head.insertBefore(m,d.head.firstChild)}}catch(e){}})()`;

export function readTheme(): Theme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
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
  // строка браузера — по той же теме
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', next === 'light' ? '#f4f5f7' : '#050608');
  });
  listeners.forEach((fn) => fn(next, instant));
}

/**
 * Смена темы волной от кнопки света.
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

/**
 * Safari (и всё на его движке). Маску волны он перекрашивает на каждом кадре
 * заметно медленнее Chrome — в замере волна шла на 34–37 кадрах в секунду, —
 * поэтому здесь тема приходит наплывом, как на телефонах.
 */
const isSafari = () => /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
let switching = false;

export async function switchTheme(next: Theme, origin?: { x: number; y: number }) {
  if (typeof document === 'undefined' || switching || readTheme() === next) return;
  const start = (document as Document & { startViewTransition?: (cb: () => Promise<void>) => Transition }).startViewTransition;
  if (!start || !origin || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setTheme(next);
    return;
  }

  // Сенсорные устройства: вместо волны — наплыв. Волна — маска во весь
  // экран, радиус которой страница пересчитывает на каждом кадре; на
  // телефоне с процессором вчетверо слабее настольного на ней не успевало
  // в срок 13–14% кадров (замер по трассировке, BRIEF.md, раздел 50).
  // Наплыв — два готовых снимка страницы, которые меняются прозрачностью:
  // это целиком делает видеокарта. Картинки новой темы ждём так же.
  if (matchMedia('(pointer: coarse)').matches || isSafari()) {
    switching = true;
    document.documentElement.dataset.themeSwitching = '';
    try {
      await Promise.race([Promise.all([...preparers].map((fn) => fn(next))), new Promise((ok) => setTimeout(ok, PREPARE_MS))]);
      const fade = start.call(document, async () => {
        setTheme(next, true);
        await new Promise((ok) => setTimeout(ok, 60));
      });
      await fade.finished;
    } catch {
      if (readTheme() !== next) setTheme(next);
    } finally {
      delete document.documentElement.dataset.themeSwitching;
      switching = false;
    }
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
    // Свои цветовые переходы элементов на время смены выключены (правило
    // в globals.css): их больше сотни, каждый пересчитывался на каждом
    // кадре, а снимок новой темы делался посреди них — с промежуточными
    // цветами, которые после волны «дощёлкивали» до верных.
    root.dataset.themeSwitching = '';
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
    delete root.dataset.themeSwitching;
    switching = false;
  }
}
