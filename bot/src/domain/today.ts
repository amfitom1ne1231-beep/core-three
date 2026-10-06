import type { Db } from '../db/client';
import { morning } from './digest';
import { listLeads, type LeadRow, type Member } from './leads';
import { myTasks, type Deadlines, type MyTask } from './projects';
import { dayKey, type WorkHours } from './worktime';

/**
 * «Что ждёт меня сейчас» — одна выборка на пульт в боте и на экран
 * «Сегодня» в приложении: оба показывают одно и то же и расходиться
 * им незачем.
 */
export type Today = {
  /** День по часам студии, `2026-10-06`. */
  day: string;
  /** Клиенту ещё не ответили — этап «Новая». Сначала те, что ждут дольше. */
  waiting: LeadRow[];
  /** Открытые заявки, которые ведёт этот человек, — кроме тех, что уже в `waiting`. */
  mine: LeadRow[];
  /** Его открытые задачи: сначала с ближайшим сроком. */
  tasks: MyTask[];
  /** Что горит у всей команды: срок сегодня или раньше. */
  due: Deadlines;
  /** Открытые заявки без движения два рабочих дня и больше. */
  stale: (LeadRow & { idleDays: number })[];
};

export async function today(db: Db, me: Pick<Member, 'id'>, now: Date, work: WorkHours): Promise<Today> {
  const m = await morning(db, now, work);
  const waitingIds = new Set(m.waiting.map((l) => l.id));
  const mine = (await listLeads(db, { scope: 'open', owner: me.id })).filter((l) => !waitingIds.has(l.id));
  return { day: dayKey(now, work.tz), waiting: m.waiting, mine, tasks: await myTasks(db, me.id), due: m.due, stale: m.stale };
}

/** Сколько из того, что горит, — на этом человеке: его задачи и этапы проектов, которые он ведёт. */
export function dueFor(t: Today, memberId: number) {
  return {
    tasks: t.due.tasks.filter((x) => x.assigneeId === memberId),
    stages: t.due.stages.filter((x) => x.owner?.id === memberId)
  };
}
