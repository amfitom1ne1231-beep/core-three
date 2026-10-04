/**
 * Ретранслятор Bot API: пускает только с ключом и только в Bot API,
 * пересылает запрос как есть и не выдаёт Telegram, кто к нему обращался.
 * Токен в тестах выдуманный.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { relay } from '../.test-out/deploy/relay/netlify/edge-functions/relay.js';

const KEY = 'k'.repeat(48);
const TOKEN = '1234567890:AAFakeFakeFakeFakeFakeFakeFakeFake_x-1';

/** Подставной Telegram: запоминает, что ему прислали. */
function telegram(answer = { ok: true, result: { message_id: 7 } }, status = 200) {
  const calls = [];
  const send = async (url, init) => {
    calls.push({ url, method: init.method, headers: Object.fromEntries(init.headers), body: init.body ? new TextDecoder().decode(init.body) : undefined });
    return new Response(JSON.stringify(answer), { status, headers: { 'content-type': 'application/json', 'set-cookie': 'x=1', 'retry-after': '3' } });
  };
  return { calls, send };
}

test('с ключом: запрос уходит в Telegram тем же методом, телом и адресом', async () => {
  const tg = telegram();
  const req = new Request(`https://relay.example/${KEY}/bot${TOKEN}/sendMessage?x=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '81.26.183.159', cookie: 'a=b', 'user-agent': 'grammY' },
    body: JSON.stringify({ chat_id: -100, text: 'Новая заявка' })
  });
  const res = await relay(req, KEY, tg.send);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, result: { message_id: 7 } });
  assert.equal(tg.calls.length, 1);
  assert.equal(tg.calls[0].url, `https://api.telegram.org/bot${TOKEN}/sendMessage?x=1`);
  assert.equal(tg.calls[0].method, 'POST');
  assert.deepEqual(JSON.parse(tg.calls[0].body), { chat_id: -100, text: 'Новая заявка' });
  // Telegram не узнаёт, кто обращался к ретранслятору
  assert.deepEqual(Object.keys(tg.calls[0].headers), ['content-type']);
  // и обратно идёт только нужное
  assert.equal(res.headers.get('set-cookie'), null);
  assert.equal(res.headers.get('retry-after'), '3');
});

test('без ключа, с чужим ключом и без настроенного ключа — 404, в Telegram ничего не уходит', async () => {
  const tg = telegram();
  for (const [path, key] of [
    [`/bot${TOKEN}/getMe`, KEY],
    [`/${'x'.repeat(48)}/bot${TOKEN}/getMe`, KEY],
    [`/${KEY}/bot${TOKEN}/getMe`, undefined],
    ['/', KEY]
  ]) {
    const res = await relay(new Request(`https://relay.example${path}`), key, tg.send);
    assert.equal(res.status, 404, path);
  }
  assert.equal(tg.calls.length, 0);
});

test('с ключом, но не в Bot API — тоже 404: это не прокси общего назначения', async () => {
  const tg = telegram();
  for (const path of ['', 'robots.txt', 'https://example.com/', '../etc/passwd', `bot${TOKEN}`]) {
    const res = await relay(new Request(`https://relay.example/${KEY}/${path}`), KEY, tg.send);
    assert.equal(res.status, 404, path);
  }
  assert.equal(tg.calls.length, 0);
});

test('скачивание файла и GET без тела проходят', async () => {
  const tg = telegram();
  await relay(new Request(`https://relay.example/${KEY}/file/bot${TOKEN}/documents/file_1.pdf`), KEY, tg.send);
  await relay(new Request(`https://relay.example/${KEY}/bot${TOKEN}/getMe`), KEY, tg.send);
  assert.equal(tg.calls[0].url, `https://api.telegram.org/file/bot${TOKEN}/documents/file_1.pdf`);
  assert.equal(tg.calls[1].body, undefined);
});

test('отказ Telegram доходит как есть; Telegram недоступен — 502 в том же виде', async () => {
  const refused = telegram({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }, 400);
  const res = await relay(new Request(`https://relay.example/${KEY}/bot${TOKEN}/sendMessage`, { method: 'POST', body: '{}' }), KEY, refused.send);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).description, 'Bad Request: chat not found');

  const down = await relay(new Request(`https://relay.example/${KEY}/bot${TOKEN}/getMe`), KEY, async () => {
    throw new Error('connect ETIMEDOUT');
  });
  assert.equal(down.status, 502);
  assert.deepEqual(Object.keys(await down.json()).sort(), ['description', 'error_code', 'ok']);
});
