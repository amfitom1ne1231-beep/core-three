/**
 * Проекты: рождение из заявки на «Договоре», этапы по шаблону, задачи
 * и сроки, материалы (ссылки и файлы через бота), доступы под шифром.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import type { Update } from 'grammy/types';
import { secrets } from '../src/db/schema';
import { createLead, setStage } from '../src/domain/leads';
import { deadlines, projectView } from '../src/domain/projects';
import { parseKey, seal, unseal } from '../src/domain/seal';
import { setGroup } from '../src/domain/settings';
import { stagesFor } from '../src/domain/templates';
import { zoned } from '../src/domain/worktime';
import { createApp } from '../src/http/app';
import { tick } from '../src/jobs/scheduler';
import { GROUP, ILYA, OWNER, STRANGER, command, initData, testBot, type TgUserLike } from './helpers';

const KEY = randomBytes(32).toString('base64');
/** Московское время; 2026-10-05 — понедельник. */
const msk = (d: number, hh: number, mm = 0) => zoned(2026, 10, d, hh * 60 + mm, 'Europe/Moscow');

type View = NonNullable<Awaited<ReturnType<typeof projectView>>>;

async function setup(over: Record<string, string> = {}, now?: () => Date) {
  const t = await testBot({ OWNER_TG_IDS: `${OWNER.id},${ILYA.id}`, SECRETS_KEY: KEY, PUBLIC_URL: 'https://bot.example', ...over }, now);
  await setGroup(t.db, { chatId: GROUP.id, threadId: null, title: null });
  const app = createApp({ db: t.db, config: t.config, studio: t.studio, now });
  const call = (user: TgUserLike, path: string, body?: unknown) =>
    app.request(`/api/app${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', authorization: `tma ${initData(user, { at: now?.() })}` },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  const json = async <T>(user: TgUserLike, path: string, body?: unknown) => (await (await call(user, path, body)).json()) as T;
  // оба владельца входят — становятся участниками 1 и 2
  await call(OWNER, '/me');
  await call(ILYA, '/me');
  return { ...t, app, call, json };
}

const last = (calls: { method: string; payload: Record<string, unknown> }[], method: string) => [...calls].reverse().find((c) => c.method === method);

test('шифр доступов: читается только своим ключом и только в своём проекте', () => {
  const key = parseKey(KEY);
  const sealed = seal(key, 'project:1', 'логин admin\nпароль пёс-и-кот');
  assert.equal(unseal(key, 'project:1', sealed), 'логин admin\nпароль пёс-и-кот');
  assert.doesNotMatch(Buffer.from(sealed, 'base64').toString('latin1'), /admin/, 'в строке нет открытого текста');
  assert.notEqual(seal(key, 'project:1', 'x'), seal(key, 'project:1', 'x'), 'нонс каждый раз новый');
  assert.equal(unseal(key, 'project:2', sealed), null, 'переставили в другой проект');
  assert.equal(unseal(parseKey(randomBytes(32).toString('base64')), 'project:1', sealed), null, 'чужой ключ');
  const broken = Buffer.from(sealed, 'base64');
  broken[broken.length - 1]! ^= 1;
  assert.equal(unseal(key, 'project:1', broken.toString('base64')), null, 'строку подправили');
  assert.throws(() => parseKey('c2hvcnQ='), /32 байта/);
});

test('«Договор»: из заявки вырастает проект с этапами её направления — один раз', async () => {
  const t = await setup();
  const lead = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' });
  await t.studio.publishLead(lead.id);

  const d = await t.json<{ lead: { stage: string }; project: { id: number; title: string } | null }>(OWNER, `/leads/${lead.id}/stage`, { stage: 'contract' });
  assert.equal(d.project?.title, 'Сайт — Анна');
  assert.match(String(last(t.calls, 'editMessageText')!.payload.text), /Проект: Сайт — Анна/, 'карточка в группе знает о проекте');

  const v = await t.json<View>(OWNER, `/projects/${d.project!.id}`);
  assert.deepEqual(
    v.stages.map((s) => s.title),
    [...stagesFor('sites')]
  );
  assert.equal(v.project.leadId, lead.id);
  assert.equal(v.project.contact, '@anna_writes');
  assert.equal(v.ownerName, 'Лев', 'ведёт тот, кто довёл до договора');
  assert.equal(v.events[0]?.type, 'created');

  // вернули в работу и снова довели до договора — проект тот же
  await t.call(OWNER, `/leads/${lead.id}/reopen`, {});
  const again = await t.json<{ project: { id: number } }>(OWNER, `/leads/${lead.id}/stage`, { stage: 'contract' });
  assert.equal(again.project.id, d.project!.id);
  assert.equal((await t.json<{ projects: unknown[] }>(OWNER, '/projects')).projects.length, 1);
  await t.close();
});

test('проект вручную, этапы и задачи: сроки, исполнитель, «мои задачи»', async () => {
  const t = await setup({}, () => msk(7, 12));
  const created = await t.call(OWNER, '/projects', { client: 'Кофейня «Зерно»', kind: 'bots' });
  assert.equal(created.status, 201);
  let v = (await created.json()) as View;
  const id = v.project.id;
  assert.equal(v.project.title, 'Бот — Кофейня «Зерно»');
  assert.deepEqual(
    v.stages.map((s) => s.title),
    ['Сценарий', 'Сборка', 'Интеграции', 'Запуск']
  );

  // этап: срок и выполнение
  v = await t.json<View>(OWNER, `/stages/${v.stages[0]!.id}`, { dueOn: '2026-10-06', done: true });
  assert.ok(v.stages[0]!.doneAt);
  v = await t.json<View>(OWNER, `/projects/${id}/stages`, { title: 'Обучение персонала' });
  assert.equal(v.stages.at(-1)?.title, 'Обучение персонала');
  assert.equal(v.stages.at(-1)?.position, 5);

  // задачи: Илье на вчера, Льву на завтра, без срока
  const build = v.stages[1]!.id;
  await t.call(OWNER, `/projects/${id}/tasks`, { title: 'Собрать меню', stageId: build, assigneeId: 2, dueOn: '2026-10-06' });
  await t.call(OWNER, `/projects/${id}/tasks`, { title: 'Текст приветствия', assigneeId: 1, dueOn: '2026-10-08' });
  v = await t.json<View>(OWNER, `/projects/${id}/tasks`, { title: 'Позвонить владельцу' });
  assert.deepEqual(
    v.tasks.map((x) => x.title),
    ['Собрать меню', 'Текст приветствия', 'Позвонить владельцу'],
    'по сроку, без срока — в конце'
  );
  assert.equal((await t.call(OWNER, `/projects/${id}/tasks`, { title: 'Чужой', assigneeId: 99 })).status, 400, 'исполнитель — только из команды');
  assert.equal((await t.call(OWNER, `/projects/${id}/tasks`, { title: 'День', dueOn: '2026-13-45' })).status, 400);

  const mine = await t.json<{ tasks: { title: string; project: string }[]; today: string }>(ILYA, '/tasks/mine');
  assert.equal(mine.today, '2026-10-07');
  assert.deepEqual(
    mine.tasks.map((x) => [x.title, x.project]),
    [['Собрать меню', 'Бот — Кофейня «Зерно»']]
  );

  const list = await t.json<{ projects: { stage: string; stagesDone: number; stagesTotal: number; openTasks: number; overdue: number; nextDue: string }[] }>(OWNER, '/projects');
  assert.deepEqual(
    [list.projects[0]!.stage, list.projects[0]!.stagesDone, list.projects[0]!.stagesTotal, list.projects[0]!.openTasks, list.projects[0]!.overdue, list.projects[0]!.nextDue],
    ['Сборка', 1, 5, 3, 1, '2026-10-06']
  );

  // выполнили — уходит из «моих» и из просроченных; этап удалили — задача осталась в проекте
  const taskId = v.tasks.find((x) => x.title === 'Собрать меню')!.id;
  v = await t.json<View>(ILYA, `/tasks/${taskId}`, { done: true });
  assert.equal(v.tasks.at(-1)?.title, 'Собрать меню', 'выполненные — в конце');
  assert.equal((await t.json<{ tasks: unknown[] }>(ILYA, '/tasks/mine')).tasks.length, 0);
  v = await t.json<View>(OWNER, `/stages/${build}/remove`, {});
  assert.equal(v.tasks.find((x) => x.id === taskId)?.stageId, null);
  assert.deepEqual(
    v.events.map((e) => e.type).reverse(),
    ['created', 'stage_done', 'stage_added', 'task_added', 'task_added', 'task_added', 'task_done', 'stage_removed']
  );

  // архив: завершённый проект уходит из списка «в работе»
  await t.call(OWNER, `/projects/${id}`, { status: 'done' });
  assert.equal((await t.json<{ projects: unknown[] }>(OWNER, '/projects')).projects.length, 0);
  assert.equal((await t.json<{ projects: unknown[] }>(OWNER, '/projects?scope=archive')).projects.length, 1);
  assert.equal((await t.call(STRANGER, '/projects')).status, 403);
  await t.close();
});

test('этап чужого проекта к задаче не привязать', async () => {
  const t = await setup();
  const a = await t.json<View>(OWNER, '/projects', { client: 'А', kind: 'sites' });
  const b = await t.json<View>(OWNER, '/projects', { client: 'Б', kind: 'sites' });
  const v = await t.json<View>(OWNER, `/projects/${a.project.id}/tasks`, { title: 'Задача', stageId: b.stages[0]!.id });
  assert.equal(v.tasks[0]!.stageId, null);
  await t.close();
});

test('доступы: в базе и в списке значения нет; просмотр — отдельно и остаётся в истории', async () => {
  const t = await setup();
  const p = await t.json<View>(OWNER, '/projects', { client: 'Анна', kind: 'sites' });
  const id = p.project.id;

  const res = await t.call(OWNER, `/projects/${id}/secrets`, { title: 'Хостинг', value: 'логин anna\nпароль Tr0ub4dor&3' });
  const raw = await res.text();
  assert.doesNotMatch(raw, /Tr0ub4dor|sealed/, 'ни значения, ни шифротекста в ответе');
  const v = JSON.parse(raw) as View;
  assert.deepEqual(
    v.secrets.map((s) => s.title),
    ['Хостинг']
  );
  const [row] = await t.db.select().from(secrets);
  assert.doesNotMatch(JSON.stringify(row), /Tr0ub4dor|anna/, 'в базе — только шифр');

  const shown = await t.call(ILYA, `/secrets/${v.secrets[0]!.id}/reveal`, {});
  assert.equal(shown.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await shown.json(), { value: 'логин anna\nпароль Tr0ub4dor&3' });
  const after = await t.json<View>(OWNER, `/projects/${id}`);
  assert.deepEqual([after.events[0]!.type, after.events[0]!.who, after.events[0]!.data], ['secret_viewed', 'Илья', { title: 'Хостинг' }]);

  await t.call(OWNER, `/secrets/${v.secrets[0]!.id}`, { value: 'новый пароль' });
  assert.deepEqual(await (await t.call(OWNER, `/secrets/${v.secrets[0]!.id}/reveal`, {})).json(), { value: 'новый пароль' });
  assert.equal((await t.call(STRANGER, `/secrets/${v.secrets[0]!.id}/reveal`, {})).status, 403);
  const gone = await t.json<View>(OWNER, `/secrets/${v.secrets[0]!.id}/remove`, {});
  assert.equal(gone.secrets.length, 0);
  await t.close();

  // без ключа раздел выключен — и приложение об этом знает заранее
  const off = await setup({ SECRETS_KEY: '' });
  const me = await off.json<{ features: { secrets: boolean } }>(OWNER, '/me');
  assert.equal(me.features.secrets, false);
  const q = await off.json<View>(OWNER, '/projects', { client: 'Б', kind: 'sites' });
  assert.equal((await off.call(OWNER, `/projects/${q.project.id}/secrets`, { title: 'Х', value: 'y' })).status, 503);
  await off.close();
});

test('материалы: ссылка — только http(s); файл пересылают боту, он же присылает его обратно', async () => {
  const t = await setup();
  const p = await t.json<View>(OWNER, '/projects', { client: 'Анна', kind: 'sites' });
  const id = p.project.id;

  assert.equal((await t.call(OWNER, `/projects/${id}/links`, { url: 'javascript:alert(1)' })).status, 400);
  let v = await t.json<View>(OWNER, `/projects/${id}/links`, { url: 'https://www.figma.com/file/abc' });
  assert.deepEqual([v.materials[0]!.kind, v.materials[0]!.title, v.materials[0]!.url], ['link', 'figma.com', 'https://www.figma.com/file/abc']);

  // файл в личку — бот спрашивает, к какому проекту
  const fileMsg = { message_id: 501, date: 0, chat: { id: ILYA.id, type: 'private' }, from: ILYA, document: { file_id: 'FILE-1', file_unique_id: 'u1', file_name: 'бриф.pdf', file_size: 12345 }, caption: 'Бриф от клиента' };
  await t.send({ message: fileMsg } as unknown as Omit<Update, 'update_id'>);
  const ask = last(t.calls, 'sendMessage')!;
  assert.match(String(ask.payload.text), /К какому проекту/);
  assert.match(JSON.stringify(ask.payload.reply_markup), new RegExp(`"callback_data":"m:${id}"`));

  // выбрали проект кнопкой: файл берётся из сообщения, на которое бот отвечал
  await t.send({
    callback_query: { id: 'cb1', from: ILYA, chat_instance: 'x', data: `m:${id}`, message: { message_id: 502, date: 0, chat: { id: ILYA.id, type: 'private' }, text: 'К какому проекту прикрепить?', reply_to_message: fileMsg } }
  } as unknown as Omit<Update, 'update_id'>);
  assert.match(String(last(t.calls, 'editMessageText')!.payload.text), /Прикреплено к проекту «Сайт — Анна»: Бриф от клиента/);

  v = await t.json<View>(OWNER, `/projects/${id}`);
  const file = v.materials.find((m) => m.kind === 'file')!;
  assert.deepEqual([file.title, file.fileName, file.fileSize], ['Бриф от клиента', 'бриф.pdf', 12345]);
  assert.ok(!('fileId' in file), 'file_id приложению не отдаётся');

  // «прислать в личку» из приложения
  assert.deepEqual(await t.json(OWNER, `/materials/${file.id}/send`, {}), { ok: true });
  const sent = last(t.calls, 'sendDocument')!;
  assert.deepEqual([sent.payload.chat_id, sent.payload.document], [OWNER.id, 'FILE-1']);
  assert.equal((await t.call(OWNER, `/materials/${v.materials[0]!.id}/send`, {})).status, 404, 'ссылку прислать нельзя');

  // посторонний с файлом — как обычно, ссылка на сайт
  await t.send({ message: { ...fileMsg, message_id: 600, chat: { id: STRANGER.id, type: 'private' }, from: STRANGER } } as unknown as Omit<Update, 'update_id'>);
  assert.match(String(last(t.calls, 'sendMessage')!.payload.text), /рабочий бот студии/);

  // /start project_N — кнопка приложения на проект
  await t.send(command(OWNER, `/start project_${id}`));
  assert.match(JSON.stringify(last(t.calls, 'sendMessage')!.payload.reply_markup), new RegExp(`https://bot.example/app/projects/${id}`));
  await t.close();
});

test('сроки дня: одно сообщение в рабочее утро, с отметкой исполнителей; закрытое и архив молчат', async () => {
  let clock = msk(6, 9, 30);
  const t = await setup({}, () => clock);
  const sla = { work: t.config.work, takeMin: 60, alarmBeforeEndMin: 60 };
  const a = await t.json<View>(OWNER, '/projects', { client: 'Анна', kind: 'sites' });
  const b = await t.json<View>(OWNER, '/projects', { client: 'Архивный', kind: 'bots' });
  await t.call(OWNER, `/projects/${a.project.id}/tasks`, { title: 'Прототип главной', assigneeId: 2, dueOn: '2026-10-06' });
  await t.call(OWNER, `/projects/${a.project.id}/tasks`, { title: 'Просроченная', assigneeId: 1, dueOn: '2026-10-02' });
  await t.call(OWNER, `/projects/${a.project.id}/tasks`, { title: 'На потом', assigneeId: 1, dueOn: '2026-10-20' });
  const done = await t.json<View>(OWNER, `/projects/${a.project.id}/tasks`, { title: 'Уже сделана', assigneeId: 1, dueOn: '2026-10-05' });
  await t.call(OWNER, `/tasks/${done.tasks.find((x) => x.title === 'Уже сделана')!.id}`, { done: true });
  await t.call(OWNER, `/stages/${a.stages[0]!.id}`, { dueOn: '2026-10-06' });
  await t.call(OWNER, `/projects/${b.project.id}/tasks`, { title: 'В архиве', assigneeId: 1, dueOn: '2026-10-01' });
  await t.call(OWNER, `/projects/${b.project.id}`, { status: 'cancelled' });

  const due = await deadlines(t.db, '2026-10-06');
  assert.deepEqual(
    due.tasks.map((x) => x.title),
    ['Просроченная', 'Прототип главной']
  );
  assert.deepEqual(
    due.stages.map((x) => x.title),
    ['Бриф']
  );

  const digests = () => t.calls.filter((c) => c.method === 'sendMessage' && /Сроки на сегодня/.test(String(c.payload.text)));
  await tick(t.db, t.studio, sla, clock);
  assert.equal(digests().length, 0, '9:30 — рабочий день ещё не начался');

  clock = msk(6, 10, 1);
  await tick(t.db, t.studio, sla, clock);
  assert.equal(digests().length, 1);
  const text = String(digests()[0]!.payload.text);
  assert.equal(digests()[0]!.payload.chat_id, GROUP.id);
  assert.match(text, new RegExp(`tg://user\\?id=${OWNER.id}[^\\n]*\\n— Просроченная · Сайт — Анна · с 2 окт`));
  assert.match(text, new RegExp(`tg://user\\?id=${ILYA.id}[^\\n]*\\n— Прототип главной · Сайт — Анна · сегодня`));
  assert.match(text, /Этапы\n— «Бриф» · Сайт — Анна · сегодня/);
  assert.doesNotMatch(text, /На потом|Уже сделана|В архиве/);

  clock = msk(6, 15);
  await tick(t.db, t.studio, sla, clock);
  assert.equal(digests().length, 1, 'второй раз за день не шлём');

  clock = msk(10, 12);
  await tick(t.db, t.studio, sla, clock);
  assert.equal(digests().length, 1, 'суббота — молчим');

  clock = msk(12, 10, 0);
  await tick(t.db, t.studio, sla, clock);
  assert.equal(digests().length, 2, 'понедельник: просроченное напоминается снова');
  await t.close();
});
