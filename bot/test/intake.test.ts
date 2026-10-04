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
import { createLead, getLead } from '../src/domain/leads';
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

test('Telegram недоступен — заявка в базе, сайт получает ответ, карточка догоняет позже', async () => {
  const t = await testBot();
  await setGroup(t.db, { chatId: GROUP.id, threadId: null, title: null });
  const app = createApp({ db: t.db, config: t.config, studio: t.studio });

  // связи нет: любой вызов Telegram падает, как при блокировке
  let down = true;
  t.studio.bot.api.config.use((prev, method, payload, signal) => {
    if (down) throw new Error('connect ETIMEDOUT');
    return prev(method, payload, signal);
  });

  const res = await post(app, { lead: siteForm() });
  assert.equal(res.status, 201);
  const { id } = (await res.json()) as { id: number };
  assert.equal((await getLead(t.db, id))?.cardMessageId, null);
  assert.equal(await t.studio.publishPending(), 0);

  // связь вернулась — карточка встаёт, и ровно одна
  down = false;
  assert.equal(await t.studio.publishPending(), 1);
  assert.ok((await getLead(t.db, id))?.cardMessageId);
  assert.equal(await t.studio.publishPending(), 0);
  assert.equal(t.calls.filter((c) => c.method === 'sendMessage' && c.payload.chat_id === GROUP.id).length, 1);
  await t.close();
});

test('Telegram молчит — сайт не ждёт дольше отведённого', async () => {
  const t = await testBot();
  await setGroup(t.db, { chatId: GROUP.id, threadId: null, title: null });
  const app = createApp({ db: t.db, config: t.config, studio: t.studio, cardWaitMs: 40 });

  // запрос к Telegram повис: ни ответа, ни ошибки
  let release = () => {};
  const hang = new Promise<void>((resolve) => (release = resolve));
  t.studio.bot.api.config.use(async (prev, method, payload, signal) => {
    if (method === 'sendMessage') await hang;
    return prev(method, payload, signal);
  });

  const started = Date.now();
  const res = await post(app, { lead: siteForm() });
  assert.equal(res.status, 201);
  assert.ok(Date.now() - started < 1500, 'ответ сайту не должен ждать Telegram');
  const { id } = (await res.json()) as { id: number };

  // пока первая отправка висит, вторую карточку расписание не ставит
  assert.equal(await t.studio.publishPending(), 0);
  release();
  await new Promise((r) => setTimeout(r, 50));
  assert.ok((await getLead(t.db, id))?.cardMessageId);
  assert.equal(t.calls.filter((c) => c.method === 'sendMessage' && c.payload.chat_id === GROUP.id).length, 1);
  await t.close();
});

test('давняя заявка без карточки задним числом в группу не идёт', async () => {
  const t = await testBot();
  await setGroup(t.db, { chatId: GROUP.id, threadId: null, title: null });
  const old = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' }, new Date(Date.now() - 5 * 24 * 3600 * 1000));
  assert.equal(await t.studio.publishPending(), 0);
  assert.equal((await getLead(t.db, old.id))?.cardMessageId, null);
  await t.close();
});
