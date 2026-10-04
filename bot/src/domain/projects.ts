import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, max } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  materials,
  members,
  projectEvents,
  projectStages,
  projects,
  secrets,
  tasks,
  type FileKind,
  type ProjectStatus
} from '../db/schema';
import type { Lead, Member } from './leads';
import { seal, unseal } from './seal';
import { projectTitle, stagesFor } from './templates';

/**
 * Проекты: этапы по шаблону направления, задачи, материалы, доступы.
 * Как и с заявками, всё идёт через эти функции — каждая пишет событие
 * в историю проекта. Сроки — дни без времени («2026-10-15»); какой
 * сегодня день, решает вызывающий: он знает пояс студии.
 */

export type Project = typeof projects.$inferSelect;
export type ProjectStage = typeof projectStages.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Material = typeof materials.$inferSelect;
type EventType = (typeof projectEvents.$inferInsert)['type'];

/** После этих состояний проект в архиве: сроки по нему не напоминаются. */
export const ARCHIVED: ProjectStatus[] = ['done', 'cancelled'];

const event = (db: Db, projectId: number, memberId: number | null, type: EventType, data: Record<string, unknown> | null, at: Date) =>
  db.insert(projectEvents).values({ projectId, memberId, type, data, createdAt: at });

const clean = (s: string, limit: number) => s.trim().slice(0, limit);

/* ---------- проект ---------- */

export type NewProject = {
  client: string;
  kind: string;
  title?: string;
  contact?: string | null;
  leadId?: number | null;
  ownerId?: number | null;
};

async function insertProject(tx: Db, input: NewProject, memberId: number | null, at: Date): Promise<Project> {
  const client = clean(input.client, 120);
  const [project] = await tx
    .insert(projects)
    .values({
      title: clean(input.title ?? '', 160) || projectTitle(input.kind, client),
      client,
      contact: input.contact ? clean(input.contact, 160) : null,
      kind: input.kind,
      leadId: input.leadId ?? null,
      ownerId: input.ownerId ?? memberId,
      createdAt: at
    })
    .returning();
  await tx.insert(projectStages).values(stagesFor(input.kind).map((title, i) => ({ projectId: project!.id, position: i + 1, title })));
  await event(tx, project!.id, memberId, 'created', input.leadId ? { leadId: input.leadId } : null, at);
  return project!;
}

export async function createProject(db: Db, input: NewProject, memberId: number | null, at = new Date()) {
  return db.transaction((tx) => insertProject(tx, input, memberId, at));
}

/**
 * Заявка дошла до «Договора» — из неё вырастает проект с этапами по её
 * направлению. Один раз: заявку можно вернуть в работу и снова довести
 * до договора — второй проект не появится. Вызывается внутри той же
 * транзакции, что меняет этап.
 */
export async function projectFromLead(tx: Db, lead: Lead, memberId: number, at = new Date()) {
  const [existing] = await tx.select().from(projects).where(eq(projects.leadId, lead.id));
  if (existing) return existing;
  return insertProject(tx, { client: lead.name, contact: lead.contact, kind: lead.kind, leadId: lead.id, ownerId: lead.ownerId ?? memberId }, memberId, at);
}

export async function getProject(db: Db, id: number) {
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  return p ?? null;
}

export type ProjectPatch = { title?: string; client?: string; contact?: string | null; status?: ProjectStatus; ownerId?: number | null };

export async function updateProject(db: Db, id: number, memberId: number, patch: ProjectPatch, at = new Date()) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(projects).where(eq(projects.id, id)).for('update');
    if (!before) return null;
    const set: Partial<Project> = {};
    if (patch.title !== undefined && clean(patch.title, 160)) set.title = clean(patch.title, 160);
    if (patch.client !== undefined && clean(patch.client, 120)) set.client = clean(patch.client, 120);
    if (patch.contact !== undefined) set.contact = patch.contact ? clean(patch.contact, 160) : null;
    if (patch.ownerId !== undefined) set.ownerId = patch.ownerId;
    if (patch.status && patch.status !== before.status) {
      set.status = patch.status;
      set.closedAt = ARCHIVED.includes(patch.status) ? at : null;
      await event(tx, id, memberId, 'status', { from: before.status, to: patch.status }, at);
    }
    if (!Object.keys(set).length) return before;
    const [next] = await tx.update(projects).set(set).where(eq(projects.id, id)).returning();
    return next!;
  });
}

export type ProjectRow = Project & {
  ownerName: string | null;
  /** Текущий этап — первый невыполненный. */
  stage: string | null;
  stagesDone: number;
  stagesTotal: number;
  openTasks: number;
  /** Просроченные задачи и этапы. */
  overdue: number;
  /** Ближайший срок среди открытых задач и этапов. */
  nextDue: string | null;
};

/**
 * Список проектов. Сначала те, где что-то просрочено, потом по ближайшему
 * сроку; проекты без сроков — в конце, свежие выше.
 */
export async function listProjects(db: Db, scope: 'active' | 'archive' | 'all', today: string): Promise<ProjectRow[]> {
  const where =
    scope === 'archive' ? inArray(projects.status, ARCHIVED) : scope === 'active' ? inArray(projects.status, ['active', 'paused']) : undefined;
  const rows = await db
    .select({ p: projects, ownerName: members.name })
    .from(projects)
    .leftJoin(members, eq(members.id, projects.ownerId))
    .where(where)
    .orderBy(desc(projects.createdAt), desc(projects.id));
  if (!rows.length) return [];

  const ids = rows.map((r) => r.p.id);
  const stages = await db.select().from(projectStages).where(inArray(projectStages.projectId, ids)).orderBy(asc(projectStages.position));
  const open = await db
    .select()
    .from(tasks)
    .where(and(inArray(tasks.projectId, ids), isNull(tasks.doneAt)));

  const list = rows.map(({ p, ownerName }): ProjectRow => {
    const own = stages.filter((s) => s.projectId === p.id);
    const todo = own.filter((s) => !s.doneAt);
    const mine = open.filter((t) => t.projectId === p.id);
    const dues = [...todo.map((s) => s.dueOn), ...mine.map((t) => t.dueOn)].filter((d): d is string => !!d).sort();
    return {
      ...p,
      ownerName,
      stage: todo[0]?.title ?? null,
      stagesDone: own.length - todo.length,
      stagesTotal: own.length,
      openTasks: mine.length,
      overdue: ARCHIVED.includes(p.status) ? 0 : dues.filter((d) => d < today).length,
      nextDue: dues[0] ?? null
    };
  });

  if (scope === 'archive') return list;
  return list.sort((a, b) => Number(b.overdue > 0) - Number(a.overdue > 0) || (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999'));
}

export type ProjectEvent = { id: number; type: EventType; at: Date; who: string | null; data: Record<string, unknown> | null };

/** Проект целиком — всё, что показывает его экран. Значений доступов здесь нет, только названия. */
export async function projectView(db: Db, id: number) {
  const [row] = await db
    .select({ p: projects, ownerName: members.name })
    .from(projects)
    .leftJoin(members, eq(members.id, projects.ownerId))
    .where(eq(projects.id, id));
  if (!row) return null;
  const stages = await db.select().from(projectStages).where(eq(projectStages.projectId, id)).orderBy(asc(projectStages.position), asc(projectStages.id));
  // открытые задачи — по сроку (без срока в конце), выполненные — следом, свежие выше
  const allTasks = await db.select().from(tasks).where(eq(tasks.projectId, id)).orderBy(asc(tasks.id));
  const mats = await db.select().from(materials).where(eq(materials.projectId, id)).orderBy(asc(materials.id));
  const keys = await db
    .select({ id: secrets.id, title: secrets.title, updatedAt: secrets.updatedAt })
    .from(secrets)
    .where(eq(secrets.projectId, id))
    .orderBy(asc(secrets.id));
  const events: ProjectEvent[] = await db
    .select({ id: projectEvents.id, type: projectEvents.type, at: projectEvents.createdAt, who: members.name, data: projectEvents.data })
    .from(projectEvents)
    .leftJoin(members, eq(members.id, projectEvents.memberId))
    .where(eq(projectEvents.projectId, id))
    .orderBy(desc(projectEvents.createdAt), desc(projectEvents.id))
    .limit(60);

  const openTasks = allTasks.filter((t) => !t.doneAt).sort((a, b) => (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999') || a.id - b.id);
  const doneTasks = allTasks.filter((t) => t.doneAt).sort((a, b) => b.doneAt!.getTime() - a.doneAt!.getTime());
  return {
    project: row.p,
    ownerName: row.ownerName,
    stages,
    tasks: [...openTasks, ...doneTasks],
    // file_id — внутреннее дело бота: приложению он не нужен
    materials: mats.map(({ fileId: _fileId, ...m }) => m),
    secrets: keys,
    events
  };
}

/* ---------- этапы ---------- */

export async function addStage(db: Db, projectId: number, memberId: number, input: { title: string; dueOn?: string | null }, at = new Date()) {
  const title = clean(input.title, 120);
  if (!title || !(await getProject(db, projectId))) return null;
  return db.transaction(async (tx) => {
    const [last] = await tx.select({ n: max(projectStages.position) }).from(projectStages).where(eq(projectStages.projectId, projectId));
    const [stage] = await tx
      .insert(projectStages)
      .values({ projectId, position: (last?.n ?? 0) + 1, title, dueOn: input.dueOn ?? null })
      .returning();
    await event(tx, projectId, memberId, 'stage_added', { title }, at);
    return stage!;
  });
}

export type StagePatch = { title?: string; dueOn?: string | null; done?: boolean };

export async function updateStage(db: Db, stageId: number, memberId: number, patch: StagePatch, at = new Date()) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(projectStages).where(eq(projectStages.id, stageId)).for('update');
    if (!before) return null;
    const set: Partial<ProjectStage> = {};
    if (patch.title !== undefined && clean(patch.title, 120)) set.title = clean(patch.title, 120);
    if (patch.dueOn !== undefined) set.dueOn = patch.dueOn;
    if (patch.done !== undefined && patch.done !== Boolean(before.doneAt)) {
      set.doneAt = patch.done ? at : null;
      await event(tx, before.projectId, memberId, patch.done ? 'stage_done' : 'stage_reopened', { title: set.title ?? before.title }, at);
    }
    if (!Object.keys(set).length) return before;
    const [next] = await tx.update(projectStages).set(set).where(eq(projectStages.id, stageId)).returning();
    return next!;
  });
}

/** Задачи этапа не пропадают: остаются в проекте без этапа. */
export async function removeStage(db: Db, stageId: number, memberId: number, at = new Date()) {
  return db.transaction(async (tx) => {
    const [stage] = await tx.delete(projectStages).where(eq(projectStages.id, stageId)).returning();
    if (!stage) return null;
    await event(tx, stage.projectId, memberId, 'stage_removed', { title: stage.title }, at);
    return stage;
  });
}

/* ---------- задачи ---------- */

export type NewTask = { title: string; stageId?: number | null; assigneeId?: number | null; dueOn?: string | null };

/** Этап задачи обязан быть из того же проекта — чужой молча отбрасывается. */
async function ownStage(db: Db, projectId: number, stageId: number | null | undefined) {
  if (!stageId) return null;
  const [s] = await db
    .select({ id: projectStages.id })
    .from(projectStages)
    .where(and(eq(projectStages.id, stageId), eq(projectStages.projectId, projectId)));
  return s?.id ?? null;
}

export async function addTask(db: Db, projectId: number, memberId: number, input: NewTask, at = new Date()) {
  const title = clean(input.title, 300);
  if (!title || !(await getProject(db, projectId))) return null;
  return db.transaction(async (tx) => {
    const [task] = await tx
      .insert(tasks)
      .values({
        projectId,
        stageId: await ownStage(tx, projectId, input.stageId),
        title,
        assigneeId: input.assigneeId ?? null,
        dueOn: input.dueOn ?? null,
        createdBy: memberId,
        createdAt: at
      })
      .returning();
    await event(tx, projectId, memberId, 'task_added', { title }, at);
    return task!;
  });
}

export type TaskPatch = { title?: string; stageId?: number | null; assigneeId?: number | null; dueOn?: string | null; done?: boolean };

export async function updateTask(db: Db, taskId: number, memberId: number, patch: TaskPatch, at = new Date()) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).for('update');
    if (!before) return null;
    const set: Partial<Task> = {};
    if (patch.title !== undefined && clean(patch.title, 300)) set.title = clean(patch.title, 300);
    if (patch.stageId !== undefined) set.stageId = await ownStage(tx, before.projectId, patch.stageId);
    if (patch.assigneeId !== undefined) set.assigneeId = patch.assigneeId;
    if (patch.dueOn !== undefined) set.dueOn = patch.dueOn;
    if (patch.done !== undefined && patch.done !== Boolean(before.doneAt)) {
      set.doneAt = patch.done ? at : null;
      await event(tx, before.projectId, memberId, patch.done ? 'task_done' : 'task_reopened', { title: set.title ?? before.title }, at);
    }
    if (!Object.keys(set).length) return before;
    const [next] = await tx.update(tasks).set(set).where(eq(tasks.id, taskId)).returning();
    return next!;
  });
}

export async function removeTask(db: Db, taskId: number, memberId: number, at = new Date()) {
  return db.transaction(async (tx) => {
    const [task] = await tx.delete(tasks).where(eq(tasks.id, taskId)).returning();
    if (!task) return null;
    await event(tx, task.projectId, memberId, 'task_removed', { title: task.title }, at);
    return task;
  });
}

export type MyTask = Task & { project: string };

/** Открытые задачи человека по проектам в работе: сначала с ближайшим сроком. */
export async function myTasks(db: Db, memberId: number): Promise<MyTask[]> {
  const rows = await db
    .select({ t: tasks, project: projects.title })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(tasks.assigneeId, memberId), isNull(tasks.doneAt), eq(projects.status, 'active')));
  return rows.map((r) => ({ ...r.t, project: r.project })).sort((a, b) => (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999') || a.id - b.id);
}

export type Deadlines = {
  tasks: (Task & { project: string; assignee: Member | null })[];
  stages: (ProjectStage & { project: string; owner: Member | null })[];
};

/** Что горит: открытые задачи и этапы проектов в работе со сроком сегодня или раньше. */
export async function deadlines(db: Db, today: string): Promise<Deadlines> {
  const t = await db
    .select({ t: tasks, project: projects.title, assignee: members })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(members, eq(members.id, tasks.assigneeId))
    .where(and(isNull(tasks.doneAt), isNotNull(tasks.dueOn), lte(tasks.dueOn, today), eq(projects.status, 'active')))
    .orderBy(asc(tasks.dueOn), asc(tasks.id));
  const s = await db
    .select({ s: projectStages, project: projects.title, owner: members })
    .from(projectStages)
    .innerJoin(projects, eq(projects.id, projectStages.projectId))
    .leftJoin(members, eq(members.id, projects.ownerId))
    .where(and(isNull(projectStages.doneAt), isNotNull(projectStages.dueOn), lte(projectStages.dueOn, today), eq(projects.status, 'active')))
    .orderBy(asc(projectStages.dueOn), asc(projectStages.id));
  return {
    tasks: t.map((r) => ({ ...r.t, project: r.project, assignee: r.assignee })),
    stages: s.map((r) => ({ ...r.s, project: r.project, owner: r.owner }))
  };
}

/* ---------- материалы ---------- */

export async function addLink(db: Db, projectId: number, memberId: number, input: { title?: string; url: string }, at = new Date()) {
  if (!(await getProject(db, projectId))) return null;
  const url = input.url.trim();
  // название не дали — хватит адреса сайта: «figma.com»
  const title = clean(input.title ?? '', 160) || new URL(url).hostname.replace(/^www\./, '');
  return db.transaction(async (tx) => {
    const [m] = await tx.insert(materials).values({ projectId, kind: 'link', title, url, addedBy: memberId, createdAt: at }).returning();
    await event(tx, projectId, memberId, 'material_added', { title, kind: 'link' }, at);
    return m!;
  });
}

export type NewFile = { fileId: string; fileKind: FileKind; title?: string; fileName?: string | null; fileSize?: number | null };

export async function addFile(db: Db, projectId: number, memberId: number, input: NewFile, at = new Date()) {
  if (!(await getProject(db, projectId))) return null;
  const title = clean(input.title ?? '', 160) || clean(input.fileName ?? '', 160) || 'Файл';
  return db.transaction(async (tx) => {
    const [m] = await tx
      .insert(materials)
      .values({
        projectId,
        kind: 'file',
        title,
        fileId: input.fileId,
        fileKind: input.fileKind,
        fileName: input.fileName ?? null,
        fileSize: input.fileSize ?? null,
        addedBy: memberId,
        createdAt: at
      })
      .returning();
    await event(tx, projectId, memberId, 'material_added', { title, kind: 'file' }, at);
    return m!;
  });
}

export async function getMaterial(db: Db, id: number) {
  const [m] = await db.select().from(materials).where(eq(materials.id, id));
  return m ?? null;
}

export async function removeMaterial(db: Db, id: number, memberId: number, at = new Date()) {
  return db.transaction(async (tx) => {
    const [m] = await tx.delete(materials).where(eq(materials.id, id)).returning();
    if (!m) return null;
    await event(tx, m.projectId, memberId, 'material_removed', { title: m.title }, at);
    return m;
  });
}

/* ---------- доступы ---------- */

/** Проект входит в проверяемые данные шифра: строку не переставить в другой проект. */
const scope = (projectId: number) => `project:${projectId}`;

export async function addSecret(db: Db, key: Buffer, projectId: number, memberId: number, input: { title: string; value: string }, at = new Date()) {
  const title = clean(input.title, 160);
  if (!title || !input.value || !(await getProject(db, projectId))) return null;
  return db.transaction(async (tx) => {
    const [s] = await tx
      .insert(secrets)
      .values({ projectId, title, sealed: seal(key, scope(projectId), input.value), addedBy: memberId, createdAt: at, updatedAt: at })
      .returning({ id: secrets.id, projectId: secrets.projectId, title: secrets.title });
    await event(tx, projectId, memberId, 'secret_added', { title }, at);
    return s!;
  });
}

export async function changeSecret(db: Db, key: Buffer, id: number, memberId: number, patch: { title?: string; value?: string }, at = new Date()) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(secrets).where(eq(secrets.id, id)).for('update');
    if (!before) return null;
    const title = (patch.title !== undefined && clean(patch.title, 160)) || before.title;
    const sealed = patch.value ? seal(key, scope(before.projectId), patch.value) : before.sealed;
    await tx.update(secrets).set({ title, sealed, updatedAt: at }).where(eq(secrets.id, id));
    await event(tx, before.projectId, memberId, 'secret_changed', { title }, at);
    return { id, projectId: before.projectId, title };
  });
}

/**
 * Показать значение. Каждый просмотр пишется в историю проекта —
 * кто и когда смотрел пароль, должно быть видно.
 * `value: null` — строка не расшифровалась: ключ другой или запись испорчена.
 */
export async function revealSecret(db: Db, key: Buffer, id: number, memberId: number, at = new Date()) {
  const [s] = await db.select().from(secrets).where(eq(secrets.id, id));
  if (!s) return null;
  const value = unseal(key, scope(s.projectId), s.sealed);
  if (value !== null) await event(db, s.projectId, memberId, 'secret_viewed', { title: s.title }, at);
  return { projectId: s.projectId, title: s.title, value };
}

export async function removeSecret(db: Db, id: number, memberId: number, at = new Date()) {
  return db.transaction(async (tx) => {
    const [s] = await tx.delete(secrets).where(eq(secrets.id, id)).returning({ projectId: secrets.projectId, title: secrets.title });
    if (!s) return null;
    await event(tx, s.projectId, memberId, 'secret_removed', { title: s.title }, at);
    return s;
  });
}
