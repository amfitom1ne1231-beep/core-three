import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Подпись запроса с заявкой от сайта к сервису бота: HMAC-SHA256
 * от «метка времени.тело» общим секретом (INTAKE_SECRET). Метка не даёт
 * повторить перехваченный запрос позже: старше пяти минут — отказ.
 *
 * Файл общий: сайт подписывает (lib/intake.ts), сервис проверяет
 * (bot/src/http/app.ts) — формат не может разойтись.
 */

export const SIGNATURE_HEADER = 'x-ct-signature';
export const TIMESTAMP_HEADER = 'x-ct-timestamp';
const MAX_SKEW_MS = 5 * 60 * 1000;

export function sign(secret: string, timestamp: string, body: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verify(secret: string, timestamp: string | undefined, signature: string | undefined, body: string, now = Date.now()) {
  if (!timestamp || !signature || !/^\d{10,16}$/.test(timestamp)) return false;
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_MS) return false;
  const expected = Buffer.from(sign(secret, timestamp, body), 'hex');
  const got = Buffer.from(signature, 'hex');
  return got.length === expected.length && timingSafeEqual(got, expected);
}
