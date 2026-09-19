// Наложение подогнанных полигонов на исходник (×3), с номерами вершин.
const fs = require('fs');
const sharp = require('sharp');
const g = JSON.parse(fs.readFileSync(process.argv[3] || 'brand/trace/geometry.json', 'utf8'));
const K = 3;
const colors = { cap: '#ff3b3b', column: '#27c93f', ell: '#2f6bff', beam: '#ffb800', inner: '#e000e0' };
const polys = Object.entries(g.facets).map(([name, f]) => {
  const pts = f.verts.map(([x, y]) => `${(x * K).toFixed(1)},${(y * K).toFixed(1)}`).join(' ');
  const labels = f.verts.map(([x, y], i) => `<text x="${x * K + 4}" y="${y * K - 4}" font-size="15" font-family="monospace" fill="${colors[name]}" stroke="#000" stroke-width="3" paint-order="stroke">${i}</text>`).join('');
  return `<polygon points="${pts}" fill="none" stroke="${colors[name]}" stroke-width="2.5"/>${labels}`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${410 * K}" height="${390 * K}">${polys}<circle cx="${g.center[0] * K}" cy="${g.center[1] * K}" r="5" fill="#fff"/></svg>`;
sharp('brand/Логотип.jpg').extract({ left: 500, top: 120, width: 410, height: 390 }).resize(410 * K).composite([{ input: Buffer.from(svg) }]).png().toFile(process.argv[2]).then(() => console.log('ok'));
