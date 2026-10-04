import { bigint, boolean, date, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Схема базы бота. Миграции генерирует drizzle-kit (`npm run db:generate`)
 * в `bot/drizzle`; применяются при старте сервиса.
 *
 * Время везде с поясом: сроки считаются в рабочем поясе студии,
 * а сервер может стоять где угодно.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** Срок — день без времени («2026-10-15»): «сегодня» считается в поясе студии. */
const day = (name: string) => date(name, { mode: 'string' });

/** Команда. Владельцы — те, чьи id в OWNER_TG_IDS; остальные входят по приглашению. */
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

/* ---------- проекты ---------- */

export const PROJECT_STATUSES = ['active', 'paused', 'done', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Проект: рождается из заявки на «Договоре» или заводится вручную. */
export const projects = pgTable(
  'projects',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    /** Клиент — человек или компания, как его зовут в студии. */
    client: text('client').notNull(),
    contact: text('contact'),
    /** Направление — те же значения, что у заявки; от него шаблон этапов. */
    kind: text('kind').notNull(),
    status: text('status', { enum: PROJECT_STATUSES }).notNull().default('active'),
    /** Заявка, из которой вырос проект. У заявки проект один. */
    leadId: integer('lead_id')
      .references(() => leads.id, { onDelete: 'set null' })
      .unique(),
    ownerId: integer('owner_id').references(() => members.id),
    createdAt: ts('created_at').notNull().defaultNow(),
    closedAt: ts('closed_at')
  },
  (t) => [index('projects_status_idx').on(t.status)]
);

/** Этапы проекта: при создании — по шаблону направления, дальше правятся. */
export const projectStages = pgTable(
  'project_stages',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    title: text('title').notNull(),
    dueOn: day('due_on'),
    doneAt: ts('done_at')
  },
  (t) => [index('project_stages_project_idx').on(t.projectId)]
);

/** Задача внутри проекта: исполнитель, срок, выполнена или нет. */
export const tasks = pgTable(
  'tasks',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    stageId: integer('stage_id').references(() => projectStages.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    assigneeId: integer('assignee_id').references(() => members.id),
    dueOn: day('due_on'),
    doneAt: ts('done_at'),
    createdBy: integer('created_by').references(() => members.id),
    createdAt: ts('created_at').notNull().defaultNow()
  },
  (t) => [index('tasks_project_idx').on(t.projectId), index('tasks_due_idx').on(t.dueOn)]
);

export const FILE_KINDS = ['document', 'photo', 'video', 'audio', 'voice'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/**
 * Материалы проекта: ссылка (Figma, репозиторий, диск) или файл. Файлы
 * лежат в самом Telegram — их пересылают боту, а здесь хранится `file_id`,
 * по которому бот пришлёт файл обратно.
 */
export const materials = pgTable(
  'materials',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['link', 'file'] }).notNull(),
    title: text('title').notNull(),
    url: text('url'),
    fileId: text('file_id'),
    fileKind: text('file_kind', { enum: FILE_KINDS }),
    fileName: text('file_name'),
    fileSize: integer('file_size'),
    addedBy: integer('added_by').references(() => members.id),
    createdAt: ts('created_at').notNull().defaultNow()
  },
  (t) => [index('materials_project_idx').on(t.projectId)]
);

/**
 * Доступы: пароли к хостингам и панелям. Значение зашифровано
 * (AES-256-GCM, ключ — только в окружении сервиса); в базе, в бэкапе
 * и в логах его в открытом виде нет.
 */
export const secrets = pgTable(
  'secrets',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    sealed: text('sealed').notNull(),
    addedBy: integer('added_by').references(() => members.id),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow()
  },
  (t) => [index('secrets_project_idx').on(t.projectId)]
);

export const PROJECT_EVENTS = [
  'created',
  'status',
  'stage_done',
  'stage_reopened',
  'stage_added',
  'stage_removed',
  'task_added',
  'task_done',
  'task_reopened',
  'task_removed',
  'material_added',
  'material_removed',
  'secret_added',
  'secret_changed',
  'secret_viewed',
  'secret_removed'
] as const;

/** История проекта. Кто смотрел доступы — тоже здесь. */
export const projectEvents = pgTable(
  'project_events',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    memberId: integer('member_id').references(() => members.id),
    type: text('type', { enum: PROJECT_EVENTS }).notNull(),
    data: jsonb('data').$type<Record<string, unknown>>(),
    createdAt: ts('created_at').notNull().defaultNow()
  },
  (t) => [index('project_events_project_idx').on(t.projectId)]
);
