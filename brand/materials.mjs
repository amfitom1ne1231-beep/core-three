/**
 * Фактуры направлений — запекаются в картинки.
 *
 * Материал — фрактальный шум, освещённый косым светом: тот же принцип,
 * что у шейдера первого экрана, но средствами SVG-фильтра. Раньше фильтр
 * считался прямо на странице, по фактическому размеру рамки. Chrome делает
 * это на видеокарте и не замечает, а Safari считает шум и свет на
 * процессоре: по 90–100 мс на каждый вход рамки в экран — страница услуг
 * при прокрутке трижды замирала (замер — BRIEF.md, раздел 51). Картинка
 * стоит браузеру ничего, а выглядит так же.
 *
 * Пресеты живут здесь: кроме этого скрипта, параметры шума никому не нужны.
 * Странице достаточно имени пресета (components/Material.tsx).
 *
 * Запуск (нужен установленный Google Chrome, сервер не нужен):
 *   npm i --no-save playwright-core
 *   node brand/materials.mjs
 *
 * Результат — public/materials/<пресет>.webp. Снимается рамка 800×460
 * при плотности 2 — как блок «Состав работы» на ноутбуке, чтобы рельеф
 * вышел той же силы, что был на странице: свет считается по соседним
 * пикселям, и от размера растра зависит, насколько выпуклой выйдет складка.
 * Запас под сдвиг и приглушение цвета запечены сюда же.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

/** По одному материалу на направление: разная фактура при общей природе. */
const MATERIALS = {
  silk: { seed: 7, freq: [0.009, 0.019], octaves: 5, surface: 3.4, azimuth: 235, elevation: 46, diffuse: '#6f8aa8', specular: '#cfe0f2', exponent: 26, scale: 1.12 },
  folded: { seed: 23, freq: [0.014, 0.008], octaves: 4, surface: 4.6, azimuth: 205, elevation: 38, diffuse: '#5f7b98', specular: '#c3d6ea', exponent: 18, scale: 1.16 },
  grain: { seed: 41, freq: [0.032, 0.032], octaves: 5, surface: 1.9, azimuth: 255, elevation: 52, diffuse: '#77879b', specular: '#dbe6f2', exponent: 36, scale: 1.08 },
  stream: { seed: 58, freq: [0.006, 0.034], octaves: 5, surface: 3.8, azimuth: 185, elevation: 42, diffuse: '#6b87ab', specular: '#cddff3', exponent: 20, scale: 1.14 },
  crystal: { seed: 71, freq: [0.022, 0.012], octaves: 3, surface: 5.4, azimuth: 275, elevation: 58, diffuse: '#7a90ad', specular: '#e3edf8', exponent: 44, scale: 1.1 },
  deep: { seed: 89, freq: [0.008, 0.011], octaves: 5, surface: 2.8, azimuth: 220, elevation: 34, diffuse: '#556f8c', specular: '#b8cde3', exponent: 14, scale: 1.2 }
};

const W = 800;
const H = 460;
/** Ширина готовой картинки: рамка шире 640 px на плотном экране бывает, шире 1280 — нет. */
const OUT_W = 1280;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public/materials');
fs.mkdirSync(out, { recursive: true });

const svg = (m) => `
<svg viewBox="0 0 480 300" preserveAspectRatio="none"
     style="position:absolute;left:50%;top:50%;width:100%;height:100%;transform:translate(-50%,-50%) scale(${m.scale});filter:saturate(0.85)">
  <defs>
    <filter id="mat" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="${m.freq[0]} ${m.freq[1]}" numOctaves="${m.octaves}" seed="${m.seed}" result="noise"/>
      <!-- рассеянный свет даёт тело материала -->
      <feDiffuseLighting in="noise" lighting-color="${m.diffuse}" surfaceScale="${m.surface}" diffuseConstant="0.95" result="body">
        <feDistantLight azimuth="${m.azimuth}" elevation="${m.elevation}"/>
      </feDiffuseLighting>
      <!-- блик на гребнях — то, из-за чего поверхность читается шёлком -->
      <feSpecularLighting in="noise" lighting-color="${m.specular}" surfaceScale="${m.surface}" specularConstant="0.6" specularExponent="${m.exponent}" result="glint">
        <feDistantLight azimuth="${m.azimuth - 25}" elevation="${m.elevation + 14}"/>
      </feSpecularLighting>
      <feComposite in="glint" in2="noise" operator="in" result="glintClipped"/>
      <feMerge><feMergeNode in="body"/><feMergeNode in="glintClipped"/></feMerge>
      <!-- гашение в тёмное: материал должен жить на чёрном, а не светиться -->
      <feComponentTransfer>
        <feFuncR type="linear" slope="0.78" intercept="-0.03"/>
        <feFuncG type="linear" slope="0.80" intercept="-0.03"/>
        <feFuncB type="linear" slope="0.88" intercept="-0.02"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="480" height="300" filter="url(#mat)"/>
</svg>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

for (const [name, m] of Object.entries(MATERIALS)) {
  await page.setContent(
    `<body style="margin:0;background:#000"><div style="position:relative;width:${W}px;height:${H}px;overflow:hidden">${svg(m)}</div></body>`
  );
  const png = await page.screenshot({ type: 'png' });
  const file = path.join(out, `${name}.webp`);
  await sharp(png).resize({ width: OUT_W }).webp({ quality: 72, effort: 6 }).toFile(file);
  console.log(`${name}: ${(fs.statSync(file).size / 1024).toFixed(0)} КБ`);
}

await browser.close();
