/**
 * Приём заявок с сайта: только подписанные, свежие и проверенные теми же
 * правилами, что форма. Ловушку для ботов сервис решает сам.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/http/app';
import { sign, verify } from '../../lib/intake-sign';
import { getLead } from '../src/domain/leads';
import { setGroup } from '../src/domain/settings';
import { GROUP, siteForm, testBot } from './helpers';

const SECRET = 'test-intake-secret-0123456789';

function post(app: ReturnType<typeof createApp>, body: unknown, opts: { ts?: number; secret?: string } = {}) {
  const raw = JSON.stringify(body);
  const ts = String(opts.ts ?? Date.now());
  return app.request('/api/intake/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ct-timestamp': ts, 'x-ct-signature': sign(opts.secret ?? SECRET, ts, raw) },
    body: raw
  });
}

test('подпись: верная проходит, чужая, старая и битая — нет', () => {
  const ts = String(Date.now());
  assert.ok(verify(SECRET, ts, sign(SECRET, ts, '{}'), '{}'));
  assert.ok(!verify(SECRET, ts, sign('other-secret-0123456789', ts, '{}'), '{}'));
  assert.ok(!verify(SECRET, ts, sign(SECRET, ts, '{}'), '{"x":1}'));
  const old = String(Date.now() - 10 * 60 * 1000);
  assert.ok(!verify(SECRET, old, sign(SECRET, old, '{}'), '{}'));
  assert.ok(!verify(SECRET, ts, 'zz', '{}'));
});

test('заявка с сайта: в базу и карточкой в группу', async () => {
  const t = await testBot();
  await setGroup(t.db, { chatId: GROUP.id, threadId: null, title: null });
  const app = createApp({ db: t.db, config: t.config, studio: t.studio });

  const res = await post(app, { lead: siteForm(), meta: { utm_source: 'telegram', landing: '/bots' } });
  assert.equal(res.status, 201);
  const { id } = (await res.json()) as { id: number };
  const lead = await getLead(t.db, id);
  assert.equal(lead?.name, 'Анна');
  assert.equal(lead?.kind, 'sites');
  assert.equal(lead?.spam, false);
  assert.deepEqual(lead?.meta, { utm_source: 'telegram', landing: '/bots' });
  assert.ok(t.calls.some((c) => c.method === 'sendMessage' && c.payload.chat_id === GROUP.id));
  await t.close();
});

test('без подписи — 401, и в базе пусто', async () => {
  const t = await testBot();
  const app = createApp({ db: t.db, config: t.config, studio: t.studio });
  const res = await post(app, { lead: siteForm() }, { secret: 'someone-else-0123456789' });
  assert.equal(res.status, 401);
  assert.equal(await getLead(t.db, 1), null);
  await t.close();
});

test('форма без контакта — 422 с полями', async () => {
  const t = await testBot();
  const app = createApp({ db: t.db, config: t.config, studio: t.studio });
  const res = await post(app, { lead: siteForm({ contact: '' }) });
  assert.equal(res.status, 422);
  assert.ok(((await res.json()) as { fields: Record<string, string> }).fields.contact);
  await t.close();
});

test('ловушка сработала — заявка сохраняется с пометкой, а не пропадает', async () => {
  const t = await testBot();
  const app = createApp({ db: t.db, config: t.config, studio: t.studio });
  const res = await post(app, { lead: siteForm({ elapsed: 300 }) });
  assert.equal(res.status, 201);
  const { id } = (await res.json()) as { id: number };
  assert.equal((await getLead(t.db, id))?.spam, true);
  await t.close();
});

test('«Мы напишем сами» из «Помощи»: свой канал и пометка в карточке', async () => {
  const t = await testBot();
  await setGroup(t.db, { chatId: GROUP.id, threadId: null, title: null });
  const app = createApp({ db: t.db, config: t.config, studio: t.studio });

  const form = siteForm({ contact: '+7 900 111-22-33', task: 'Нужна помощь: просит написать по номеру в мессенджер.', kind: 'general', page: '/help', help: true });
  const res = await post(app, { lead: form, meta: { landing: '/help' } });
  assert.equal(res.status, 201);
  const lead = await getLead(t.db, ((await res.json()) as { id: number }).id);
  assert.equal(lead?.source, 'help');
  assert.equal(lead?.page, '/help');
  const card = t.calls.find((c) => c.method === 'sendMessage' && c.payload.chat_id === GROUP.id);
  assert.match(String(card?.payload.text), /из «Помощи»/);
  assert.match(String(card?.payload.text), /Нужна помощь<\/b> — написать по номеру/);

  // по нику написать в WhatsApp нельзя — сервис такую форму не примет
  const tg = await post(app, { lead: { ...form, contact: '@anna_writes' } });
  assert.equal(tg.status, 422);
  await t.close();
});
