/**
 * Живой знак: три луча настоящей моделью, которую крутят пальцем.
 *
 * Библиотеки нет намеренно. Предмет один, граней у него полторы тысячи,
 * а всё освещение снято заранее: шар под лампами из Blender
 * (`brand/mark-live.mjs`, «мат-кап»). Грань берёт цвет той точки шара,
 * куда смотрит её отражение, — блики ламп настоящие, а считать их
 * телефону не нужно. Вся отрисовка — одна программа и один вызов.
 *
 * Геометрия, оси и камера — те же, что в `brand/blender/mark3d.py`:
 * единицы логотипа, Z вверх, изометрия вдоль (1,1,1). Поэтому живой знак
 * в покое стоит ровно так же, как снятый.
 */

type Vec3 = [number, number, number];
type Mat4 = Float32Array;

/** Сечение бруса и ход разлёта — из mark3d.py. */
const S = 14.6;
const OUT = 10;
const SPIN = (18 * Math.PI) / 180;
/** Оси лучей: «Честность» вверх, «Скорость» по X, «Профессионализм» по Y. */
const AXES: Vec3[] = [
  [0, 0, 1],
  [1, 0, 0],
  [0, 1, 0]
];
/** Опора проворота каждого луча — середина его бруса у общего угла. */
const PIVOTS: Vec3[] = [
  [S / 2, S / 2, 0],
  [0, S / 2, S / 2],
  [S / 2, 0, S / 2]
];
const TARGET: Vec3 = [18, 18, 28];
const DIST = 360;
const AZ = Math.PI / 4;
const EL = Math.asin(1 / Math.sqrt(3));
/** Объектив 110 мм на кадре 36 мм. */
const FOV = 2 * Math.atan(18 / 110);

const VERT = `
attribute vec3 aPos;
attribute vec3 aNor;
attribute float aId;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat4 uArm[3];
varying vec3 vN;
varying vec3 vP;
varying vec3 vO;
varying vec3 vNo;
varying float vMat;
varying float vArm;
void main() {
  float arm = floor(aId * 0.5 + 0.01);
  vMat = aId - arm * 2.0;
  vArm = arm;
  mat4 a = uArm[int(arm)];
  vec4 o = a * vec4(aPos / 256.0, 1.0);
  vec4 v = uView * uModel * o;
  vO = o.xyz;
  vNo = mat3(a) * aNor;
  vN = mat3(uView) * mat3(uModel) * vNo;
  vP = v.xyz;
  gl_Position = uProj * v;
}`;

const FRAG = `
precision highp float;
uniform sampler2D uCap;
uniform vec3 uCore;
uniform vec3 uEye;
uniform mat3 uNV;
uniform float uGlow;
uniform float uD;
varying vec3 vN;
varying vec3 vP;
varying vec3 vO;
varying vec3 vNo;
varying float vMat;
varying float vArm;

const float S = ${S.toFixed(1)};
const float L = 55.0;

// цвет шара в точке с данной нормалью: x — половина атласа (0 синий, 1 серебро)
vec3 cap(vec2 uv, float half_) {
  uv = clamp(uv, 0.03, 0.97);
  return texture2D(uCap, vec2((uv.x + half_) * 0.5, 1.0 - uv.y)).rgb;
}

// луч против бруса: расстояние до входа и нормаль грани, -1 — мимо
float hitBox(vec3 ro, vec3 rd, vec3 lo, vec3 hi, out vec3 nrm) {
  vec3 inv = 1.0 / rd;
  vec3 a = (lo - ro) * inv;
  vec3 b = (hi - ro) * inv;
  vec3 tn = min(a, b);
  vec3 tf = max(a, b);
  float t0 = max(max(tn.x, tn.y), tn.z);
  float t1 = min(min(tf.x, tf.y), tf.z);
  nrm = -sign(rd) * step(tn.yzx, tn.xyz) * step(tn.zxy, tn.xyz);
  return (t0 > t1 || t0 < 0.05) ? -1.0 : t0;
}

void main() {
  vec3 n = normalize(vN);
  float mat = floor(vMat + 0.5);
  // отражение взгляда: у плоской грани оно меняется от края к краю,
  // и блик по ней скользит, а не заливает её целиком
  vec3 r = reflect(normalize(vP), n);
  float m = 2.0 * sqrt(r.x * r.x + r.y * r.y + (r.z + 1.0) * (r.z + 1.0));
  vec3 c = cap(r.xy / m + 0.5, mat);

  // Лучи отражаются друг в друге — отсюда синяя глубина в общем углу,
  // без неё грани плоские. Брусья стоят по осям, поэтому хватает одного
  // отскока против трёх коробок: что отразилось, берём с того же шара.
  vec3 no = normalize(vNo);
  vec3 rd = reflect(normalize(vO - uEye), no) + 1e-4;
  vec3 ro = vO + no * 0.1;
  float best = 1e5;
  vec3 bn = vec3(0.0);
  vec3 blo = vec3(0.0);
  vec3 bhi = vec3(0.0);
  vec3 hn;
  vec3 lo;
  vec3 hi;
  float t;
  bool beam = mat < 0.5;
  if (!(beam && vArm < 0.5)) { lo = vec3(0.0, 0.0, uD); hi = vec3(S, S, L + uD); t = hitBox(ro, rd, lo, hi, hn); if (t > 0.0 && t < best) { best = t; bn = hn; blo = lo; bhi = hi; } }
  if (!(beam && vArm > 0.5 && vArm < 1.5)) { lo = vec3(uD, 0.0, 0.0); hi = vec3(L + uD, S, S); t = hitBox(ro, rd, lo, hi, hn); if (t > 0.0 && t < best) { best = t; bn = hn; blo = lo; bhi = hi; } }
  if (!(beam && vArm > 1.5)) { lo = vec3(0.0, uD, 0.0); hi = vec3(S, L + uD, S); t = hitBox(ro, rd, lo, hi, hn); if (t > 0.0 && t < best) { best = t; bn = hn; blo = lo; bhi = hi; } }
  if (best < 1e4) {
    vec3 hv = normalize(uNV * bn);
    vec3 seen = cap(hv.xy * 0.5 + 0.5, 0.0);
    // синий металл красит отражение, серебро отдаёт как есть
    vec3 tint = mix(vec3(0.5, 0.68, 1.0), vec3(1.0), mat);
    // Металл матовый, отражение в нём не зеркальное: к краям отражённой
    // грани оно сходит на нет, иначе в брусе стоит резкий двойник соседа
    vec3 hp = ro + rd * best;
    vec3 e3 = min(hp - blo, bhi - hp) + abs(bn) * 1e3;
    float soft = smoothstep(0.0, 6.0, min(min(e3.x, e3.y), e3.z));
    c = mix(c, seen * tint * 1.25 + vec3(0.0, 0.012, 0.03), 0.6 * soft * exp(-best / 110.0));
  }

  // тень не бывает чёрной: от пола и соседних граней всегда что-то приходит
  c += mix(vec3(0.012, 0.03, 0.07), vec3(0.05, 0.055, 0.065), mat);
  c *= mix(vec3(1.12, 1.12, 1.16), vec3(1.0), mat);

  // у общего угла лучи заслоняют друг другу свет
  float d = distance(vO, uCore);
  c *= mix(0.78, 1.0, smoothstep(3.0, 28.0, d));
  // свет ядра: разгорается, когда лучи разошлись
  vec3 toCore = normalize(uCore - vO);
  c += uGlow * vec3(0.36, 0.56, 0.92) * max(dot(no, toCore), 0.0) / (1.0 + d * d / 240.0);
  gl_FragColor = vec4(c, 1.0);
}`;

/* ------------------------------------------------------------ матрицы */

const ident = (): Mat4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

const mul = (a: Mat4, b: Mat4): Mat4 => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
};

const move = ([x, y, z]: Vec3): Mat4 => {
  const o = ident();
  o[12] = x;
  o[13] = y;
  o[14] = z;
  return o;
};

const turn = ([x, y, z]: Vec3, angle: number): Mat4 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  // prettier-ignore
  return new Float32Array([
    t * x * x + c,     t * x * y + s * z, t * x * z - s * y, 0,
    t * x * y - s * z, t * y * y + c,     t * y * z + s * x, 0,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c,     0,
    0, 0, 0, 1
  ]);
};

const apply = (m: Mat4, [x, y, z]: Vec3): Vec3 => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14]
];
const upper3 = (m: Mat4) => new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);

const norm = ([x, y, z]: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const lookAt = (eye: Vec3, at: Vec3, up: Vec3): Mat4 => {
  const f = norm([at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]]);
  const s = norm(cross(f, up));
  const u = cross(s, f);
  // prettier-ignore
  return new Float32Array([
    s[0], u[0], -f[0], 0,
    s[1], u[1], -f[1], 0,
    s[2], u[2], -f[2], 0,
    -dot(s, eye), -dot(u, eye), dot(f, eye), 1
  ]);
};

const perspective = (fov: number, near: number, far: number): Mat4 => {
  const f = 1 / Math.tan(fov / 2);
  // prettier-ignore
  return new Float32Array([
    f, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0
  ]);
};

/* ------------------------------------------------------------ знак */

export type Mark3D = {
  destroy: () => void;
  /** Собрать (false) или развести лучи (true). */
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  /** Сменить свет: другой шар — другая студия (тёмная или светлая тема). */
  setMatcap: (url: string) => void;
};

export type Mark3DOptions = {
  mesh?: string;
  matcap?: string;
  /** Зовётся после первого нарисованного кадра. */
  onReady?: () => void;
  /** Зовётся раз в полсекунды со средней частотой кадров. */
  onFps?: (fps: number) => void;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error(src));
    img.src = src;
  });

/**
 * Поднимает знак на канвасе. `null` — если WebGL нет или файлы не пришли:
 * тогда на месте остаётся то, что стояло под канвасом.
 */
export async function createMark3D(canvas: HTMLCanvasElement, opts: Mark3DOptions = {}): Promise<Mark3D | null> {
  const context = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!context) return null;
  // отдельным именем: в объявленных ниже функциях проверка на null иначе теряется
  const gl = context;

  let buf: ArrayBuffer;
  let cap: HTMLImageElement;
  try {
    [buf, cap] = await Promise.all([
      fetch(opts.mesh ?? '/mark/live/mesh.bin').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('mesh')))),
      loadImage(opts.matcap ?? '/mark/live/matcap.webp')
    ]);
  } catch {
    return null;
  }

  const n = new DataView(buf).getUint32(0, true);
  const pos = new Int16Array(buf, 4, n * 3);
  const nor = new Int8Array(buf, 4 + n * 6, n * 3);
  const ids = new Uint8Array(buf, 4 + n * 9, n);

  const shader = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[mark3d]', gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  const attr = (name: string, data: ArrayBufferView, size: number, type: number, normalized: boolean) => {
    const loc = gl.getAttribLocation(program, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, type, normalized, 0, 0);
  };
  attr('aPos', pos, 3, gl.SHORT, false);
  attr('aNor', nor, 3, gl.BYTE, true);
  attr('aId', ids, 1, gl.UNSIGNED_BYTE, false);

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const U = (name: string) => gl.getUniformLocation(program, name);
  const uProj = U('uProj');
  const uView = U('uView');
  const uModel = U('uModel');
  const uArm = [U('uArm[0]'), U('uArm[1]'), U('uArm[2]')];
  const uCore = U('uCore');
  const uGlow = U('uGlow');
  const uEye = U('uEye');
  const uNV = U('uNV');
  const uD = U('uD');
  gl.uniform1i(U('uCap'), 0);
  gl.uniformMatrix4fv(uProj, false, perspective(FOV, 100, 700));
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);

  /* --- состояние --- */
  let yaw = 0;
  let pitch = 0;
  let vyaw = 0;
  let vpitch = 0;
  let open = 0;
  let vopen = 0;
  let openTarget = 0;
  let held = false;
  let idle = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const side = Math.max(1, Math.round((canvas.clientWidth || 300) * dpr));
    if (canvas.width !== side || canvas.height !== side) {
      canvas.width = side;
      canvas.height = side;
    }
    gl.viewport(0, 0, side, side);
  };

  /* --- палец --- */
  let last: { x: number; y: number; t: number } | null = null;
  let travelled = 0;
  let downAt = 0;
  const down = (e: PointerEvent) => {
    held = true;
    travelled = 0;
    downAt = e.timeStamp;
    last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    vyaw = vpitch = 0;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const drag = (e: PointerEvent) => {
    if (!held || !last) return;
    const k = 3.2 / Math.max(canvas.clientWidth, 1);
    const dx = (e.clientX - last.x) * k;
    const dy = (e.clientY - last.y) * k;
    const dt = Math.max(e.timeStamp - last.t, 1) / 1000;
    yaw += dx;
    pitch = Math.max(-0.75, Math.min(0.75, pitch + dy));
    vyaw = dx / dt;
    vpitch = dy / dt;
    travelled += Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y);
    last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    idle = 0;
  };
  const up = (e: PointerEvent) => {
    if (!held) return;
    held = false;
    // короткое касание без движения — развести или собрать лучи
    if (travelled < 8 && e.timeStamp - downAt < 320) openTarget = openTarget ? 0 : 1;
    // палец остановился раньше, чем отпустил, — инерции нет
    if (last && e.timeStamp - last.t > 90) vyaw = vpitch = 0;
    last = null;
    idle = 0;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', drag);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  /* --- цикл --- */
  let raf = 0;
  let prev = performance.now();
  let ready = false;
  let frames = 0;
  let acc = 0;
  let onScreen = true;
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !raf) raf = requestAnimationFrame(frame);
  });
  io.observe(canvas);
  const visible = () => {
    if (!document.hidden && !raf) raf = requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange', visible);

  function frame(now: number) {
    raf = 0;
    if (!onScreen || document.hidden) {
      prev = now;
      return;
    }
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;

    if (!held) {
      // инерция затухает; через секунду покоя знак плавно встаёт как на логотипе
      yaw += vyaw * dt;
      pitch = Math.max(-0.75, Math.min(0.75, pitch + vpitch * dt));
      const fr = Math.exp(-dt * 2.6);
      vyaw *= fr;
      vpitch *= fr;
      idle += dt;
      if (idle > 1.1 && Math.abs(vyaw) < 0.6) {
        const home = Math.round(yaw / (2 * Math.PI)) * 2 * Math.PI;
        const pull = 1 - Math.exp(-dt * 2.2);
        yaw += (home - yaw) * pull;
        pitch += (0 - pitch) * pull;
      }
    }
    // пружина разлёта: чуть перелетает и садится
    vopen += ((openTarget - open) * 70 - vopen * 11) * dt;
    open += vopen * dt;

    const t = now / 1000;
    const sway = reduced || held ? 0 : Math.sin(t * 0.6) * 0.05;
    const d = open * OUT;
    const shift = d / 3;
    const target: Vec3 = [TARGET[0] + shift, TARGET[1] + shift, TARGET[2] + shift];
    const dir: Vec3 = [Math.cos(EL) * Math.cos(AZ), Math.cos(EL) * Math.sin(AZ), Math.sin(EL)];
    const eye: Vec3 = [target[0] + dir[0] * DIST, target[1] + dir[1] * DIST, target[2] + dir[2] * DIST];
    const right = norm(cross([-dir[0], -dir[1], -dir[2]], [0, 0, 1]));

    size();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const view = lookAt(eye, target, [0, 0, 1]);
    const back: Vec3 = [-target[0], -target[1], -target[2]];
    const model = mul(move(target), mul(turn(right, pitch), mul(turn([0, 0, 1], yaw + sway), move(back))));
    const unmodel = mul(move(target), mul(turn([0, 0, 1], -yaw - sway), mul(turn(right, -pitch), move(back))));
    gl.uniformMatrix4fv(uView, false, view);
    gl.uniformMatrix4fv(uModel, false, model);
    // взгляд и нормали — в пространстве самого знака: там брусья стоят по осям
    gl.uniform3fv(uEye, apply(unmodel, eye));
    gl.uniformMatrix3fv(uNV, false, upper3(mul(view, model)));
    gl.uniform1f(uD, d);
    for (let i = 0; i < 3; i++) {
      const a = AXES[i];
      const p = PIVOTS[i];
      const spin = turn(a, open * SPIN * (i === 1 ? -1 : 1));
      const out = move([a[0] * d, a[1] * d, a[2] * d]);
      gl.uniformMatrix4fv(uArm[i], false, mul(out, mul(move(p), mul(spin, move([-p[0], -p[1], -p[2]])))));
    }
    gl.uniform3f(uCore, S / 2, S / 2, S / 2);
    gl.uniform1f(uGlow, Math.max(0, open) * 1.4);
    gl.drawArrays(gl.TRIANGLES, 0, n);

    if (!ready) {
      ready = true;
      opts.onReady?.();
    }
    if (opts.onFps) {
      frames++;
      acc += dt;
      if (acc >= 0.5) {
        opts.onFps(frames / acc);
        frames = 0;
        acc = 0;
      }
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', visible);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', drag);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      gl.deleteProgram(program);
    },
    setOpen(next) {
      openTarget = next ? 1 : 0;
    },
    isOpen: () => openTarget === 1,
    setMatcap(url) {
      // текстура одна и привязана с самого начала — новая картинка ложится в неё же
      loadImage(url)
        .then((img) => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img))
        .catch(() => {});
    }
  };
}
