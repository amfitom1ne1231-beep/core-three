import { SIGNATURE_HEADER, TIMESTAMP_HEADER, sign } from './intake-sign.ts';
import { errorLine } from './redact.ts';

/**
 * Заявка уходит в сервис бота — он хранит заявки в своей базе в РФ
 * и сам ставит карточку в рабочую группу (bot/, план — BOT.md).
 *
 * Форма передаётся как пришла: сервис не верит сайту и проверяет её
 * заново теми же правилами (lib/lead.ts), включая ловушки для ботов.
 * Запрос подписан общим секретом (lib/intake-sign.ts).
 *
 * Без адреса сервиса локально заявка уходит в лог — форму можно
 * проверять целиком без бота. В продакшне без него — `unconfigured`,
 * и роут шлёт заявку прямо в группу (lib/notify.ts).
 */

export type ForwardResult = 'sent' | 'dry' | 'unconfigured' | 'failed';

export async function forwardLead(form: unknown, meta?: Record<string, string>): Promise<ForwardResult> {
  const url = process.env.BOT_INTAKE_URL;
  const secret = process.env.INTAKE_SECRET;

  if (!url || !secret) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[lead:dry]', form);
      return 'dry';
    }
    console.error('[lead] BOT_INTAKE_URL / INTAKE_SECRET не заданы');
    return 'unconfigured';
  }

  const body = JSON.stringify({ lead: form, meta });
  const ts = String(Date.now());
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [TIMESTAMP_HEADER]: ts, [SIGNATURE_HEADER]: sign(secret, ts, body) },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) return 'sent';
    console.error('[lead] сервис бота', res.status, await res.text());
    return 'failed';
  } catch (err) {
    console.error('[lead] сервис бота недоступен', errorLine(err));
    return 'failed';
  }
}
