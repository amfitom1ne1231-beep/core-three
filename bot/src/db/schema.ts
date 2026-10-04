import { bigint, boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Схема базы бота. Миграции генерирует drizzle-kit (`npm run db:generate`)
 * в `bot/drizzle`; применяются при старте сервиса.
 *
 * Время везде с поясом: сроки считаются в рабочем поясе студии,
 * а сервер может стоять где угодно.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** Команда. Владелец один — тот, чей id в OWNER_TG_ID. */
export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  tgId: bigint('tg_id', { mode: 'number' }).notNull().unique(),
  name: text('name').notNull(),
  username: text('username'),
  role: text('role', { enum: ['owner', 'member'] }).notNull().default('member'),
  active: boolean('active').notNull().default(true),
  createdAt: ts('created_at').notNull().defaultNow()
});

/** Приглашения в команду: ссылка на бота с кодом, живёт двое суток. */
export const invites = pgTable('invites', {
  code: text('code').primaryKey(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => members.id),
  createdAt: ts('created_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  usedBy: integer('used_by').references(() => members.id),
  usedAt: ts('used_at')
});

/** Настройки, которые меняются из бота: рабочая группа, темы. */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow()
});

export const STAGES = ['new', 'contacted', 'call', 'proposal', 'contract', 'lost'] as const;
export type Stage = (typeof STAGES)[number];

export const SOURCES = ['site', 'mail', 'manual'] as const;
export type Source = (typeof SOURCES)[number];

export const leads = pgTable(
  'leads',
  {
    id: serial('id').primaryKey(),
    source: text('source', { enum: SOURCES }).notNull(),
    name: text('name').notNull(),
    contact: text('contact').notNull(),
    task: text('task').notNull(),
    /** Направление: те же значения, что у формы сайта (lib/lead.ts). */
    kind: text('kind').notNull(),
    /** Страница, где оставили заявку. */
    page: text('page'),
    /** Метки источника: utm_*, страница входа, откуда пришли. */
    meta: jsonb('meta').$type<Record<string, string>>(),
    /** Сработала ловушка для ботов. Не выбрасывается — см. сайт. */
    spam: boolean('spam').notNull().default(false),
    stage: text('stage', { enum: STAGES }).notNull().default('new'),
    lostReason: text('lost_reason'),
    ownerId: integer('owner_id').references(() => members.id),
    createdAt: ts('created_at').notNull().defaultNow(),
    takenAt: ts('taken_at'),
    /** Первый ответ клиенту — переход на «Связались» или дальше. */
    firstReplyAt: ts('first_reply_at'),
    closedAt: ts('closed_at'),
    remindedAt: ts('reminded_at'),
    /** Карточка заявки в рабочей группе — её бот и обновляет. */
    cardChatId: bigint('card_chat_id', { mode: 'number' }),
    cardMessageId: integer('card_message_id')
  },
  (t) => [index('leads_stage_idx').on(t.stage), index('leads_created_idx').on(t.createdAt)]
);

export const LEAD_EVENTS = ['created', 'taken', 'released', 'stage', 'note', 'lost', 'reopened', 'reminded', 'alarmed'] as const;

/** История заявки: кто, что и когда. Из неё же считаются метрики. */
export const leadEvents = pgTable(
  'lead_events',
  {
    id: serial('id').primaryKey(),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    memberId: integer('member_id').references(() => members.id),
    type: text('type', { enum: LEAD_EVENTS }).notNull(),
    data: jsonb('data').$type<Record<string, unknown>>(),
    createdAt: ts('created_at').notNull().defaultNow()
  },
  (t) => [index('lead_events_lead_idx').on(t.leadId)]
);

/**
 * Ожидание ответа в группе: «ответьте на это сообщение текстом заметки».
 * Хранится в базе, а не в памяти — переживает перезапуск сервиса.
 */
export const prompts = pgTable(
  'prompts',
  {
    id: serial('id').primaryKey(),
    chatId: bigint('chat_id', { mode: 'number' }).notNull(),
    messageId: integer('message_id').notNull(),
    kind: text('kind', { enum: ['note'] }).notNull(),
    leadId: integer('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
    memberId: integer('member_id').references(() => members.id),
    createdAt: ts('created_at').notNull().defaultNow()
  },
  (t) => [uniqueIndex('prompts_msg_idx').on(t.chatId, t.messageId)]
);

/**
 * Запуски по расписанию. Ключ (`alarm:2026-10-05`) не даёт отправить
 * одно и то же дважды, если сервис перезапустился посреди дня.
 */
export const jobRuns = pgTable('job_runs', {
  key: text('key').primaryKey(),
  ranAt: ts('ran_at').notNull().defaultNow()
});
