import type { Db } from '../db/client';
import { jobRuns } from '../db/schema';
import { logAlarm, markReminded, unansweredLeads, untakenLeads } from '../domain/leads';
import { morning, weekly } from '../domain/digest';
import { isoWeek } from '../domain/metrics';
import { alarmSlot, needsReminder, unansweredForAlarm, type Sla } from '../domain/sla';
import { dayKey, localParts } from '../domain/worktime';
import type { StudioBot } from '../tg/bot';
import { errorLine } from '../../../lib/redact';

/**
 * Расписание: раз в полминуты сервис смотрит, не пора ли кого-то
 * позвать или прислать сводку. Решения «пора» по заявкам — в domain/sla.ts,
 * что попадает в сводки — в domain/digest.ts, здесь только исполнение.
 *
 * Своя таблица запусков вместо очереди: сервис один, задач немного,
 * а ключ запуска не даёт повторить вечернюю тревогу после перезапуска.
 */

/**
 * Сроки и то, какие сводки включены. Сводки можно не указывать — тогда
 * обе идут, как шли всегда.
 */
export type Plan = Sla & { morningDigest?: boolean; weeklyDigest?: boolean };

/** Записать запуск по ключу. false — такой уже был. */
export async function claim(db: Db, key: string, at = new Date()) {
  const rows = await db.insert(jobRuns).values({ key, ranAt: at }).onConflictDoNothing().returning();
  return rows.length > 0;
}

export async function tick(db: Db, studio: StudioBot | null, sla: Plan, now = new Date()) {
  // заявки, пришедшие при недоступном Telegram: карточки догоняют, как только связь есть
  if (studio) await studio.publishPending(now).catch((e) => console.error('[bot] карточки', errorLine(e)));

  // напоминание «никто не взял»: одно на заявку
  for (const lead of await untakenLeads(db)) {
    if (!needsReminder(lead, now, sla)) continue;
    await markReminded(db, lead.id, now);
    if (studio) await studio.remind(lead).catch((e) => console.error('[sla] напоминание', lead.id, errorLine(e)));
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
      if (studio && list.length) await studio.alarm(list).catch((e) => console.error('[sla] тревога', errorLine(e)));
    }
  }

  // Сводки — с начала рабочего дня. Ключи — день и неделя: сервис лежал
  // утром — пришлёт, как поднимется, но не дважды.
  const local = localParts(now, sla.work.tz);
  if (sla.work.days.includes(local.dow) && local.min >= sla.work.start) {
    const today = dayKey(now, sla.work.tz);
    // Выключенная сводка день не занимает: включили в середине дня — придёт сегодняшняя.
    if (sla.morningDigest !== false && (await claim(db, `digest:${today}`, now))) {
      const m = await morning(db, now, sla.work);
      if (studio) await studio.morningDigest(m, today).catch((e) => console.error('[digest] утро', errorLine(e)));
    }
    // итоги прошлой недели — в первый рабочий день новой
    if (sla.weeklyDigest !== false && (await claim(db, `week:${isoWeek(today)}`, now))) {
      const w = await weekly(db, now, sla.work, sla.takeMin);
      if (studio) await studio.weeklyDigest(w).catch((e) => console.error('[digest] неделя', errorLine(e)));
    }
  }
}

/**
 * `plan` — готовые сроки или функция, которая их отдаёт. Функция зовётся
 * на каждом заходе: настройки меняют из приложения, и новый час
 * напоминания должен начать действовать без перезапуска сервиса.
 */
export function startScheduler(db: Db, studio: StudioBot | null, plan: Plan | (() => Promise<Plan>), everyMs = 30_000) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await tick(db, studio, typeof plan === 'function' ? await plan() : plan);
    } catch (e) {
      console.error('[scheduler]', errorLine(e));
    } finally {
      running = false;
    }
  };
  const timer = setInterval(run, everyMs);
  void run();
  return () => clearInterval(timer);
}
