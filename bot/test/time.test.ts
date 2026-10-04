/**
 * Рабочее время и сроки: заявка в пятницу ночью не «просрочивается»
 * к субботнему утру, а напоминание и тревога не будят команду.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Lead } from '../src/domain/leads';
import { alarmSlot, needsReminder, unansweredForAlarm, type Sla } from '../src/domain/sla';
import { dayKey, isWorkTime, shortTime, workMinutesBetween, zoned, type WorkHours } from '../src/domain/worktime';

const W: WorkHours = { tz: 'Europe/Moscow', days: [1, 2, 3, 4, 5], start: 600, end: 1140 };
const SLA: Sla = { work: W, takeMin: 60, alarmBeforeEndMin: 60 };
/** Московское время: 2026-10-05 — понедельник. */
const msk = (d: number, hh: number, mm = 0) => zoned(2026, 10, d, hh * 60 + mm, 'Europe/Moscow');

const lead = (over: Partial<Lead> = {}): Lead =>
  ({
    id: 1,
    source: 'site',
    name: 'Анна',
    contact: '@anna',
    task: 'лендинг',
    kind: 'sites',
    page: '/sites',
    meta: null,
    spam: false,
    stage: 'new',
    lostReason: null,
    ownerId: null,
    createdAt: msk(5, 11),
    takenAt: null,
    firstReplyAt: null,
    closedAt: null,
    remindedAt: null,
    cardChatId: null,
    cardMessageId: null,
    ...over
  }) as Lead;

test('пояс студии, а не сервера: 10:00 МСК — это 07:00 UTC', () => {
  assert.equal(msk(5, 10).toISOString(), '2026-10-05T07:00:00.000Z');
  assert.equal(dayKey(msk(5, 23, 30), 'Europe/Moscow'), '2026-10-05');
});

test('рабочее время: будни с 10 до 19', () => {
  assert.ok(isWorkTime(msk(5, 10), W));
  assert.ok(!isWorkTime(msk(5, 9, 59), W));
  assert.ok(!isWorkTime(msk(5, 19), W));
  assert.ok(!isWorkTime(msk(10, 12), W), 'суббота');
});

test('минуты считаются только рабочие', () => {
  assert.equal(workMinutesBetween(msk(5, 11), msk(5, 12), W), 60);
  assert.equal(workMinutesBetween(msk(5, 18, 30), msk(6, 10, 30), W), 60, 'вечер и утро следующего дня');
  assert.equal(workMinutesBetween(msk(9, 23), msk(12, 10, 0), W), 0, 'пятница ночью → понедельник 10:00');
  assert.equal(workMinutesBetween(msk(9, 23), msk(12, 11, 0), W), 60);
});

test('напоминание: час рабочего времени без «Беру», и только одно', () => {
  assert.ok(!needsReminder(lead(), msk(5, 11, 59), SLA));
  assert.ok(needsReminder(lead(), msk(5, 12), SLA));
  assert.ok(!needsReminder(lead({ ownerId: 3 }), msk(5, 15), SLA), 'уже взяли');
  assert.ok(!needsReminder(lead({ remindedAt: msk(5, 12) }), msk(5, 15), SLA), 'уже напоминали');
  assert.ok(!needsReminder(lead({ spam: true }), msk(5, 15), SLA), 'ловушка');
  assert.ok(!needsReminder(lead({ createdAt: msk(9, 22) }), msk(10, 14), SLA), 'суббота — не дёргаем');
});

test('вечерняя тревога: в рабочий день за час до конца, ключ — день', () => {
  assert.deepEqual(alarmSlot(msk(5, 17, 59), SLA), { due: false, key: 'alarm:2026-10-05' });
  assert.equal(alarmSlot(msk(5, 18), SLA).due, true);
  assert.equal(alarmSlot(msk(10, 18), SLA).due, false, 'суббота');
});

test('в тревогу — только те, у кого был рабочий час на ответ', () => {
  const list = [
    lead({ id: 1, createdAt: msk(5, 11) }),
    lead({ id: 2, createdAt: msk(5, 17, 50) }),
    lead({ id: 3, createdAt: msk(5, 11), firstReplyAt: msk(5, 12) })
  ];
  assert.deepEqual(
    unansweredForAlarm(list, msk(5, 18), SLA).map((l) => l.id),
    [1]
  );
});

test('время в карточке: сегодня — часы, вчера — словом', () => {
  assert.equal(shortTime(msk(5, 9, 5), msk(5, 12), 'Europe/Moscow'), '9:05');
  assert.equal(shortTime(msk(4, 21, 40), msk(5, 12), 'Europe/Moscow'), 'вчера, 21:40');
  assert.equal(shortTime(msk(1, 14, 0), msk(5, 12), 'Europe/Moscow'), '1 окт, 14:00');
});
