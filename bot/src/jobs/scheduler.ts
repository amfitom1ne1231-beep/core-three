import type { Db } from '../db/client';
import { jobRuns } from '../db/schema';
import { logAlarm, markReminded, unansweredLeads, untakenLeads } from '../domain/leads';
import { alarmSlot, needsReminder, unansweredForAlarm, type Sla } from '../domain/sla';
import type { StudioBot } from '../tg/bot';

/**
 * Расписание: раз в полминуты сервис смотрит, не пора ли кого-то
 * позвать. Решения «пора» — в domain/sla.ts, здесь только исполнение.
 *
 * Своя таблица запусков вместо очереди: сервис один, задач немного,
 * а ключ запуска не даёт повторить вечернюю тревогу после перезапуска.
 */

/** Записать запуск по ключу. false — такой уже был. */
export async function claim(db: Db, key: string, at = new Date()) {
  const rows = await db.insert(jobRuns).values({ key, ranAt: at }).onConflictDoNothing().returning();
  return rows.length > 0;
}

export async function tick(db: Db, studio: StudioBot | null, sla: Sla, now = new Date()) {
  // напоминание «никто не взял»: одно на заявку
  for (const lead of await untakenLeads(db)) {
    if (!needsReminder(lead, now, sla)) continue;
    await markReminded(db, lead.id, now);
    if (studio) await studio.remind(lead).catch((e) => console.error('[sla] напоминание', lead.id, e));
  }

  // вечерняя тревога: раз в рабочий день
  const slot = alarmSlot(now, sla);
  if (slot.due) {
    const list = unansweredForAlarm(await unansweredLeads(db), now, sla);
    if (await claim(db, slot.key, now)) {
      await logAlarm(
        db,
        list.map((l) => l.id),
        now
      );
      if (studio && list.length) await studio.alarm(list).catch((e) => console.error('[sla] тревога', e));
    }
  }
}

export function startScheduler(db: Db, studio: StudioBot | null, sla: Sla, everyMs = 30_000) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await tick(db, studio, sla);
    } catch (e) {
      console.error('[scheduler]', e);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(run, everyMs);
  void run();
  return () => clearInterval(timer);
}
