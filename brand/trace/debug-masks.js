// Отладка: усреднённые маски граней верхнего элемента поверх исходника.
const fs = require('fs');
const sharp = require('sharp');
const { FACETS, facetMask, GW, GH } = require('./fit.js');
const colors = { cap: [255, 80, 80], column: [80, 200, 80], ell: [80, 120, 255], beam: [255, 200, 0], inner: [220, 0, 220] };
(async () => {
  const base = await sharp('brand/Логотип.jpg').extract({ left: 500, top: 120, width: 410, height: 390 })
    .resize(GW, GH).greyscale().raw().toBuffer();
  const buf = Buffer.alloc(GW * GH * 3);
  for (let i = 0; i < GW * GH; i++) { const v = 60 + base[i] * 0.5; buf[i*3] = buf[i*3+1] = buf[i*3+2] = v; }
  for (const [name, f] of Object.entries(FACETS)) {
    const m = facetMask(f.inst);
    const c = colors[name];
    for (let i = 0; i < GW * GH; i++) if (m[i]) { buf[i*3] = c[0]; buf[i*3+1] = c[1]; buf[i*3+2] = c[2]; }
  }
  await sharp(buf, { raw: { width: GW, height: GH, channels: 3 } }).resize(1230).png().toFile(process.argv[2]);
  console.log('ok');
})();
