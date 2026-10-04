import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { LEAD_KINDS } from '../../../lib/lead';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { PROJECT_STATUSES } from '../db/schema';
import {
  addLink,
  addSecret,
  addStage,
  addTask,
  changeSecret,
  createProject,
  getMaterial,
  listProjects,
  myTasks,
  projectView,
  removeMaterial,
  removeSecret,
  removeStage,
  removeTask,
  revealSecret,
  updateProject,
  updateStage,
  updateTask
} from '../domain/projects';
import { parseKey } from '../domain/seal';
import { team } from '../domain/team';
import { dayKey } from '../domain/worktime';
import type { StudioBot } from '../tg/bot';
import type { AppEnv } from './auth';

/**
 * API проектов для мини-приложения. Любое изменение возвращает проект
 * целиком — экран обновляется одним ответом. Значение доступа отдаётся
 * только отдельным запросом `reveal`, и каждый такой запрос остаётся
 * в истории проекта.
 */

const Id = z.coerce.number().int().positive();

/** Срок — день: «2026-10-15». null — снять срок. */
const Day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'нет такого дня')
  .nullable();

const MemberId = Id.nullable();

const NewProject = z.object({
  client: z.string().trim().min(1).max(120),
  kind: z.enum(LEAD_KINDS).default('general'),
  title: z.string().trim().max(160).optional(),
  contact: z.string().trim().max(160).optional()
});
const ProjectPatch = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  client: z.string().trim().min(1).max(120).optional(),
  contact: z.string().trim().max(160).nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  ownerId: MemberId.optional()
});
const NewStage = z.object({ title: z.string().trim().min(1).max(120), dueOn: Day.optional() });
const StagePatch = z.object({ title: z.string().trim().min(1).max(120).optional(), dueOn: Day.optional(), done: z.boolean().optional() });
const NewTask = z.object({
  title: z.string().trim().min(1).max(300),
  stageId: Id.nullable().optional(),
  assigneeId: MemberId.optional(),
  dueOn: Day.optional()
});
const TaskPatch = NewTask.partial().extend({ done: z.boolean().optional() });
const NewLink = z.object({
  title: z.string().trim().max(160).optional(),
  url: z.url({ protocol: /^https?$/ }).max(2000)
});
const NewSecret = z.object({ title: z.string().trim().min(1).max(160), value: z.string().min(1).max(8000) });
const SecretPatch = z.object({ title: z.string().trim().min(1).max(160).optional(), value: z.string().min(1).max(8000).optional() });

export function mountProjects(
  api: Hono<AppEnv>,
  { db, config, studio, now, log }: { db: Db; config: Config; studio: StudioBot | null; now: () => Date; log: (line: string) => void }
) {
  const key = config.SECRETS_KEY ? parseKey(config.SECRETS_KEY) : null;
  const today = () => dayKey(now(), config.work.tz);

  /** Исполнитель и ведущий — только из команды. */
  async function inTeam(id: number | null | undefined) {
    return id == null || (await team(db)).some((m) => m.id === id);
  }

  type Ctx = Context<AppEnv>;
  const param = (c: Ctx) => Id.safeParse(c.req.param('id'));
  const body = async <T>(c: Ctx, schema: z.ZodType<T>) => schema.safeParse(await c.req.json().catch(() => null));
  const notFound = (c: Ctx) => c.json({ error: 'not found' }, 404);
  const bad = (c: Ctx) => c.json({ error: 'bad request' }, 400);

  async function view(c: Ctx, projectId: number, status: 200 | 201 = 200) {
    const v = await projectView(db, projectId);
    return v ? c.json(v, status) : notFound(c);
  }

  /* ---------- проекты ---------- */

  api.get('/projects', async (c) => {
    const scope = z.enum(['active', 'archive', 'all']).default('active').safeParse(c.req.query('scope'));
    if (!scope.success) return bad(c);
    return c.json({ projects: await listProjects(db, scope.data, today()), today: today() });
  });

  api.post('/projects', async (c) => {
    const b = await body(c, NewProject);
    if (!b.success) return bad(c);
    const me = c.get('member').id;
    const project = await createProject(db, b.data, me, now());
    log(`проект #${project.id} заведён вручную — участник ${me}`);
    return view(c, project.id, 201);
  });

  api.get('/projects/:id', async (c) => {
    const id = param(c);
    return id.success ? view(c, id.data) : notFound(c);
  });

  api.post('/projects/:id', async (c) => {
    const id = param(c);
    const b = await body(c, ProjectPatch);
    if (!id.success) return notFound(c);
    if (!b.success || !(await inTeam(b.data.ownerId))) return bad(c);
    const me = c.get('member').id;
    if (!(await updateProject(db, id.data, me, b.data, now()))) return notFound(c);
    if (b.data.status) log(`проект #${id.data} ${b.data.status} — участник ${me}`);
    return view(c, id.data);
  });

  /* ---------- этапы ---------- */

  api.post('/projects/:id/stages', async (c) => {
    const id = param(c);
    const b = await body(c, NewStage);
    if (!id.success) return notFound(c);
    if (!b.success) return bad(c);
    return (await addStage(db, id.data, c.get('member').id, b.data, now())) ? view(c, id.data) : notFound(c);
  });

  api.post('/stages/:id', async (c) => {
    const id = param(c);
    const b = await body(c, StagePatch);
    if (!id.success) return notFound(c);
    if (!b.success) return bad(c);
    const stage = await updateStage(db, id.data, c.get('member').id, b.data, now());
    return stage ? view(c, stage.projectId) : notFound(c);
  });

  api.post('/stages/:id/remove', async (c) => {
    const id = param(c);
    const stage = id.success ? await removeStage(db, id.data, c.get('member').id, now()) : null;
    return stage ? view(c, stage.projectId) : notFound(c);
  });

  /* ---------- задачи ---------- */

  api.get('/tasks/mine', async (c) => c.json({ tasks: await myTasks(db, c.get('member').id), today: today() }));

  api.post('/projects/:id/tasks', async (c) => {
    const id = param(c);
    const b = await body(c, NewTask);
    if (!id.success) return notFound(c);
    if (!b.success || !(await inTeam(b.data.assigneeId))) return bad(c);
    return (await addTask(db, id.data, c.get('member').id, b.data, now())) ? view(c, id.data) : notFound(c);
  });

  api.post('/tasks/:id', async (c) => {
    const id = param(c);
    const b = await body(c, TaskPatch);
    if (!id.success) return notFound(c);
    if (!b.success || !(await inTeam(b.data.assigneeId))) return bad(c);
    const task = await updateTask(db, id.data, c.get('member').id, b.data, now());
    return task ? view(c, task.projectId) : notFound(c);
  });

  api.post('/tasks/:id/remove', async (c) => {
    const id = param(c);
    const task = id.success ? await removeTask(db, id.data, c.get('member').id, now()) : null;
    return task ? view(c, task.projectId) : notFound(c);
  });

  /* ---------- материалы ---------- */

  api.post('/projects/:id/links', async (c) => {
    const id = param(c);
    const b = await body(c, NewLink);
    if (!id.success) return notFound(c);
    if (!b.success) return bad(c);
    return (await addLink(db, id.data, c.get('member').id, b.data, now())) ? view(c, id.data) : notFound(c);
  });

  api.post('/materials/:id/remove', async (c) => {
    const id = param(c);
    const m = id.success ? await removeMaterial(db, id.data, c.get('member').id, now()) : null;
    return m ? view(c, m.projectId) : notFound(c);
  });

  /** Файл лежит в Telegram — бот присылает его человеку в личку. */
  api.post('/materials/:id/send', async (c) => {
    const id = param(c);
    const m = id.success ? await getMaterial(db, id.data) : null;
    if (!m || m.kind !== 'file') return notFound(c);
    if (!studio) return c.json({ error: 'bot disabled' }, 503);
    try {
      await studio.sendFile(c.get('member').tgId, m);
    } catch (e) {
      console.error('[app] файл', m.id, e);
      return c.json({ error: 'send failed' }, 502);
    }
    return c.json({ ok: true });
  });

  /* ---------- доступы ---------- */

  const noKey = (c: Ctx) => c.json({ error: 'secrets disabled' }, 503);

  api.post('/projects/:id/secrets', async (c) => {
    if (!key) return noKey(c);
    const id = param(c);
    const b = await body(c, NewSecret);
    if (!id.success) return notFound(c);
    if (!b.success) return bad(c);
    const me = c.get('member').id;
    if (!(await addSecret(db, key, id.data, me, b.data, now()))) return notFound(c);
    log(`проект #${id.data}: доступ добавлен — участник ${me}`);
    return view(c, id.data);
  });

  api.post('/secrets/:id', async (c) => {
    if (!key) return noKey(c);
    const id = param(c);
    const b = await body(c, SecretPatch);
    if (!id.success) return notFound(c);
    if (!b.success) return bad(c);
    const s = await changeSecret(db, key, id.data, c.get('member').id, b.data, now());
    return s ? view(c, s.projectId) : notFound(c);
  });

  api.post('/secrets/:id/reveal', async (c) => {
    if (!key) return noKey(c);
    const id = param(c);
    const me = c.get('member').id;
    const s = id.success ? await revealSecret(db, key, id.data, me, now()) : null;
    if (!s) return notFound(c);
    if (s.value === null) return c.json({ error: 'cannot decrypt' }, 500);
    log(`проект #${s.projectId}: доступ показан — участник ${me}`);
    // значение не должно осесть ни в каком кэше
    c.header('Cache-Control', 'no-store');
    return c.json({ value: s.value });
  });

  api.post('/secrets/:id/remove', async (c) => {
    const id = param(c);
    const s = id.success ? await removeSecret(db, id.data, c.get('member').id, now()) : null;
    return s ? view(c, s.projectId) : notFound(c);
  });

  return { secretsEnabled: Boolean(key) };
}
