// Сборка знака CoreThree по логотипу brand/Логотип.jpg.
//
// Порядок: node brand/trace/segment.js && node brand/trace/build.js
//
// Знак — три одинаковых элемента, повёрнутых на 120° вокруг центра
// симметрии. Эталон — верхний элемент, пять граней:
//   cap    — синий торец колонны (ромб наверху)
//   column — синяя левая грань колонны, от торца до центра
//   ell    — серебристая Г-грань: правая грань колонны, ступенька и скат
//            вдоль балки; внутренний угол у логотипа скруглён — это
//            сохранено кривой, а не выпрямлено
//   beam   — серебристая внешняя грань балки (сторона треугольника)
//   inner  — синяя внутренняя грань той же балки
//
// Каждое ребро задано направлением (кратным 30°: 0, ±30, ±60, 90) и
// грубой точкой; точное положение ребра уточняется по пикселям границы
// самой грани в растре. Вершины — пересечения соседних рёбер, поэтому
// углы точные, а светлые фаски между гранями выходят той же ширины,
// что в логотипе.

const fs = require('fs');
const { facetMask, contour, rot, C } = require('./fit.js');

const K = 3; // грубые точки сняты с кропа, увеличенного втрое
const p3 = ([x, y]) => [x / K, y / K];

// Грани: рёбра по часовой, каждое — направление в градусах и две
// грубые точки на нём (координаты кропа ×3). curve — скруглённый угол
// между двумя рёбрами (квадратичная кривая с опорой в их пересечении).
const SPEC = {
  cap: {
    id: 1,
    tone: 'blue',
    edges: [
      [-30, [460, 130], [612, 45]],
      [30, [612, 45], [775, 128]],
      [-30, [775, 128], [612, 222]],
      [30, [612, 222], [460, 130]]
    ]
  },
  column: {
    id: 7,
    tone: 'blue',
    edges: [
      [30, [448, 160], [600, 245]],
      [90, [600, 260], [600, 690]],
      [-30, [600, 697], [478, 764]],
      [90, [448, 740], [448, 170]]
    ]
  },
  ell: {
    id: 8,
    tone: 'grey',
    edges: [
      [-30, [625, 250], [775, 165]],
      [90, [775, 170], [775, 265]],
      [-30, [775, 270], [715, 305]],
      [90, [715, 310], [715, 368]],
      [60, [740, 415], [890, 690]],
      [30, [890, 690], [700, 583]],
      [90, [625, 450], [625, 255]]
    ],
    // скругление между скатом-основанием (ребро 5) и левой гранью (ребро 6)
    curve: { after: 5, from: [698, 582], to: [627, 452] }
  },
  beam: {
    id: 22,
    tone: 'grey',
    edges: [
      [-30, [755, 315], [815, 280]],
      [60, [815, 280], [1098, 765]],
      [30, [1098, 765], [925, 690]],
      [60, [925, 690], [755, 315]]
    ]
  },
  inner: {
    id: 24,
    tone: 'blue',
    edges: [
      [60, [736, 302], [965, 688]],
      [30, [965, 688], [903, 652]],
      [60, [903, 652], [741, 372]],
      [90, [741, 372], [736, 302]]
    ]
  }
};

// Логотип — изометрия объёмного предмета, а не узор с поворотной
// симметрией: торцы, колонны и боковые балки совпадают с поворотом
// верхнего элемента, а нижняя балка показана иначе — сверху серебро,
// спереди синий. Поэтому каждая грань меряется по своей области в
// растре: для повторяющихся стартовая разметка — повёрнутая эталонная,
// нижние две размечены отдельно.
const BOTTOM_TOP = {
  id: 181,
  tone: 'grey',
  edges: [
    [-30, [445, 968], [676, 836]],
    [0, [682, 836], [760, 833]],
    [30, [770, 832], [1020, 937]],
    [90, [1015, 950], [1012, 1120]],
    [30, [1009, 1132], [915, 1082]],
    [90, [911, 1075], [911, 1012]],
    [30, [908, 1004], [828, 952]],
    [0, [820, 951], [490, 951]]
  ]
};
const BOTTOM_FRONT = {
  id: 409,
  tone: 'blue',
  edges: [
    [0, [530, 976], [812, 976]],
    [30, [822, 978], [880, 1011]],
    [90, [881, 1016], [881, 1076]],
    [0, [875, 1080], [375, 1080]],
    [-30, [368, 1079], [522, 979]]
  ]
};

const rot3 = ([x, y], deg) => rot(x / K, y / K, C[0], C[1], deg).map((v) => v * K);
const turned = (spec, deg, id) => ({
  ...spec,
  id,
  edges: spec.edges.map(([a, p, q]) => [a + deg, rot3(p, deg), rot3(q, deg)]),
  curve: spec.curve && { ...spec.curve, from: rot3(spec.curve.from, deg), to: rot3(spec.curve.to, deg) }
});

const fix = (spec, edges) => ({ ...spec, edges: spec.edges.map((e, i) => edges[i] ?? e) });

const ELEMENTS = [
  ['honesty', 'Честность', SPEC],
  [
    'speed',
    'Скорость',
    { cap: turned(SPEC.cap, 120, 300), column: turned(SPEC.column, 120, 39), top: BOTTOM_TOP, front: BOTTOM_FRONT }
  ],
  [
    'craft',
    'Профессионализм',
    {
      // торец слева внизу в растре частично распознан как серебро —
      // берём повёрнутый эталон без уточнения
      cap: { ...turned(SPEC.cap, 240, 342), lock: true },
      column: turned(SPEC.column, 240, 191),
      ell: turned(SPEC.ell, 240, 48),
      // Острая верхушка левой балки — на x≈421; правее идёт светлая
      // полоса фаски, за её край уточнение цеплялось бы — ребро закреплено.
      beam: fix(turned(SPEC.beam, 240, 20), { 2: [90, [422, 500], [422, 270], 'lock'] }),
      inner: turned(SPEC.inner, 240, 30)
    }
  ]
];

const rad = (d) => (d * Math.PI) / 180;

// Уточнение ребра: точки границы грани в полосе ±3 px от грубой прямой,
// внутри средних 70% отрезка; смещение прямой — среднее по нормали.
// Два прохода: широкое окно ловит ребро, даже если грубая точка
// промахнулась на несколько пикселей, узкое — уточняет без соседей.
function refine(boundary, deg, a, b) {
  const wide = refineOnce(boundary, deg, a, b, 6);
  const shifted = (p) => [p[0] + (wide.shift * wide.nrm[0]) * K, p[1] + (wide.shift * wide.nrm[1]) * K];
  const fine = refineOnce(boundary, deg, shifted(a), shifted(b), 2);
  return { ...fine, shift: wide.shift + fine.shift };
}

function refineOnce(boundary, deg, a, b, band) {
  const dir = [Math.cos(rad(deg)), Math.sin(rad(deg))];
  const nrm = [-dir[1], dir[0]];
  const A = p3(a), B = p3(b);
  const off0 = A[0] * nrm[0] + A[1] * nrm[1];
  const t0 = Math.min(A[0] * dir[0] + A[1] * dir[1], B[0] * dir[0] + B[1] * dir[1]);
  const t1 = Math.max(A[0] * dir[0] + A[1] * dir[1], B[0] * dir[0] + B[1] * dir[1]);
  const pad = (t1 - t0) * 0.15;
  const hits = boundary.filter((p) => {
    const t = p[0] * dir[0] + p[1] * dir[1];
    const o = p[0] * nrm[0] + p[1] * nrm[1];
    return t > t0 + pad && t < t1 - pad && Math.abs(o - off0) < band;
  });
  const off = hits.length >= 4 ? hits.reduce((s, p) => s + p[0] * nrm[0] + p[1] * nrm[1], 0) / hits.length : off0;
  return { dir, nrm, off, hits: hits.length, shift: off - off0 };
}

function meet(p, q) {
  const det = p.nrm[0] * q.nrm[1] - p.nrm[1] * q.nrm[0];
  return [(p.off * q.nrm[1] - p.nrm[1] * q.off) / det, (p.nrm[0] * q.off - p.off * q.nrm[0]) / det];
}

// точка на прямой, ближайшая к заданной
function onLine(l, pt) {
  const P = p3(pt);
  const d = P[0] * l.nrm[0] + P[1] * l.nrm[1] - l.off;
  return [P[0] - d * l.nrm[0], P[1] - d * l.nrm[1]];
}

const all = [];
for (const [arm, core, specs] of ELEMENTS) {
  // порядок отрисовки: сначала дальние грани, торец — последним
  const names = ['beam', 'inner', 'front', 'top', 'ell', 'column', 'cap'].filter((n) => specs[n]);
  for (const name of names) {
    const f = specs[name];
    const boundary = contour(facetMask([[f.id, 0]]));
    const lines = f.edges.map(([deg, a, b, lock]) =>
      f.lock || lock ? refineOnce([], deg, a, b, 0) : refine(boundary, deg, a, b)
    );
    const report = lines.map((l) => `${l.hits}/${l.shift >= 0 ? '+' : ''}${l.shift.toFixed(2)}`).join(' ');
    console.log(`${arm.padEnd(8)}${name.padEnd(7)} #${String(f.id).padEnd(4)} точек/сдвиг: ${report}`);

    // вершины; для скругления — две точки касания и опора в углу
    const segs = [];
    for (let i = 0; i < lines.length; i++) {
      const cur = lines[i], next = lines[(i + 1) % lines.length];
      if (f.curve && f.curve.after === i) {
        const corner = meet(cur, next);
        segs.push({ type: 'L', p: onLine(cur, f.curve.from) });
        segs.push({ type: 'Q', c: corner, p: onLine(next, f.curve.to) });
      } else {
        segs.push({ type: 'L', p: meet(cur, next) });
      }
    }
    all.push({ arm, core, name, tone: f.tone, segs });
  }
}
const pts = all.flatMap((f) => f.segs.flatMap((s) => [s.p]));
const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
const k = 96 / Math.max(w, h);
const ox = (100 - w * k) / 2 - Math.min(...xs) * k;
const oy = (100 - h * k) / 2 - Math.min(...ys) * k;
const fit = ([x, y]) => [x * k + ox, y * k + oy];
const f2 = (v) => v.toFixed(2);
const d = (segs) => {
  const [first, ...rest] = segs;
  const s0 = fit(first.p);
  return (
    `M${f2(s0[0])} ${f2(s0[1])}` +
    rest.map((s) => {
      const p = fit(s.p);
      if (s.type === 'Q') {
        const c = fit(s.c);
        return ` Q${f2(c[0])} ${f2(c[1])} ${f2(p[0])} ${f2(p[1])}`;
      }
      return ` L${f2(p[0])} ${f2(p[1])}`;
    }).join('') +
    // замыкание: если первая точка — конец кривой, её нужно довести
    ' Z'
  );
};
// первый сегмент — точка старта; кривая не может стоять первой
for (const f of all) if (f.segs[0].type === 'Q') f.segs.push(f.segs.shift());

const center = fit(C);
// Прозрачности для одноцветного знака (currentColor): светлые на тёмном —
// серебро, тёмные — синий, как светотень исходника.
const OPACITY = { cap: 0.82, column: 1, ell: 0.5, top: 0.5, beam: 0.68, inner: 0.36, front: 0.36 };

const out = all.map((f) => ({ ...f, d: d(f.segs), opacity: OPACITY[f.name] }));
fs.writeFileSync('brand/trace/final.json', JSON.stringify({ center, k, ox, oy, facets: out }, null, 1));

// --- артефакты ------------------------------------------------------------
const byArm = {};
for (const f of out) (byArm[f.arm] ??= { core: f.core, facets: [] }).facets.push(f);

const ts = [
  '// Сгенерировано brand/trace/build.js по логотипу brand/Логотип.jpg — правки вносить там.',
  '',
  "export type MarkTone = 'blue' | 'grey';",
  'export type MarkFacet = { facet: string; tone: MarkTone; opacity: number; d: string };',
  'export type MarkArm = { arm: string; core: string; facets: MarkFacet[] };',
  '',
  'export const MARK_ARMS: MarkArm[] = [',
  ...Object.entries(byArm).flatMap(([arm, a]) => [
    '  {',
    `    arm: '${arm}',`,
    `    core: '${a.core}',`,
    '    facets: [',
    ...a.facets.map((f) => `      { facet: '${f.name}', tone: '${f.tone}', opacity: ${f.opacity}, d: '${f.d}' },`),
    '    ]',
    '  },'
  ]),
  '];',
  '',
  '/** Центр трёхкратной симметрии в системе viewBox — вокруг него вращаются лучи. */',
  `export const MARK_CENTER = { x: ${f2(center[0])}, y: ${f2(center[1])} };`,
  ''
].join('\n');
fs.writeFileSync('components/mark-geometry.ts', ts);

const svg = (flat) =>
  [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="currentColor" role="img" aria-label="CoreThree">',
    '  <title>CoreThree</title>',
    ...Object.entries(byArm).flatMap(([arm, a]) => [
      `  <g data-arm="${arm}" data-core="${a.core}">`,
      ...a.facets.map((f) => `    <path data-facet="${f.name}"${flat ? '' : ` fill-opacity="${f.opacity}"`} d="${f.d}"/>`),
      '  </g>'
    ]),
    '</svg>',
    ''
  ].join('\n');
fs.writeFileSync('brand/mark.svg', svg(false));
fs.writeFileSync('brand/mark-solid.svg', svg(true));

// фирменные цвета знака — как в логотипе: синий и серебро
const COLORS = { blue: '#1f4f95', grey: '#9aa1a9' };
fs.writeFileSync(
  'brand/mark-color.svg',
  [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="CoreThree">',
    '  <title>CoreThree</title>',
    ...out.map((f) => `  <path fill="${COLORS[f.tone]}" d="${f.d}"/>`),
    '</svg>',
    ''
  ].join('\n')
);
// favicon: знак в цветах логотипа на тёмной плашке сайта, чуть светлее —
// на тёмном фирменный синий проваливается
const ICON = { blue: '#3a6db8', grey: '#b9bfc7' };
fs.writeFileSync(
  'app/icon.svg',
  [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '  <rect width="100" height="100" rx="18" fill="#0b0f14"/>',
    '  <g transform="translate(50 50) scale(0.84) translate(-50 -50)">',
    ...out.map((f) => `    <path fill="${ICON[f.tone]}" d="${f.d}"/>`),
    '  </g>',
    '</svg>',
    ''
  ].join('\n')
);
console.log(`центр ${f2(center[0])} ${f2(center[1])}; собрано: components/mark-geometry.ts, brand/mark*.svg, app/icon.svg`);
