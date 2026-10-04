/**
 * Расписание демо «Бритва»: окна в мини-приложении обязаны совпадать
 * с дырами в панели владельца. Если запись встанет поверх чужой, демо
 * врёт ровно в том месте, ради которого его собирали.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { anyStarts, freeStarts, priceFor, seedDay, duration } from '../.test-out/lib/barber.js';
import { BOOK, MASTERS, SERVICES, SHOP } from '../.test-out/content/concepts/barber.js';

const overlap = (a, b) => a.start < b.start + b.min && b.start < a.start + a.min;
const days = Array.from({ length: 60 }, (_, i) => new Date(2026, 9, 1 + i));

test('день одинаков при каждом расчёте', () => {
  const d = new Date(2026, 9, 10);
  assert.deepEqual(seedDay(BOOK, d), seedDay(BOOK, new Date(2026, 9, 10)));
});

test('у мастера записи не накладываются и не выходят за часы работы', () => {
  for (const d of days) {
    const busy = seedDay(BOOK, d);
    for (const m of MASTERS) {
      const mine = busy.filter((b) => b.master === m.id);
      mine.forEach((a, i) => {
        assert.ok(a.start >= SHOP.open && a.start + a.min <= SHOP.close, `${d.toDateString()} ${m.id}`);
        mine.slice(i + 1).forEach((b) => assert.ok(!overlap(a, b), `${d.toDateString()} ${m.id}`));
      });
    }
  }
});

test('окно никогда не ложится на занятое и влезает до закрытия', () => {
  for (const d of days) {
    const busy = seedDay(BOOK, d);
    for (const s of SERVICES) {
      for (const m of MASTERS) {
        for (const t of freeStarts(BOOK, busy, m.id, s.min)) {
          const slot = { start: t, min: s.min };
          assert.ok(t + s.min <= SHOP.close);
          busy.filter((b) => b.master === m.id).forEach((b) => assert.ok(!overlap(slot, b)));
        }
      }
    }
  }
});

test('на длинную услугу окон не больше, чем на короткую', () => {
  for (const d of days) {
    const busy = seedDay(BOOK, d);
    for (const m of MASTERS) {
      assert.ok(freeStarts(BOOK, busy, m.id, 90).length <= freeStarts(BOOK, busy, m.id, 30).length);
    }
  }
});

test('сегодня — не раньше чем через час, с шагом сетки', () => {
  const busy = seedDay(BOOK, new Date(2026, 9, 10));
  const starts = freeStarts(BOOK, busy, 'ilya', 30, 14 * 60 + 10);
  assert.ok(starts.every((t) => t >= 14 * 60 + 30 && t % 30 === 0));
});

test('перенос: своя запись не загораживает саму себя', () => {
  const own = { id: 'own', master: 'ilya', start: 12 * 60, min: 60, service: 'cut', client: 'Алексей' };
  const busy = [own];
  assert.ok(!freeStarts(BOOK, busy, 'ilya', 60).includes(12 * 60));
  assert.ok(freeStarts(BOOK, busy, 'ilya', 60, 0, 'own').includes(12 * 60));
});

test('«любой мастер» отдаёт окно самому доступному из свободных', () => {
  const busy = [{ id: 'x', master: 'ilya', start: 12 * 60, min: 60, service: 'cut', client: 'Олег' }];
  const any = anyStarts(BOOK, busy, 60);
  assert.equal(any.get(10 * 60), 'ilya');
  assert.equal(any.get(12 * 60), 'timur');
});

test('цена у старшего мастера — с надбавкой и круглая', () => {
  const combo = SERVICES.find((s) => s.id === 'combo');
  const [ilya, timur, artem] = MASTERS;
  assert.equal(priceFor(combo, ilya), 2700);
  assert.equal(priceFor(combo, timur), 3100);
  assert.equal(priceFor(combo, artem), 3500);
});

test('длительность словами', () => {
  assert.equal(duration(30), '30 мин');
  assert.equal(duration(60), '1 ч');
  assert.equal(duration(90), '1 ч 30 мин');
});
