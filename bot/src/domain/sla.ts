import type { Lead } from './leads';
import { dayKey, localParts, workMinutesBetween, type WorkHours } from './worktime';

/**
 * Сроки по заявкам — решение заказчика: «в рабочее время через час
 * без "Беру" — повтор в группу с отметкой всех; к вечеру без ответа
 * клиенту — тревога владельцу. Ночью и в выходные не дёргает».
 *
 * Здесь только решения «пора / не пора» — без базы и без Telegram,
 * чтобы их можно было проверить на любых часах.
 */

export type Sla = { work: WorkHours; takeMin: number; alarmBeforeEndMin: number };

/** Час рабочего времени без «Беру» — пора напомнить. Напоминание одно. */
export function needsReminder(lead: Lead, now: Date, sla: Sla) {
  if (lead.spam || lead.stage !== 'new' || lead.ownerId || lead.remindedAt) return false;
  return workMinutesBetween(lead.createdAt, now, sla.work) >= sla.takeMin;
}

/**
 * Вечерняя проверка: в рабочий день за час до конца. Ключ — день: если
 * сервис перезапускали, повторной тревоги не будет, а пропущенная
 * (сервис лежал в момент проверки) догонится до полуночи того же дня.
 */
export function alarmSlot(now: Date, sla: Sla): { due: boolean; key: string } {
  const p = localParts(now, sla.work.tz);
  const key = `alarm:${dayKey(now, sla.work.tz)}`;
  const due = sla.work.days.includes(p.dow) && p.min >= sla.work.end - sla.alarmBeforeEndMin;
  return { due, key };
}

/**
 * Кому не ответили к вечеру: клиенту никто не написал, хотя рабочий
 * час на это у команды был. Заявку, пришедшую за десять минут до проверки,
 * в тревогу не тащим — на неё ещё есть время.
 */
export function unansweredForAlarm(list: Lead[], now: Date, sla: Sla) {
  return list.filter(
    (l) => !l.spam && !l.firstReplyAt && l.stage === 'new' && workMinutesBetween(l.createdAt, now, sla.work) >= sla.takeMin
  );
}
