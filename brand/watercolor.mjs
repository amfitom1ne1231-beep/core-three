/**
 * Акварель ученика из живого кадра лендинга — запекается в картинки.
 *
 * Фотографий у нас нет, но курс учит рисовать, и его витрина — сами работы.
 * Акварель собрана из SVG-фильтров: турбулентность рвёт край заливки так,
 * как краска растекается по мокрой бумаге, второй шум даёт зерно листа.
 * Раньше фильтры считались на странице. Safari пересчитывает их на каждом
 * кадре перехода между темами — на странице «Сайты» волна шла на 37 кадрах
 * в секунду вместо 55–57, как на остальных (замер — BRIEF.md, раздел 52).
 *
 * Сама акварель живёт здесь; странице достаются две картинки и маска-кисть,
 * которой работа проступает (components/live/LiveLanding.tsx):
 *   public/live/watercolor.webp        — готовая работа на листе
 *   public/live/watercolor-paper.webp  — чистый лист с тем же зерном
 *
 * Запуск (нужен установленный Google Chrome, сервер не нужен):
 *   npm i --no-save playwright-core
 *   node brand/watercolor.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public/live');
fs.mkdirSync(out, { recursive: true });

/** Лист 200×150 в координатах рисунка; на странице он не шире 320 px, плотность экрана до 3. */
const W = 200;
const H = 150;
const SCALE = 4;

const DEFS = `
  <filter id="lw-bleed" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.6"/>
  </filter>
  <filter id="lw-edge" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="9" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="lw-paper">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2"/>
    <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.35  0 0 0 0.09 0"/>
  </filter>
  <linearGradient id="lw-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8fb4d9"/>
    <stop offset="0.55" stop-color="#e9c9a6"/>
    <stop offset="1" stop-color="#f1d9bb"/>
  </linearGradient>`;

const PAINT = `
  <g filter="url(#lw-bleed)" opacity="0.92">
    <rect x="4" y="4" width="192" height="92" fill="url(#lw-sky)"/>
    <circle cx="138" cy="58" r="15" fill="#f2a65a" opacity="0.85"/>
    <path d="M-5 92 C30 70 52 64 80 78 C104 90 118 66 148 70 C170 73 186 84 205 80 V150 H-5Z" fill="#6b8f8a" opacity="0.8"/>
    <path d="M-5 104 C26 92 60 96 92 104 C130 114 160 98 205 102 V150 H-5Z" fill="#3f6470" opacity="0.85"/>
    <path d="M-5 120 C40 112 90 118 130 122 C160 125 182 118 205 120 V150 H-5Z" fill="#2c4a5a" opacity="0.8"/>
    <!-- отражение солнца в воде -->
    <ellipse cx="138" cy="128" rx="18" ry="2.2" fill="#f2c28c" opacity="0.7"/>
    <ellipse cx="136" cy="134" rx="11" ry="1.6" fill="#f2c28c" opacity="0.55"/>
  </g>
  <!-- тонкие штрихи поверх заливки — рука ученика -->
  <g filter="url(#lw-edge)" fill="none" stroke="#243a46" stroke-width="0.9" stroke-linecap="round" opacity="0.55">
    <path d="M60 86 l3 -10 l3 10 M66 84 l2.5 -8 l2.5 8"/>
    <path d="M22 72 q8 -4 14 0 M28 66 q6 -3 11 0"/>
  </g>`;

const sheet = (painted) => `<body style="margin:0;background:#f6efe3">
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block">
    <defs>${DEFS}</defs>
    <rect width="${W}" height="${H}" fill="#f6efe3"/>
    ${painted ? PAINT : ''}
    <rect width="${W}" height="${H}" filter="url(#lw-paper)"/>
  </svg></body>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
for (const [name, painted] of [['watercolor', true], ['watercolor-paper', false]]) {
  await page.setContent(sheet(painted));
  const file = path.join(out, `${name}.webp`);
  await sharp(await page.screenshot({ type: 'png' })).webp({ quality: 80, effort: 6 }).toFile(file);
  console.log(`${name}: ${(fs.statSync(file).size / 1024).toFixed(0)} КБ`);
}
await browser.close();
