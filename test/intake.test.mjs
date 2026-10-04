/**
 * Заявка с сайта в сервис бота: подписанная общим секретом, форма —
 * как пришла (сервис проверит её сам). Без адреса сервиса локально —
 * всухую, в продакшне — сигнал роуту идти запасным путём.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { forwardLead } from '../.test-out/lib/intake.js';
import { verify } from '../.test-out/lib/intake-sign.js';

const form = { name: 'Анна', contact: '@anna_writes', task: 'Лендинг', consent: true, elapsed: 9000, website: '' };

test('форма уходит подписанной и целиком', async () => {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push({ url, init });
    return new Response('{"id":1}', { status: 201 });
  };
  process.env.BOT_INTAKE_URL = 'http://bot:8787/api/intake/lead';
  process.env.INTAKE_SECRET = 'site-and-bot-secret-0123456789';
  try {
    assert.equal(await forwardLead(form, { utm_source: 'tg' }), 'sent');
  } finally {
    globalThis.fetch = real;
  }
  const { url, init } = sent[0];
  assert.equal(url, 'http://bot:8787/api/intake/lead');
  assert.deepEqual(JSON.parse(init.body), { lead: form, meta: { utm_source: 'tg' } });
  assert.ok(verify(process.env.INTAKE_SECRET, init.headers['x-ct-timestamp'], init.headers['x-ct-signature'], init.body));
  delete process.env.BOT_INTAKE_URL;
  delete process.env.INTAKE_SECRET;
});

test('сервис ответил ошибкой — роут уйдёт запасным путём', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('down', { status: 502 });
  process.env.BOT_INTAKE_URL = 'http://bot:8787/api/intake/lead';
  process.env.INTAKE_SECRET = 'site-and-bot-secret-0123456789';
  const log = console.error;
  console.error = () => {};
  try {
    assert.equal(await forwardLead(form), 'failed');
  } finally {
    globalThis.fetch = real;
    console.error = log;
    delete process.env.BOT_INTAKE_URL;
    delete process.env.INTAKE_SECRET;
  }
});

test('без адреса сервиса вне продакшна — всухую', async () => {
  const info = console.info;
  console.info = () => {};
  try {
    assert.equal(await forwardLead(form), 'dry');
  } finally {
    console.info = info;
  }
});
