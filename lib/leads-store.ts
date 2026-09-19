import type { Lead } from './lead';

/**
 * Запись заявки в Supabase через REST, без клиентской библиотеки:
 * один POST не стоит лишней зависимости.
 *
 * Таблица закрыта политиками целиком, писать в неё может только серверный
 * ключ. Ключ живёт в .env.local и в браузер не попадает — у переменной
 * нет префикса NEXT_PUBLIC.
 */

export type SaveResult = 'saved' | 'dry' | 'unconfigured' | 'failed';

export async function saveLead(lead: Lead): Promise<SaveResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    // Локально без ключей форма всё равно проверяется целиком —
    // заявка уходит в лог сервера вместо базы.
    if (process.env.NODE_ENV !== 'production') {
      console.info('[lead:dry]', lead);
      return 'dry';
    }
    console.error('[lead] SUPABASE_URL / SUPABASE_SECRET_KEY не заданы');
    return 'unconfigured';
  }

  const headers: Record<string, string> = {
    apikey: key,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal'
  };
  // Старый service_role-ключ — это JWT, ему нужен ещё и Bearer.
  // Новому sb_secret_ достаточно apikey.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(`${url}/rest/v1/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify(lead),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) return 'saved';
    console.error('[lead] supabase', res.status, await res.text());
    return 'failed';
  } catch (err) {
    console.error('[lead] supabase недоступна', err);
    return 'failed';
  }
}
