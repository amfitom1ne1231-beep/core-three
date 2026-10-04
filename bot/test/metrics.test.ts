/**
 * Метрики и сводки: воронка по когорте, время первого ответа в рабочих
 * минутах, источники; утренняя сводка и итоги недели в группу.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { addNote, createLead, markLost, setStage, takeLead } from '../src/domain/leads';
import { computeMetrics, isoWeek, lastDays, lastWeek, sourceOf, type Metrics } from '../src/domain/metrics';
import { setGroup } from '../src/domain/settings';
import { zoned } from '../src/domain/worktime';
import { createApp } from '../src/http/app';
import { tick } from '../src/jobs/scheduler';
import { GROUP, ILYA, OWNER, STRANGER, initData, testBot } from './helpers';

/** Московское время; 2026-10-05 — понедельник. */
const msk = (d: number, hh: number, mm = 0) => zoned(2026, 10, d, hh * 60 + mm, 'Europe/Moscow');
const sept = (d: number, hh: number) => zoned(2026, 9, d, hh * 60, 'Europe/Moscow');

async function setup(now: () => Date) {
  const t = await testBot({ OWNER_TG_IDS: `${OWNER.id},${ILYA.id}` }, now);
  await setGroup(t.db, { chatId: GROUP.id, threadId: null, title: null });
  const app = createApp({ db: t.db, config: t.config, studio: t.studio, now });
  const call = (user: typeof OWNER, path: string) => app.request(`/api/app${path}`, { headers: { authorization: `tma ${initData(user, { at: now() })}` } });
  await call(OWNER, '/me');
  await call(ILYA, '/me');
  return { ...t, call, sla: { work: t.config.work, takeMin: 60, alarmBeforeEndMin: 60 } };
}

/** Неделя заявок: договор, два отказа, ожидающая, ловушка — и одна из прошлого периода. */
async function week(db: Awaited<ReturnType<typeof setup>>['db']) {
  const site = { source: 'site' as const, contact: '@someone_here', task: 'Задача', kind: 'sites' };
  const old = await createLead(db, { ...site, name: 'Давняя', meta: { landing: '/' } }, sept(28, 12));
  await setStage(db, old.id, 1, 'contract', sept(28, 13));

  const won = await createLead(db, { ...site, name: 'Анна', meta: { utm_source: 'Telegram', utm_medium: 'cpc', landing: '/sites' } }, msk(5, 11));
  await setStage(db, won.id, 1, 'contacted', msk(5, 11, 20));
  await setStage(db, won.id, 1, 'call', msk(5, 15));
  await setStage(db, won.id, 1, 'proposal', msk(6, 12));
  await setStage(db, won.id, 1, 'contract', msk(7, 12));

  const lost = await createLead(db, { ...site, name: 'Борис', kind: 'bots', meta: { ref: 'vk.com', landing: '/bots' } }, msk(5, 12));
  // понедельник 12:00–19:00 (420 мин) + вторник 10:00–10:30
  await setStage(db, lost.id, 2, 'contacted', msk(6, 10, 30));
  await markLost(db, lost.id, 2, 'price', msk(6, 16));

  const waiting = await createLead(db, { source: 'manual', name: 'Вера', contact: '+7 900 000-00-00', task: 'Магазин', kind: 'ecommerce' }, msk(6, 14));
  await takeLead(db, waiting.id, 1, msk(6, 14));

  await createLead(db, { ...site, name: 'Бот', spam: true }, msk(6, 15));

  const mail = await createLead(db, { source: 'mail', name: 'Глеб', contact: 'gleb@example.com', task: 'Письмо', kind: 'sites' }, msk(7, 11));
  await setStage(db, mail.id, 1, 'contacted', msk(7, 11, 50));
  await setStage(db, mail.id, 1, 'call', msk(7, 16));
  await markLost(db, mail.id, 1, 'silent', msk(8, 12));
  return { won, lost, waiting, mail };
}

test('недели и периоды — в поясе студии', () => {
  assert.equal(isoWeek('2026-10-05'), '2026-W41');
  assert.equal(isoWeek('2026-10-11'), '2026-W41', 'воскресенье — та же неделя');
  assert.equal(isoWeek('2027-01-01'), '2026-W53', 'пятница 1 января — ещё прошлый год');
  assert.equal(isoWeek('2024-12-30'), '2025-W01');

  const w = lastWeek(msk(5, 10), 'Europe/Moscow');
  assert.deepEqual([w.monday, w.sunday], ['2026-09-28', '2026-10-04']);
  assert.equal(w.from.toISOString(), '2026-09-27T21:00:00.000Z', 'понедельник 00:00 МСК');
  assert.equal(w.to.toISOString(), '2026-10-04T21:00:00.000Z');

  const d = lastDays(7, msk(9, 15), 'Europe/Moscow');
  assert.equal(d.from.toISOString(), '2026-10-02T21:00:00.000Z', 'семь дней — сегодня и шесть до него, с полуночи');
});

test('источник: метка главнее сайта, сайт главнее прямого захода', () => {
  assert.deepEqual(sourceOf({ source: 'site', meta: { utm_source: ' Telegram ', ref: 'vk.com' } }), { id: 'utm:telegram', label: 'telegram' });
  assert.deepEqual(sourceOf({ source: 'site', meta: { ref: 'vk.com', landing: '/' } }), { id: 'ref:vk.com', label: 'vk.com' });
  assert.equal(sourceOf({ source: 'site', meta: { landing: '/' } }).id, 'direct');
  assert.equal(sourceOf({ source: 'site', meta: null }).id, 'unknown');
  assert.equal(sourceOf({ source: 'mail', meta: null }).label, 'Почта');
});

test('метрики недели: воронка по когорте, ответ в рабочих минутах, источники', async () => {
  const now = () => msk(9, 15);
  const t = await setup(now);
  await week(t.db);

  const res = await t.call(OWNER, '/metrics?days=7');
  assert.equal(res.status, 200);
  const m = (await res.json()) as Metrics;

  assert.deepEqual(m.leads, { total: 4, spam: 1, open: 1, won: 1, lost: 2 });
  assert.deepEqual(
    m.funnel.map((f) => [f.stage, f.reached]),
    [
      ['new', 4],
      ['contacted', 3],
      ['call', 2],
      ['proposal', 1],
      ['contract', 1]
    ],
    'отказ после созвона в «Созвон» посчитан'
  );
  assert.deepEqual(m.firstReply, { answered: 3, medianMin: 50, withinSla: 2, slaMin: 60, waiting: 1 }, 'ответы за 20, 50 и 450 рабочих минут');
  assert.deepEqual(
    m.bySource.map((s) => [s.label, s.count, s.won]),
    [
      ['Почта', 1, 0],
      ['Вручную', 1, 0],
      ['vk.com', 1, 0],
      ['telegram', 1, 1]
    ]
  );
  assert.deepEqual(
    m.byKind.map((k) => [k.id, k.count]),
    [
      ['sites', 2],
      ['bots', 1],
      ['ecommerce', 1]
    ]
  );
  assert.deepEqual(
    m.lostReasons.map((r) => [r.label, r.count]),
    [
      ['Дорого', 1],
      ['Пропал', 1]
    ]
  );
  assert.equal(m.bucket, 'day');
  assert.deepEqual(
    m.timeline.map((b) => [b.start.slice(8), b.count]),
    [
      ['03', 0],
      ['04', 0],
      ['05', 2],
      ['06', 1],
      ['07', 1],
      ['08', 0],
      ['09', 0]
    ],
    'пустые дни на месте, ловушка не в счёт'
  );
  assert.deepEqual(m.previous, { total: 1, won: 1 });
  assert.equal(m.projects.active, 2, 'проекты из двух договоров');

  // всё время: недели вместо дней, сравнения нет
  const all = (await (await t.call(OWNER, '/metrics?days=all')).json()) as Metrics;
  assert.equal(all.leads.total, 5);
  assert.equal(all.previous, null);
  assert.equal(all.bucket, 'day');
  assert.equal(all.timeline[0]!.start, '2026-09-28');

  assert.equal((await t.call(OWNER, '/metrics?days=14')).status, 400);
  assert.equal((await t.call(STRANGER, '/metrics')).status, 403);
  await t.close();
});

test('длинный период складывается в недели', async () => {
  const t = await setup(() => msk(9, 15));
  const m = await computeMetrics(t.db, { ...lastDays(90, msk(9, 15), 'Europe/Moscow'), work: t.config.work, slaMin: 60 });
  assert.equal(m.bucket, 'week');
  assert.equal(m.timeline[0]!.start, '2026-07-06', 'первая неделя начинается с понедельника');
  assert.equal(m.timeline.at(-1)!.start, '2026-10-05');
  assert.equal(m.firstReply.medianMin, null);
  await t.close();
});

test('утренняя сводка: кому не ответили и что стоит без движения; пусто — молчит', async () => {
  let clock = msk(8, 9);
  const t = await setup(() => clock);
  const texts = () => t.calls.filter((c) => c.method === 'sendMessage').map((c) => String(c.payload.text));
  const mornings = () => texts().filter((x) => /^<b>Утро/.test(x));

  clock = msk(8, 10, 1);
  await tick(t.db, t.studio, t.sla, clock);
  assert.equal(mornings().length, 0, 'сказать нечего — сообщения нет');

  const { waiting } = await week(t.db);
  await t.studio.publishLead(waiting.id);
  // вторая заявка пришла вчера вечером и ждёт; третья — в работе, но стоит с понедельника
  await createLead(t.db, { source: 'site', name: 'Ночная', contact: '@night_owl', task: 'Сайт', kind: 'sites' }, msk(8, 21));
  const stuck = await createLead(t.db, { source: 'site', name: 'Застрявшая', contact: '@stuck_one', task: 'Бот', kind: 'bots' }, msk(5, 10));
  await setStage(t.db, stuck.id, 2, 'contacted', msk(5, 10, 30));
  await addNote(t.db, stuck.id, 2, 'Обещал ответить', msk(5, 11));

  clock = msk(9, 10, 1);
  await tick(t.db, t.studio, t.sla, clock);
  assert.equal(mornings().length, 1);
  const text = mornings()[0]!;
  assert.match(text, /^<b>Утро, пт 9 окт<\/b>\nЗаявок с прошлого рабочего дня: 1/);
  assert.match(text, /<b>Ждут ответа — 2<\/b>\n— <a href="https:\/\/t\.me\/c\/1234567890\/\d+">#\d+<\/a> Вера · Магазины · ведёт Лев\n— #\d+ Ночная · Сайты · никто не взял/);
  assert.match(text, /<b>Без движения — 1<\/b>\n— #\d+ Застрявшая · Связались · 3 раб\. дн\. · Илья/);
  assert.doesNotMatch(text, /Сроки на сегодня/, 'сроков нет — раздела нет');
  assert.doesNotMatch(text, /tg:\/\/user/, 'в сводке никого не отмечают, кроме исполнителей задач');

  clock = msk(9, 16);
  await tick(t.db, t.studio, t.sla, clock);
  assert.equal(mornings().length, 1, 'раз в день');
  await t.close();
});

test('итоги недели: в первый рабочий день, один раз, цифрами прошлой недели', async () => {
  let clock = msk(12, 9, 59);
  const t = await setup(() => clock);
  await week(t.db);
  const weeks = () => t.calls.filter((c) => c.method === 'sendMessage' && /Итоги недели/.test(String(c.payload.text))).map((c) => String(c.payload.text));

  await tick(t.db, t.studio, t.sla, clock);
  assert.equal(weeks().length, 0, 'до начала рабочего дня');

  clock = msk(12, 10, 0);
  await tick(t.db, t.studio, t.sla, clock);
  assert.equal(weeks().length, 1);
  const text = weeks()[0]!;
  assert.match(text, /^<b>Итоги недели · 5 окт – 11 окт<\/b>\n\nЗаявок: 4 \(неделей раньше — 1\)/);
  assert.match(text, /Дошли: связались 3 · созвон \/ бриф 2 · кп отправлено 1 · договор 1/);
  assert.match(text, /Договоров: 1 · отказов: 2 \(дорого — 1, пропал — 1\)/);
  assert.match(text, /Первый ответ: обычно за 50 мин, в срок — 2 из 3/);
  assert.match(text, /Без ответа до сих пор: 1/);
  assert.match(text, /Откуда: Почта — 1, Вручную — 1, vk\.com — 1, telegram — 1/);
  assert.match(text, /Проекты: в работе 2$/);

  clock = msk(13, 10, 5);
  await tick(t.db, t.studio, t.sla, clock);
  assert.equal(weeks().length, 1, 'во вторник не повторяем');

  clock = msk(19, 10, 5);
  await tick(t.db, t.studio, t.sla, clock);
  assert.equal(weeks().length, 2, 'следующий понедельник — следующая неделя');
  assert.match(weeks()[1]!, /Заявок: 0 \(неделей раньше — 4\)\nПроекты: в работе 2/);
  await t.close();
});
