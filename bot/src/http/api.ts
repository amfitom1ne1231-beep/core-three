import { Hono } from 'hono';
import { z } from 'zod';
import { checkLead, LEAD_KINDS } from '../../../lib/lead';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { STAGES } from '../db/schema';
import {
  addNote,
  createLead,
  leadHistory,
  leadView,
  listLeads,
  markLost,
  reopenLead,
  setStage,
  takeLead,
  type LeadFilter
} from '../domain/leads';
import { CLOSED, FUNNEL, KIND_LABEL, LOST_REASONS, SOURCE_LABEL, STAGE_LABEL, type LostReason } from '../domain/stages';
import { team } from '../domain/team';
import type { StudioBot } from '../tg/bot';
import { appAuth, type AppEnv } from './auth';
import { mountProjects } from './projects-api';

/**
 * API мини-приложения. Делает то же, что кнопки под карточкой в группе,
 * и теми же функциями (`domain/leads.ts`): действие из приложения
 * попадает в историю заявки и тут же обновляет её карточку в группе.
 */

const Id = z.coerce.number().int().positive();

const ListQuery = z.object({
  scope: z.enum(['open', 'closed', 'all']).optional(),
  stage: z.enum(STAGES).optional(),
  owner: z.union([z.literal('none'), z.literal('me'), Id]).optional(),
  q: z.string().max(100).optional()
});

const StageBody = z.object({ stage: z.enum(FUNNEL as [string, ...string[]]) });
const LostBody = z.object({ reason: z.enum(Object.keys(LOST_REASONS) as [LostReason, ...LostReason[]]) });
const NoteBody = z.object({ text: z.string().trim().min(1).max(2000) });
const NewLeadBody = z.object({
  name: z.string(),
  contact: z.string(),
  task: z.string(),
  kind: z.enum(LEAD_KINDS).default('general'),
  /** Завёл — значит, ведёт: так чаще всего и бывает. */
  take: z.boolean().default(true)
});

export function createApi({
  db,
  config,
  studio,
  now = () => new Date()
}: {
  db: Db;
  config: Config;
  studio: StudioBot | null;
  now?: () => Date;
}) {
  const api = new Hono<AppEnv>();
  api.use('*', appAuth({ db, config, now }));

  /** Что делают из приложения — в лог, как и нажатия в группе. Без имён. */
  const log = config.NODE_ENV === 'test' ? () => {} : (line: string) => console.info(`[app] ${line}`);

  /** Карточка в группе — следом за действием; не вышло — действие уже записано. */
  const refresh = (id: number) => studio?.refreshCard(id).catch((e) => console.error('[app] карточка', id, e));

  async function detail(id: number) {
    const v = await leadView(db, id);
    if (!v) return null;
    return {
      lead: v.lead,
      owner: v.owner ? { id: v.owner.id, name: v.owner.name } : null,
      project: v.project,
      events: await leadHistory(db, id)
    };
  }

  const { secretsEnabled } = mountProjects(api, { db, config, studio, now, log });

  api.get('/me', async (c) => {
    const me = c.get('member');
    log(`открыто — участник ${me.id}`);
    const people = await team(db);
    return c.json({
      me: { id: me.id, name: me.name, role: me.role },
      team: people.map((m) => ({ id: m.id, name: m.name })),
      dict: {
        stages: STAGES.map((id) => ({ id, label: STAGE_LABEL[id] })),
        funnel: FUNNEL,
        closed: CLOSED,
        lostReasons: Object.entries(LOST_REASONS).map(([id, label]) => ({ id, label })),
        kinds: LEAD_KINDS.map((id) => ({ id, label: KIND_LABEL[id] ?? id })),
        sources: SOURCE_LABEL
      },
      tz: config.work.tz,
      // чего в этой установке нет: доступы — без ключа шифрования, файлы — без бота
      features: { secrets: secretsEnabled, files: Boolean(studio) }
    });
  });

  api.get('/leads', async (c) => {
    const q = ListQuery.safeParse(c.req.query());
    if (!q.success) return c.json({ error: 'bad request' }, 400);
    const { owner, ...rest } = q.data;
    const filter: LeadFilter = { ...rest, owner: owner === 'me' ? c.get('member').id : owner };
    return c.json({ leads: await listLeads(db, filter) });
  });

  api.post('/leads', async (c) => {
    const body = NewLeadBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad request' }, 400);
    // те же правила, что у формы сайта: имя, контакт, на который можно ответить, пара слов о задаче
    const check = checkLead({ ...body.data, consent: true, elapsed: Number.MAX_SAFE_INTEGER, website: '' });
    if (!check.ok) return c.json({ error: 'invalid', fields: check.errors }, 422);
    const { name, contact, task, kind } = check.lead;
    const lead = await createLead(db, { source: 'manual', name, contact, task, kind }, now());
    if (body.data.take) await takeLead(db, lead.id, c.get('member').id, now());
    if (studio) await studio.publishLead(lead.id).catch((e) => console.error('[app] карточка', lead.id, e));
    log(`#${lead.id} заведена вручную — участник ${c.get('member').id}`);
    return c.json(await detail(lead.id), 201);
  });

  api.get('/leads/:id', async (c) => {
    const id = Id.safeParse(c.req.param('id'));
    const d = id.success ? await detail(id.data) : null;
    return d ? c.json(d) : c.json({ error: 'not found' }, 404);
  });

  /** Действие над заявкой: проверить тело, выполнить, обновить карточку, вернуть заявку. */
  function action<T>(path: string, schema: z.ZodType<T> | null, run: (id: number, memberId: number, body: T) => Promise<unknown>) {
    api.post(`/leads/:id/${path}`, async (c) => {
      const id = Id.safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'not found' }, 404);
      const body = schema ? schema.safeParse(await c.req.json().catch(() => null)) : null;
      if (body && !body.success) return c.json({ error: 'bad request' }, 400);
      const done = await run(id.data, c.get('member').id, (body?.data ?? null) as T);
      if (!done) return c.json({ error: 'not found' }, 404);
      const arg = body?.data && typeof body.data === 'object' ? (Object.entries(body.data).find(([k]) => k !== 'text')?.[1] ?? '') : '';
      log(`#${id.data} ${path}${arg ? ` ${String(arg)}` : ''} — участник ${c.get('member').id}`);
      await refresh(id.data);
      return c.json(await detail(id.data));
    });
  }

  action('take', null, (id, me) => takeLead(db, id, me, now()));
  action('stage', StageBody, (id, me, b) => setStage(db, id, me, b.stage as (typeof FUNNEL)[number], now()));
  action('lost', LostBody, (id, me, b) => markLost(db, id, me, b.reason, now()));
  action('note', NoteBody, async (id, me, b) => ((await leadView(db, id)) ? addNote(db, id, me, b.text, now()) : null));
  action('reopen', null, (id, me) => reopenLead(db, id, me, now()));

  return api;
}
