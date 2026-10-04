import { and, asc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { leadEvents, leads, projects, tasks, type Stage } from '../db/schema';
import type { Lead } from './leads';
import { deadlines } from './projects';
import { FUNNEL, LOST_REASONS, type LostReason } from './stages';
import { dayKey, workMinutesBetween, zoned, type WorkHours } from './worktime';

/**
 * Метрики: всё считается из заявок и их истории — отдельной «аналитики»
 * в базе нет, поэтому цифры не могут разойтись с тем, что было на самом деле.
 *
 * Счёт — по когорте: заявки, пришедшие за период. Воронка отвечает на
 * вопрос «сколько из пришедших дошли до этапа», а не «сколько карточек
 * сейчас на нём стоит»; заявка, дошедшая до КП и получившая отказ,
 * в «КП отправлено» посчитана.
 *
 * Время первого ответа — в рабочих минутах: заявка, пришедшая в субботу
 * и принятая в понедельник в 10:20, ждала двадцать минут, а не двое суток.
 */

export type Bucket = 'day' | 'week' | 'month';

export type Metrics = {
  from: string | null;
  to: string;
  leads: { total: number; spam: number; open: number; won: number; lost: number };
  /** Сколько заявок когорты дошли до каждого этапа воронки. */
  funnel: { stage: Stage; reached: number }[];
  firstReply: {
    answered: number;
    /** Медиана в рабочих минутах; null — отвечать было некому. */
    medianMin: number | null;
    withinSla: number;
    slaMin: number;
    /** Ещё на «Новой» — клиенту не ответили. */
    waiting: number;
  };
  bySource: { id: string; label: string; count: number; won: number }[];
  byKind: { id: string; count: number; won: number }[];
  lostReasons: { id: string; label: string; count: number }[];
  bucket: Bucket;
  timeline: { start: string; count: number }[];
  /** Проекты — как есть сейчас; завершённые — за период. */
  projects: { active: number; paused: number; done: number; openTasks: number; overdueTasks: number; overdueStages: number };
  /** Такой же по длине период перед этим — для сравнения. Для «всё время» его нет. */
  previous: { total: number; won: number } | null;
};

const DAY = 86_400_000;

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** Понедельник недели, в которую попадает день. */
function mondayOf(day: string) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((dow + 6) % 7));
}

const bucketOf = (day: string, bucket: Bucket) => (bucket === 'day' ? day : bucket === 'week' ? mondayOf(day) : `${day.slice(0, 7)}-01`);

function nextBucket(start: string, bucket: Bucket) {
  if (bucket === 'day') return addDays(start, 1);
  if (bucket === 'week') return addDays(start, 7);
  const [y, m] = start.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 1)).toISOString().slice(0, 10);
}

/** До какого этапа воронки заявка дошла за всю свою историю. */
function reached(lead: Lead, events: { type: string; data: Record<string, unknown> | null }[]) {
  let idx = Math.max(0, FUNNEL.indexOf(lead.stage));
  for (const e of events) {
    const stage = e.type === 'lost' ? e.data?.from : e.type === 'stage' || e.type === 'reopened' ? e.data?.to : null;
    idx = Math.max(idx, FUNNEL.indexOf(stage as Stage));
  }
  return idx;
}

/**
 * Откуда заявка. С сайта — по тому, что он запомнил при первом заходе:
 * рекламная метка главнее сайта-источника, тот главнее «пришёл напрямую».
 */
export function sourceOf(lead: Pick<Lead, 'source' | 'meta'>): { id: string; label: string } {
  if (lead.source === 'mail') return { id: 'mail', label: 'Почта' };
  if (lead.source === 'manual') return { id: 'manual', label: 'Вручную' };
  // отдельной строкой, а не по меткам: видно, сколько заявок дала сама «Помощь»
  if (lead.source === 'help') return { id: 'help', label: '«Помощь»: напишем сами' };
  const utm = lead.meta?.utm_source?.trim().toLowerCase();
  if (utm) return { id: `utm:${utm}`, label: utm };
  if (lead.meta?.ref) return { id: `ref:${lead.meta.ref}`, label: lead.meta.ref };
  // заявки, пришедшие до того, как сайт начал запоминать источник
  return lead.meta ? { id: 'direct', label: 'Прямой заход' } : { id: 'unknown', label: 'Сайт, источник не записан' };
}

function tally<T extends { id: string }>(items: (T & { won: boolean })[]) {
  const map = new Map<string, T & { count: number; won: number }>();
  for (const { won, ...item } of items) {
    const row = map.get(item.id) ?? { ...(item as unknown as T), count: 0, won: 0 };
    row.count++;
    if (won) row.won++;
    map.set(item.id, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

export type MetricsInput = { from: Date | null; to: Date; work: WorkHours; slaMin: number; now?: Date };

export async function computeMetrics(db: Db, { from, to, work, slaMin, now = to }: MetricsInput): Promise<Metrics> {
  const tz = work.tz;
  const range = and(from ? gte(leads.createdAt, from) : undefined, lt(leads.createdAt, to));
  const all = await db.select().from(leads).where(range).orderBy(asc(leads.createdAt));
  const cohort = all.filter((l) => !l.spam);

  const events = cohort.length
    ? await db
        .select({ leadId: leadEvents.leadId, type: leadEvents.type, data: leadEvents.data })
        .from(leadEvents)
        .where(
          and(
            inArray(
              leadEvents.leadId,
              cohort.map((l) => l.id)
            ),
            inArray(leadEvents.type, ['stage', 'reopened', 'lost'])
          )
        )
    : [];
  const byLead = new Map<number, typeof events>();
  for (const e of events) byLead.set(e.leadId, [...(byLead.get(e.leadId) ?? []), e]);

  const depth = cohort.map((l) => reached(l, byLead.get(l.id) ?? []));
  const funnel = FUNNEL.map((stage, i) => ({ stage, reached: depth.filter((d) => d >= i).length }));

  const won = (l: Lead) => l.stage === 'contract';
  const replies = cohort.filter((l) => l.firstReplyAt).map((l) => workMinutesBetween(l.createdAt, l.firstReplyAt!, work));

  // ось времени: дни — до месяца, недели — до полугода, дальше месяцы
  const firstDay = dayKey(from ?? all[0]?.createdAt ?? to, tz);
  const lastDay = dayKey(new Date(to.getTime() - 1), tz);
  const span = Math.round((Date.parse(lastDay) - Date.parse(firstDay)) / DAY) + 1;
  const bucket: Bucket = span <= 31 ? 'day' : span <= 183 ? 'week' : 'month';
  const counts = new Map<string, number>();
  for (const l of cohort) {
    const key = bucketOf(dayKey(l.createdAt, tz), bucket);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const timeline: Metrics['timeline'] = [];
  for (let start = bucketOf(firstDay, bucket); start <= lastDay; start = nextBucket(start, bucket)) {
    timeline.push({ start, count: counts.get(start) ?? 0 });
  }

  const today = dayKey(now, tz);
  const allProjects = await db.select({ status: projects.status, closedAt: projects.closedAt }).from(projects);
  const due = await deadlines(db, today);
  const openTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(isNull(tasks.doneAt), eq(projects.status, 'active')));

  let previous: Metrics['previous'] = null;
  if (from) {
    // столько же целых дней перед началом периода: «7 дней» сравниваются с семью предыдущими
    const length = Math.ceil((to.getTime() - from.getTime()) / DAY) * DAY;
    const before = await db
      .select({ stage: leads.stage })
      .from(leads)
      .where(and(gte(leads.createdAt, new Date(from.getTime() - length)), lt(leads.createdAt, from), eq(leads.spam, false)));
    previous = { total: before.length, won: before.filter((l) => l.stage === 'contract').length };
  }

  return {
    from: from ? from.toISOString() : null,
    to: to.toISOString(),
    leads: {
      total: cohort.length,
      spam: all.length - cohort.length,
      open: cohort.filter((l) => l.stage !== 'contract' && l.stage !== 'lost').length,
      won: cohort.filter(won).length,
      lost: cohort.filter((l) => l.stage === 'lost').length
    },
    funnel,
    firstReply: {
      answered: replies.length,
      medianMin: median(replies),
      withinSla: replies.filter((m) => m <= slaMin).length,
      slaMin,
      waiting: cohort.filter((l) => l.stage === 'new').length
    },
    bySource: tally(cohort.map((l) => ({ ...sourceOf(l), won: won(l) }))),
    byKind: tally(cohort.map((l) => ({ id: l.kind, won: won(l) }))),
    lostReasons: tally(cohort.filter((l) => l.stage === 'lost' && l.lostReason).map((l) => ({ id: l.lostReason!, label: LOST_REASONS[l.lostReason as LostReason] ?? l.lostReason!, won: false }))).map(
      ({ id, label, count }) => ({ id, label, count })
    ),
    bucket,
    timeline,
    projects: {
      active: allProjects.filter((p) => p.status === 'active').length,
      paused: allProjects.filter((p) => p.status === 'paused').length,
      done: allProjects.filter((p) => p.status === 'done' && p.closedAt && (!from || p.closedAt >= from) && p.closedAt < to).length,
      openTasks: openTasks.length,
      overdueTasks: due.tasks.filter((t) => t.dueOn! < today).length,
      overdueStages: due.stages.filter((s) => s.dueOn! < today).length
    },
    previous
  };
}

/** Период «последние N дней»: с начала дня N−1 дней назад (в поясе студии) до этой минуты. */
export function lastDays(days: number, now: Date, tz: string): { from: Date; to: Date } {
  const [y, m, d] = addDays(dayKey(now, tz), -(days - 1))
    .split('-')
    .map(Number);
  return { from: zoned(y!, m!, d!, 0, tz), to: now };
}

/** Прошлая неделя целиком: с понедельника по воскресенье, в поясе студии. */
export function lastWeek(now: Date, tz: string): { from: Date; to: Date; monday: string; sunday: string } {
  const thisMonday = mondayOf(dayKey(now, tz));
  const monday = addDays(thisMonday, -7);
  const at = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return zoned(y!, m!, d!, 0, tz);
  };
  return { from: at(monday), to: at(thisMonday), monday, sunday: addDays(thisMonday, -1) };
}

/** Номер недели по ISO («2026-W41») — ключ запуска итогов недели. */
export function isoWeek(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  // четверг той же недели определяет год и номер
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
