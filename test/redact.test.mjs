/**
 * Ошибка в логе — без токена бота. Токен в тестах выдуманный.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { errorLine, redact } from '../.test-out/lib/redact.js';

const TOKEN = '1234567890:AAFakeFakeFakeFakeFakeFakeFakeFake_x-1';

test('токен вырезается из адреса запроса и из голого текста', () => {
  assert.equal(redact(`request to https://api.telegram.org/bot${TOKEN}/getUpdates failed`), 'request to https://api.telegram.org/bot<токен>/getUpdates failed');
  assert.equal(redact(`TELEGRAM_BOT_TOKEN=${TOKEN}`), 'TELEGRAM_BOT_TOKEN=<токен>');
  assert.equal(redact('заявка #12 в 10:30:45, чат -1001234567890'), 'заявка #12 в 10:30:45, чат -1001234567890');
});

test('сетевая ошибка Telegram: строка с кодом причины, вложенная ошибка с токеном в лог не идёт', () => {
  // так выглядит ошибка grammY: сама без токена, внутри — исходная, с адресом запроса
  const inner = Object.assign(new Error(`request to https://api.telegram.org/bot${TOKEN}/sendMessage failed, reason: `), { code: 'ETIMEDOUT' });
  const e = Object.assign(new Error("Network request for 'sendMessage' failed!"), { name: 'HttpError', error: inner });
  const line = errorLine(e);
  assert.equal(line, "HttpError: Network request for 'sendMessage' failed! [ETIMEDOUT]");
  assert.ok(!line.includes(TOKEN));
});

test('токен в самом сообщении ошибки тоже не проходит', () => {
  const line = errorLine(new Error(`fetch https://api.telegram.org/bot${TOKEN}/getMe`));
  assert.ok(!line.includes(TOKEN));
  assert.match(line, /bot<токен>\/getMe/);
});

test('не ошибка — тоже строкой', () => {
  assert.equal(errorLine('просто текст'), 'просто текст');
  assert.equal(errorLine({ a: 1 }), '{"a":1}');
  assert.equal(errorLine(undefined), 'undefined');
});
