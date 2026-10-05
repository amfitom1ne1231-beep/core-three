/**
 * Свечение ядер знака на первом экране — запекается в картинки.
 *
 * Свечение — размытый силуэт луча, который «дышит» прозрачностью. Раньше
 * он размывался на странице: `filter: blur(28px)` на каждом из трёх лучей.
 * В обычной работе браузер держит такой слой готовым, но под наплывом
 * смены темы Safari пересчитывал все три размытия на каждом кадре — наплыв
 * на главной шёл кадрами по 50 мс вместо 17 (замер — BRIEF.md, раздел 51).
 * Готовая картинка размытия не требует вовсе.
 *
 * Геометрию лучей скрипт берёт с живой страницы — из тех же граней, что
 * рисует знак, — поэтому отдельной копии контуров у него нет.
 *
 * Запуск при работающем сервере (нужен установленный Google Chrome):
 *   npm i --no-save playwright-core
 *   node brand/halos.mjs [http://localhost:3000]
 *
 * Результат — public/mark/halo-<луч>.webp и halo-<луч>-s.webp. Радиус
 * размытия задан в пикселях экрана, а знак бывает разного размера, поэтому
 * вариантов два: для знака на ноутбуке (605 px) и на телефоне (330 px).
 * Поле вокруг знака у обоих — 30% его стороны: туда уходит хвост размытия,
 * и на странице картинка стоит с таким же выносом (components/HeroMark.tsx).
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const base = process.argv[2] ?? 'http://localhost:3000';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public/mark');
fs.mkdirSync(out, { recursive: true });

const BLUR = 28;
const COLOR = '#6e9bcc';
/** Поле вокруг знака в долях его стороны. Менять вместе с выносом в HeroMark. */
const PAD = 0.3;
/** [суффикс файла, сторона знака на экране, сторона готовой картинки] */
const SIZES = [
  ['', 605, 256],
  ['-s', 330, 224]
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 });
await page.goto(base, { waitUntil: 'load' });
await page.waitForSelector('[data-hero-mark] svg defs', { state: 'attached' });

// грани каждого луча — из чёткого слоя знака: у него они те же, что были у свечения
const arms = await page.evaluate(() =>
  [...document.querySelectorAll('[data-hero-mark] svg')]
    .filter((svg) => svg.querySelector(':scope > defs') && svg.querySelector(':scope > g'))
    .map((svg) => [...svg.querySelectorAll(':scope > path')].map((p) => p.getAttribute('d')))
);
if (arms.length !== 3) throw new Error(`ожидалось три луча, найдено ${arms.length}`);

for (const [suffix, side, outSide] of SIZES) {
  const pad = Math.round(side * PAD);
  const box = side + pad * 2;
  await page.setViewportSize({ width: box, height: box });
  for (const [i, facets] of arms.entries()) {
    await page.setContent(`<body style="margin:0;background:transparent">
      <div style="position:absolute;left:${pad}px;top:${pad}px;width:${side}px;height:${side}px;filter:blur(${BLUR}px)">
        <svg viewBox="0 0 100 100" style="width:100%;height:100%;overflow:visible">
          ${facets.map((d) => `<path d="${d}" fill="${COLOR}"/>`).join('')}
        </svg>
      </div></body>`);
    const png = await page.screenshot({ type: 'png', omitBackground: true });
    // хвост размытия не должен упираться в край картинки: иначе на странице будет виден срез
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let edge = 0;
    for (let x = 0; x < info.width; x++) edge = Math.max(edge, data[x * 4 + 3], data[((info.height - 1) * info.width + x) * 4 + 3]);
    for (let y = 0; y < info.height; y++) edge = Math.max(edge, data[y * info.width * 4 + 3], data[(y * info.width + info.width - 1) * 4 + 3]);
    const file = path.join(out, `halo-${i + 1}${suffix}.webp`);
    await sharp(png).resize({ width: outSide }).webp({ quality: 78, alphaQuality: 90, effort: 6 }).toFile(file);
    console.log(`halo-${i + 1}${suffix}: ${(fs.statSync(file).size / 1024).toFixed(1)} КБ, непрозрачность на краю ${edge} из 255`);
  }
}

await browser.close();
