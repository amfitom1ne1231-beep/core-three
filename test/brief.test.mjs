/**
 * Бриф на /contact: ориентир по срокам и то, как он написан.
 *
 * Ориентир — первое число, которое человек видит от студии, и оно
 * обязано совпадать с паспортами направлений. Здесь же ловится то, что
 * однажды уже проскочило: «1–1 неделя» для мониторинга.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { estimate, formatEstimate } from '../.test-out/content/brief.js';

const show = (needs, stage = null) => {
  const e = estimate(needs, stage);
  return e ? Object.values(formatEstimate(e)).join(' ') : null;
};

test('ничего не выбрано или «пока не знаю» — ориентира нет', () => {
  assert.equal(show([]), null);
  assert.equal(show(['unsure']), null);
});

test('сроки совпадают с паспортами направлений', () => {
  assert.equal(show(['site']), '1–4 недели');
  assert.equal(show(['bot']), '1–4 недели');
  assert.equal(show(['shop']), '4–8 недель');
});

test('мониторинг в одиночку — в днях, как на его странице', () => {
  assert.equal(show(['ops']), '2–3 дня');
  // «есть идея» мониторингу ничего не добавляет: прототипировать нечего
  assert.equal(show(['ops'], 'idea'), '2–3 дня');
});

test('мониторинг вместе со сборкой срок не удлиняет', () => {
  assert.equal(show(['site', 'ops']), show(['site']));
});

test('каждое следующее направление — плюс неделя, идея — ещё неделя', () => {
  assert.equal(show(['site', 'shop']), '5–9 недель');
  assert.equal(show(['site'], 'idea'), '2–5 недель');
});

test('одинаковые границы пишутся одним числом', () => {
  assert.deepEqual(formatEstimate({ lo: 3, hi: 3, unit: 'weeks' }), { value: '3', unit: 'недели' });
  assert.deepEqual(formatEstimate({ lo: 1, hi: 1, unit: 'weeks' }), { value: '1', unit: 'неделя' });
  assert.deepEqual(formatEstimate({ lo: 5, hi: 5, unit: 'days' }), { value: '5', unit: 'дней' });
});
