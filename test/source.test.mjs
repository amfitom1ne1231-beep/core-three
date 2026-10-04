/**
 * Источник заявки: что запоминается при первом заходе и что из присланного
 * клиентом сервер согласен принять.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSource, sourceFrom } from '../.test-out/lib/source.js';
import { leadMessage, sourceLine } from '../.test-out/lib/notify.js';

test('первый заход: метки из ссылки, страница входа и сайт, с которого пришли', () => {
  const url = new URL('https://corethree.ru/bots?utm_source=telegram&utm_medium=cpc&utm_campaign=autumn&x=1');
  assert.deepEqual(sourceFrom(url, 'https://www.vk.com/away.php?to=...'), {
    utm_source: 'telegram',
    utm_medium: 'cpc',
    utm_campaign: 'autumn',
    landing: '/bots',
    ref: 'vk.com'
  });
});

test('переход внутри своего сайта и пустой referrer источником не считаются', () => {
  const url = new URL('https://corethree.ru/contact');
  assert.deepEqual(sourceFrom(url, 'https://www.corethree.ru/sites'), { landing: '/contact' });
  assert.deepEqual(sourceFrom(url, ''), { landing: '/contact' });
  assert.deepEqual(sourceFrom(url, 'не адрес'), { landing: '/contact' });
});

test('сервер берёт только известные строковые поля и режет длину', () => {
  assert.deepEqual(cleanSource({ utm_source: ' tg ', landing: '/x', evil: 'drop', utm_medium: 42, ref: '', utm_term: 'a'.repeat(500) }), {
    utm_source: 'tg',
    landing: '/x',
    utm_term: 'a'.repeat(200)
  });
  assert.equal(cleanSource(null), undefined);
  assert.equal(cleanSource('utm_source=tg'), undefined);
  assert.equal(cleanSource({ evil: 1 }), undefined);
});

test('запасное сообщение в группу: строка источника — только если он известен', () => {
  const lead = { name: 'Анна', contact: '@anna', task: 'Лендинг', kind: 'sites', page: '/sites' };
  assert.equal(sourceLine({ utm_source: 'telegram', utm_medium: 'cpc', landing: '/bots', ref: 'vk.com' }), 'Источник: telegram / cpc · вход: /bots · с vk.com');
  assert.equal(sourceLine(undefined), null);
  assert.match(leadMessage(lead, 'new', { landing: '/sites' }), /Раздел: Сайты · \/sites\nИсточник: вход: \/sites\n\nЛендинг/);
  assert.doesNotMatch(leadMessage(lead, 'new'), /Источник/);
});
