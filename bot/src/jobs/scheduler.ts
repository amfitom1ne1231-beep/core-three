import type { Db } from '../db/client';
import { jobRuns } from '../db/schema';
import { logAlarm, markReminded, unansweredLeads, untakenLeads } from '../domain/leads';
import { morning, weekly } from '../domain/digest';
import { isoWeek } from '../domain/metrics';
import { alarmSlot, needsReminder, unansweredForAlarm, type Sla } from '../domain/sla';
import { dayKey, localParts } from '../domain/worktime';
import type { StudioBot } from '../tg/bot';

/**
 * Расписание: раз в полминуты сервис смотрит, не пора ли кого-то
 * позвать или прислать сводку. Решения «пора» по заявкам — в domain/sla.ts,
 * что попадает в сводки — в domain/digest.ts, здесь только исполнение.
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

  // Сводки — с начала рабочего дня. Ключи — день и неделя: сервис лежал
  // утром — пришлёт, как поднимется, но не дважды.
  const local = localParts(now, sla.work.tz);
  if (sla.work.days.includes(local.dow) && local.min >= sla.work.start) {
    const today = dayKey(now, sla.work.tz);
    if (await claim(db, `digest:${today}`, now)) {
      const m = await morning(db, now, sla.work);
      if (studio) await studio.morningDigest(m, today).catch((e) => console.error('[digest] утро', e));
    }
    // итоги прошлой недели — в первый рабочий день новой
    if (await claim(db, `week:${isoWeek(today)}`, now)) {
      const w = await weekly(db, now, sla.work, sla.takeMin);
      if (studio) await studio.weeklyDigest(w).catch((e) => console.error('[digest] неделя', e));
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
