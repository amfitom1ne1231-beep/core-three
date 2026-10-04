import type { Lead } from './lead';
import type { SourceMeta } from './source';
import { errorLine } from './redact.ts';

/**
 * Запасной путь заявки — прямо в рабочий чат Telegram.
 *
 * Основной путь — сервис бота (lib/intake.ts): он хранит заявку и ставит
 * карточку с кнопками. Сюда заявка попадает, только если сервис
 * недоступен: простым сообщением, зато не потерянная.
 *
 * Включается двумя переменными: TELEGRAM_BOT_TOKEN (бот, через
 * которого пишем) и TELEGRAM_CHAT_ID (куда: личка, группа или канал,
 * где бот состоит). Пока их нет — молча выключено.
 *
 * TELEGRAM_THREAD_ID — тема, если в группе включены темы. Без неё
 * сообщение уходит в общую ветку, и заявки тонут среди болтовни.
 *
 * TELEGRAM_API_ROOT — свой адрес Bot API вместо api.telegram.org: нужен,
 * когда с сервера до Telegram напрямую не достать (в России он
 * заблокирован). Тот же, что у сервиса бота.
 *
 * Сообщение — простой текст, без parse_mode: в имени или задаче может
 * оказаться что угодно, и разметка Telegram сломалась бы на первой
 * звёздочке или подчёркивании.
 */

export type NotifyResult = 'sent' | 'off' | 'failed';

const KIND_LABEL: Record<Lead['kind'], string> = {
  general: 'Общая',
  sites: 'Сайты',
  ecommerce: 'Магазины',
  bots: 'Боты',
  monitoring: 'Мониторинг',
  concepts: 'Концепты'
};

/** «telegram / cpc · вход: /bots · с vk.com» — одной строкой, только то, что есть. */
export function sourceLine(meta?: SourceMeta): string | null {
  if (!meta) return null;
  const parts = [
    [meta.utm_source, meta.utm_medium, meta.utm_campaign].filter(Boolean).join(' / '),
    meta.landing && `вход: ${meta.landing}`,
    meta.ref && `с ${meta.ref}`
  ].filter(Boolean);
  return parts.length ? `Источник: ${parts.join(' · ')}` : null;
}

export function leadMessage(lead: Lead, status: 'new' | 'spam', meta?: SourceMeta): string {
  const head =
    status === 'spam'
      ? 'Заявка с сайта — сработала ловушка для ботов. Проверьте: ловушка ошибается на тех, кто вставил текст из буфера.'
      : lead.help
        ? 'Нужна помощь: просит написать по номеру в Telegram, Max или WhatsApp — не звонить'
        : 'Новая заявка с сайта';
  return [
    head,
    '',
    `Имя: ${lead.name}`,
    `Контакт: ${lead.contact}`,
    `Раздел: ${KIND_LABEL[lead.kind]} · ${lead.page}`,
    sourceLine(meta),
    '',
    lead.task
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export async function notifyLead(lead: Lead, status: 'new' | 'spam' = 'new', meta?: SourceMeta): Promise<NotifyResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return 'off';
  const thread = Number(process.env.TELEGRAM_THREAD_ID) || undefined;

  try {
    const root = (process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org').replace(/\/+$/, '');
    const res = await fetch(`${root}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // предел сообщения Telegram — 4096 знаков, задача бывает до 4000
      body: JSON.stringify({
        chat_id: chat,
        message_thread_id: thread,
        text: leadMessage(lead, status, meta).slice(0, 4096),
        disable_web_page_preview: true
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) return 'sent';
    console.error('[lead] telegram', res.status, await res.text());
    return 'failed';
  } catch (err) {
    console.error('[lead] telegram недоступен', errorLine(err));
    return 'failed';
  }
}
