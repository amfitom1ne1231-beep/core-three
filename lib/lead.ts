/**
 * Заявка: общие правила для формы и серверного роута.
 *
 * Проверка живёт в одном месте, чтобы клиент и сервер не разошлись:
 * клиент показывает ошибки сразу, сервер не верит клиенту и проверяет
 * то же самое ещё раз. Лимиты длины совпадают с ограничениями таблицы
 * в supabase/migrations.
 */

export const LEAD_KINDS = ['general', 'sites', 'ecommerce', 'bots', 'monitoring', 'concepts'] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

export type LeadField = 'name' | 'contact' | 'task' | 'consent';

export type Lead = {
  name: string;
  contact: string;
  task: string;
  kind: LeadKind;
  page: string;
};

export const LIMITS = {
  name: 120,
  contact: 160,
  task: 4000,
  page: 300
} as const;

/**
 * Быстрее этого форму не заполнить — значит, бот.
 *
 * Было 2500 мс, и в них не укладывался живой человек, заранее написавший
 * текст и вставивший его из буфера. Признак слабый: наивный бот шлёт
 * запрос мгновенно или вообще без отметки времени, и на это хватает
 * секунды с небольшим. Сильный признак здесь — скрытое поле.
 */
export const MIN_FILL_MS = 1200;

const isKind = (v: unknown): v is LeadKind => LEAD_KINDS.includes(v as LeadKind);

/**
 * Тип проекта — скрытое поле. Берётся из явного параметра ссылки
 * (`/contact?type=bots`), а если его нет — из раздела, где стоит форма.
 */
export function kindFromLocation(pathname: string, param?: string | null): LeadKind {
  if (isKind(param)) return param;
  const section = pathname.split('/')[1] ?? '';
  return isKind(section) ? section : 'general';
}

/** Ссылка на заявку, которая несёт с собой раздел, откуда пришёл человек. */
export function contactHref(pathname: string): string {
  const kind = kindFromLocation(pathname);
  return kind === 'general' ? '/contact' : `/contact?type=${kind}`;
}

/**
 * Контакт — одно поле на выбор: телефон, Telegram или почта.
 * Проверка мягкая: задача не в том, чтобы отсечь опечатку,
 * а в том, чтобы не получить заявку, на которую некуда ответить.
 */
function looksLikeContact(v: string): boolean {
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const phone = (v.match(/\d/g) ?? []).length >= 7 && /^[\d\s()+\-.]+$/.test(v);
  const tg = /^(@|(https?:\/\/)?t\.me\/)?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(v);
  return email || phone || tg;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export type LeadCheck =
  | { ok: true; lead: Lead; bot: boolean }
  | { ok: false; errors: Partial<Record<LeadField, string>> };

export function checkLead(raw: unknown): LeadCheck {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const name = str(src.name);
  const contact = str(src.contact);
  const task = str(src.task);
  const errors: Partial<Record<LeadField, string>> = {};

  if (!name) errors.name = 'Как к вам обращаться?';
  else if (name.length > LIMITS.name) errors.name = 'Слишком длинно для имени';

  if (!contact) errors.contact = 'Нужен контакт, иначе не сможем ответить';
  else if (contact.length > LIMITS.contact || !looksLikeContact(contact))
    errors.contact = 'Телефон, Telegram или почта — в одном из этих видов';

  if (task.length < 3) errors.task = 'Пара слов о задаче';
  else if (task.length > LIMITS.task) errors.task = `Не больше ${LIMITS.task} знаков — детали обсудим на созвоне`;

  if (src.consent !== true) errors.consent = 'Без согласия не сможем обработать заявку';

  if (Object.keys(errors).length) return { ok: false, errors };

  // Ловушки для ботов: скрытое поле, которое человек не видит,
  // и время заполнения. Бот получает «успех» и ничего не узнаёт.
  const elapsed = Number(src.elapsed);
  const bot = str(src.website) !== '' || !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS;

  const page = str(src.page).slice(0, LIMITS.page) || '/';
  const kind = isKind(src.kind) ? src.kind : 'general';

  return { ok: true, bot, lead: { name, contact, task, kind, page } };
}
