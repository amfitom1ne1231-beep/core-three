/**
 * Мини-приложение: вход по подписи Telegram и API заявок. Действие
 * из приложения должно оставлять тот же след, что кнопка под карточкой:
 * событие в истории и обновлённая карточка в группе.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createLead, getLead, leadHistory } from '../src/domain/leads';
import { setGroup } from '../src/domain/settings';
import { team } from '../src/domain/team';
import { createApp } from '../src/http/app';
import { readInitData } from '../src/http/auth';
import { GROUP, ILYA, OWNER, STRANGER, TOKEN, command, initData, testBot, type TgUserLike } from './helpers';

type Detail = { lead: { id: number; stage: string; ownerId: number | null; source: string; lostReason: string | null }; owner: { name: string } | null; events: { type: string; who: string | null }[] };

async function setup(over: Record<string, string> = {}) {
  const t = await testBot(over);
  await setGroup(t.db, { chatId: GROUP.id, threadId: null, title: null });
  const app = createApp({ db: t.db, config: t.config, studio: t.studio });
  const call = (user: TgUserLike | null, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    app.request(`/api/app${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(user ? { authorization: `tma ${initData(user)}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  return { ...t, app, call };
}

const anna = { source: 'site' as const, name: 'Анна', contact: '@anna_writes', task: 'Лендинг под курс акварели', kind: 'sites' };

test('initData: своя подпись проходит; чужой токен, правка и вчерашняя — нет', () => {
  assert.equal(readInitData(initData(OWNER), TOKEN)?.id, OWNER.id);
  assert.equal(readInitData(initData(OWNER, { token: '999:other' }), TOKEN), null);
  assert.equal(readInitData(initData(OWNER).replace('%D0%9B%D0%B5%D0%B2', 'X'), TOKEN), null, 'подменили имя');
  assert.equal(readInitData(initData(OWNER, { at: new Date(Date.now() - 25 * 3600 * 1000) }), TOKEN), null);
  assert.equal(readInitData('user=%7B%7D&auth_date=1', TOKEN), null, 'без подписи');
});

test('вход: без подписи — 401, посторонний — 403, владелец входит без /start', async () => {
  const t = await setup();
  assert.equal((await t.call(null, '/me')).status, 401);
  assert.equal((await t.call(STRANGER, '/me')).status, 403);
  assert.equal((await team(t.db)).length, 0);

  const res = await t.call(OWNER, '/me');
  assert.equal(res.status, 200);
  const me = (await res.json()) as { me: { name: string; role: string }; dict: { stages: unknown[] } };
  assert.deepEqual(me.me.name, 'Лев');
  assert.equal(me.me.role, 'owner');
  assert.equal(me.dict.stages.length, 6);
  await t.close();
});

test('режим разработки: только с этой машины и пока сервис не виден снаружи', async () => {
  const dev = await setup({ APP_DEV: '1', NODE_ENV: 'development' });
  await dev.send(command(OWNER, '/start'));
  assert.equal((await dev.call(null, '/me', undefined, { host: 'localhost:8787' })).status, 200);
  assert.equal((await dev.call(null, '/me', undefined, { host: 'abc.trycloudflare.com' })).status, 401, 'чужой Host');
  assert.equal((await dev.call(null, '/me', undefined, { host: 'localhost:8787', 'cf-connecting-ip': '1.2.3.4' })).status, 401, 'через туннель');
  await dev.close();

  const open = await setup({ APP_DEV: '1', NODE_ENV: 'development', PUBLIC_URL: 'https://abc.trycloudflare.com' });
  await open.send(command(OWNER, '/start'));
  assert.equal((await open.call(null, '/me', undefined, { host: 'localhost:8787' })).status, 401, 'сервис виден снаружи');
  await open.close();

  const off = await setup();
  await off.send(command(OWNER, '/start'));
  assert.equal((await off.call(null, '/me', undefined, { host: 'localhost:8787' })).status, 401, 'режим не включён');
  await off.close();
});

test('список: в работе, ничьи, мои, закрытые, поиск', async () => {
  const t = await setup({ OWNER_TG_IDS: `${OWNER.id},${ILYA.id}` });
  await t.call(OWNER, '/me');
  await t.call(ILYA, '/me');
  const a = await createLead(t.db, anna, new Date('2026-10-01T09:00:00Z'));
  const b = await createLead(t.db, { ...anna, name: 'Борис', contact: 'boris@example.com', task: 'Бот для записи в автосервис', kind: 'bots' }, new Date('2026-10-02T09:00:00Z'));
  const c = await createLead(t.db, { ...anna, name: 'Вера', task: 'Скидка 100%_сегодня' }, new Date('2026-10-03T09:00:00Z'));
  await t.call(ILYA, `/leads/${b.id}/take`, {});
  await t.call(OWNER, `/leads/${c.id}/lost`, { reason: 'price' });

  const ids = async (q: string, user = OWNER) => ((await (await t.call(user, `/leads${q}`)).json()) as { leads: { id: number; ownerName: string | null }[] }).leads.map((l) => l.id);
  assert.deepEqual(await ids(''), [a.id, b.id], 'в работе — от старых к новым');
  assert.deepEqual(await ids('?owner=none'), [a.id]);
  assert.deepEqual(await ids('?owner=me', ILYA), [b.id]);
  assert.deepEqual(await ids('?scope=closed'), [c.id]);
  assert.deepEqual(await ids('?scope=all&q=автосервис'), [b.id]);
  assert.deepEqual(await ids(`?scope=all&q=%23${a.id}`), [a.id], 'по номеру');
  assert.deepEqual(await ids('?scope=all&q=100%25_'), [c.id], '% и _ — обычные символы');
  assert.deepEqual(await ids('?scope=all&q=%25'), [c.id]);
  assert.equal((await t.call(OWNER, '/leads?scope=wrong')).status, 400);
  await t.close();
});

test('действия из приложения: история заявки и карточка в группе', async () => {
  const t = await setup();
  const lead = await createLead(t.db, anna);
  await t.studio.publishLead(lead.id);
  const edits = () => t.calls.filter((c) => c.method === 'editMessageText').length;

  let d = (await (await t.call(OWNER, `/leads/${lead.id}/take`, {})).json()) as Detail;
  assert.equal(d.owner?.name, 'Лев');
  assert.equal(edits(), 1, 'карточка обновилась');

  d = (await (await t.call(OWNER, `/leads/${lead.id}/stage`, { stage: 'call' })).json()) as Detail;
  assert.equal(d.lead.stage, 'call');
  assert.ok((await getLead(t.db, lead.id))?.firstReplyAt);

  await t.call(OWNER, `/leads/${lead.id}/note`, { text: 'Созвон в четверг' });
  d = (await (await t.call(OWNER, `/leads/${lead.id}/lost`, { reason: 'silent' })).json()) as Detail;
  assert.equal(d.lead.stage, 'lost');
  assert.equal(d.lead.lostReason, 'silent');

  d = (await (await t.call(OWNER, `/leads/${lead.id}/reopen`, {})).json()) as Detail;
  assert.equal(d.lead.stage, 'contacted', 'клиенту уже отвечали — возвращается в «Связались»');
  assert.equal(edits(), 5);
  assert.deepEqual(
    d.events.map((e) => e.type),
    ['created', 'taken', 'stage', 'note', 'lost', 'reopened']
  );
  assert.deepEqual((await leadHistory(t.db, lead.id)).at(-1)?.who, 'Лев');

  assert.equal((await t.call(OWNER, `/leads/${lead.id}/stage`, { stage: 'lost' })).status, 400, 'отказ — только с причиной');
  assert.equal((await t.call(OWNER, `/leads/${lead.id}/note`, { text: '   ' })).status, 400);
  assert.equal((await t.call(OWNER, '/leads/999/take', {})).status, 404);
  assert.equal((await t.call(OWNER, '/leads/999')).status, 404);
  assert.equal((await t.call(STRANGER, `/leads/${lead.id}/take`, {})).status, 403);
  await t.close();
});

test('заявка вручную: те же правила, что у формы; карточка в группу; завёл — ведёт', async () => {
  const t = await setup();
  const bad = await t.call(OWNER, '/leads', { name: 'Глеб', contact: 'позвонит сам', task: 'Магазин' });
  assert.equal(bad.status, 422);
  assert.ok(((await bad.json()) as { fields: Record<string, string> }).fields.contact);

  const res = await t.call(OWNER, '/leads', { name: 'Глеб', contact: '+7 900 123-45-67', task: 'Магазин запчастей, знакомый Ильи', kind: 'ecommerce' });
  assert.equal(res.status, 201);
  const d = (await res.json()) as Detail;
  assert.equal(d.lead.source, 'manual');
  assert.equal(d.owner?.name, 'Лев');
  const card = t.calls.find((c) => c.method === 'sendMessage' && c.payload.chat_id === GROUP.id);
  assert.match(String(card?.payload.text), /^<b>#\d+ · Магазины<\/b> · <b>Новая<\/b> · ведёт Лев\n/, 'состояние — первой строкой');
  assert.match(String(card?.payload.text), /\nвручную · /, 'откуда и когда — строкой под контактом');
  assert.match(String(card?.payload.text), /ведёт Лев/);
  await t.close();
});

test('«Открыть» на карточке: нет адреса — нет кнопки; есть — ссылка в личку, там кнопка приложения', async () => {
  const off = await setup();
  const l0 = await createLead(off.db, anna);
  await off.studio.publishLead(l0.id);
  assert.doesNotMatch(JSON.stringify(off.calls.at(-1)!.payload.reply_markup), /Открыть/);
  await off.close();

  const t = await setup({ PUBLIC_URL: 'https://abc.trycloudflare.com' });
  const lead = await createLead(t.db, anna);
  await t.studio.publishLead(lead.id);
  assert.match(JSON.stringify(t.calls.at(-1)!.payload.reply_markup), new RegExp(`"Открыть","url":"https://t.me/corethree_bot\\?start=lead_${lead.id}"`));

  await t.send(command(OWNER, `/start lead_${lead.id}`));
  const reply = [...t.calls].reverse().find((c) => c.method === 'sendMessage')!;
  assert.match(JSON.stringify(reply.payload.reply_markup), new RegExp(`"web_app":\\{"url":"https://abc.trycloudflare.com/app/leads/${lead.id}"`));
  const menu = t.calls.find((c) => c.method === 'setChatMenuButton')!;
  assert.equal(menu.payload.chat_id, OWNER.id);
  assert.match(JSON.stringify(menu.payload.menu_button), /"web_app":\{"url":"https:\/\/abc\.trycloudflare\.com\/app\/"/);

  await t.send(command(STRANGER, `/start lead_${lead.id}`));
  assert.match(String(t.calls.at(-1)!.payload.text), /рабочий бот студии/, 'постороннему заявку не показываем');

  // адрес появился — открытые карточки перерисованы один раз, при следующем запуске тишина
  const edits = () => t.calls.filter((c) => c.method === 'editMessageText').length;
  await t.studio.syncCards();
  assert.equal(edits(), 1);
  await t.studio.syncCards();
  assert.equal(edits(), 1);
  await t.close();

  const direct = await setup({ PUBLIC_URL: 'https://bot.corethree.ru', MINI_APP_LINK: 'direct' });
  const l2 = await createLead(direct.db, anna);
  await direct.studio.publishLead(l2.id);
  assert.match(JSON.stringify(direct.calls.at(-1)!.payload.reply_markup), new RegExp(`https://t.me/corethree_bot\\?startapp=lead_${l2.id}`));
  await direct.close();
});

test('страница приложения: не собрано — так и сказано, а не пустой экран', async () => {
  const t = await setup({ ADMIN_DIST: '/nonexistent/admin-dist' });
  const res = await t.app.request('/app/leads/1');
  assert.equal(res.status, 503);
  assert.match(await res.text(), /не собрано/);
  await t.close();
});

test('страница приложения: файлы сборки, любой экран — index.html, наружу из папки не выйти', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'admin-'));
  const dist = path.join(root, 'dist');
  mkdirSync(path.join(dist, 'assets'), { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>app</title>');
  writeFileSync(path.join(dist, 'assets', 'index-abc.js'), 'console.log(1)');
  writeFileSync(path.join(root, 'secret.txt'), 'нельзя');
  const t = await setup({ ADMIN_DIST: dist });

  const js = await t.app.request('/app/assets/index-abc.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type') ?? '', /javascript/);
  assert.match(js.headers.get('cache-control') ?? '', /immutable/);

  for (const url of ['/app/', '/app/leads/12', '/app/new']) {
    const page = await t.app.request(url);
    assert.equal(page.status, 200, url);
    assert.match(await page.text(), /<title>app<\/title>/);
    assert.equal(page.headers.get('cache-control'), 'no-cache');
  }
  assert.equal((await t.app.request('/app/assets/index-old.js')).status, 404, 'файл прошлой сборки');
  assert.doesNotMatch(await (await t.app.request('/app/%2e%2e/secret.txt')).text(), /нельзя/);
  assert.doesNotMatch(await (await t.app.request('/app/..%2fsecret.txt')).text(), /нельзя/);
  assert.equal((await t.app.request('/app')).status, 302);
  await t.close();
});
