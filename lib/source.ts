/**
 * Откуда пришёл человек: рекламные метки из ссылки (utm), страница, с которой
 * он начал, и сайт, с которого перешёл. Запоминается при первом заходе
 * во вкладке и уходит вместе с заявкой — из этого сервис бота считает,
 * какие источники приводят заявки, а какие только посетителей.
 *
 * Хранится в sessionStorage: живёт, пока открыта вкладка, никуда не
 * отправляется сам по себе и cookie не заводит.
 */

export const SOURCE_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'landing', 'ref'] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];
export type SourceMeta = Partial<Record<SourceKey, string>>;

const LIMIT = 200;
const KEY = 'ct-source';

/**
 * Сервер не верит клиенту: из присланного остаются только известные поля,
 * только строки и только до предела длины. Пусто — `undefined`.
 */
export function cleanSource(raw: unknown): SourceMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: SourceMeta = {};
  for (const key of SOURCE_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, LIMIT);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Что запомнить по адресу первой страницы и тому, откуда на неё пришли. */
export function sourceFrom(url: URL, referrer: string): SourceMeta {
  const meta: Record<string, string> = { landing: url.pathname };
  for (const key of SOURCE_KEYS) {
    if (key.startsWith('utm_')) meta[key] = url.searchParams.get(key) ?? '';
  }
  try {
    // свой же сайт источником не считается: это переход между страницами
    const from = new URL(referrer).hostname.replace(/^www\./, '');
    if (from && from !== url.hostname.replace(/^www\./, '')) meta.ref = from;
  } catch {
    // referrer пустой или битый — пришли напрямую
  }
  return cleanSource(meta) ?? {};
}

/** Первый заход во вкладке: запомнить источник. Повторные вызовы ничего не меняют. */
export function rememberSource() {
  try {
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, JSON.stringify(sourceFrom(new URL(location.href), document.referrer)));
  } catch {
    // приватный режим: источник просто не запомнится
  }
}

export function readSource(): SourceMeta | undefined {
  try {
    return cleanSource(JSON.parse(sessionStorage.getItem(KEY) ?? 'null'));
  } catch {
    return undefined;
  }
}
