/**
 * QR-коды для перехода на сайт — на визитки, в презентации, в печать.
 *
 * Три адреса: главная, заявка и концепты. У каждого метка `utm_source=qr`:
 * сайт запоминает её и отдаёт вместе с заявкой (lib/source.ts), так что
 * в боте видно, сколько заявок пришло с кодов.
 *
 * Два вида каждого кода:
 *   <имя>.svg / .png        — со знаком в середине. Запас исправления ошибок
 *                             наибольший (H), знак закрывает меньше 8% поля.
 *   <имя>-plain.svg / .png  — без знака, клеток меньше: для мелкой печати,
 *                             где важна каждая клетка (от 2 см по стороне).
 *
 * SVG — в печать (вектор, любой размер), PNG 1200×1200 — в экран.
 * Белое поле вокруг кода — часть кода: обрезать его нельзя.
 *
 * Скрипт сам читает каждый готовый код, в полном размере и уменьшенным,
 * и падает, если прочитался не тот адрес: код, который не сканируется,
 * хуже, чем никакого.
 *
 * Запуск:
 *   npm i --no-save qrcode jsqr
 *   node brand/qr.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import sharp from 'sharp';

const SITE = 'https://corethree.ru';
const CODES = [
  { name: 'site', url: `${SITE}/?utm_source=qr` },
  { name: 'contact', url: `${SITE}/contact?utm_source=qr` },
  { name: 'concepts', url: `${SITE}/concepts?utm_source=qr` }
];

const INK = '#0a0c10';
const PAPER = '#ffffff';
/** Белое поле вокруг кода, в клетках: по стандарту не меньше четырёх. */
const QUIET = 4;
/** Сторона окна под знак, в клетках. Нечётная — как и сторона самого кода, иначе окно не встанет по центру. */
const WINDOW = 9;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const out = path.join(root, 'qr');
fs.mkdirSync(out, { recursive: true });

// знак — тот же, что на сайте: содержимое brand/mark.svg без внешнего тега
const mark = fs
  .readFileSync(path.join(root, 'mark.svg'), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<title>[\s\S]*?<\/title>/, '');

function svg(url, withMark) {
  const qr = QRCode.create(url, { errorCorrectionLevel: withMark ? 'H' : 'M' });
  const n = qr.modules.size;
  const side = n + QUIET * 2;
  const from = (n - WINDOW) / 2;
  const inWindow = (r, c) => withMark && r >= from && r < from + WINDOW && c >= from && c < from + WINDOW;

  // тёмные клетки — полосами по строкам: файл в разы меньше, чем по клетке на прямоугольник
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c) || inWindow(r, c)) continue;
      let len = 1;
      while (c + len < n && qr.modules.get(r, c + len) && !inWindow(r, c + len)) len++;
      d += `M${c + QUIET} ${r + QUIET}h${len}v1h-${len}z`;
      c += len - 1;
    }
  }

  // знак занимает окно без клетки с каждого края — между ним и кодом остаётся воздух
  const box = WINDOW - 2;
  const at = QUIET + from + 1;
  const logo = withMark ? `\n  <g transform="translate(${at} ${at}) scale(${box / 100})" fill="${INK}">${mark}</g>` : '';

  return {
    n,
    text: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" role="img" aria-label="QR-код: ${url}">
  <title>${url}</title>
  <rect width="${side}" height="${side}" fill="${PAPER}"/>
  <path d="${d}" fill="${INK}" shape-rendering="crispEdges"/>${logo}
</svg>
`
  };
}

async function read(png, size) {
  const { data, info } = await sharp(png).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

for (const { name, url } of CODES) {
  for (const withMark of [true, false]) {
    const file = withMark ? name : `${name}-plain`;
    const { n, text } = svg(url, withMark);
    fs.writeFileSync(path.join(out, `${file}.svg`), text);
    const png = await sharp(Buffer.from(text), { density: 2400 }).resize(1200, 1200).png().toBuffer();
    fs.writeFileSync(path.join(out, `${file}.png`), png);

    // читается ли: как есть и мелким — так код выглядит на визитке в кадре телефона
    for (const size of [1200, 300, 150]) {
      const got = await read(png, size);
      if (got !== url) throw new Error(`${file}: при ${size}px прочитано «${got}», а должно быть «${url}»`);
    }
    console.log(`${file}: ${n}×${n} клеток, читается при 1200, 300 и 150 px → ${url}`);
  }
}
