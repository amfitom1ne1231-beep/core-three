/**
 * Словарь в «Помощи»: поиск и постоянные якоря.
 *
 * Якорь слова (`/help#word-<id>`) — адрес, по которому на этапе «словарь
 * на месте» поведут ссылки из текстов сайта, поэтому он обязан быть
 * уникальным и латиницей. Поиск — то, чем человек «не из темы» ищет
 * слово: как помнит, с ошибкой в «ё» и в любом регистре.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { findWords, GLOSSARY } from '../.test-out/content/glossary.js';

const terms = (q) => findWords(q).map((w) => w.term);

test('якоря слов уникальны и годятся для адреса', () => {
  const ids = GLOSSARY.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/, id);
});

test('по алфавиту: сначала русские слова, латиница после', () => {
  const firstLatin = GLOSSARY.findIndex((w) => !/^[а-яё]/i.test(w.term));
  assert.ok(GLOSSARY.slice(firstLatin).every((w) => !/^[а-яё]/i.test(w.term)));
  const ru = GLOSSARY.slice(0, firstLatin).map((w) => w.term);
  assert.deepEqual(ru, [...ru].sort((a, b) => a.localeCompare(b, 'ru')));
});

test('пустой запрос — весь словарь', () => {
  assert.equal(findWords('  ').length, GLOSSARY.length);
});

test('ищется как помнится: начало слова, другое написание, регистр и «ё»', () => {
  assert.equal(terms('хост')[0], 'Хостинг');
  assert.equal(terms('сео')[0], 'SEO');
  assert.equal(terms('WEB APP')[0], 'Мини-приложение');
  assert.equal(terms('верстка')[0], 'Вёрстка');
  assert.equal(terms('коммерческое')[0], 'КП');
});

test('совпадение в названии стоит выше совпадения в объяснении', () => {
  // «оплата» есть в объяснении бота и корзины, но слово про оплату — эквайринг
  assert.equal(terms('оплат')[0], 'Эквайринг');
});

test('нет такого слова — пусто, а не весь словарь', () => {
  assert.deepEqual(terms('ёлка'), []);
});
