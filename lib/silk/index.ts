import { SILK_FRAG, SIM_FRAG, VERT } from './shaders';

export type SilkParams = {
  scale: number;
  warp: number;
  speed: number;
  flow: number;
  core1: number;
  core2: number;
  core3: number;
  exposure: number;
  sheen: number;
  glint: number;
  fresnel: number;
  film: number;
  edge: number;
  vignette: number;
  grain: number;
  decay: number;
  curl: number;
  octaves: number;
  accent: string;
};

/** Утверждено на прототипе: тёмный матовый, глубже и синее референса. */
export const SILK_DEFAULTS: SilkParams = {
  scale: 1.1,
  warp: 1.08,
  speed: 0.9,
  flow: 0.8,
  core1: 1.0,
  core2: 0.74,
  core3: 0.52,
  exposure: 0.98,
  sheen: 0.95,
  glint: 0.52,
  fresnel: 0.85,
  film: 0.3,
  edge: 0.85,
  vignette: 1.0,
  grain: 1.25,
  decay: 0.85,
  curl: 3.2,
  octaves: 3,
  accent: '#55769a'
};

/**
 * Часы материала и веса ядер. Рантайм обновляет их каждый кадр, чтобы
 * DOM-элементы (знак на первом экране) могли дышать в такт свету ядер.
 */
export const silkClock = { t: 0, w: [1, 0.74, 0.52] as [number, number, number], live: false };

/** Скорости и фазы трёх ядер — те же числа, что в шейдере (addCore). */
export const CORE_SPEED = [0.11, 0.07, 0.05] as const;
export const CORE_PHASE = [0, 2.09, 4.18] as const;

export type SilkHandle = {
  destroy: () => void;
  setParams: (patch: Partial<SilkParams>) => void;
  /** 0 — тёмный матовый, 1 — молочный. Переход плавный; `instant` — сразу. */
  setTheme: (mode: 0 | 1, instant?: boolean) => void;
  /**
   * Не рисовать: материал целиком закрыт завесой главы. Последний кадр
   * остаётся на канвасе, под непрозрачной завесой его всё равно не видно.
   */
  setPaused: (paused: boolean) => void;
  /** Замереть на последнем кадре: под наплывом темы страница не должна меняться. */
  setHeld: (held: boolean) => void;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

type Prog = { program: WebGLProgram; loc: (name: string) => WebGLUniformLocation | null };

export type SilkOptions = {
  params?: Partial<SilkParams>;
  /**
   * Тема, в которой материал рождается: 0 — тёмный, 1 — молочный.
   * Плавный переход — для смены темы на глазах, а не для рождения:
   * материал создаётся заново на каждой странице, и в светлой теме
   * каждый переход начинался с тёмной вспышки.
   */
  mode?: 0 | 1;
  /** Зовётся один раз, после первого отрисованного кадра. */
  onFirstFrame?: () => void;
  /**
   * Рисовать даже когда страница скрыта. В обычной жизни не нужно — пауза
   * на скрытой вкладке экономит батарею. Включается ключом ?silkdebug,
   * чтобы можно было проверить материал в фоновом окне.
   */
  ignoreVisibility?: boolean;
};

export function createSilk(canvas: HTMLCanvasElement, opts: SilkOptions = {}): SilkHandle {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance'
  });

  if (!gl) {
    // Без WebGL остаётся фон из токенов темы — первый экран не ломается.
    canvas.style.display = 'none';
    opts.onFirstFrame?.();
    return { destroy: () => {}, setParams: () => {}, setTheme: () => {}, setPaused: () => {}, setHeld: () => {} };
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const isMobile = innerWidth < 768 || coarse;

  const P: SilkParams = { ...SILK_DEFAULTS, ...opts.params };
  if (isMobile) {
    // Октавы не режем: на двух материал выглядит резиной. Режем разрешение
    // и убираем проход следа — курсора на телефоне всё равно нет.
    P.scale = 0.92;
    P.flow = 0;
  }

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[silk]', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const build = (frag: string): Prog | null => {
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[silk]', gl.getProgramInfoLog(program));
      return null;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    const cache = new Map<string, WebGLUniformLocation | null>();
    return {
      program,
      loc: (name) => {
        if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
        return cache.get(name) ?? null;
      }
    };
  };

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const bindQuad = (program: WebGLProgram) => {
    gl.useProgram(program);
    const a = gl.getAttribLocation(program, 'position');
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  };

  let silk = build(`#define OCT ${P.octaves | 0}\n${SILK_FRAG}`);
  const sim = build(`#define OCT 3\n${SIM_FRAG}`);
  if (!silk || !sim) {
    canvas.style.display = 'none';
    opts.onFirstFrame?.();
    return { destroy: () => {}, setParams: () => {}, setTheme: () => {}, setPaused: () => {}, setHeld: () => {} };
  }

  /* --- поле следа курсора: две RGBA8-текстуры по кругу --- */
  let FW = 256;
  let FH = 160;
  const targets = [0, 1].map(() => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { tex, fbo: gl.createFramebuffer()! };
  });
  let src = 0;

  const sizeField = (w: number, h: number) => {
    FW = w;
    FH = h;
    for (const t of targets) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FW, FH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
      gl.clearColor(0.5, 0.5, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  /**
   * При reduced motion время стоит, след курсора выключен, и каждый кадр
   * был копией предыдущего — шестьдесят раз в секунду. Теперь кадр
   * рисуется, только когда что-то поменялось: параметры главы, тема,
   * размер окна.
   */
  let dirty = true;

  /* --- размеры --- */
  let renderScale = isMobile ? 0.7 : 1;
  /**
   * Размер канваса меняется только в кадре, прямо перед отрисовкой.
   * Присвоение width/height стирает буфер, и раньше это случалось после
   * отрисовки — подстройка разрешения под частоту кадров стирала только
   * что нарисованный кадр, и на экран попадал чёрный. На тяжёлых
   * страницах частота гуляла у порогов, разрешение качалось туда-сюда,
   * и фон мигал раз за разом — в светлой теме серой вспышкой сквозь
   * завесу, в тёмной провалом в черноту.
   */
  let wantSize = false;
  const requestSize = () => {
    wantSize = true;
    dirty = true;
    kick();
  };
  const resize = () => {
    // На компьютере — не плотнее 1,5: материал гладкий, на экране Retina
    // разницы с двойной плотностью глаз не видит, а точек почти вдвое меньше.
    // Фон был самой дорогой частью кадра при прокрутке.
    const dpr = Math.min(devicePixelRatio || 1, isMobile ? 2 : 1.5);
    const cssW = canvas.clientWidth || innerWidth;
    const cssH = canvas.clientHeight || innerHeight;
    canvas.width = Math.max(1, Math.round(cssW * dpr * renderScale));
    canvas.height = Math.max(1, Math.round(cssH * dpr * renderScale));
    sizeField(256, Math.max(64, Math.round(256 / Math.max(cssW / cssH, 0.3))));
    dirty = true;
  };

  /* --- ввод --- */
  const pointer = {
    uv: [0.5, 0.55] as [number, number],
    prev: [0.5, 0.55] as [number, number],
    vel: [0, 0] as [number, number],
    speed: 0,
    inject: 0,
    inside: false
  };

  const onPointerMove = (e: PointerEvent) => {
    pointer.uv = [e.clientX / innerWidth, 1 - e.clientY / innerHeight];
    pointer.inside = true;
  };
  const onPointerLeave = () => {
    pointer.inside = false;
  };

  let scrollNorm = 0;
  let scrollVel = 0;
  let lastScroll = scrollY;
  const onScroll = () => {
    scrollNorm = scrollY / Math.max(innerHeight, 1);
    scrollVel += Math.abs(scrollY - lastScroll) * 0.06;
    lastScroll = scrollY;
  };

  let hidden = document.hidden && !opts.ignoreVisibility;
  const onVisibility = () => {
    hidden = document.hidden && !opts.ignoreVisibility;
    kick();
  };

  let onScreen = true;
  const io = new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      kick();
    },
    { threshold: 0 }
  );
  io.observe(canvas);

  addEventListener('resize', requestSize, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  if (!isMobile) {
    addEventListener('pointermove', onPointerMove, { passive: true });
    addEventListener('pointerleave', onPointerLeave, { passive: true });
  }

  resize();

  /* --- цикл --- */
  const t0 = performance.now();
  let last = t0;
  let mode: number = opts.mode ?? 0;
  let modeTarget: number = mode;
  let frames = 0;
  let acc = 0;
  let slow = 0;
  let fast = 0;
  let raf = 0;
  let announced = false;
  const still = reduced || isMobile;
  let paused = false;
  let held = false;

  /**
   * Цикл идёт, только пока есть что рисовать. Раньше он просил кадр всегда —
   * и под глухой завесой, и во вкладке на заднем плане — и только потом
   * решал, что рисовать нечего. Сам пустой кадр дёшев, но страница из-за
   * него просыпалась 60 раз в секунду, а с ней пересчитывались все идущие
   * анимации. Теперь, когда рисовать нечего, цикл стоит; будит его `kick`
   * — из всех мест, где появляется работа.
   */
  const frame = (now: number) => {
    raf = 0;
    // первый кадр рисуется в любом случае: его ждёт прелоадер, а страница,
    // открытая посреди схемы, начинает как раз под полной завесой
    if (hidden || !onScreen || held || (paused && announced) || !silk) {
      last = now;
      return;
    }
    if (reduced && !dirty && Math.abs(modeTarget - mode) < 0.001) {
      last = now;
      return;
    }
    raf = requestAnimationFrame(frame);
    dirty = false;
    if (wantSize) {
      wantSize = false;
      resize();
    }

    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const time = (now - t0) / 1000;
    silkClock.t = (reduced ? 12 : time) * 0.15 * P.speed;
    silkClock.w = [P.core1, P.core2, P.core3];
    silkClock.live = true;

    const dx = pointer.uv[0] - pointer.prev[0];
    const dy = pointer.uv[1] - pointer.prev[1];
    const inst = Math.hypot(dx, dy) / Math.max(dt, 0.001);
    pointer.vel[0] += (dx / Math.max(dt, 0.001) - pointer.vel[0]) * 0.35;
    pointer.vel[1] += (dy / Math.max(dt, 0.001) - pointer.vel[1]) * 0.35;
    pointer.speed += (Math.min(inst, 3) - pointer.speed) * 0.12;
    pointer.inject += ((inst > 0.02 && pointer.inside ? 1 : 0) - pointer.inject) * 0.25;
    pointer.prev = [...pointer.uv] as [number, number];
    scrollVel *= 0.92;
    mode += (modeTarget - mode) * Math.min(dt * 3.2, 1);

    // 1. след курсора
    if (!still) {
      const dst = targets[1 - src];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, FW, FH);
      bindQuad(sim.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[src].tex);
      gl.uniform1i(sim.loc('uPrev'), 0);
      gl.uniform2f(sim.loc('uPointer'), pointer.uv[0], pointer.uv[1]);
      gl.uniform2f(
        sim.loc('uPointerVel'),
        Math.max(-2, Math.min(2, pointer.vel[0] * 0.35)),
        Math.max(-2, Math.min(2, pointer.vel[1] * 0.35))
      );
      gl.uniform1f(sim.loc('uInject'), pointer.inject);
      gl.uniform1f(sim.loc('uDt'), dt);
      gl.uniform2f(sim.loc('uTexel'), 1 / FW, 1 / FH);
      gl.uniform1f(sim.loc('uAspect'), FW / FH);
      gl.uniform1f(sim.loc('uDecay'), P.decay);
      gl.uniform1f(sim.loc('uCurl'), P.curl);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = 1 - src;
    }

    // 2. материал
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    bindQuad(silk.program);
    const aspect = canvas.width / canvas.height;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[src].tex);
    gl.uniform1i(silk.loc('uField'), 0);
    gl.uniform2f(silk.loc('uResolution'), canvas.width, canvas.height);
    gl.uniform1f(silk.loc('uTime'), reduced ? 12 : time);
    gl.uniform2f(
      silk.loc('uMouse'),
      (pointer.uv[0] * 2 - 1) * aspect * P.scale,
      (pointer.uv[1] * 2 - 1) * P.scale
    );
    gl.uniform1f(silk.loc('uPointerVel'), still ? 0 : pointer.speed);
    gl.uniform1f(silk.loc('uScroll'), scrollNorm);
    gl.uniform1f(silk.loc('uVelocity'), reduced ? 0 : Math.min(scrollVel, 6));
    gl.uniform1f(silk.loc('uScale'), P.scale);
    gl.uniform1f(silk.loc('uWarp'), P.warp);
    gl.uniform1f(silk.loc('uFlow'), still ? 0 : P.flow);
    gl.uniform1f(silk.loc('uExposure'), P.exposure);
    gl.uniform1f(silk.loc('uSheen'), P.sheen);
    gl.uniform1f(silk.loc('uGlint'), P.glint);
    gl.uniform1f(silk.loc('uFresnel'), P.fresnel);
    gl.uniform1f(silk.loc('uFilm'), P.film);
    gl.uniform1f(silk.loc('uEdge'), P.edge);
    gl.uniform1f(silk.loc('uGrain'), P.grain);
    gl.uniform1f(silk.loc('uVignette'), P.vignette);
    gl.uniform1f(silk.loc('uSpeed'), P.speed);
    gl.uniform3fv(silk.loc('uAccent'), hexToRgb(P.accent));
    gl.uniform3f(silk.loc('uCoreW'), P.core1, P.core2, P.core3);
    gl.uniform1f(silk.loc('uMode'), mode);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!announced) {
      announced = true;
      opts.onFirstFrame?.();
    }

    // 3. разрешение подстраивается под живые кадры (при reduced motion
    // кадров нет по замыслу — подстраивать нечего)
    if (reduced) return;
    acc += dt;
    frames++;
    if (acc >= 0.5) {
      const fps = frames / acc;
      // гистерезис: вниз — после секунды провала, вверх — после трёх секунд
      // запаса. Без него разрешение качалось на каждом полусекундном замере
      slow = fps < 45 ? slow + 1 : 0;
      fast = fps > 58 ? fast + 1 : 0;
      if (slow >= 2 && renderScale > 0.55) {
        renderScale = Math.max(0.55, renderScale - 0.15);
        requestSize();
        slow = 0;
        fast = 0;
      } else if (fast >= 6 && renderScale < (isMobile ? 0.7 : 1)) {
        renderScale = Math.min(isMobile ? 0.7 : 1, renderScale + 0.1);
        requestSize();
        fast = 0;
      }
      acc = 0;
      frames = 0;
    }
  };
  raf = requestAnimationFrame(frame);
  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  return {
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener('resize', requestSize);
      removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      removeEventListener('pointermove', onPointerMove);
      removeEventListener('pointerleave', onPointerLeave);
      for (const t of targets) {
        gl.deleteTexture(t.tex);
        gl.deleteFramebuffer(t.fbo);
      }
      gl.deleteBuffer(quad);
      if (silk) gl.deleteProgram(silk.program);
      gl.deleteProgram(sim.program);
      // Контекст НЕ теряем: в StrictMode эффект монтируется дважды, а
      // getContext на том же канвасе вернёт тот же самый контекст —
      // loseContext убил бы второй экземпляр. Контекст умрёт с канвасом.
    },
    setParams(patch) {
      const needsRebuild = patch.octaves !== undefined && patch.octaves !== P.octaves;
      Object.assign(P, patch);
      dirty = true;
      kick();
      if (needsRebuild) {
        if (silk) gl.deleteProgram(silk.program);
        silk = build(`#define OCT ${P.octaves | 0}\n${SILK_FRAG}`);
      }
    },
    setTheme(next, instant = false) {
      modeTarget = next;
      if (instant) mode = next;
      dirty = true;
      kick();
    },
    setPaused(next) {
      paused = next;
      if (!next) kick();
    },
    setHeld(next) {
      held = next;
      if (!next) kick();
    }
  };
}
