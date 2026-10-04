/**
 * Словарь на месте: слова из словаря размечены в текстах сайта `[[…]]`
 * и по нажатию объясняются (HELP.md, этап 4).
 *
 * Разметку ставят руками, поэтому проверяется то, что руками легко
 * испортить: слово есть в словаре; на странице размечено только первое
 * появление; разметка стоит только там, где текст выводится через
 * `Words`, — в заголовке, кнопке или описании для выдачи скобки
 * вылезли бы наружу как есть.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { marks, pieces, plain } from '../.test-out/content/glossary.js';
import { SITE } from '../.test-out/content/site.js';
import { SERVICES } from '../.test-out/content/services.js';
import { ABOUT } from '../.test-out/content/about.js';
import { HELP } from '../.test-out/content/help.js';

/** Все строки объекта с путями; номера в массивах — `[]`, чтобы путь читался как поле. */
function strings(v, path = '') {
  if (typeof v === 'string') return [{ path, s: v }];
  if (Array.isArray(v)) return v.flatMap((x) => strings(x, `${path}[]`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => strings(x, path ? `${path}.${k}` : k));
  return [];
}
const found = (obj, prefix) => strings(obj, prefix).flatMap(({ path, s }) => marks(s).map((m) => ({ ...m, path })));

/** Поля, которые выводятся через `Words`. Остальным разметка запрещена. */
const ALLOWED = new Set([
  'site.journey.stations[].you',
  'site.services[].summary',
  'services[].lead',
  'services[].includes[].text',
  'services[].steps[].text',
  'services[].audience.items[]',
  'services[].terms[].value',
  'services[].faq[].a',
  'about.cores.detail[].text',
  'about.start.items[].text',
  'about.principles.items[].text',
  'about.limits.items[]',
  'help.start.lead',
  'help.map.lead',
  'help.price.lead',
  'help.after.lead',
  'help.faq.lead',
  'help.words.lead',
  'help.price.factors.items[].text',
  'help.after.prepare.items[].text',
  'help.faq.general.items[].a',
  // вопросы направлений на /help выводятся без кнопок (`plain`)
  'help.faq.services[].items[].a'
]);

const ALL = [...found(SITE, 'site'), ...found(SERVICES, 'services'), ...found(ABOUT, 'about'), ...found(HELP, 'help')];

test('разметка разбирается: слово, другая форма с id, текст вокруг', () => {
  assert.deepEqual(
    pieces('Заявка уходит в [[CRM]] или к [[хостингу|hosting]].').map((p) => (typeof p === 'string' ? p : `<${p.word.id}:${p.text}>`)),
    ['Заявка уходит в ', '<crm:CRM>', ' или к ', '<hosting:хостингу>', '.']
  );
  assert.equal(plain('Без [[бэкапов|backup]] — никак'), 'Без бэкапов — никак');
  assert.deepEqual(pieces('просто текст'), ['просто текст']);
});

test('каждое размеченное слово есть в словаре', () => {
  assert.ok(ALL.length >= 25, 'разметка на месте');
  for (const m of ALL) assert.ok(m.id, `${m.path}: «${m.text}» нет в словаре — нужен [[${m.text}|id]]`);
});

test('разметка — только там, где текст выводится через Words', () => {
  for (const m of ALL) assert.ok(ALLOWED.has(m.path), `${m.path}: «${m.text}» — это поле выводится без Words`);
});

test('на странице слово размечено один раз — первое появление', () => {
  const pages = {
    '/': [...found(SITE.journey, 'journey'), ...found(SITE.services, 'services')],
    ...Object.fromEntries(SERVICES.map((s) => [`/${s.slug}`, found(s, s.slug)])),
    '/about': found(ABOUT, 'about'),
    // вопросы направлений на /help — без кнопок
    '/help': found({ ...HELP, faq: { ...HELP.faq, services: [] } }, 'help')
  };
  for (const [page, list] of Object.entries(pages)) {
    const seen = new Map();
    for (const m of list) {
      assert.ok(!seen.has(m.id), `${page}: «${m.id}» размечено дважды — ${seen.get(m.id)} и ${m.path}`);
      seen.set(m.id, m.path);
    }
  }
});
