import type { Lead } from './lead';

/**
 * Уведомление о заявке в рабочий чат Telegram.
 *
 * Без него заявка ложилась только в таблицу, и обещание «ответим
 * в течение дня» держалось на том, что кто-то сам откроет панель
 * Supabase. Теперь каждая заявка приходит сообщением.
 *
 * Включается двумя переменными: TELEGRAM_BOT_TOKEN (бот, через
 * которого пишем) и TELEGRAM_CHAT_ID (куда: личка, группа или канал,
 * где бот состоит). Пока их нет — молча выключено.
 *
 * TELEGRAM_THREAD_ID — тема, если в группе включены темы. Без неё
 * сообщение уходит в общую ветку, и заявки тонут среди болтовни.
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

export function leadMessage(lead: Lead, status: 'new' | 'spam'): string {
  const head =
    status === 'spam'
      ? 'Заявка с сайта — сработала ловушка для ботов. Проверьте: ловушка ошибается на тех, кто вставил текст из буфера.'
      : 'Новая заявка с сайта';
  return [
    head,
    '',
    `Имя: ${lead.name}`,
    `Контакт: ${lead.contact}`,
    `Раздел: ${KIND_LABEL[lead.kind]} · ${lead.page}`,
    '',
    lead.task
  ].join('\n');
}

export async function notifyLead(lead: Lead, status: 'new' | 'spam' = 'new'): Promise<NotifyResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return 'off';
  const thread = Number(process.env.TELEGRAM_THREAD_ID) || undefined;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // предел сообщения Telegram — 4096 знаков, задача бывает до 4000
      body: JSON.stringify({
        chat_id: chat,
        message_thread_id: thread,
        text: leadMessage(lead, status).slice(0, 4096),
        disable_web_page_preview: true
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) return 'sent';
    console.error('[lead] telegram', res.status, await res.text());
    return 'failed';
  } catch (err) {
    console.error('[lead] telegram недоступен', err);
    return 'failed';
  }
}
