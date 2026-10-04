/**
 * Ошибка для лога — без секретов.
 *
 * Писать ошибку целиком (`console.error(e)`) нельзя: в сетевой ошибке
 * запроса к Telegram лежит исходная ошибка, а в её тексте — адрес вида
 * `…/bot<токен>/sendMessage`. Так 05.10.2026 токен бота оказался в логе
 * сервера. Здесь от ошибки остаётся строка (у сетевой — ещё и код причины),
 * а всё, что похоже на токен бота, вырезается, где бы оно ни стояло.
 *
 * Файл общий для сайта и сервиса бота.
 */

/** Токен бота: «123456789:…» — в адресе запроса перед ним стоит «bot». */
const TOKEN = /(bot)?\d{6,}:[A-Za-z0-9_-]{30,}/g;

export function redact(text: string): string {
  return text.replace(TOKEN, (_all, bot?: string) => `${bot ?? ''}<токен>`);
}

export function errorLine(e: unknown): string {
  if (!(e instanceof Error)) return redact(typeof e === 'string' ? e : JSON.stringify(e) ?? String(e));
  // у сетевой ошибки причина — во вложенной: её код говорит больше, чем текст
  const inner = (e as { error?: unknown; cause?: unknown }).error ?? (e as { cause?: unknown }).cause;
  const code = inner && typeof inner === 'object' && 'code' in inner ? ` [${String((inner as { code: unknown }).code)}]` : '';
  const network = e.name === 'HttpError' || e.name === 'GrammyError' || e.name === 'TypeError' || e.name === 'TimeoutError' || e.name === 'AbortError';
  // у своей ошибки нужен и стек — по нему её ищут; у сетевой он ничего не говорит
  return redact(network ? `${e.name}: ${e.message}${code}` : `${e.stack ?? `${e.name}: ${e.message}`}${code}`);
}
