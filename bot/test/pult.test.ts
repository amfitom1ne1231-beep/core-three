/**
 * Пульт и справочник в личке бота, настройки из приложения. Проверяется
 * то, о чём договорились с заказчиком: свой видит, что ждёт именно его,
 * и листает одно сообщение; новичок получает три шага; посторонний —
 * кнопку на сайт; числа в справочнике и в напоминаниях идут из настроек.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Update } from 'grammy/types';
import { helpSections, daysLabel, span } from '../src/domain/help';
import { createLead, getLead, takeLead } from '../src/domain/leads';
import { defaultPrefs, loadPrefs, savePrefs } from '../src/domain/prefs';
import { addTask, createProject } from '../src/domain/projects';
import { getSetting, setGroup, setSetting } from '../src/domain/settings';
import { team } from '../src/domain/team';
import { dayKey } from '../src/domain/worktime';
import { createApp } from '../src/http/app';
import { tick } from '../src/jobs/scheduler';
import { GROUP, ILYA, OWNER, STRANGER, command, initData, press, testBot, type Call, type TgUserLike } from './helpers';

const last = (calls: Call[], method: string) => [...calls].reverse().find((c) => c.method === method);
const dm = (u: TgUserLike) => ({ id: u.id, type: 'private' as const, title: '' });
const say = (from: TgUserLike, text: string) =>
  ({ message: { message_id: Math.floor(Math.random() * 1e6), date: 0, chat: { id: from.id, type: 'private' }, from, text } }) as unknown as Omit<Update, 'update_id'>;
const buttons = (c: Call | undefined) => JSON.stringify(c?.payload.reply_markup ?? {});

/** Команда из двух человек, группа привязана. */
async function studio(over: Record<string, string> = {}, now?: () => Date) {
  const t = await testBot(over, now);
  await t.send(command(OWNER, '/start'));
  await t.send(command(OWNER, '/invite'));
  const code = String(last(t.calls, 'sendMessage')!.payload.text).match(/start=(inv_[\w-]+)/)![1]!;
  await t.send(command(ILYA, `/start ${code}`));
  await t.send(command(OWNER, '/bind', GROUP));
  const [lev, ilya] = await team(t.db);
  return { ...t, lev: lev!, ilya: ilya! };
}

test('/start своему — пульт: что ждёт именно его, и кнопки', async () => {
  const t = await studio();
  const a = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' });
  await createLead(t.db, { source: 'site', name: 'Борис', contact: '@boris', task: 'Бот', kind: 'bots' });
  await takeLead(t.db, a.id, t.lev.id);
  const p = await createProject(t.db, { title: 'Сайт — Дарья', client: 'Дарья', kind: 'sites' }, t.lev.id);
  await addTask(t.db, p!.id, t.lev.id, { title: 'Получить фотографии', assigneeId: t.lev.id, dueOn: dayKey(new Date(), t.config.work.tz) });

  await t.send(command(OWNER, '/start'));
  const msg = last(t.calls, 'sendMessage')!;
  const text = String(msg.payload.text);
  assert.match(text, /^<b>CoreThree · рабочий бот<\/b>/);
  assert.match(text, /Ждут ответа — 2, из них ничьих 1/);
  assert.match(text, /Мои заявки — 1/);
  assert.match(text, /Мои сроки на сегодня — 1 задача/);
  for (const label of ['Заявки', 'Мои', 'Сегодня', 'Справка']) assert.match(buttons(msg), new RegExp(`"text":"${label}"`));
  assert.doesNotMatch(buttons(msg), /web_app/, 'без адреса приложения кнопки «Студии» нет');
  await t.close();
});

test('с адресом приложения на пульте есть «Открыть „Студию“»', async () => {
  const t = await testBot({ PUBLIC_URL: 'https://bot.corethree.ru' });
  await t.send(command(OWNER, '/start'));
  assert.match(buttons(last(t.calls, 'sendMessage')), /"web_app":\{"url":"https:\/\/bot\.corethree\.ru\/app\/"\}/);
  await t.close();
});

test('кнопки пульта перелистывают то же сообщение, а не шлют новые', async () => {
  const t = await studio();
  const a = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' });
  await t.studio.publishLead(a.id);
  await takeLead(t.db, a.id, t.ilya.id);
  const sent = t.calls.filter((c) => c.method === 'sendMessage').length;

  await t.send(press(ILYA, 'p:leads', 500, dm(ILYA)));
  let e = last(t.calls, 'editMessageText')!;
  assert.equal(e.payload.message_id, 500);
  assert.match(String(e.payload.text), /^<b>Открытые заявки — 1<\/b>/);
  assert.match(String(e.payload.text), /<a href="https:\/\/t\.me\/c\/1234567890\/\d+">#\d+<\/a> · Анна · Новая · Илья/, 'номер — ссылкой на карточку');
  assert.match(buttons(e), /‹ Пульт/);

  await t.send(press(ILYA, 'p:mine', 500, dm(ILYA)));
  e = last(t.calls, 'editMessageText')!;
  assert.match(String(e.payload.text), /<b>Мои заявки — 1<\/b>[\s\S]*Анна[\s\S]*<b>Мои задачи — нет<\/b>/);

  await t.send(press(ILYA, 'p:today', 500, dm(ILYA)));
  assert.match(String(last(t.calls, 'editMessageText')!.payload.text), /^<b>Сегодня · [а-я]{2}, \d+ [а-я]{3}<\/b>[\s\S]*На сегодня ничего не горит/);

  await t.send(press(ILYA, 'p:home', 500, dm(ILYA)));
  assert.match(String(last(t.calls, 'editMessageText')!.payload.text), /Ждут ответа — 1/);
  assert.equal(t.calls.filter((c) => c.method === 'sendMessage').length, sent, 'новых сообщений не появилось');
  await t.close();
});

test('справка листается по разделам; числа в ней — из настроек', async () => {
  const t = await studio();
  await t.send(command(ILYA, '/help'));
  const index = last(t.calls, 'sendMessage')!;
  assert.match(String(index.payload.text), /^<b>Справка<\/b>/);
  for (const title of ['Заявки', 'Проекты', 'Сводки и сроки', 'Команда']) assert.match(buttons(index), new RegExp(`"text":"${title}"`));

  await t.send(press(ILYA, 'p:h_digests', 600, dm(ILYA)));
  let page = String(last(t.calls, 'editMessageText')!.payload.text);
  assert.match(page, /^<b>Справка · Сводки и сроки<\/b>/);
  assert.match(page, /пн–пт, 10:00–19:00 по Москве/);
  assert.match(page, /через час рабочего времени без «Беру»/);
  assert.match(page, /в 18:00 бот смотрит/);
  assert.match(buttons(last(t.calls, 'editMessageText')), /· Сводки и сроки ·/, 'текущий раздел отмечен');

  assert.equal((await savePrefs(t.db, t.config, { takeMin: 30, workStart: 9 * 60, workDays: [1, 3, 5], morningDigest: false })).ok, true);
  await t.send(press(ILYA, 'p:h_digests', 600, dm(ILYA)));
  page = String(last(t.calls, 'editMessageText')!.payload.text);
  assert.match(page, /пн, ср, пт, 9:00–19:00/);
  assert.match(page, /через 30 мин рабочего времени/);
  assert.match(page, /<b>Утренняя сводка<\/b> — выключена/);
  await t.close();
});

test('новичку по приглашению — три шага, а не пульт', async () => {
  const t = await testBot();
  await t.send(command(OWNER, '/start'));
  await t.send(command(OWNER, '/bind', GROUP));
  await t.send(command(OWNER, '/invite'));
  const code = String(last(t.calls, 'sendMessage')!.payload.text).match(/start=(inv_[\w-]+)/)![1]!;
  await t.send(command(ILYA, `/start ${code}`));
  const hello = [...t.calls].reverse().find((c) => c.method === 'sendMessage' && c.payload.chat_id === ILYA.id)!;
  assert.match(String(hello.payload.text), /^<b>Вы в команде CoreThree, Илья<\/b>/);
  assert.match(String(hello.payload.text), /<b>1\.<\/b>[\s\S]*рабочую группу «CoreThree · работа»[\s\S]*<b>2\.<\/b>[\s\S]*<b>3\.<\/b>/);
  assert.match(buttons(hello), /Справка/);

  // во второй раз он уже свой — обычный пульт
  await t.send(command(ILYA, '/start'));
  assert.match(String(last(t.calls, 'sendMessage')!.payload.text), /^<b>CoreThree · рабочий бот<\/b>/);
  await t.close();
});

test('постороннему — кнопка на сайт; кнопки пульта ему не отвечают', async () => {
  const t = await studio();
  await t.send(say(STRANGER, 'здравствуйте, сколько стоит сайт?'));
  const msg = last(t.calls, 'sendMessage')!;
  assert.match(String(msg.payload.text), /рабочий бот студии CoreThree/);
  assert.match(buttons(msg), /"text":"Оставить заявку","url":"https:\/\/corethree\.ru\/contact"/);

  await t.send(press(STRANGER, 'p:leads', 700, dm(STRANGER)));
  assert.match(String(last(t.calls, 'answerCallbackQuery')!.payload.text), /только для команды/);
  assert.equal(last(t.calls, 'editMessageText'), undefined);
  await t.close();
});

test('на непонятный текст своему — подсказка, а не тишина', async () => {
  const t = await studio();
  await t.send(say(ILYA, 'а где мои заявки'));
  const msg = last(t.calls, 'sendMessage')!;
  assert.equal(msg.payload.chat_id, ILYA.id);
  assert.match(String(msg.payload.text), /Не разобрал/);
  assert.match(buttons(msg), /"text":"Пульт"/);
  await t.close();
});

test('меню команд по «/»: у каждого своё, приглашение — только владельцам', async () => {
  const t = await studio();
  const menus = t.calls.filter((c) => c.method === 'setMyCommands');
  const of = (u: TgUserLike) => JSON.stringify([...menus].reverse().find((c) => (c.payload.scope as { chat_id?: number } | undefined)?.chat_id === u.id)?.payload.commands);
  assert.match(of(OWNER), /"command":"invite"/);
  assert.match(of(ILYA), /"command":"start"/);
  assert.doesNotMatch(of(ILYA), /"command":"invite"/);
  await t.close();
});

test('описание бота отправляется один раз на версию текста', async () => {
  const t = await testBot();
  await t.studio.syncProfile();
  await t.studio.syncProfile();
  assert.equal(t.calls.filter((c) => c.method === 'setMyDescription').length, 1);
  assert.match(String(last(t.calls, 'setMyDescription')!.payload.description), /corethree\.ru\/contact/);
  assert.deepEqual(await getSetting(t.db, 'profile'), { v: '1' });
  await t.close();
});

test('настройки: умолчания из окружения, правка проверяется, порча не роняет', async () => {
  const t = await testBot();
  assert.deepEqual(await loadPrefs(t.db, t.config), defaultPrefs(t.config));
  assert.equal(defaultPrefs(t.config).takeMin, 60);

  const bad = await savePrefs(t.db, t.config, { workStart: 18 * 60 + 30, workEnd: 19 * 60 });
  assert.equal(bad.ok, false, 'рабочий день короче часа');
  assert.equal((await savePrefs(t.db, t.config, { takeMin: 2 })).ok, false);

  const ok = await savePrefs(t.db, t.config, { takeMin: 45, workDays: [5, 1, 1, 3] });
  assert.equal(ok.ok && ok.prefs.takeMin, 45);
  assert.deepEqual((await loadPrefs(t.db, t.config)).workDays, [1, 3, 5], 'дни — по порядку и без повторов');

  await setSetting(t.db, 'prefs', { takeMin: 'сломано' });
  assert.deepEqual(await loadPrefs(t.db, t.config), defaultPrefs(t.config), 'испорченная запись — умолчания');
  await t.close();
});

test('слова о сроках: «час», «30 мин», «пн–пт»', () => {
  assert.equal(span(60), 'час');
  assert.equal(span(30), '30 мин');
  assert.equal(span(90), '1 ч 30 мин');
  assert.equal(span(120), '2 ч');
  assert.equal(daysLabel([1, 2, 3, 4, 5]), 'пн–пт');
  assert.equal(daysLabel([1, 3, 5]), 'пн, ср, пт');
  assert.equal(daysLabel([0, 6]), 'сб, вс');
  assert.equal(daysLabel([0, 1, 2, 3, 4, 5, 6]), 'каждый день');
  assert.equal(helpSections(defaultPrefs({ work: { tz: 'Europe/Moscow', days: [1, 2, 3, 4, 5], start: 600, end: 1140 }, SLA_TAKE_MIN: 60, SLA_ALARM_BEFORE_END_MIN: 60 } as never)).length, 4);
});

test('напоминание называет срок из настроек', async () => {
  const t = await studio();
  await savePrefs(t.db, t.config, { takeMin: 30 });
  const lead = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' });
  await t.studio.publishLead(lead.id);
  await t.studio.remind((await getLead(t.db, lead.id))!);
  assert.match(String(last(t.calls, 'sendMessage')!.payload.text), /ждёт уже 30 мин — никто не взял/);
  await t.close();
});

test('выключенная утренняя сводка не уходит и день не занимает', async () => {
  // пятница 9 октября 2026, 10:05 по Москве
  const at = new Date(Date.UTC(2026, 9, 9, 7, 5));
  const t = await studio({}, () => at);
  await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' }, new Date(at.getTime() - 3 * 3600_000));
  const sla = { work: t.config.work, takeMin: 60, alarmBeforeEndMin: 60 };
  const mornings = () => t.calls.filter((c) => c.method === 'sendMessage' && /^<b>Утро/.test(String(c.payload.text))).length;

  await tick(t.db, t.studio, { ...sla, morningDigest: false, weeklyDigest: false }, at);
  assert.equal(mornings(), 0);
  // включили в тот же день — сегодняшняя сводка приходит
  await tick(t.db, t.studio, { ...sla, morningDigest: true, weeklyDigest: false }, at);
  assert.equal(mornings(), 1);
  await tick(t.db, t.studio, { ...sla, morningDigest: true, weeklyDigest: false }, at);
  assert.equal(mornings(), 1, 'второй раз за день — нет');
  await t.close();
});

/* ---------- приложение: «Сегодня», справка, команда и настройки ---------- */

async function withApp(over: Record<string, string> = {}) {
  const t = await studio(over);
  await setGroup(t.db, { chatId: GROUP.id, threadId: 7, title: GROUP.title });
  const app = createApp({ db: t.db, config: t.config, studio: t.studio });
  const call = (user: TgUserLike, path: string, method = 'GET', body?: unknown) =>
    app.request(`/api/app${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `tma ${initData(user)}` },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  return { ...t, call };
}

test('«Сегодня» в приложении — та же выборка, что у пульта; людей отдаём без id в Telegram', async () => {
  const t = await withApp();
  const a = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' });
  const b = await createLead(t.db, { source: 'site', name: 'Борис', contact: '@boris', task: 'Бот', kind: 'bots' });
  await takeLead(t.db, b.id, t.ilya.id);
  const p = await createProject(t.db, { title: 'Сайт — Дарья', client: 'Дарья', kind: 'sites' }, t.lev.id);
  await addTask(t.db, p!.id, t.lev.id, { title: 'Макет', assigneeId: t.ilya.id, dueOn: '2020-01-01' });

  const res = await t.call(ILYA, '/today');
  assert.equal(res.status, 200);
  const d = (await res.json()) as { day: string; waiting: { id: number }[]; mine: unknown[]; tasks: { title: string }[]; due: { tasks: { assignee: Record<string, unknown> | null }[] } };
  assert.match(d.day, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(d.waiting.map((l) => l.id), [a.id, b.id]);
  assert.equal(d.mine.length, 0, 'своя заявка на этапе «Новая» уже в «Ждут ответа» — дважды не показываем');
  assert.deepEqual(d.tasks.map((x) => x.title), ['Макет']);
  assert.deepEqual(d.due.tasks[0]!.assignee, { id: t.ilya.id, name: 'Илья' });
  await t.close();
});

test('справка в приложении — тот же текст, что в боте', async () => {
  const t = await withApp();
  const res = await t.call(ILYA, '/help');
  const d = (await res.json()) as { sections: { id: string; title: string; items: unknown[] }[] };
  assert.deepEqual(d.sections.map((s) => s.id), ['leads', 'projects', 'digests', 'team']);
  assert.ok(d.sections.every((s) => s.items.length >= 5));
  await t.close();
});

test('настройки видят все, меняют владельцы; ошибки — по полям', async () => {
  const t = await withApp();
  const seen = (await (await t.call(ILYA, '/settings')).json()) as { canEdit: boolean; prefs: { takeMin: number }; team: { name: string; role: string; me: boolean }[]; group: { title: string; topic: boolean } };
  assert.equal(seen.canEdit, false);
  assert.equal(seen.prefs.takeMin, 60);
  assert.deepEqual(seen.team.map((m) => [m.name, m.role, m.me]), [['Лев', 'owner', false], ['Илья', 'member', true]]);
  assert.deepEqual(seen.group, { title: GROUP.title, topic: true });

  assert.equal((await t.call(ILYA, '/settings', 'PUT', { takeMin: 30 })).status, 403);
  const bad = await t.call(OWNER, '/settings', 'PUT', { workStart: 1100, workEnd: 1140 });
  assert.equal(bad.status, 422);
  assert.ok(((await bad.json()) as { fields: Record<string, string> }).fields.workEnd);
  assert.equal((await t.call(OWNER, '/settings', 'PUT', { takeMin: 'час' })).status, 400);

  const ok = await t.call(OWNER, '/settings', 'PUT', { takeMin: 30, weeklyDigest: false });
  assert.equal(ok.status, 200);
  const next = (await ok.json()) as { prefs: { takeMin: number; weeklyDigest: boolean; morningDigest: boolean }; canEdit: boolean };
  assert.deepEqual([next.prefs.takeMin, next.prefs.weeklyDigest, next.prefs.morningDigest, next.canEdit], [30, false, true, true]);
  await t.close();
});

test('команда: приглашает и убирает владелец; владельца убрать нельзя', async () => {
  const t = await withApp();
  assert.equal((await t.call(ILYA, '/team/invite', 'POST', {})).status, 403);
  const inv = await t.call(OWNER, '/team/invite', 'POST', {});
  assert.equal(inv.status, 201);
  assert.match(((await inv.json()) as { link: string }).link, /^https:\/\/t\.me\/corethree_bot\?start=inv_[\w-]+$/);

  assert.equal((await t.call(ILYA, `/team/${t.lev.id}`, 'DELETE')).status, 403);
  assert.equal((await t.call(OWNER, `/team/${t.lev.id}`, 'DELETE')).status, 409, 'владельцы заданы на сервере');
  assert.equal((await t.call(OWNER, '/team/999', 'DELETE')).status, 404);
  const gone = await t.call(OWNER, `/team/${t.ilya.id}`, 'DELETE');
  assert.equal(gone.status, 200);
  assert.deepEqual(((await gone.json()) as { team: { name: string }[] }).team.map((m) => m.name), ['Лев']);
  assert.equal((await t.call(ILYA, '/me')).status, 403, 'убранный больше не входит');
  await t.close();
});
