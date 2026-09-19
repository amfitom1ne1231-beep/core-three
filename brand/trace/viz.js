const sharp = require('sharp');
const { W, H, lab, big } = JSON.parse(require('fs').readFileSync('brand/trace/labels.json', 'utf8'));
const out = process.argv[2];
const pal = [[230,25,75],[60,180,75],[255,225,25],[0,130,200],[245,130,48],[145,30,180],[70,240,240],[240,50,230],[210,245,60],[250,190,212],[0,128,128],[220,190,255],[170,110,40],[128,0,0],[170,255,195],[128,128,0]];
const color = new Map(big.map((c, i) => [c.id, pal[i % pal.length]]));
const buf = Buffer.alloc(W * H * 3, 255);
for (let i = 0; i < W * H; i++) {
  const c = color.get(lab[i]);
  if (c) { buf[i*3] = c[0]; buf[i*3+1] = c[1]; buf[i*3+2] = c[2]; }
  else if (lab[i] !== -1) { buf[i*3] = 200; buf[i*3+1] = 200; buf[i*3+2] = 200; }
}
// подписи — номер области в центре тяжести
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W*3}" height="${H*3}">${big.map((c) => `<text x="${c.cx*3}" y="${c.cy*3}" font-size="26" font-family="monospace" fill="#000" stroke="#fff" stroke-width="4" paint-order="stroke" text-anchor="middle">${c.id}</text>`).join('')}</svg>`;
sharp(buf, { raw: { width: W, height: H, channels: 3 } }).resize(W * 3, H * 3, { kernel: 'nearest' }).composite([{ input: Buffer.from(svg) }]).png().toFile(out).then(() => console.log('ok'));
