import {
  backButton,
  hapticFeedback,
  init,
  isTMA,
  miniApp,
  openTelegramLink,
  retrieveLaunchParams,
  retrieveRawInitData,
  swipeBehavior,
  themeParams,
  viewport
} from '@tma.js/sdk-react';

/**
 * Всё, что приложение берёт у Telegram, — в одном месте: подпись для входа,
 * цвета темы, кнопка «Назад» в шапке, отклик вибрацией.
 *
 * В обычном браузере (разработка) Telegram нет: тема — запасная, по теме
 * системы, «Назад» рисует само приложение, а сервис пускает без подписи
 * только с этой же машины.
 *
 * Каждый вызов — через `ifAvailable`: клиенты Telegram разных версий умеют
 * разное, и то, чего клиент не умеет, должно тихо пропускаться.
 */

/**
 * Параметры запуска Telegram кладёт в якорь адреса. Подпись, тему и
 * стартовую ссылку читаем оттуда и сами: SDK отвергает параметры целиком,
 * если в них нет поля, которое Telegram стал присылать позже (`signature` —
 * с конца 2024-го), — а вход в приложение от этого зависеть не должен.
 */
const launch = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const rawInitData = launch.get('tgWebAppData') ?? undefined;

export const inTelegram = Boolean(rawInitData) || isTMA();

let initData: string | undefined;
let startParam: string | undefined;

export function boot() {
  if (!inTelegram) {
    document.documentElement.classList.add('browser');
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => setScheme(dark.matches);
    follow();
    dark.addEventListener('change', follow);
    return;
  }
  initData = rawInitData;
  startParam = launch.get('tgWebAppStartParam') ?? undefined;
  try {
    init();
    initData = retrieveRawInitData() ?? initData;
    startParam = retrieveLaunchParams().tgWebAppStartParam ?? startParam;
  } catch (e) {
    console.warn('[tg] SDK не запустился — работаю без него', e);
    bootBare();
    return;
  }

  // цвета темы — в CSS-переменные --tg-theme-*; меняются вместе с темой Telegram
  themeParams.mount.ifAvailable();
  themeParams.bindCssVars.ifAvailable();
  // родные элементы (календарь, выпадающий список) — в тёмной или светлой схеме вслед за темой Telegram,
  // а не системы: иначе на тёмной теме при светлой системе значок календаря не видно
  const scheme = () => setScheme(themeParams.isDark());
  scheme();
  themeParams.isDark.sub(scheme);

  miniApp.mount.ifAvailable();
  // шапка и подложка — цвета страницы, чтобы приложение не выглядело вклеенным
  miniApp.setHeaderColor.ifAvailable('secondary_bg_color');
  miniApp.setBgColor.ifAvailable('secondary_bg_color');

  backButton.mount.ifAvailable();

  // список прокручивают вверх-вниз — жест не должен заодно сворачивать приложение
  swipeBehavior.mount.ifAvailable();
  swipeBehavior.disableVertical.ifAvailable();

  if (viewport.mount.isAvailable()) {
    viewport
      .mount()
      .then(() => {
        viewport.bindCssVars.ifAvailable();
        viewport.expand.ifAvailable();
      })
      .catch((e: unknown) => console.error('[tg] viewport', e));
  }

  miniApp.ready.ifAvailable();
}

/**
 * Тёмная тема или светлая. От этого зависят родные элементы (календарь,
 * выпадающий список) и цвет столбцов на графиках: на тёмном фоне акцент
 * темы приглушается, на светлом — делается глубже (styles.css, --mark).
 */
function setScheme(dark: boolean) {
  const root = document.documentElement;
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.dataset.scheme = dark ? 'dark' : 'light';
}

/** Событие клиенту Telegram напрямую, без SDK: мобильный и настольный мост, веб-версия. */
function post(eventType: string, eventData: unknown = '') {
  try {
    const w = window as unknown as { TelegramWebviewProxy?: { postEvent(type: string, data: string): void }; external?: { notify?(msg: string): void } };
    if (w.TelegramWebviewProxy) w.TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
    else if (w.external?.notify) w.external.notify(JSON.stringify({ eventType, eventData }));
    else if (window.parent !== window) window.parent.postMessage(JSON.stringify({ eventType, eventData }), 'https://web.telegram.org');
  } catch {
    // моста нет — значит, и сказать некому
  }
}

/**
 * Запуск без SDK — на клиенте, параметры которого он не принял. Главное
 * уже есть (подпись для входа); здесь тема из тех же параметров и «готово»
 * для Telegram. Кнопку «Назад» в этом режиме рисует само приложение.
 */
function bootBare() {
  const root = document.documentElement;
  let colors = 0;
  try {
    const theme = JSON.parse(launch.get('tgWebAppThemeParams') ?? '{}') as Record<string, unknown>;
    for (const [key, value] of Object.entries(theme)) {
      if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) continue;
      root.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, value);
      colors++;
    }
    const bg = typeof theme.bg_color === 'string' ? theme.bg_color : '';
    if (/^#[0-9a-f]{6}$/i.test(bg)) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
      setScheme(0.299 * r! + 0.587 * g! + 0.114 * b! < 128);
    }
  } catch {
    // темы в параметрах нет или она битая
  }
  if (!colors) root.classList.add('browser');
  post('web_app_ready');
  post('web_app_expand');
}

/** Заголовок входа: строка initData, подписанная Telegram. */
export const authHeader = (): Record<string, string> => (initData ? { authorization: `tma ${initData}` } : {});

/** Заявка или проект из ссылки `?startapp=lead_12` / `project_3` — приложение открыли сразу на них. */
export function startTarget(): { name: 'lead' | 'project'; id: number } | null {
  const m = startParam?.match(/^(lead|project)_(\d{1,9})$/);
  return m ? { name: m[1] as 'lead' | 'project', id: Number(m[2]) } : null;
}

/** Кнопка «Назад» в шапке Telegram. Возвращает, удалось ли её показать. */
export function nativeBack(visible: boolean, onClick: () => void): (() => void) | null {
  if (!inTelegram || !backButton.show.isAvailable()) return null;
  if (!visible) {
    backButton.hide.ifAvailable();
    return () => {};
  }
  backButton.show();
  return backButton.onClick(onClick);
}

export const hasNativeBack = () => inTelegram && backButton.show.isAvailable();

export const haptic = {
  tap: () => void hapticFeedback.impactOccurred.ifAvailable('light'),
  done: () => void hapticFeedback.notificationOccurred.ifAvailable('success'),
  fail: () => void hapticFeedback.notificationOccurred.ifAvailable('error')
};

/** Ссылка t.me — внутри Telegram, без ухода в браузер. */
export function openTg(url: string) {
  if (inTelegram && openTelegramLink.isAvailable()) openTelegramLink(url);
  else window.open(url, '_blank', 'noopener');
}
