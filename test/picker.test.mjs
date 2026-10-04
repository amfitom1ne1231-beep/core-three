/**
 * Подбор решения («Помощь» и «Нужна помощь?» в брифе): что советуется
 * на какие ответы.
 *
 * Развилки — черновик, заказчик правит их на живом (HELP.md). Поэтому
 * здесь две части: ключевые случаи из таблицы, которую он видел,
 * и сплошной перебор всех 320 сочетаний — любое из них даёт совет,
 * который бриф сумеет отметить, и ориентир по сроку.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NEEDS, STAGES, EXTRAS, stagesFor } from '../.test-out/content/brief.js';
import { advise, adviceHref, QUESTIONS } from '../.test-out/content/picker.js';

const base = { biz: 'services', goal: 'found', where: 'referral', have: 'nothing' };
const pick = (over) => {
  const a = advise({ ...base, ...over });
  return [a.main, a.second ?? null];
};

test('найти и написать — сайт; клиенты в Telegram — и бот', () => {
  assert.deepEqual(pick({ goal: 'found' }), ['site', null]);
  assert.deepEqual(pick({ goal: 'found', where: 'telegram' }), ['site', 'bot']);
});

test('платить онлайн: товары — магазин или мини-приложение, курс — лендинг, услуги — бот', () => {
  assert.deepEqual(pick({ biz: 'goods', goal: 'pay', where: 'search' }), ['shop', null]);
  assert.deepEqual(pick({ biz: 'goods', goal: 'pay', where: 'telegram' }), ['app', null]);
  assert.deepEqual(pick({ biz: 'teach', goal: 'pay' }), ['site', null]);
  assert.deepEqual(pick({ biz: 'services', goal: 'pay' }), ['bot', null]);
});

test('запись — бот, у курсов — лендинг; повторяющиеся вопросы — бот', () => {
  assert.deepEqual(pick({ goal: 'book' }), ['bot', null]);
  assert.deepEqual(pick({ biz: 'teach', goal: 'book' }), ['site', null]);
  assert.deepEqual(pick({ goal: 'repeat' }), ['bot', null]);
});

test('бот, а клиенты ищут в поиске — и сайт', () => {
  assert.deepEqual(pick({ goal: 'book', where: 'search' }), ['bot', 'site']);
});

test('«чтобы не падало» — мониторинг, а если стеречь пока нечего — сначала собрать', () => {
  assert.deepEqual(pick({ goal: 'stable', have: 'site' }), ['ops', null]);
  assert.deepEqual(pick({ goal: 'stable', have: 'nothing' }), ['site', 'ops']);
  assert.deepEqual(pick({ biz: 'goods', goal: 'stable', have: 'social' }), ['shop', 'ops']);
});

test('этап: только идея — прототип; макет — сразу в сборку; есть сайт — «нужен новый»', () => {
  assert.equal(advise({ ...base, have: 'nothing' }).stage, 'idea');
  assert.equal(advise({ ...base, have: 'social' }).stage, 'idea');
  assert.equal(advise({ ...base, have: 'mockup' }).stage, 'spec');
  assert.equal(advise({ ...base, have: 'site' }).stage, 'live');
  // у бота «старого сайта» нет — как в брифе
  assert.equal(advise({ ...base, goal: 'repeat', have: 'site' }).stage, 'idea');
  assert.equal(advise({ ...base, goal: 'stable', have: 'site' }).stage, null);
});

test('что подключить: оплата и запись отмечаются сами', () => {
  assert.deepEqual(advise({ ...base, biz: 'services', goal: 'pay' }).extras, ['Онлайн-оплата', 'Запись и бронь']);
  assert.deepEqual(advise({ ...base, goal: 'book' }).extras, ['Запись и бронь']);
  assert.deepEqual(advise({ ...base, goal: 'found' }).extras, []);
});

test('объяснение — словами из ответов', () => {
  const a = advise({ biz: 'goods', goal: 'pay', where: 'search', have: 'nothing' });
  assert.match(a.why, /^Вы продаёте товары, и вам нужно, чтобы покупали и платили онлайн\./);
  assert.match(advise({ ...base, biz: 'other' }).why, /^Вам нужно, чтобы вас находили и писали\./);
});

test('ссылка в заявку несёт всё отмеченное', () => {
  const href = adviceHref(advise({ biz: 'services', goal: 'book', where: 'search', have: 'nothing' }));
  const q = new URL(href, 'http://x').searchParams;
  assert.equal(q.get('need'), 'bot,site');
  assert.equal(q.get('stage'), 'idea');
  assert.equal(q.get('extras'), 'Запись и бронь');
});

test('любое из 320 сочетаний даёт совет, который бриф сумеет отметить', () => {
  const ids = (id) => QUESTIONS.find((q) => q.id === id).options.map((o) => o.id);
  let n = 0;
  for (const biz of ids('biz'))
    for (const goal of ids('goal'))
      for (const where of ids('where'))
        for (const have of ids('have')) {
          const a = advise({ biz, goal, where, have });
          const needs = [a.main, a.second].filter(Boolean);
          const at = JSON.stringify({ biz, goal, where, have });
          for (const id of needs) assert.ok(NEEDS.some((x) => x.id === id && id !== 'unsure'), at);
          assert.notEqual(a.main, a.second, at);
          // этап — из тех, что бриф показывает для этих пунктов
          if (a.stage) assert.ok(stagesFor(needs).some((s) => s.id === a.stage), at);
          else assert.deepEqual(needs, ['ops'], at);
          for (const x of a.extras) assert.ok(EXTRAS.includes(x), at);
          assert.ok(a.eta, at);
          assert.ok(a.why.length > 40, at);
          n++;
        }
  assert.equal(n, 320);
  assert.ok(STAGES.length);
});
