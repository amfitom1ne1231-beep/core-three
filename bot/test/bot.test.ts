/**
 * Бот целиком, с подменённым API Telegram: вход в команду, привязка
 * группы, карточка заявки и кнопки под ней, заметка ответом, напоминание.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLead, getLead } from '../src/domain/leads';
import { getGroup } from '../src/domain/settings';
import { team } from '../src/domain/team';
import { GROUP, ILYA, OWNER, STRANGER, command, press, replyTo, testBot } from './helpers';

const last = (calls: { method: string; payload: Record<string, unknown> }[], method: string) =>
  [...calls].reverse().find((c) => c.method === method);

async function withTeamAndGroup() {
  const t = await testBot();
  await t.send(command(OWNER, '/start'));
  await t.send(command(OWNER, '/invite'));
  const link = String(last(t.calls, 'sendMessage')!.payload.text);
  const code = link.match(/start=(inv_[\w-]+)/)![1]!;
  await t.send(command(ILYA, `/start ${code}`));
  await t.send(command(OWNER, '/bind', GROUP));
  return t;
}

test('посторонний получает ссылку на сайт и ничего больше', async () => {
  const t = await testBot();
  await t.send(command(STRANGER, '/start'));
  assert.match(String(last(t.calls, 'sendMessage')!.payload.text), /рабочий бот студии.*corethree\.ru\/contact/s);
  assert.equal((await team(t.db)).length, 0);
  await t.close();
});

test('владелец входит сам, коллегу приглашает ссылкой; ссылка одноразовая', async () => {
  const t = await withTeamAndGroup();
  const people = await team(t.db);
  assert.deepEqual(
    people.map((m) => [m.name, m.role]),
    [
      ['Лев', 'owner'],
      ['Илья', 'member']
    ]
  );
  const link = String(t.calls.find((c) => String(c.payload.text).includes('start=inv_'))!.payload.text);
  await t.send(command(STRANGER, `/start ${link.match(/start=(inv_[\w-]+)/)![1]}`));
  assert.match(String(last(t.calls, 'sendMessage')!.payload.text), /не действует/);
  await t.close();
});

test('/bind в группе — заявки идут туда', async () => {
  const t = await withTeamAndGroup();
  assert.deepEqual(await getGroup(t.db), { chatId: GROUP.id, threadId: null, title: GROUP.title });
  await t.close();
});

test('новая заявка — карточка в группе; «Беру» и шаг вперёд правят её на месте', async () => {
  const t = await withTeamAndGroup();
  const lead = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг <курса>', kind: 'sites', page: '/sites' });
  await t.studio.publishLead(lead.id);

  const card = last(t.calls, 'sendMessage')!;
  assert.equal(card.payload.chat_id, GROUP.id);
  assert.match(String(card.payload.text), /#\d+ · Сайты/);
  assert.match(String(card.payload.text), /Лендинг &lt;курса&gt;/, 'бриф экранирован');
  assert.match(String(card.payload.text), /href="https:\/\/t.me\/anna_writes"/);
  assert.match(String(card.payload.text), /никто не взял/);
  const saved = await getLead(t.db, lead.id);
  assert.ok(saved?.cardMessageId);

  await t.send(press(ILYA, `l:${lead.id}:take`, saved!.cardMessageId!));
  assert.match(String(last(t.calls, 'editMessageText')!.payload.text), /ведёт Илья/);

  await t.send(press(ILYA, `l:${lead.id}:st:contacted`, saved!.cardMessageId!));
  assert.match(String(last(t.calls, 'editMessageText')!.payload.text), /<b>Связались<\/b> · ведёт Илья/);
  assert.ok((await getLead(t.db, lead.id))?.firstReplyAt);
  await t.close();
});

test('кнопки — только для команды', async () => {
  const t = await withTeamAndGroup();
  const lead = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' });
  await t.studio.publishLead(lead.id);
  await t.send(press(STRANGER, `l:${lead.id}:take`));
  const answer = last(t.calls, 'answerCallbackQuery')!;
  assert.match(String(answer.payload.text), /только для команды/);
  assert.equal((await getLead(t.db, lead.id))?.ownerId, null);
  await t.close();
});

test('отказ: меню причин и запись причины в карточке', async () => {
  const t = await withTeamAndGroup();
  const lead = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' });
  await t.studio.publishLead(lead.id);
  await t.send(press(OWNER, `l:${lead.id}:lost`));
  const menu = JSON.stringify(last(t.calls, 'editMessageText')!.payload.reply_markup);
  assert.match(menu, /Дорого/);
  await t.send(press(OWNER, `l:${lead.id}:lr:price`));
  assert.match(String(last(t.calls, 'editMessageText')!.payload.text), /<b>Отказ<\/b>: Дорого/);
  assert.match(JSON.stringify(last(t.calls, 'editMessageText')!.payload.reply_markup), /Вернуть в работу/);
  await t.close();
});

test('заметка: бот просит ответить, ответ ложится в карточку', async () => {
  const t = await withTeamAndGroup();
  const lead = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' });
  await t.studio.publishLead(lead.id);
  await t.send(press(ILYA, `l:${lead.id}:note`));
  const prompt = last(t.calls, 'sendMessage')!;
  assert.match(String(prompt.payload.text), /ответьте на это сообщение/);
  const promptId = 100 + t.calls.filter((c) => c.method === 'sendMessage').length;

  await t.send(replyTo(ILYA, promptId, 'Созвон в четверг в 15:00'));
  assert.match(String(last(t.calls, 'editMessageText')!.payload.text), /— Илья: Созвон в четверг в 15:00/);
  await t.close();
});

test('напоминание зовёт всю команду ответом на карточку', async () => {
  const t = await withTeamAndGroup();
  const lead = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' });
  await t.studio.publishLead(lead.id);
  await t.studio.remind((await getLead(t.db, lead.id))!);
  const msg = last(t.calls, 'sendMessage')!;
  assert.match(String(msg.payload.text), /ждёт уже час/);
  assert.match(String(msg.payload.text), new RegExp(`tg://user\\?id=${OWNER.id}`));
  assert.match(String(msg.payload.text), new RegExp(`tg://user\\?id=${ILYA.id}`));
  assert.ok(msg.payload.reply_parameters, 'ответом на карточку');
  await t.close();
});

test('владельцев несколько — каждый входит сам, без приглашения', async () => {
  const t = await testBot({ OWNER_TG_IDS: `${OWNER.id}, ${ILYA.id}` });
  await t.send(command(OWNER, '/start'));
  await t.send(command(ILYA, '/start'));
  assert.deepEqual(
    (await team(t.db)).map((m) => [m.name, m.role]),
    [
      ['Лев', 'owner'],
      ['Илья', 'owner']
    ]
  );
  await t.close();
});
