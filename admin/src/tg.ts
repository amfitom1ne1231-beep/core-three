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

export const inTelegram = isTMA();

let initData: string | undefined;
let startParam: string | undefined;

export function boot() {
  if (!inTelegram) {
    document.documentElement.classList.add('browser');
    return;
  }
  try {
    init();
    initData = retrieveRawInitData();
    startParam = retrieveLaunchParams().tgWebAppStartParam;
  } catch (e) {
    console.error('[tg] запуск', e);
    return;
  }

  // цвета темы — в CSS-переменные --tg-theme-*; меняются вместе с темой Telegram
  themeParams.mount.ifAvailable();
  themeParams.bindCssVars.ifAvailable();

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

/** Заголовок входа: строка initData, подписанная Telegram. */
export const authHeader = (): Record<string, string> => (initData ? { authorization: `tma ${initData}` } : {});

/** Заявка из ссылки `?startapp=lead_12` — приложение открыли сразу на ней. */
export function startLeadId(): number | null {
  const m = startParam?.match(/^lead_(\d{1,9})$/);
  return m ? Number(m[1]) : null;
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
