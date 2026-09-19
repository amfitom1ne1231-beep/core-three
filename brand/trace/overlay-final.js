// Проверка: все 15 граней собранного знака поверх логотипа (контуром).
const fs = require('fs');
const sharp = require('sharp');
const { k, ox, oy, facets } = JSON.parse(fs.readFileSync('brand/trace/final.json', 'utf8'));
const K = 3;
const col = { blue: '#ff2d55', grey: '#00e0ff' };
// пути в системе 0..100 → координаты кропа: (x - ox) / k, затем ×3
const g = `<g transform="scale(${K}) translate(${-ox / k} ${-oy / k}) scale(${1 / k})">${facets
  .map((f) => `<path d="${f.d}" fill="${process.argv[3] === 'fill' ? col[f.tone] : 'none'}" fill-opacity="0.55" stroke="${col[f.tone]}" stroke-width="${0.35}" />`)
  .join('')}</g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${410 * K}" height="${390 * K}">${g}</svg>`;
sharp('brand/Логотип.jpg').extract({ left: 500, top: 120, width: 410, height: 390 }).resize(410 * K)
  .composite([{ input: Buffer.from(svg) }]).png().toFile(process.argv[2]).then(() => console.log('ok'));
