/**
 * Уведомление о заявке: что приходит в рабочий чат.
 *
 * Отправку не проверяем — она упирается в Telegram. Проверяем то, что
 * от нас зависит: в сообщении есть всё, чтобы ответить, не открывая
 * базу, а заявка с ловушкой помечена, но не потеряна.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { leadMessage, notifyLead } from '../.test-out/lib/notify.js';

const lead = {
  name: 'Лев',
  contact: '@lev_writes',
  task: 'Что: Сайт или лендинг\nСрок: В течение месяца\n\nНужен лендинг под курс',
  kind: 'sites',
  page: '/sites'
};

test('в сообщении имя, контакт, раздел и сам бриф', () => {
  const text = leadMessage(lead, 'new');
  assert.match(text, /^Новая заявка/);
  assert.match(text, /Имя: Лев/);
  assert.match(text, /Контакт: @lev_writes/);
  assert.match(text, /Раздел: Сайты · \/sites/);
  assert.ok(text.endsWith(lead.task));
});

test('заявка с ловушкой приходит с пометкой, а не пропадает', () => {
  assert.match(leadMessage(lead, 'spam'), /ловушка/);
});

test('без токена и чата уведомление выключено и ничего не шлёт', async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  assert.equal(await notifyLead(lead), 'off');
});

test('тема группы: номер уходит в message_thread_id, без него — в общую ветку', async () => {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response('{}', { status: 200 });
  };
  try {
    process.env.TELEGRAM_BOT_TOKEN = 'test';
    process.env.TELEGRAM_CHAT_ID = '-1001';
    process.env.TELEGRAM_THREAD_ID = '42';
    assert.equal(await notifyLead(lead), 'sent');
    delete process.env.TELEGRAM_THREAD_ID;
    assert.equal(await notifyLead(lead), 'sent');
  } finally {
    globalThis.fetch = real;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  }
  assert.equal(sent[0].message_thread_id, 42);
  assert.equal(sent[0].chat_id, '-1001');
  assert.ok(!('message_thread_id' in sent[1]));
});
