import { asc, eq, gt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { leadEvents, leads, members, projectEvents, projectStages, projects, tasks } from '../db/schema';
import { computeMetrics, sourceOf } from '../domain/metrics';
import { KIND_LABEL, LOST_REASONS, SOURCE_LABEL, STAGE_LABEL, type LostReason } from '../domain/stages';
import { dayKey, localParts, workMinutesBetween, zoned, type WorkHours } from '../domain/worktime';

/**
 * Что бот дублирует в Google-таблицу: листы, их заголовки и строки.
 * Первая колонка каждого листа — ключ: по ней скрипт таблицы находит
 * строку и обновляет её на месте.
 *
 * Состав — решение заказчика (04.10.2026): заявки целиком, с именами
 * и контактами, история действий, проекты и задачи, итоги по неделям.
 * Доступов (паролей) здесь нет и быть не должно: в таблицу уходят только
 * их названия в истории.
 */

export type Cell = string | number;
/** `keep` — строки, выпавшие из выборки, в таблице остаются: их просто больше не обновляют. */
export type Sheet = { name: string; header: string[]; rows: Map<string, Cell[]>; keep?: boolean };

const PROJECT_STATUS = { active: 'В работе', paused: 'На паузе', done: 'Завершён', cancelled: 'Отменён' } as const;

/** «2026-10-04 15:22» в поясе студии — таблица читает это как дату, а сортируется оно и как текст. */
function stamp(date: Date | null, tz: string): string {
  if (!date) return '';
  const p = localParts(date, tz);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${two(p.m)}-${two(p.d)} ${two(Math.floor(p.min / 60))}:${two(p.min % 60)}`;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/* ---------- заявки ---------- */

const LEADS_HEADER = [
  '№',
  'Пришла',
  'Имя',
  'Контакт',
  'Направление',
  'Откуда',
  'Источник',
  'Страница',
  'Этап',
  'Причина отказа',
  'Ведёт',
  'Взята',
  'Первый ответ',
  'Ответ, раб. мин',
  'Закрыта',
  'Ловушка',
  'Проект',
  'Текст заявки'
];

async function leadsSheet(db: Db, work: WorkHours): Promise<Sheet> {
  const list = await db
    .select({ lead: leads, owner: members.name, project: projects.title })
    .from(leads)
    .leftJoin(members, eq(members.id, leads.ownerId))
    .leftJoin(projects, eq(projects.leadId, leads.id))
    .orderBy(asc(leads.id));
  const rows = new Map<string, Cell[]>();
  for (const { lead: l, owner, project } of list) {
    rows.set(String(l.id), [
      l.id,
      stamp(l.createdAt, work.tz),
      l.name,
      l.contact,
      KIND_LABEL[l.kind] ?? l.kind,
      SOURCE_LABEL[l.source],
      sourceOf(l).label,
      l.page ?? '',
      STAGE_LABEL[l.stage],
      l.lostReason ? (LOST_REASONS[l.lostReason as LostReason] ?? l.lostReason) : '',
      owner ?? '',
      stamp(l.takenAt, work.tz),
      stamp(l.firstReplyAt, work.tz),
      l.firstReplyAt ? workMinutesBetween(l.createdAt, l.firstReplyAt, work) : '',
      stamp(l.closedAt, work.tz),
      l.spam ? 'да' : '',
      project ?? '',
      l.task
    ]);
  }
  return { name: 'Заявки', header: LEADS_HEADER, rows };
}

/* ---------- проекты и задачи ---------- */

const PROJECTS_HEADER = [
  '№',
  'Название',
  'Клиент',
  'Контакт',
  'Направление',
  'Состояние',
  'Ведёт',
  'Этап сейчас',
  'Этапов пройдено',
  'Этапов всего',
  'Открытых задач',
  'Просрочено',
  'Ближайший срок',
  'Создан',
  'Закрыт',
  'Заявка №'
];
const TASKS_HEADER = ['№', 'Проект', 'Этап', 'Задача', 'Исполнитель', 'Срок', 'Состояние', 'Создана', 'Выполнена'];

async function projectSheets(db: Db, work: WorkHours, today: string): Promise<Sheet[]> {
  const list = await db
    .select({ p: projects, owner: members.name })
    .from(projects)
    .leftJoin(members, eq(members.id, projects.ownerId))
    .orderBy(asc(projects.id));
  const stages = await db.select().from(projectStages).orderBy(asc(projectStages.position));
  const allTasks = await db
    .select({ t: tasks, who: members.name })
    .from(tasks)
    .leftJoin(members, eq(members.id, tasks.assigneeId))
    .orderBy(asc(tasks.id));

  const projectRows = new Map<string, Cell[]>();
  for (const { p, owner } of list) {
    const own = stages.filter((s) => s.projectId === p.id);
    const todo = own.filter((s) => !s.doneAt);
    const open = allTasks.filter((x) => x.t.projectId === p.id && !x.t.doneAt);
    const dues = [...todo.map((s) => s.dueOn), ...open.map((x) => x.t.dueOn)].filter((d): d is string => !!d).sort();
    const archived = p.status === 'done' || p.status === 'cancelled';
    projectRows.set(String(p.id), [
      p.id,
      p.title,
      p.client,
      p.contact ?? '',
      KIND_LABEL[p.kind] ?? p.kind,
      PROJECT_STATUS[p.status],
      owner ?? '',
      todo[0]?.title ?? '',
      own.length - todo.length,
      own.length,
      open.length,
      archived ? 0 : dues.filter((d) => d < today).length,
      dues[0] ?? '',
      stamp(p.createdAt, work.tz),
      stamp(p.closedAt, work.tz),
      p.leadId ?? ''
    ]);
  }

  const title = new Map(list.map(({ p }) => [p.id, p.title]));
  const stageTitle = new Map(stages.map((s) => [s.id, s.title]));
  const taskRows = new Map<string, Cell[]>();
  for (const { t, who } of allTasks) {
    taskRows.set(String(t.id), [
      t.id,
      title.get(t.projectId) ?? '',
      t.stageId ? (stageTitle.get(t.stageId) ?? '') : '',
      t.title,
      who ?? '',
      t.dueOn ?? '',
      t.doneAt ? 'выполнена' : t.dueOn && t.dueOn < today ? 'просрочена' : 'открыта',
      stamp(t.createdAt, work.tz),
      stamp(t.doneAt, work.tz)
    ]);
  }
  return [
    { name: 'Проекты', header: PROJECTS_HEADER, rows: projectRows },
    { name: 'Задачи', header: TASKS_HEADER, rows: taskRows }
  ];
}

/* ---------- история действий ---------- */

const HISTORY_HEADER = ['Код', 'Когда', 'Где', '№', 'Название', 'Кто', 'Что', 'Подробности'];

function leadAction(type: string, data: Record<string, unknown> | null): [string, string] {
  const stage = (id: unknown) => STAGE_LABEL[id as keyof typeof STAGE_LABEL] ?? str(id);
  switch (type) {
    case 'created':
      return ['Заявка пришла', SOURCE_LABEL[data?.source as keyof typeof SOURCE_LABEL] ?? ''];
    case 'taken':
      return ['Взял заявку', ''];
    case 'released':
      return ['Снял с себя', ''];
    case 'stage':
      return ['Этап', `${stage(data?.from)} → ${stage(data?.to)}`];
    case 'reopened':
      return ['Вернул в работу', `${stage(data?.from)} → ${stage(data?.to)}`];
    case 'lost':
      return ['Отказ', str(data?.label) || str(data?.reason)];
    case 'note':
      return ['Заметка', str(data?.text)];
    case 'reminded':
      return ['Напоминание: никто не взял', ''];
    case 'alarmed':
      return ['Вечерняя тревога: клиенту не ответили', ''];
    default:
      return [type, ''];
  }
}

const PROJECT_ACTION: Record<string, string> = {
  created: 'Проект заведён',
  status: 'Состояние',
  stage_done: 'Этап выполнен',
  stage_reopened: 'Этап снова в работе',
  stage_added: 'Добавлен этап',
  stage_removed: 'Удалён этап',
  task_added: 'Новая задача',
  task_done: 'Задача выполнена',
  task_reopened: 'Задача снова открыта',
  task_removed: 'Удалена задача',
  material_added: 'Добавлен материал',
  material_removed: 'Удалён материал',
  secret_added: 'Добавлен доступ',
  secret_changed: 'Изменён доступ',
  secret_viewed: 'Просмотр доступа',
  secret_removed: 'Удалён доступ'
};

function projectDetails(type: string, data: Record<string, unknown> | null) {
  if (type === 'status') return `${PROJECT_STATUS[data?.from as keyof typeof PROJECT_STATUS] ?? ''} → ${PROJECT_STATUS[data?.to as keyof typeof PROJECT_STATUS] ?? ''}`;
  if (type === 'created') return data?.leadId ? `из заявки №${String(data.leadId)}` : 'вручную';
  return str(data?.title);
}

export type Cursor = { lead: number; project: number };

/** Новые события после курсора. История только дописывается, поэтому хватает номера последнего события. */
async function historyRows(db: Db, work: WorkHours, after: Cursor): Promise<{ rows: Map<string, Cell[]>; cursor: Cursor }> {
  const rows = new Map<string, Cell[]>();
  const cursor = { ...after };

  const le = await db
    .select({ e: leadEvents, who: members.name, name: leads.name })
    .from(leadEvents)
    .innerJoin(leads, eq(leads.id, leadEvents.leadId))
    .leftJoin(members, eq(members.id, leadEvents.memberId))
    .where(gt(leadEvents.id, after.lead))
    .orderBy(asc(leadEvents.id));
  for (const { e, who, name } of le) {
    const [what, details] = leadAction(e.type, e.data);
    rows.set(`L${e.id}`, [`L${e.id}`, stamp(e.createdAt, work.tz), 'Заявка', e.leadId, name, who ?? '', what, details]);
    cursor.lead = Math.max(cursor.lead, e.id);
  }

  const pe = await db
    .select({ e: projectEvents, who: members.name, title: projects.title })
    .from(projectEvents)
    .innerJoin(projects, eq(projects.id, projectEvents.projectId))
    .leftJoin(members, eq(members.id, projectEvents.memberId))
    .where(gt(projectEvents.id, after.project))
    .orderBy(asc(projectEvents.id));
  for (const { e, who, title } of pe) {
    rows.set(`P${e.id}`, [`P${e.id}`, stamp(e.createdAt, work.tz), 'Проект', e.projectId, title, who ?? '', PROJECT_ACTION[e.type] ?? e.type, projectDetails(e.type, e.data)]);
    cursor.project = Math.max(cursor.project, e.id);
  }
  return { rows, cursor };
}

/* ---------- итоги по неделям ---------- */

const WEEKS_HEADER = [
  'Неделя с',
  'по',
  'Заявок',
  'Связались',
  'Созвон / бриф',
  'КП отправлено',
  'Договор',
  'Договоров сейчас',
  'Отказов',
  'Первый ответ, раб. мин',
  'Ответов в срок',
  'Без ответа',
  'Откуда',
  'Причины отказов'
];

/** Сколько последних недель пересчитывается: заявки прошлых недель ещё движутся по воронке. */
const WEEKS_BACK = 12;
const DAY = 86_400_000;

async function weeksSheet(db: Db, work: WorkHours, slaMin: number, now: Date): Promise<Sheet> {
  const rows = new Map<string, Cell[]>();
  const today = dayKey(now, work.tz);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const thisMonday = Date.parse(`${today}T00:00:00Z`) - ((dow + 6) % 7) * DAY;
  const at = (ms: number) => {
    const d = new Date(ms);
    return zoned(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 0, work.tz);
  };
  for (let i = WEEKS_BACK; i >= 1; i--) {
    const monday = thisMonday - i * 7 * DAY;
    const m = await computeMetrics(db, { from: at(monday), to: at(monday + 7 * DAY), work, slaMin, now });
    // пустые недели до первой заявки в таблице не нужны
    if (!m.leads.total) continue;
    const key = new Date(monday).toISOString().slice(0, 10);
    const reached = (stage: string) => m.funnel.find((f) => f.stage === stage)?.reached ?? 0;
    rows.set(key, [
      key,
      new Date(monday + 6 * DAY).toISOString().slice(0, 10),
      m.leads.total,
      reached('contacted'),
      reached('call'),
      reached('proposal'),
      reached('contract'),
      m.leads.won,
      m.leads.lost,
      m.firstReply.medianMin ?? '',
      m.firstReply.answered ? `${m.firstReply.withinSla} из ${m.firstReply.answered}` : '',
      m.firstReply.waiting,
      m.bySource.map((s) => `${s.label} — ${s.count}`).join(', '),
      m.lostReasons.map((r) => `${r.label} — ${r.count}`).join(', ')
    ]);
  }
  // недели старше WEEKS_BACK не пересчитываются, но и не удаляются
  return { name: 'Итоги по неделям', header: WEEKS_HEADER, rows, keep: true };
}

/* ---------- всё вместе ---------- */

export const HISTORY = { name: 'История', header: HISTORY_HEADER };

export async function snapshot(db: Db, opts: { work: WorkHours; slaMin: number; now: Date; after: Cursor }) {
  const today = dayKey(opts.now, opts.work.tz);
  const [projectsSheet, tasksSheet] = await projectSheets(db, opts.work, today);
  const history = await historyRows(db, opts.work, opts.after);
  return {
    /** Листы, которые сверяются целиком: строка уходит в таблицу, только если изменилась. */
    sheets: [await leadsSheet(db, opts.work), projectsSheet!, tasksSheet!, await weeksSheet(db, opts.work, opts.slaMin, opts.now)],
    history: { ...HISTORY, rows: history.rows },
    cursor: history.cursor
  };
}
