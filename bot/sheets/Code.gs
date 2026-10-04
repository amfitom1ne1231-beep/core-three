/**
 * Приёмник бота CoreThree в Google-таблице.
 *
 * Бот студии присылает сюда строки — заявки, историю действий, проекты,
 * задачи, итоги недель, — а скрипт раскладывает их по листам. Листы
 * и заголовки создаёт сам. Строка находится по первой колонке (номеру):
 * есть — обновляется на месте, нет — дописывается снизу. Поэтому свои
 * колонки с пометками можно вести правее — они не съедут.
 *
 * Установка: Расширения → Apps Script → вставить этот файл →
 * Развернуть → Новое развёртывание → Веб-приложение →
 * «Выполнять от моего имени», «Доступ: все» → скопировать адрес
 * и отдать его боту (SHEETS_URL). Подробно — bot/README.md.
 *
 * Адрес открыт всем, поэтому каждый запрос несёт секрет; без него скрипт
 * ничего не пишет и ничего не отдаёт.
 */

// Секрет подставляет `npm run sheets:script` — тот же, что SHEETS_SECRET у бота.
const SECRET = '__SECRET__';

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'bad json' });
  }
  if (!body || SECRET === '__' + 'SECRET__' || body.secret !== SECRET) return reply({ ok: false, error: 'forbidden' });

  // два запроса разом не должны писать в одни и те же строки
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    let applied = 0;
    (body.ops || []).forEach(function (op) {
      applied += apply(book, op);
    });
    return reply({ ok: true, applied: applied });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return reply({ ok: true, about: 'приёмник бота CoreThree' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Текст клиента не должен стать формулой: строка, начинающаяся с «=», «+»,
 * «-» или «@», таблицей исполняется. Апостроф впереди делает её просто
 * текстом (в ячейке он не виден). Телефон «+7 …» — как раз такой случай.
 */
function safe(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value;
}

function sheetFor(book, name, header) {
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  const have = sheet.getLastRow() ? sheet.getRange(1, 1, 1, header.length).getValues()[0] : [];
  if (have.join('\u0001') !== header.join('\u0001')) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Ключ строки, как его прислал бот. Неделю «2026-10-05» таблица хранит
 * датой и отдаёт датой — без перевода обратно строка не нашлась бы
 * и дописывалась бы заново при каждом обновлении.
 */
function keyOf(book, value) {
  return Object.prototype.toString.call(value) === '[object Date]' ? Utilities.formatDate(value, book.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : String(value);
}

function apply(book, op) {
  const sheet = sheetFor(book, op.sheet, op.header);
  const width = op.header.length;
  const last = sheet.getLastRow();
  const keys = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues() : [];
  const lineOf = {};
  keys.forEach(function (row, i) {
    lineOf[keyOf(book, row[0])] = i + 2;
  });

  const fresh = [];
  (op.rows || []).forEach(function (row) {
    const cells = row.map(safe);
    const line = lineOf[String(row[0])];
    if (line) sheet.getRange(line, 1, 1, width).setValues([cells]);
    else fresh.push(cells);
  });
  if (fresh.length) sheet.getRange(sheet.getLastRow() + 1, 1, fresh.length, width).setValues(fresh);

  // удаляем снизу вверх: иначе номера строк съедут под руками
  const gone = (op.remove || [])
    .map(function (key) {
      return lineOf[String(key)];
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return b - a;
    });
  gone.forEach(function (line) {
    sheet.deleteRow(line);
  });
  return (op.rows || []).length + gone.length;
}
