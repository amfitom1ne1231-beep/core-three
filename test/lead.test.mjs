/**
 * Заявка — единственный путь, по которому приходят клиенты, и
 * единственное место в проекте, где есть настоящая логика решения:
 * что считать контактом, что считать ботом, что вернуть человеку.
 * Проверялось это до сих пор только руками в браузере.
 *
 * Тест идёт по собранному `lib/lead.ts`: сборка лежит в `.test-out`
 * и делается тем же `tsc`, который уже стоит в проекте, — отдельный
 * прогонщик тестов ради одного файла не нужен.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLead, kindFromLocation, contactHref, LIMITS, MIN_FILL_MS } from '../.test-out/lib/lead.js';

/** Заведомо правильная заявка: в тестах меняем по одному полю. */
const ok = () => ({
  name: 'Лев',
  contact: 'lev@example.ru',
  task: 'Нужен лендинг под запуск курса',
  consent: true,
  elapsed: MIN_FILL_MS + 1000,
  page: '/sites',
  kind: 'sites'
});

test('правильная заявка проходит и не считается ботом', () => {
  const r = checkLead(ok());
  assert.equal(r.ok, true);
  assert.equal(r.bot, false);
  assert.equal(r.lead.kind, 'sites');
  assert.equal(r.lead.page, '/sites');
  assert.equal(r.lead.name, 'Лев');
});

test('пробелы по краям срезаются', () => {
  const r = checkLead({ ...ok(), name: '  Лев  ', task: '  Нужен сайт  ' });
  assert.equal(r.lead.name, 'Лев');
  assert.equal(r.lead.task, 'Нужен сайт');
});

test('каждое обязательное поле сообщает о себе отдельно', () => {
  const r = checkLead({ elapsed: 9999 });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['consent', 'contact', 'name', 'task']);
});

test('согласие обязательно и «почти да» не считается', () => {
  for (const consent of [false, undefined, 'true', 1]) {
    const r = checkLead({ ...ok(), consent });
    assert.equal(r.ok, false, `consent=${String(consent)} не должно проходить`);
    assert.ok(r.errors.consent);
  }
});

test('контакт принимается в любом из трёх видов', () => {
  for (const contact of [
    'lev@example.ru',
    '+7 (999) 123-45-67',
    '8 999 123 45 67',
    '@lev_ivanov',
    't.me/lev_ivanov',
    'https://t.me/lev_ivanov'
  ]) {
    assert.equal(checkLead({ ...ok(), contact }).ok, true, `${contact} должен приниматься`);
  }
});

test('на что ответить нельзя — не принимается', () => {
  for (const contact of ['', '   ', 'позвоните', '12345', 'лев@почта', '@ab']) {
    const r = checkLead({ ...ok(), contact });
    assert.equal(r.ok, false, `${contact} не должен приниматься`);
    assert.ok(r.errors.contact);
  }
});

test('лимиты длины совпадают с ограничениями таблицы', () => {
  assert.equal(checkLead({ ...ok(), name: 'a'.repeat(LIMITS.name) }).ok, true);
  assert.equal(checkLead({ ...ok(), name: 'a'.repeat(LIMITS.name + 1) }).ok, false);
  assert.equal(checkLead({ ...ok(), task: 'a'.repeat(LIMITS.task + 1) }).ok, false);
  // адрес страницы не отвергает заявку, а обрезается
  const r = checkLead({ ...ok(), page: '/' + 'x'.repeat(LIMITS.page * 2) });
  assert.equal(r.ok, true);
  assert.equal(r.lead.page.length, LIMITS.page);
});

test('ловушки для ботов срабатывают, но заявку не выбрасывают', () => {
  const trap = (patch) => {
    const r = checkLead({ ...ok(), ...patch });
    // важно: для отправителя это по-прежнему успех — бот не должен понять
    assert.equal(r.ok, true);
    return r.bot;
  };
  assert.equal(trap({ website: 'https://spam.example' }), true, 'скрытое поле заполнено');
  assert.equal(trap({ elapsed: MIN_FILL_MS - 1 }), true, 'заполнено быстрее человека');
  assert.equal(trap({ elapsed: undefined }), true, 'отметки времени нет вовсе');
  assert.equal(trap({ elapsed: 'быстро' }), true, 'отметка времени не число');
  assert.equal(trap({}), false, 'живой человек ботом не считается');
});

test('тип проекта: явный параметр важнее раздела, мусор — общий', () => {
  assert.equal(kindFromLocation('/sites', 'bots'), 'bots');
  assert.equal(kindFromLocation('/ecommerce', null), 'ecommerce');
  assert.equal(kindFromLocation('/ecommerce', 'выдумка'), 'ecommerce');
  assert.equal(kindFromLocation('/about', null), 'general');
  assert.equal(kindFromLocation('/', null), 'general');
});

test('ссылка на заявку несёт раздел, из которого пришли', () => {
  assert.equal(contactHref('/'), '/contact');
  assert.equal(contactHref('/about'), '/contact');
  assert.equal(contactHref('/bots'), '/contact?type=bots');
  assert.equal(contactHref('/monitoring'), '/contact?type=monitoring');
});

test('подложенный не-объект не роняет проверку', () => {
  for (const junk of [null, undefined, 'строка', 42, []]) {
    const r = checkLead(junk);
    assert.equal(r.ok, false);
  }
});

test('«Мы напишем сами»: только телефон — по нему пишут в мессенджер', () => {
  const help = { ...ok(), help: true, page: '/help', kind: 'general' };
  const tg = checkLead({ ...help, contact: '@lev_writes' });
  assert.equal(tg.ok, false);
  assert.match(tg.errors.contact, /телефон/i);
  assert.equal(checkLead({ ...help, contact: 'lev@example.ru' }).ok, false);

  const r = checkLead({ ...help, contact: '+7 (900) 111-22-33' });
  assert.equal(r.ok, true);
  assert.equal(r.lead.help, true);
});

test('обычная заявка пометки «помощь» не несёт, даже если её подложили строкой', () => {
  assert.equal('help' in checkLead(ok()).lead, false);
  assert.equal('help' in checkLead({ ...ok(), help: 'yes' }).lead, false);
});
