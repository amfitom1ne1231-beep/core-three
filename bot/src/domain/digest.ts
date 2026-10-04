import { and, asc, eq, gte, max, notInArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { leadEvents, leads, members } from '../db/schema';
import type { LeadRow } from './leads';
import { computeMetrics, lastWeek, type Metrics } from './metrics';
import { deadlines, type Deadlines } from './projects';
import { CLOSED } from './stages';
import { dayKey, localParts, workMinutesBetween, zoned, type WorkHours } from './worktime';

/**
 * Сводки в группу: утренняя — в начале каждого рабочего дня, итоги недели —
 * в её первый рабочий день. Здесь только то, что в них попадает; слова
 * и разметку подбирает бот.
 */

export type Morning = {
  /** Сколько заявок пришло с начала прошлого рабочего дня. */
  arrived: number;
  /** Клиенту ещё не ответили — этап «Новая». */
  waiting: LeadRow[];
  /** Открытые заявки, по которым ничего не происходило два рабочих дня и больше. */
  stale: (LeadRow & { idleDays: number })[];
  due: Deadlines;
};

/** Начало предыдущего рабочего дня: от него считаются «новые со вчера». */
function previousWorkStart(now: Date, work: WorkHours) {
  for (let back = 1; back <= 14; back++) {
    const p = localParts(new Date(now.getTime() - back * 86_400_000), work.tz);
    if (work.days.includes(p.dow)) return zoned(p.y, p.m, p.d, work.start, work.tz);
  }
  return new Date(now.getTime() - 86_400_000);
}

const STALE_WORK_DAYS = 2;

export async function morning(db: Db, now: Date, work: WorkHours): Promise<Morning> {
  const since = previousWorkStart(now, work);
  const arrived = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(gte(leads.createdAt, since), eq(leads.spam, false)));

  const open = await db
    .select({ lead: leads, ownerName: members.name })
    .from(leads)
    .leftJoin(members, eq(members.id, leads.ownerId))
    .where(and(notInArray(leads.stage, CLOSED), eq(leads.spam, false)))
    .orderBy(asc(leads.createdAt));
  const rows: LeadRow[] = open.map((r) => ({ ...r.lead, ownerName: r.ownerName }));

  // последнее событие по каждой открытой заявке: давно ли к ней прикасались
  const last = new Map<number, Date>();
  for (const r of await db.select({ leadId: leadEvents.leadId, at: max(leadEvents.createdAt) }).from(leadEvents).groupBy(leadEvents.leadId)) {
    if (r.at) last.set(r.leadId, r.at);
  }
  const dayLen = work.end - work.start;
  const stale = rows
    .filter((l) => l.stage !== 'new')
    .map((l) => ({ ...l, idleDays: Math.floor(workMinutesBetween(last.get(l.id) ?? l.createdAt, now, work) / dayLen) }))
    .filter((l) => l.idleDays >= STALE_WORK_DAYS)
    .sort((a, b) => b.idleDays - a.idleDays);

  return { arrived: arrived.length, waiting: rows.filter((l) => l.stage === 'new'), stale, due: await deadlines(db, dayKey(now, work.tz)) };
}

export type Weekly = { monday: string; sunday: string; metrics: Metrics };

/** Итоги прошлой недели — те же метрики, что в приложении, за понедельник–воскресенье. */
export async function weekly(db: Db, now: Date, work: WorkHours, slaMin: number): Promise<Weekly> {
  const { from, to, monday, sunday } = lastWeek(now, work.tz);
  return { monday, sunday, metrics: await computeMetrics(db, { from, to, work, slaMin, now }) };
}
