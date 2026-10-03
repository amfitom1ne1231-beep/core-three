'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { SITE } from '@/content/site';
import { onThemeChange, readTheme, type Theme } from '@/lib/theme';

/**
 * Проба новой схемы «Путь одного заказа»: плита и модули из Blender
 * (brand/blender/scheme.py), ток, жетон и подписи — здесь.
 *
 * Слои кладутся по координатам из map.json, который пишет тот же скрипт:
 * камера ортографическая, поэтому точки пазов, посчитанные в Blender,
 * совпадают с картинкой до пикселя. Ток рисуется между плитой и модулями —
 * модули сами закрывают его там, где стоят впереди, как настоящие.
 */

type Box = { x: number; y: number; w: number; h: number };
type Pt = [number, number];
type SchemeMap = {
  size: [number, number];
  layers: Record<string, Box>;
  modules: Record<string, { n: string; name: string; top: Pt; right: Pt; peak: Pt; base: Pt; hit: Pt[] }>;
  channels: Record<string, Pt[]>;
  rim: Pt[];
};

const ROOT = '/scheme/probe';
/** Порядок заказа: заход с края → станция → канал → станция → выход. */
const ROUTE: { channel: string; to: string | null }[] = [
  { channel: 'in', to: 'site' },
  { channel: 'ab', to: 'catalog' },
  { channel: 'out', to: null }
];
const TRAVEL_MS = 1300;
const HOLD_MS = 3200;
/** Длина импульса в пикселях кадра — одинаковая на коротком и длинном канале. */
const PULSE_PX = 170;
/** Шлейф за импульсом: паз, по которому только что прошёл ток, ещё светится. */
const TRAIL_PX = 520;
/** Насколько приподнимается активный модуль — доля его собственной высоты. */
const LIFT = '-2.5%';

const d = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export default function SchemeProbe() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [map, setMap] = useState<SchemeMap | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [moving, setMoving] = useState(false);
  const token = useRef<HTMLDivElement>(null);
  const pulse = useRef<SVGGElement>(null);
  const held = useRef(false);

  useEffect(() => {
    setTheme(readTheme());
    return onThemeChange(setTheme);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`${ROOT}/${theme}/map.json`)
      .then((r) => r.json())
      .then((m: SchemeMap) => alive && setMap(m));
    return () => {
      alive = false;
    };
  }, [theme]);

  /**
   * Один шаг заказа: импульс едет по каналу, жетон — за его головой.
   * Голова считается по самому пути (`getPointAtLength`), поэтому жетон
   * не может разойтись с током ни на одном изгибе.
   */
  const travel = useCallback(
    (i: number) => {
      const g = pulse.current;
      const path = g?.querySelector<SVGPathElement>(`[data-ch="${ROUTE[i].channel}"]`);
      if (!map || !g || !path) return;
      const total = path.getTotalLength();
      // путь размечен в долях (pathLength=1): импульс и шлейф — доли,
      // равные своей длине в пикселях
      const strokes = [...g.querySelectorAll<SVGPathElement>(`[data-group="${ROUTE[i].channel}"] path`)].map((s) => ({
        s,
        seg: Math.min(s.dataset.trail !== undefined ? 0.9 : 0.6, (s.dataset.trail !== undefined ? TRAIL_PX : PULSE_PX) / total)
      }));
      strokes.forEach(({ s, seg }) => (s.style.strokeDasharray = `${seg} ${1 + seg}`));
      const [W, H] = map.size;
      setMoving(true);
      setStep(i);
      const t0 = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / TRAVEL_MS);
        const e = 1 - Math.pow(1 - p, 3);
        // голова импульса — в e, хвост длиной seg тянется за ней
        strokes.forEach(({ s, seg }) => (s.style.strokeDashoffset = String(seg - e)));
        const pt = path.getPointAtLength(e * total);
        if (token.current) {
          token.current.style.left = pct(pt.x, W);
          token.current.style.top = pct(pt.y, H);
        }
        if (p < 1) raf = requestAnimationFrame(tick);
        else {
          setMoving(false);
          setActive(ROUTE[i].to);
        }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    },
    [map]
  );

  // заказ идёт сам: заход → «Сайт» → канал → «Каталог» → дальше, по кругу
  useEffect(() => {
    if (!map) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActive('site');
      return;
    }
    let i = 0;
    let stop: (() => void) | undefined;
    let timer = 0;
    const next = () => {
      if (held.current) {
        timer = window.setTimeout(next, 600);
        return;
      }
      stop = travel(i);
      const wait = TRAVEL_MS + (ROUTE[i].to ? HOLD_MS : 500);
      i = (i + 1) % ROUTE.length;
      timer = window.setTimeout(next, wait);
    };
    timer = window.setTimeout(next, 700);
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, [map, travel]);

  if (!map) return <div className="aspect-[1800/1300] w-full" />;
  const [W, H] = map.size;
  const L = map.layers;
  const at = (b: Box): CSSProperties => ({ left: pct(b.x, W), top: pct(b.y, H), width: pct(b.w, W), height: pct(b.h, H) });
  const ids = Object.keys(map.modules);
  const station = (id: string) => SITE.journey.stations.find((s) => s.id === id);
  const src = (name: string) => `${ROOT}/${theme}/${name}.webp`;
  const light = theme === 'light';

  return (
    <div
      className="relative w-full select-none"
      style={{ aspectRatio: `${W} / ${H}` }}
      onMouseEnter={() => (held.current = true)}
      onMouseLeave={() => (held.current = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src('plate')} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
      {/* тень приподнятого модуля бледнеет: модуль ушёл от плиты, и
          плотная контактная тень под цоколем читалась бы щелью */}
      {ids.map((id) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={id}
          src={src(`shadow-${id}`)}
          alt=""
          className="absolute transition-opacity duration-500"
          style={{ ...at(L[`shadow-${id}`]), opacity: active === id ? 0.3 : 1 }}
          draggable={false}
        />
      ))}

      {/* ---------- ток: между плитой и модулями ---------- */}
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <filter id="scheme-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        {/* фоновый ток: система жива, даже когда заказа нет. Штрих
            в пикселях кадра, а не в долях пути: на коротком и длинном
            канале ток бежит с одной скоростью */}
        {Object.entries(map.channels).map(([k, pts]) => (
          <path key={k} d={d(pts)} className="scheme-idle" />
        ))}
        {/* обход мониторинга по краю плиты */}
        <path d={d(map.rim)} className="scheme-rim" pathLength={1} />

        {/* заказ: широкое свечение и яркое ядро */}
        <g ref={pulse} className="scheme-pulse" data-moving={moving || undefined}>
          {Object.entries(map.channels).map(([k, pts]) => (
            <g key={k} data-group={k} style={{ opacity: ROUTE[step]?.channel === k ? 1 : 0 }}>
              <path d={d(pts)} pathLength={1} className="scheme-pulse-trail" data-trail="" filter="url(#scheme-glow)" />
              <path d={d(pts)} pathLength={1} className="scheme-pulse-glow" filter="url(#scheme-glow)" />
              <path d={d(pts)} pathLength={1} className="scheme-pulse-core" data-ch={k} />
            </g>
          ))}
        </g>
      </svg>

      {/* ---------- модули ---------- */}
      {ids.map((id) => {
        const on = active === id;
        return (
          <div
            key={id}
            className="absolute transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ ...at(L[`mod-${id}-off`]), transform: `translateY(${on ? LIFT : '0'})` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(`mod-${id}-off`)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src(`mod-${id}-on`)}
              alt=""
              className="absolute inset-0 h-full w-full transition-opacity duration-500"
              style={{ opacity: on ? 1 : 0 }}
              draggable={false}
            />
          </div>
        );
      })}

      {/* Свечение значка: резкое и размытое, оба — светом поверх (screen).
          Лежит не в обёртке модуля, а прямо в сцене: обёртка с трансформом
          изолирует смешивание, и чёрный фон свечения становился тёмной
          плашкой вместо того, чтобы раствориться. Подъём — своим трансформом. */}
      {ids.map((id) =>
        [0, 14].map((blur) => {
          const on = active === id;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${id}-${blur}`}
              src={src(`glow-${id}`)}
              alt=""
              className="pointer-events-none absolute transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                ...at(L[`glow-${id}`]),
                opacity: on ? (light ? 0.5 : blur ? 0.9 : 0.6) : 0,
                mixBlendMode: 'screen',
                filter: blur ? `blur(${blur}px)` : undefined,
                transform: `translateY(${on ? LIFT : '0'})`
              }}
              draggable={false}
            />
          );
        })
      )}

      {/* ---------- подписи, выноска, жетон ---------- */}
      {ids.map((id) => {
        const m = map.modules[id];
        const st = station(id);
        const on = active === id;
        return (
          <div key={id}>
            <span
              className="pointer-events-none absolute -translate-y-1/2 pl-3 font-mono text-[10px] uppercase tracking-rail transition-colors duration-500"
              style={{ left: pct(m.right[0], W), top: pct(m.right[1], H), color: on ? 'var(--fg)' : 'var(--fg-dim)' }}
            >
              <b className="font-normal text-faint">{m.n}</b> {m.name}
            </span>
            {st && (
              <div
                className="glass pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[10px] px-3 py-2 text-[12px] leading-snug transition-[opacity,transform] duration-500"
                style={{
                  left: pct(m.peak[0], W),
                  top: pct(m.peak[1], H),
                  opacity: on ? 1 : 0,
                  transform: `translate(-50%, ${on ? 'calc(-100% - 14px)' : 'calc(-100% - 4px)'})`
                }}
              >
                <span className="block font-mono text-[9px] uppercase tracking-rail text-faint">{st.role}</span>
                {st.event}
              </div>
            )}
          </div>
        );
      })}

      <div
        ref={token}
        className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-[160%] items-center gap-2 whitespace-nowrap rounded-full border border-line-strong bg-bg/80 py-1 pl-1 pr-3 text-[11px] backdrop-blur transition-opacity duration-300"
        style={{ opacity: moving ? 1 : 0 }}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-medium text-white">
          {SITE.journey.order.who[0]}
        </span>
        {SITE.journey.order.who} · {SITE.journey.order.id} <span className="text-dim">{SITE.journey.order.sum}</span>
      </div>

      {/* нажатие по модулю: контур из той же проекции */}
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        {ids.map((id) => (
          <polygon
            key={id}
            points={map.modules[id].hit.map((p) => p.join(',')).join(' ')}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => setActive(id)}
          >
            <title>{map.modules[id].name}</title>
          </polygon>
        ))}
      </svg>
    </div>
  );
}
