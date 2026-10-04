/**
 * Заявки в базе: этапы, первый ответ, отказ, возврат в работу —
 * и всё это в истории. Postgres настоящий (PGlite в памяти).
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { asc, eq } from 'drizzle-orm';
import { leadEvents, members } from '../src/db/schema';
import { addNote, createLead, leadView, markLost, openLeads, setStage, takeLead } from '../src/domain/leads';
import { memoryDb } from './helpers';

async function setup() {
  const h = await memoryDb();
  const [ilya] = await h.db.insert(members).values({ tgId: 1, name: 'Илья' }).returning();
  const [timur] = await h.db.insert(members).values({ tgId: 2, name: 'Тимур' }).returning();
  const lead = await createLead(h.db, { source: 'site', name: 'Анна', contact: '@anna_w', task: 'Лендинг', kind: 'sites', page: '/sites' });
  return { ...h, ilya: ilya!, timur: timur!, lead };
}

const t0 = new Date('2026-10-05T08:00:00Z');
const min = (n: number) => new Date(t0.getTime() + n * 60000);

test('путь заявки: беру → связались → КП → договор, всё в истории', async () => {
  const { db, ilya, lead, close } = await setup();
  await takeLead(db, lead.id, ilya.id, min(5));
  await setStage(db, lead.id, ilya.id, 'contacted', min(20));
  await setStage(db, lead.id, ilya.id, 'proposal', min(60));
  const done = await setStage(db, lead.id, ilya.id, 'contract', min(120));

  assert.equal(done?.ownerId, ilya.id);
  assert.equal(done?.firstReplyAt?.getTime(), min(20).getTime(), 'первый ответ — на «Связались»');
  assert.equal(done?.closedAt?.getTime(), min(120).getTime());
  const types = (await db.select().from(leadEvents).where(eq(leadEvents.leadId, lead.id)).orderBy(asc(leadEvents.id))).map((e) => e.type);
  assert.deepEqual(types, ['created', 'taken', 'stage', 'stage', 'stage']);
  await close();
});

test('двинул ничейную заявку — значит, ведёт её', async () => {
  const { db, timur, lead, close } = await setup();
  const next = await setStage(db, lead.id, timur.id, 'call', min(10));
  assert.equal(next?.ownerId, timur.id);
  assert.ok(next?.firstReplyAt, 'созвон — тоже ответ клиенту');
  await close();
});

test('перехват: «Беру» у коллеги записывается, от кого забрали', async () => {
  const { db, ilya, timur, lead, close } = await setup();
  await takeLead(db, lead.id, ilya.id, min(1));
  await takeLead(db, lead.id, timur.id, min(2));
  const [ev] = (await db.select().from(leadEvents).where(eq(leadEvents.leadId, lead.id)).orderBy(asc(leadEvents.id))).slice(-1);
  assert.equal(ev?.type, 'taken');
  assert.deepEqual(ev?.data, { from: ilya.id });
  await close();
});

test('отказ с причиной закрывает заявку, «Вернуть» — открывает и стирает причину', async () => {
  const { db, ilya, lead, close } = await setup();
  const lost = await markLost(db, lead.id, ilya.id, 'price', min(30));
  assert.equal(lost?.stage, 'lost');
  assert.equal(lost?.lostReason, 'price');
  assert.equal((await openLeads(db)).length, 0);

  const back = await setStage(db, lead.id, ilya.id, 'contacted', min(40));
  assert.equal(back?.closedAt, null);
  assert.equal(back?.lostReason, null);
  const [ev] = (await db.select().from(leadEvents).where(eq(leadEvents.leadId, lead.id)).orderBy(asc(leadEvents.id))).slice(-1);
  assert.equal(ev?.type, 'reopened');
  await close();
});

test('заметки: в карточке последние, с автором', async () => {
  const { db, ilya, lead, close } = await setup();
  await addNote(db, lead.id, ilya.id, 'Созвон в четверг', min(1));
  await addNote(db, lead.id, ilya.id, '   ', min(2));
  await addNote(db, lead.id, ilya.id, 'Прислала референсы', min(3));
  const v = await leadView(db, lead.id);
  assert.deepEqual(
    v?.notes.map((n) => [n.who, n.text]),
    [
      ['Илья', 'Прислала референсы'],
      ['Илья', 'Созвон в четверг']
    ]
  );
  await close();
});
