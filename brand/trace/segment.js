// Сегментация логотипа: синий / серебро / светлое (фон и фаски-зазоры).
// Запуск: node brand/trace/segment.js
const sharp = require('sharp');

const CROP = { left: 500, top: 120, width: 410, height: 390 };

(async () => {
  const { data, info } = await sharp('brand/Логотип.jpg').extract(CROP).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const cls = new Uint8Array(W * H); // 0 светлое, 1 синий, 2 серебро
  for (let i = 0; i < W * H; i++) {
    const r = data[i * C], g = data[i * C + 1], b = data[i * C + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (b - r > 28 && b > 55) cls[i] = 1;
    else if (lum < 178) cls[i] = 2;
    else cls[i] = 0;
  }
  // связные области
  const lab = new Int32Array(W * H).fill(-1);
  const comps = [];
  for (let s = 0; s < W * H; s++) {
    if (cls[s] === 0 || lab[s] !== -1) continue;
    const k = cls[s], id = comps.length, q = [s];
    lab[s] = id;
    let n = 0, sx = 0, sy = 0, minx = W, miny = H, maxx = 0, maxy = 0;
    while (q.length) {
      const p = q.pop(), x = p % W, y = (p / W) | 0;
      n++; sx += x; sy += y;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const np = ny * W + nx;
        if (cls[np] === k && lab[np] === -1) { lab[np] = id; q.push(np); }
      }
    }
    comps.push({ id, k, n, cx: sx / n, cy: sy / n, box: [minx, miny, maxx, maxy] });
  }
  const big = comps.filter((c) => c.n > 150).sort((a, b) => b.n - a.n);
  console.log(`${W}x${H}, областей всего ${comps.length}, крупных ${big.length}`);
  for (const c of big) console.log(`#${c.id} ${c.k === 1 ? 'синий ' : 'серебро'} n=${c.n} c=(${c.cx.toFixed(1)},${c.cy.toFixed(1)}) box=${c.box.join(',')}`);
  require('fs').writeFileSync('brand/trace/labels.json', JSON.stringify({ W, H, CROP, lab: Array.from(lab), big }));
})();
