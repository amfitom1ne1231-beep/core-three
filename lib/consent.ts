/**
 * Выбор посетителя по cookie и загрузка Яндекс.Метрики.
 *
 * Пока счётчик не задан переменной окружения, ничего из этого не
 * включается: спрашивать согласие на то, чего нет, — лишний шум.
 * Метрика грузится только после явного «Принять».
 */

export const YM_ID = Number(process.env.NEXT_PUBLIC_YM_ID) || 0;

export type Consent = 'all' | 'essential';

const KEY = 'ct-consent';
export const CONSENT_RESET = 'ct-consent-reset';

export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'all' || v === 'essential' ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(v: Consent) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* приватный режим: выбор проживёт до перезагрузки */
  }
}

/** Сброс выбора — плашка покажется снова. Зовётся со страницы политики. */
export function resetConsent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* нечего сбрасывать */
  }
  dispatchEvent(new Event(CONSENT_RESET));
}

type Ym = ((id: number, method: string, ...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
declare global {
  interface Window {
    ym?: Ym;
  }
}

let loaded = false;

export function loadMetrika() {
  if (loaded || !YM_ID) return;
  loaded = true;

  // очередь вызовов до загрузки скрипта — так же, как в официальном сниппете
  const ym: Ym = (...args: unknown[]) => {
    (ym.a = ym.a ?? []).push(args);
  };
  ym.l = Date.now();
  window.ym = window.ym ?? ym;

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.appendChild(s);

  // defer: просмотры отправляем сами — у сайта клиентская навигация,
  // и автоматический хит при инициализации посчитал бы только первую страницу
  window.ym(YM_ID, 'init', { defer: true, clickmap: true, trackLinks: true, accurateTrackBounce: true });
}

export function hit(url: string) {
  if (loaded && window.ym) window.ym(YM_ID, 'hit', url);
}
