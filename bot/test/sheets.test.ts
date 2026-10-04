/**
 * Дублирование в Google-таблицу: что уходит, что не уходит, и сам скрипт
 * таблицы — он исполняется здесь же, в подставной среде Apps Script,
 * потому что проверить его в Google из тестов нельзя.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { members } from '../src/db/schema';
import { addNote, createLead, markLost, setStage, takeLead } from '../src/domain/leads';
import { addSecret, addTask, removeTask, updateStage, updateTask, projectView } from '../src/domain/projects';
import { parseKey } from '../src/domain/seal';
import { dayKey, zoned } from '../src/domain/worktime';
import type { Cell } from '../src/sheets/rows';
import { syncSheets, type Op } from '../src/sheets/sync';
import { memoryDb, testConfig } from './helpers';

const SECRET = 'sheet-secret-0123456789';
const msk = (d: number, hh: number, mm = 0) => zoned(2026, 10, d, hh * 60 + mm, 'Europe/Moscow');
/** Пояс самой таблицы (Файл → Настройки) — не обязательно пояс студии. */
const TABLE_TZ = 'Asia/Novosibirsk';

/**
 * Таблица и её скрипт: листы — массивы строк, скрипт — настоящий sheets/Code.gs.
 * `dates` — как настоящая таблица: «2026-10-05» без апострофа она хранит
 * датой и отдаёт скрипту датой же. По умолчанию выключено, чтобы ячейки
 * в проверках сравнивались строками.
 */
function spreadsheet(secret: string | null = SECRET, opts: { dates?: boolean } = {}) {
  let code = readFileSync(new URL('../sheets/Code.gs', import.meta.url), 'utf8');
  if (secret) code = code.replace("const SECRET = '__SECRET__';", `const SECRET = '${secret}';`);
  const book = new Map<string, (Cell | Date)[][]>();
  const asTyped = (v: Cell): Cell | Date => {
    const m = opts.dates && typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(v) : null;
    return m ? zoned(+m[1]!, +m[2]!, +m[3]!, +(m[4] ?? 0) * 60 + +(m[5] ?? 0), TABLE_TZ) : v;
  };
  const sheet = (name: string) => {
    const rows = book.get(name)!;
    const range = (r: number, c: number, h = 1, w = 1) => ({
      getValues: () => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')),
      setValues(values: Cell[][]) {
        values.forEach((row, i) => {
          const line = (rows[r - 1 + i] ??= []);
          row.forEach((v, j) => (line[c - 1 + j] = asTyped(v)));
        });
        return this;
      },
      setFontWeight() {
        return this;
      }
    });
    return { getLastRow: () => rows.length, getRange: range, setFrozenRows() {}, deleteRow: (line: number) => void rows.splice(line - 1, 1) };
  };
  const sandbox: Record<string, unknown> = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSpreadsheetTimeZone: () => TABLE_TZ,
        getSheetByName: (n: string) => (book.has(n) ? sheet(n) : null),
        insertSheet: (n: string) => {
          book.set(n, []);
          return sheet(n);
        }
      })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      formatDate(date: Date, tz: string, format: string) {
        assert.equal(format, 'yyyy-MM-dd', 'подставной formatDate умеет только этот вид');
        return dayKey(date, tz);
      }
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text: string) => ({
        text,
        setMimeType() {
          return this;
        }
      })
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const post = (body: unknown) => {
    const out = (sandbox.doPost as (e: unknown) => { text: string })({ postData: { contents: JSON.stringify(body) } });
    return JSON.parse(out.text) as { ok: boolean; applied?: number; error?: string };
  };
  /** Отправка, какой её видит бот: отказ таблицы — исключение. */
  const send = async (ops: Op[]) => {
    const res = post({ secret: SECRET, ops });
    if (!res.ok) throw new Error(res.error);
  };
  const column = (name: string, i: number) => (book.get(name) ?? []).slice(1).map((r) => r[i]);
  return { book, post, send, column };
}

test('скрипт таблицы: без секрета не пишет; заготовка без подставленного секрета закрыта для всех', () => {
  const s = spreadsheet();
  const op: Op = { sheet: 'Заявки', header: ['№', 'Имя'], rows: [[1, 'Анна']] };
  assert.deepEqual(s.post({ ops: [op] }), { ok: false, error: 'forbidden' });
  assert.deepEqual(s.post({ secret: 'чужой', ops: [op] }), { ok: false, error: 'forbidden' });
  assert.equal(s.book.size, 0, 'листов не появилось');
  assert.equal(s.post({ secret: SECRET, ops: [op] }).ok, true);

  const raw = spreadsheet(null);
  assert.equal(raw.post({ secret: '__SECRET__', ops: [op] }).ok, false, 'секрет-заглушка не подходит');
});

test('скрипт таблицы: строка находится по номеру — обновляется на месте, новая дописывается, лишняя удаляется', () => {
  const s = spreadsheet();
  const header = ['№', 'Имя', 'Этап'];
  s.post({ secret: SECRET, ops: [{ sheet: 'Заявки', header, rows: [[1, 'Анна', 'Новая'], [2, 'Борис', 'Новая'], [3, 'Вера', 'Новая']] }] });
  assert.deepEqual(s.book.get('Заявки'), [header, [1, 'Анна', 'Новая'], [2, 'Борис', 'Новая'], [3, 'Вера', 'Новая']]);

  // пометка команды правее наших колонок
  s.book.get('Заявки')![2]![3] = 'перезвонить в пятницу';
  const res = s.post({ secret: SECRET, ops: [{ sheet: 'Заявки', header, rows: [[2, 'Борис', 'Связались'], [4, 'Глеб', 'Новая']], remove: ['1'] }] });
  assert.equal(res.applied, 3);
  assert.deepEqual(s.book.get('Заявки'), [header, [2, 'Борис', 'Связались', 'перезвонить в пятницу'], [3, 'Вера', 'Новая'], [4, 'Глеб', 'Новая']], 'пометка осталась при своей строке');
});

test('скрипт таблицы: текст клиента не становится формулой', () => {
  const s = spreadsheet();
  s.post({ secret: SECRET, ops: [{ sheet: 'Заявки', header: ['№', 'Имя', 'Контакт', 'Текст'], rows: [[1, '=IMPORTXML("http://evil","//a")', '+7 900 000-00-00', '@всем -скидка']] }] });
  assert.deepEqual(s.book.get('Заявки')![1], [1, '\'=IMPORTXML("http://evil","//a")', "'+7 900 000-00-00", "'@всем -скидка"]);
});

test('скрипт таблицы: ключ, который таблица сделала датой, всё равно находит свою строку', () => {
  const s = spreadsheet(SECRET, { dates: true });
  const header = ['Неделя с', 'Заявок'];
  s.post({ secret: SECRET, ops: [{ sheet: 'Итоги по неделям', header, rows: [['2026-10-05', 2]] }] });
  assert.ok(s.book.get('Итоги по неделям')![1]![0] instanceof Date, 'подставная таблица и правда хранит дату');
  s.post({ secret: SECRET, ops: [{ sheet: 'Итоги по неделям', header, rows: [['2026-10-05', 3]] }] });
  assert.deepEqual(s.column('Итоги по неделям', 1), [3], 'обновилась та же строка, новой не появилось');
});

async function studio() {
  const h = await memoryDb();
  const config = testConfig();
  const [lev, ilya] = await h.db
    .insert(members)
    .values([
      { tgId: 1, name: 'Лев', role: 'owner' },
      { tgId: 2, name: 'Илья', role: 'owner' }
    ])
    .returning();
  return { ...h, work: config.work, L: lev!.id, I: ilya!.id };
}

test('в таблицу уходит всё целиком; дальше — только то, что изменилось', async () => {
  const t = await studio();
  const s = spreadsheet();
  const sync = (now: Date) => syncSheets(t.db, { work: t.work, slaMin: 60, now, send: s.send });

  const anna = await createLead(t.db, { source: 'site', name: 'Анна', contact: '+7 900 111-22-33', task: 'Лендинг под курс', kind: 'sites', page: '/sites', meta: { utm_source: 'telegram' } }, msk(5, 11));
  await setStage(t.db, anna.id, t.L, 'contacted', msk(5, 11, 20));
  await addNote(t.db, anna.id, t.L, 'Созвон в четверг', msk(5, 12));
  await setStage(t.db, anna.id, t.L, 'contract', msk(6, 12));
  const boris = await createLead(t.db, { source: 'manual', name: 'Борис', contact: '@boris_auto', task: 'Бот для записи', kind: 'bots' }, msk(6, 10));
  await takeLead(t.db, boris.id, t.I, msk(6, 10));

  const first = await sync(msk(7, 12));
  assert.ok(first.rows > 0);
  assert.deepEqual([...s.book.keys()].sort(), ['Заявки', 'История', 'Проекты'], 'листы создаёт сам скрипт; задач и законченных недель ещё нет — нет и их листов');

  const [, a, b] = s.book.get('Заявки')!;
  assert.deepEqual(a!.slice(0, 11), [anna.id, '2026-10-05 11:00', 'Анна', "'+7 900 111-22-33", 'Сайты', 'с сайта', 'telegram', '/sites', 'Договор', '', 'Лев']);
  assert.deepEqual([a![12], a![13], a![16], a![17]], ['2026-10-05 11:20', 20, 'Сайт — Анна', 'Лендинг под курс'], 'первый ответ — в рабочих минутах, проект — по названию');
  // ник начинается с «@» — скрипт ставит апостроф, чтобы таблица не приняла его за формулу; в ячейке он не виден
  assert.deepEqual([b![2], b![3], b![5], b![8], b![10]], ['Борис', "'@boris_auto", 'вручную', 'Новая', 'Илья']);

  assert.deepEqual(s.column('Проекты', 1), ['Сайт — Анна']);
  assert.deepEqual(s.column('История', 6), ['Заявка пришла', 'Этап', 'Заметка', 'Этап', 'Заявка пришла', 'Взял заявку', 'Проект заведён']);
  assert.ok(s.column('История', 7).includes('Созвон в четверг'), 'заметка — в подробностях');
  assert.ok(s.column('История', 7).includes('Связались → Договор'));
  assert.ok(s.column('История', 7).includes(`из заявки №${anna.id}`));

  // ничего не менялось — ничего не уходит
  let calls = 0;
  const quiet = await syncSheets(t.db, { work: t.work, slaMin: 60, now: msk(7, 12, 1), send: async () => void calls++ });
  assert.deepEqual([quiet.rows, calls], [0, 0]);

  // отказ: меняется одна строка заявок, в историю дописывается одна
  const historyBefore = s.book.get('История')!.length;
  await markLost(t.db, boris.id, t.I, 'price', msk(7, 13));
  await sync(msk(7, 13, 1));
  assert.deepEqual([s.book.get('Заявки')!.length, s.book.get('Заявки')![2]![8], s.book.get('Заявки')![2]![9]], [3, 'Отказ', 'Дорого']);
  assert.equal(s.book.get('История')!.length, historyBefore + 1);
  assert.deepEqual(s.book.get('История')!.at(-1)!.slice(2), ['Заявка', boris.id, 'Борис', 'Илья', 'Отказ', 'Дорого']);
  await t.close();
});

test('проекты и задачи: правка, которой нет в истории, тоже доходит; удалённая задача уходит из таблицы', async () => {
  const t = await studio();
  const s = spreadsheet();
  const sync = (now: Date) => syncSheets(t.db, { work: t.work, slaMin: 60, now, send: s.send });
  const lead = await createLead(t.db, { source: 'site', name: 'Дарья', contact: '@darya_yoga', task: 'Сайт студии', kind: 'sites' }, msk(1, 11));
  await setStage(t.db, lead.id, t.L, 'contract', msk(1, 12));
  const v = (await projectView(t.db, 1))!;
  const task = (await addTask(t.db, 1, t.L, { title: 'Макет главной', stageId: v.stages[2]!.id, assigneeId: t.I, dueOn: '2026-10-06' }, msk(2, 10)))!;
  const extra = (await addTask(t.db, 1, t.L, { title: 'Лишняя' }, msk(2, 10)))!;

  await sync(msk(7, 12));
  assert.deepEqual(s.book.get('Задачи')![1], [task.id, 'Сайт — Дарья', 'Дизайн', 'Макет главной', 'Илья', '2026-10-06', 'просрочена', '2026-10-02 10:00', '']);
  assert.deepEqual(s.book.get('Проекты')![1]!.slice(7, 13), ['Бриф', 0, 6, 2, 1, '2026-10-06']);

  // срок и исполнитель меняются без события в истории — отпечаток строки всё равно другой
  await updateTask(t.db, task.id, t.L, { dueOn: '2026-10-20', assigneeId: t.L }, msk(7, 13));
  await updateStage(t.db, v.stages[0]!.id, t.L, { dueOn: '2026-10-09' }, msk(7, 13));
  await removeTask(t.db, extra.id, t.L, msk(7, 13));
  await sync(msk(7, 14));
  assert.deepEqual(s.book.get('Задачи')!.slice(1).map((r) => [r[0], r[4], r[5], r[6]]), [[task.id, 'Лев', '2026-10-20', 'открыта']]);
  assert.deepEqual(s.book.get('Проекты')![1]!.slice(10, 13), [1, 0, '2026-10-09']);

  await updateTask(t.db, task.id, t.L, { done: true }, msk(8, 10));
  await sync(msk(8, 11));
  assert.deepEqual([s.book.get('Задачи')![1]![6], s.book.get('Задачи')![1]![8]], ['выполнена', '2026-10-08 10:00']);
  await t.close();
});

test('итоги по неделям: строка на неделю с заявками; цифры прошлой недели обновляются, пока заявки движутся', async () => {
  const t = await studio();
  const s = spreadsheet();
  const a = await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites', meta: { ref: 'vk.com' } }, msk(6, 11));
  await setStage(t.db, a.id, t.L, 'contacted', msk(6, 11, 30));
  await createLead(t.db, { source: 'mail', name: 'Борис', contact: 'b@example.com', task: 'Письмо', kind: 'bots' }, msk(7, 11));

  await syncSheets(t.db, { work: t.work, slaMin: 60, now: msk(13, 12), send: s.send });
  assert.deepEqual(s.book.get('Итоги по неделям')!.slice(1), [['2026-10-05', '2026-10-11', 2, 1, 0, 0, 0, 0, 0, 30, '1 из 1', 1, 'Почта — 1, vk.com — 1', '']]);

  await setStage(t.db, a.id, t.L, 'contract', msk(13, 13));
  await syncSheets(t.db, { work: t.work, slaMin: 60, now: msk(13, 14), send: s.send });
  assert.deepEqual(s.book.get('Итоги по неделям')![1]!.slice(2, 9), [2, 1, 1, 1, 1, 1, 0], 'та же строка, договор досчитан');
  assert.equal(s.book.get('Итоги по неделям')!.length, 2);
  await t.close();
});

test('итоги по неделям: неделя, которую уже не пересчитывают, из таблицы не пропадает', async () => {
  const t = await studio();
  const s = spreadsheet();
  await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' }, msk(6, 11));
  await syncSheets(t.db, { work: t.work, slaMin: 60, now: msk(13, 12), send: s.send });
  assert.deepEqual(s.column('Итоги по неделям', 0), ['2026-10-05']);

  // через четверть года неделя 5 октября вышла из пересчёта
  const later = new Date(msk(13, 12).getTime() + 14 * 7 * 86_400_000);
  await createLead(t.db, { source: 'site', name: 'Борис', contact: '@boris_auto', task: 'Бот', kind: 'bots' }, new Date(later.getTime() - 7 * 86_400_000));
  await syncSheets(t.db, { work: t.work, slaMin: 60, now: later, send: s.send });
  assert.deepEqual(s.column('Итоги по неделям', 0), ['2026-10-05', '2027-01-11']);
  await t.close();
});

test('таблица не ответила — ничего не потеряно и не задвоено: уйдёт в следующий раз', async () => {
  const t = await studio();
  const s = spreadsheet();
  await createLead(t.db, { source: 'site', name: 'Анна', contact: '@anna_writes', task: 'Лендинг', kind: 'sites' }, msk(5, 11));

  let attempt = 0;
  const flaky = async (ops: Op[]) => {
    // первый запрос дошёл и записался, второй упал — как обрыв связи посреди отправки
    if (attempt++ === 1) throw new Error('обрыв');
    await s.send(ops);
  };
  await assert.rejects(syncSheets(t.db, { work: t.work, slaMin: 60, now: msk(5, 12), send: flaky }), /обрыв/);
  await syncSheets(t.db, { work: t.work, slaMin: 60, now: msk(5, 12, 1), send: s.send });
  assert.equal(s.book.get('Заявки')!.length, 2, 'одна заявка — одна строка');
  assert.equal(s.book.get('История')!.length, 2, 'одно событие — одна строка');
  await t.close();
});

test('доступы в таблицу не попадают — только название в истории', async () => {
  const t = await studio();
  const s = spreadsheet();
  const lead = await createLead(t.db, { source: 'site', name: 'Дарья', contact: '@darya_yoga', task: 'Сайт', kind: 'sites' }, msk(1, 11));
  await setStage(t.db, lead.id, t.L, 'contract', msk(1, 12));
  await addSecret(t.db, parseKey(randomBytes(32).toString('base64')), 1, t.L, { title: 'Хостинг', value: 'пароль Tr0ub4dor&3' }, msk(2, 10));

  await syncSheets(t.db, { work: t.work, slaMin: 60, now: msk(7, 12), send: s.send });
  const dump = JSON.stringify([...s.book.entries()]);
  assert.doesNotMatch(dump, /Tr0ub4dor/);
  assert.deepEqual(s.book.get('История')!.at(-1)!.slice(6), ['Добавлен доступ', 'Хостинг']);
  await t.close();
});
