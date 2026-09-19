// Точная геометрия знака из растра brand/Логотип.jpg.
//
// Знак — три одинаковых элемента, повёрнутых на 120°. Каждый элемент —
// пять граней: синий торец, синяя грань колонны, серебристая Г-грань,
// серебристая внешняя балка и синяя внутренняя грань балки.
//
// 1. Центр симметрии ищется перебором: совпадение цветной маски
//    с собой, повёрнутой на 120°.
// 2. Все чистые экземпляры каждой грани поворачиваются в систему
//    верхнего элемента и усредняются — шум JPEG и слипшиеся области
//    перестают мешать.
// 3. Контур упрощается, рёбра притягиваются к направлениям, кратным 30°
//    (изометрия знака: 0, ±30, ±60, 90), вершины — пересечения прямых.
//
// Запуск после segment.js: node brand/trace/fit.js → brand/trace/geometry.json

const fs = require('fs');
const { W, H, lab, big } = JSON.parse(fs.readFileSync('brand/trace/labels.json', 'utf8'));

// Чистые экземпляры каждой грани и угол, на который они повёрнуты
// относительно верхнего элемента (по часовой на экране).
// Экземпляры в растре не идентичны (логотип нарисован генератором),
// поэтому эталон — верхний элемент; остальные два получаются поворотом.
const FACETS = {
  cap: { tone: 'blue', inst: [[1, 0]] },
  column: { tone: 'blue', inst: [[7, 0]] },
  ell: { tone: 'grey', inst: [[8, 0]] },
  beam: { tone: 'grey', inst: [[22, 0]] },
  inner: { tone: 'blue', inst: [[24, 0]] }
};

const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : lab[y * W + x]);
const ids = new Set(big.map((c) => c.id));
const colored = (x, y) => ids.has(at(Math.round(x), Math.round(y)));

// --- 1. центр симметрии --------------------------------------------------
function rot(x, y, cx, cy, deg) {
  const a = (deg * Math.PI) / 180;
  const dx = x - cx, dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
}
let best = { s: -1 };
for (let cx = 195; cx <= 215; cx += 0.5) {
  for (let cy = 225; cy <= 250; cy += 0.5) {
    let inter = 0, uni = 0;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const a = colored(x, y);
        const [rx, ry] = rot(x, y, cx, cy, 120);
        const b = colored(rx, ry);
        if (a && b) inter++;
        if (a || b) uni++;
      }
    }
    const s = inter / uni;
    if (s > best.s) best = { s, cx, cy };
  }
}
const C = [best.cx, best.cy];
console.log(`центр симметрии (${C[0]}, ${C[1]}), совпадение с поворотом ${(best.s * 100).toFixed(1)}%`);

// --- 2. усреднённая маска грани в системе верхнего элемента -------------
const SS = 4; // суперсэмплинг
const GW = W * SS, GH = H * SS;
function facetMask(inst) {
  const m = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = (gx + 0.5) / SS - 0.5, y = (gy + 0.5) / SS - 0.5;
      let votes = 0;
      for (const [id, deg] of inst) {
        const [sx, sy] = rot(x, y, C[0], C[1], deg);
        if (at(Math.round(sx), Math.round(sy)) === id) votes++;
      }
      m[gy * GW + gx] = votes * 2 >= inst.length ? 1 : 0;
    }
  }
  // оставляем крупнейшую связную область — отсекаем крошки
  const seen = new Int32Array(GW * GH).fill(-1);
  let bestId = -1, bestN = 0;
  let id = 0;
  for (let s = 0; s < GW * GH; s++) {
    if (!m[s] || seen[s] !== -1) continue;
    const q = [s];
    seen[s] = id;
    let n = 0;
    while (q.length) {
      const p = q.pop();
      n++;
      const x = p % GW, y = (p / GW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const np = ny * GW + nx;
        if (m[np] && seen[np] === -1) { seen[np] = id; q.push(np); }
      }
    }
    if (n > bestN) { bestN = n; bestId = id; }
    id++;
  }
  for (let s = 0; s < GW * GH; s++) m[s] = seen[s] === bestId ? 1 : 0;
  return smooth(fillHoles(m), 6);
}

// Крапинки фактуры внутри грани классифицируются как «светлое» и дырявят
// маску. Всё, что не достижимо от края кадра, считаем гранью.
function fillHoles(m) {
  const out = new Uint8Array(GW * GH).fill(1);
  const q = [];
  for (let x = 0; x < GW; x++) { q.push(x, (GH - 1) * GW + x); }
  for (let y = 0; y < GH; y++) { q.push(y * GW, y * GW + GW - 1); }
  for (const s of q) if (!m[s]) out[s] = 0;
  const stack = q.filter((s) => !m[s]);
  while (stack.length) {
    const p = stack.pop();
    const x = p % GW, y = (p / GW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const np = ny * GW + nx;
      if (!m[np] && out[np]) { out[np] = 0; stack.push(np); }
    }
  }
  return out;
}

// Сглаживание: размытие квадратом и порог 0.5 — срезает ступеньки JPEG,
// прямые рёбра остаются на месте, острые углы чуть скругляются
// (вершины потом всё равно строятся пересечением прямых).
function smooth(m, r) {
  const tmp = new Float32Array(GW * GH);
  const outv = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += x >= 0 && x < GW ? m[y * GW + x] : 0;
    for (let x = 0; x < GW; x++) {
      tmp[y * GW + x] = acc;
      const add = x + r + 1, sub = x - r;
      if (add < GW) acc += m[y * GW + add];
      if (sub >= 0) acc -= m[y * GW + sub];
    }
  }
  const k = (2 * r + 1) ** 2;
  for (let x = 0; x < GW; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += y >= 0 && y < GH ? tmp[y * GW + x] : 0;
    for (let y = 0; y < GH; y++) {
      outv[y * GW + x] = acc / k >= 0.5 ? 1 : 0;
      const add = y + r + 1, sub = y - r;
      if (add < GH) acc += tmp[add * GW + x];
      if (sub >= 0) acc -= tmp[sub * GW + x];
    }
  }
  return outv;
}

// --- 3. контур: обход границы по пикселям --------------------------------
function contour(m) {
  // стартовая точка — верхний левый пиксель области
  let start = -1;
  for (let s = 0; s < GW * GH; s++) if (m[s]) { start = s; break; }
  const inside = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && m[y * GW + x] === 1;
  // обход по Муру
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const sx = start % GW, sy = (start / GW) | 0;
  const pts = [[sx, sy]];
  let x = sx, y = sy, d = 6;
  for (let guard = 0; guard < 400000; guard++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nd = (d + 6 + k) % 8; // поворот налево и дальше по часовой
      const nx = x + dirs[nd][0], ny = y + dirs[nd][1];
      if (inside(nx, ny)) {
        x = nx; y = ny; d = nd; found = true;
        break;
      }
    }
    if (!found) break;
    if (x === sx && y === sy) break;
    pts.push([x, y]);
  }
  // назад в координаты кропа
  return pts.map(([px, py]) => [(px + 0.5) / SS - 0.5, (py + 0.5) / SS - 0.5]);
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  let idx = -1, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

// замкнутый контур: режем в двух самых дальних точках и упрощаем половины
function simplifyClosed(pts, eps) {
  let far = 0, fd = 0;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > fd) { fd = d; far = i; }
  }
  const a = rdp(pts.slice(0, far + 1), eps);
  const b = rdp([...pts.slice(far), pts[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)].map((p) => pts.findIndex((q) => q === p));
}

// --- 4. прямые с направлениями, кратными 30° -----------------------------
function fitPolygon(pts) {
  const keys = simplifyClosed(pts, 2.6);
  const n = keys.length;
  let lines = [];
  for (let i = 0; i < n; i++) {
    const i0 = keys[i], i1 = keys[(i + 1) % n];
    const span = i1 > i0 ? pts.slice(i0, i1 + 1) : [...pts.slice(i0), ...pts.slice(0, i1 + 1)];
    const a = pts[i0], b = pts[i1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 3.5) continue; // фаска от скругления угла — вершину даст пересечение соседей
    let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    const snapped = Math.round(ang / 30) * 30;
    const t = (snapped * Math.PI) / 180;
    const dir = [Math.cos(t), Math.sin(t)];
    const nrm = [-dir[1], dir[0]];
    // смещение прямой — по средней части ребра, без скруглённых концов
    const core = span.slice(Math.floor(span.length * 0.2), Math.ceil(span.length * 0.8) + 1);
    const off = core.reduce((s, p) => s + p[0] * nrm[0] + p[1] * nrm[1], 0) / core.length;
    lines.push({ ang: ((snapped % 180) + 180) % 180, dir, nrm, off, len });
  }
  // соседние прямые одного направления сливаем
  const merged = [];
  for (const l of lines) {
    const prev = merged[merged.length - 1];
    if (prev && prev.ang === l.ang && Math.abs(prev.off * (prev.nrm[0] * l.nrm[0] + prev.nrm[1] * l.nrm[1]) - l.off) < 1.5) {
      const w = prev.len + l.len;
      prev.off = (prev.off * prev.len + l.off * (prev.nrm[0] * l.nrm[0] + prev.nrm[1] * l.nrm[1]) * l.len) / w;
      prev.len = w;
    } else merged.push({ ...l });
  }
  if (merged.length > 2 && merged[0].ang === merged[merged.length - 1].ang) merged.shift();
  // вершины — пересечения соседних прямых
  const verts = [];
  for (let i = 0; i < merged.length; i++) {
    const p = merged[i], q = merged[(i + 1) % merged.length];
    const det = p.nrm[0] * q.nrm[1] - p.nrm[1] * q.nrm[0];
    if (Math.abs(det) < 1e-6) continue;
    const x = (p.off * q.nrm[1] - p.nrm[1] * q.off) / det;
    const y = (p.nrm[0] * q.off - p.off * q.nrm[0]) / det;
    verts.push([x, y]);
  }
  return { verts, angles: merged.map((l) => l.ang) };
}

module.exports = { FACETS, facetMask, contour, fitPolygon, rot, C, GW, GH, SS, W, H };

if (require.main === module) {
  const out = { center: C, facets: {} };
  for (const [name, f] of Object.entries(FACETS)) {
    const m = facetMask(f.inst);
    const pts = contour(m);
    const { verts, angles } = fitPolygon(pts);
    out.facets[name] = { tone: f.tone, verts };
    console.log(`${name.padEnd(7)} вершин ${verts.length}, направления ${angles.join(' ')}`);
  }
  fs.writeFileSync('brand/trace/geometry.json', JSON.stringify(out, null, 1));
}
