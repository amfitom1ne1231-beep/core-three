import { and, asc, desc, eq, inArray, isNull, notInArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { leadEvents, leads, members, type Source, type Stage } from '../db/schema';
import { ANSWERED, CLOSED, LOST_REASONS, type LostReason } from './stages';

/**
 * Заявки: всё, что с ними происходит, идёт через эти функции — каждая
 * пишет событие в историю. По истории потом строятся метрики, поэтому
 * обойти её нельзя: менять заявку в обход значит потерять цифры.
 */

export type Lead = typeof leads.$inferSelect;
export type Member = typeof members.$inferSelect;

export type NewLead = {
  source: Source;
  name: string;
  contact: string;
  task: string;
  kind: string;
  page?: string | null;
  meta?: Record<string, string> | null;
  spam?: boolean;
};

export async function createLead(db: Db, input: NewLead, at = new Date()): Promise<Lead> {
  return db.transaction(async (tx) => {
    const [lead] = await tx
      .insert(leads)
      .values({ ...input, page: input.page ?? null, meta: input.meta ?? null, spam: input.spam ?? false, createdAt: at })
      .returning();
    await tx.insert(leadEvents).values({ leadId: lead!.id, type: 'created', data: { source: input.source }, createdAt: at });
    return lead!;
  });
}

export async function getLead(db: Db, id: number) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  return lead ?? null;
}

/** «Беру»: заявку ведёт этот человек. Перехват у коллеги тоже записывается. */
export async function takeLead(db: Db, id: number, memberId: number, at = new Date()) {
  return db.transaction(async (tx) => {
    const [lead] = await tx.select().from(leads).where(eq(leads.id, id)).for('update');
    if (!lead) return null;
    if (lead.ownerId === memberId) return lead;
    const [next] = await tx
      .update(leads)
      .set({ ownerId: memberId, takenAt: lead.takenAt ?? at })
      .where(eq(leads.id, id))
      .returning();
    await tx
      .insert(leadEvents)
      .values({ leadId: id, memberId, type: 'taken', data: { from: lead.ownerId }, createdAt: at });
    return next!;
  });
}

/**
 * Смена этапа. Попутно: первый ответ клиенту (с «Связались» и дальше),
 * закрытие на «Договоре», и «Беру» за того, кто двигает ничейную заявку —
 * раз двигает, значит ведёт.
 */
export async function setStage(db: Db, id: number, memberId: number, stage: Stage, at = new Date()) {
  return db.transaction(async (tx) => {
    const [lead] = await tx.select().from(leads).where(eq(leads.id, id)).for('update');
    if (!lead) return null;
    if (lead.stage === stage) return lead;
    const patch: Partial<Lead> = { stage };
    if (ANSWERED.includes(stage) && !lead.firstReplyAt) patch.firstReplyAt = at;
    if (CLOSED.includes(stage)) patch.closedAt = at;
    else {
      patch.closedAt = null;
      patch.lostReason = null;
    }
    if (!lead.ownerId) {
      patch.ownerId = memberId;
      patch.takenAt = lead.takenAt ?? at;
    }
    const [next] = await tx.update(leads).set(patch).where(eq(leads.id, id)).returning();
    const reopened = CLOSED.includes(lead.stage) && !CLOSED.includes(stage);
    await tx.insert(leadEvents).values({
      leadId: id,
      memberId,
      type: reopened ? 'reopened' : 'stage',
      data: { from: lead.stage, to: stage },
      createdAt: at
    });
    return next!;
  });
}

export async function markLost(db: Db, id: number, memberId: number, reason: LostReason, at = new Date()) {
  return db.transaction(async (tx) => {
    const [lead] = await tx.select().from(leads).where(eq(leads.id, id)).for('update');
    if (!lead) return null;
    const [next] = await tx
      .update(leads)
      .set({ stage: 'lost', lostReason: reason, closedAt: at, ownerId: lead.ownerId ?? memberId })
      .where(eq(leads.id, id))
      .returning();
    await tx.insert(leadEvents).values({
      leadId: id,
      memberId,
      type: 'lost',
      data: { from: lead.stage, reason, label: LOST_REASONS[reason] },
      createdAt: at
    });
    return next!;
  });
}

export async function addNote(db: Db, id: number, memberId: number, text: string, at = new Date()) {
  const body = text.trim().slice(0, 2000);
  if (!body) return null;
  const [ev] = await db.insert(leadEvents).values({ leadId: id, memberId, type: 'note', data: { text: body }, createdAt: at }).returning();
  return ev ?? null;
}

export async function setCard(db: Db, id: number, chatId: number, messageId: number) {
  await db.update(leads).set({ cardChatId: chatId, cardMessageId: messageId }).where(eq(leads.id, id));
}

export type LeadView = {
  lead: Lead;
  owner: Member | null;
  notes: { text: string; who: string | null; at: Date }[];
};

/** Всё, что нужно карточке: заявка, кто ведёт, последние заметки. */
export async function leadView(db: Db, id: number): Promise<LeadView | null> {
  const lead = await getLead(db, id);
  if (!lead) return null;
  const owner = lead.ownerId ? ((await db.select().from(members).where(eq(members.id, lead.ownerId)))[0] ?? null) : null;
  const rows = await db
    .select({ data: leadEvents.data, at: leadEvents.createdAt, who: members.name })
    .from(leadEvents)
    .leftJoin(members, eq(members.id, leadEvents.memberId))
    .where(and(eq(leadEvents.leadId, id), eq(leadEvents.type, 'note')))
    .orderBy(desc(leadEvents.createdAt), desc(leadEvents.id))
    .limit(3);
  return {
    lead,
    owner,
    notes: rows.map((r) => ({ text: String((r.data as { text?: string } | null)?.text ?? ''), who: r.who, at: r.at }))
  };
}

/** Открытые заявки — от старых к новым: сначала то, что ждёт дольше. */
export async function openLeads(db: Db) {
  return db
    .select()
    .from(leads)
    .where(and(notInArray(leads.stage, CLOSED), eq(leads.spam, false)))
    .orderBy(asc(leads.createdAt));
}

/** Ничейные новые заявки без напоминания — кандидаты на «никто не взял». */
export async function untakenLeads(db: Db) {
  return db
    .select()
    .from(leads)
    .where(and(eq(leads.stage, 'new'), isNull(leads.ownerId), isNull(leads.remindedAt), eq(leads.spam, false)));
}

/** Клиенту ещё не ответили: этап «Новая», заявка не закрыта. */
export async function unansweredLeads(db: Db) {
  return db
    .select()
    .from(leads)
    .where(and(isNull(leads.firstReplyAt), inArray(leads.stage, ['new']), eq(leads.spam, false)))
    .orderBy(asc(leads.createdAt));
}

export async function markReminded(db: Db, id: number, at = new Date()) {
  await db.transaction(async (tx) => {
    await tx.update(leads).set({ remindedAt: at }).where(eq(leads.id, id));
    await tx.insert(leadEvents).values({ leadId: id, type: 'reminded', createdAt: at });
  });
}

export async function logAlarm(db: Db, ids: number[], at = new Date()) {
  if (!ids.length) return;
  await db.insert(leadEvents).values(ids.map((leadId) => ({ leadId, type: 'alarmed' as const, createdAt: at })));
}
