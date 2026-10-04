import type { Stage } from '../db/schema';

/** Этапы воронки — по решению заказчика, стандартная воронка. */
export const STAGE_LABEL: Record<Stage, string> = {
  new: 'Новая',
  contacted: 'Связались',
  call: 'Созвон / бриф',
  proposal: 'КП отправлено',
  contract: 'Договор',
  lost: 'Отказ'
};

/** Порядок движения вперёд; «Отказ» — выход из любого этапа. */
export const FUNNEL: Stage[] = ['new', 'contacted', 'call', 'proposal', 'contract'];

/** После этих этапов заявка закрыта: сроки по ней больше не идут. */
export const CLOSED: Stage[] = ['contract', 'lost'];

/** С «Связались» и дальше клиенту уже ответили — от этого считается время ответа. */
export const ANSWERED: Stage[] = ['contacted', 'call', 'proposal', 'contract'];

/**
 * Причины отказа. Список короткий нарочно: по нему потом видно,
 * что чинить — цену, сроки или то, кто к вам приходит.
 */
export const LOST_REASONS = {
  price: 'Дорого',
  time: 'Не устроили сроки',
  profile: 'Не наш профиль',
  silent: 'Пропал',
  competitor: 'Выбрал других',
  spam: 'Спам'
} as const;

export type LostReason = keyof typeof LOST_REASONS;

export const KIND_LABEL: Record<string, string> = {
  general: 'Общая',
  sites: 'Сайты',
  ecommerce: 'Магазины',
  bots: 'Боты',
  monitoring: 'Мониторинг',
  concepts: 'Концепты'
};

export const SOURCE_LABEL = { site: 'с сайта', mail: 'с почты', manual: 'вручную', help: 'из «Помощи»' } as const;
