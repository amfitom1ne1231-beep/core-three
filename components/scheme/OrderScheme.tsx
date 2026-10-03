'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { SITE } from '@/content/site';
import { onThemeChange, readTheme, type Theme } from '@/lib/theme';

/**
 * Схема «Путь одного заказа» из Blender (brand/blender/scheme.py).
 *
 * Сцена — рендер целиком (base). Для каждой станции и каждого паза
 * есть та же сцена, где горит только он (lit-*), обрезанная по своему
 * участку. Ток — это вариант «паз горит», проявленный маской, которая
 * бежит по пазу: настоящий свет с отражением в стекле, а не линия
 * поверх картинки. Станция включается проявлением своего варианта.
 *
 * Луч и пылинки в тёмной теме — живые, поверх рендера: запечённые,
 * они стояли бы на месте.
 *
 * Координаты пазов, подписей и областей нажатия — из map.json того же
 * скрипта: камера та же, точки совпадают с картинкой до пикселя.
 */

type Box = { x: number; y: number; w: number; h: number };
type Pt = [number, number];
type SchemeMap = {
  size: [number, number];
  layers: Record<string, Box>;
  modules: Record<string, { top: Pt; label: Pt; labelLeft: Pt; peak: Pt; hit: Pt[] }>;
  channels: Record<string, Pt[]>;
  loop: Pt[];
};

export type OrderSchemeHandle = { select: (id: string) => void };

const ROOT = '/scheme';
/** Путь заказа: по какому пазу едет импульс и где загорается. */
const ROUTE: { channel: string; to: string | null }[] = [
  { channel: 'in', to: 'site' },
  { channel: 'ab', to: 'catalog' },
  { channel: 'bc', to: 'bot' },
  { channel: 'cd', to: 'money' },
  // мониторинг: проверка уходит от дозорной колонны в контур
  { channel: 'guard', to: 'watch' },
  { channel: 'out', to: null }
];
const TRAVEL_MS = 1400;
const HOLD_MS = 3600;
/** Длина импульса и ширина его маски, в пикселях кадра рендера. */
const PULSE_PX = 260;
const PULSE_WIDTH = 90;

const d = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** Пылинки в луче: место, размер и ход — одни и те же при каждом показе. */
const DUST = Array.from({ length: 26 }, (_, i) => {
  const r = (n: number) => ((Math.sin((i + 1) * 12.9898 * n) * 43758.5453) % 1 + 1) % 1;
  return { x: 38 + r(1) * 30, y: 4 + r(2) * 52, s: 2 + r(3) * 5, dur: 9 + r(4) * 10, delay: -r(5) * 18, blur: r(6) > 0.6 };
});

const OrderScheme = forwardRef<OrderSchemeHandle, { onActive?: (id: string | null) => void; className?: string }>(
  function OrderScheme({ onActive, className = '' }, ref) {
    const [theme, setTheme] = useState<Theme>('dark');
    const [map, setMap] = useState<SchemeMap | null>(null);
    const [active, setActiveState] = useState<string | null>(null);
    const [step, setStep] = useState(-1);
    const [moving, setMoving] = useState(false);
    const [inView, setInView] = useState(false);

    const root = useRef<HTMLDivElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const token = useRef<HTMLDivElement>(null);
    const masks = useRef<SVGGElement>(null);
    const held = useRef(false);
    const touched = useRef(0);
    const cursor = useRef(0);
    const stopTravel = useRef<(() => void) | undefined>(undefined);

    const setActive = useCallback(
      (id: string | null) => {
        setActiveState(id);
        onActive?.(id);
      },
      [onActive]
    );

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

    // показ идёт, только пока схема на экране
    useEffect(() => {
      const el = root.current;
      if (!el) return;
      const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
      io.observe(el);
      return () => io.disconnect();
    }, []);

    /**
     * Камера на телефоне едет за импульсом: сцена шире экрана, и активная
     * станция держится по центру. Пока человек сам листает пальцем,
     * камера ему не мешает.
     */
    const follow = useCallback(
      (x: number) => {
        const sc = scroller.current;
        if (!sc || !map || sc.scrollWidth <= sc.clientWidth + 2) return;
        if (Date.now() - touched.current < 2500) return;
        const left = (x / map.size[0]) * sc.scrollWidth - sc.clientWidth / 2;
        sc.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
      },
      [map]
    );

    /** Один шаг заказа: импульс едет по пазу, жетон — за его головой. */
    const travel = useCallback(
      (i: number) => {
        stopTravel.current?.();
        const g = masks.current;
        const leg = ROUTE[i];
        const path = g?.querySelector<SVGPathElement>(`[data-pulse="${leg.channel}"]`);
        if (!map || !g || !path) return;
        const total = path.getTotalLength();
        const seg = Math.min(0.7, PULSE_PX / total);
        path.style.strokeDasharray = `${seg} ${1 + seg}`;
        const [W, H] = map.size;
        setStep(i);
        setMoving(true);
        const t0 = performance.now();
        let raf = 0;
        let lastFollow = 0;
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / TRAVEL_MS);
          const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          // голова в e, хвост длиной seg тянется за ней; маска уходит за конец
          path.style.strokeDashoffset = String(seg - e * (1 + seg * 0.3));
          const pt = path.getPointAtLength(Math.min(1, e) * total);
          if (token.current) {
            token.current.style.left = pct(pt.x, W);
            token.current.style.top = pct(pt.y, H);
          }
          if (now - lastFollow > 300) {
            lastFollow = now;
            follow(pt.x);
          }
          if (p < 1) raf = requestAnimationFrame(tick);
          else {
            setMoving(false);
            setActive(leg.to);
          }
        };
        raf = requestAnimationFrame(tick);
        stopTravel.current = () => cancelAnimationFrame(raf);
      },
      [map, follow, setActive]
    );

    // выбор станции снаружи (строка станций, клик по модулю): импульс
    // приходит туда по её пазу, показ продолжается с неё
    const select = useCallback(
      (id: string) => {
        const i = ROUTE.findIndex((r) => r.to === id);
        if (i < 0) return;
        cursor.current = (i + 1) % ROUTE.length;
        held.current = true;
        travel(i);
      },
      [travel]
    );
    useImperativeHandle(ref, () => ({ select }), [select]);

    // заказ идёт сам: заход → «Сайт» → … → мониторинг → дальше, по кругу
    useEffect(() => {
      if (!map || !inView) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (!active) setActive('site');
        return;
      }
      let timer = 0;
      const next = () => {
        if (held.current) {
          held.current = false;
          timer = window.setTimeout(next, HOLD_MS + TRAVEL_MS);
          return;
        }
        const i = cursor.current;
        travel(i);
        cursor.current = (i + 1) % ROUTE.length;
        timer = window.setTimeout(next, TRAVEL_MS + (ROUTE[i].to ? HOLD_MS : 600));
      };
      timer = window.setTimeout(next, 500);
      return () => {
        clearTimeout(timer);
        stopTravel.current?.();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, inView, travel]);

    useEffect(() => {
      if (active && map) follow(map.modules[active].top[0]);
    }, [active, map, follow]);

    const ids = map ? Object.keys(map.modules) : [];
    const [W, H] = map?.size ?? [1800, 900];
    const L = map?.layers ?? {};
    const src = (name: string) => `${ROOT}/${theme}/${name}.webp`;
    const station = (id: string) => SITE.journey.stations.find((s) => s.id === id);
    const leg = ROUTE[step];
    const dark = theme === 'dark';

    return (
      <div ref={root} className={`order-scheme relative ${className}`}>
        <div
          ref={scroller}
          className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-lenis-prevent-horizontal
          onPointerDown={() => (touched.current = Date.now())}
          onScroll={() => {
            // ручная прокрутка — значит, человек смотрит сам
            if (Date.now() - touched.current < 600) touched.current = Date.now();
          }}
        >
          <div className="relative min-w-[860px] select-none" style={{ aspectRatio: `${W} / ${H}` }}>
            {map && (
              <>
                {/* Рендер растворяется в фон страницы по краям: блик на стекле
                    светлее страницы, и без этого сцена читалась прямоугольником.
                    Подписи лежат вне обёртки — маска их не трогает. */}
                <div className="os-fade absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src('base')} alt="" className="absolute inset-0 h-full w-full" draggable={false} />

                <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
                  <defs>
                    <filter id="os-soft" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="18" />
                    </filter>
                    <g ref={masks}>
                      {Object.entries(map.channels).map(([k, pts]) => (
                        <mask key={k} id={`os-pulse-${k}`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                          <path
                            d={d(pts)}
                            data-pulse={k}
                            pathLength={1}
                            fill="none"
                            stroke="#fff"
                            strokeWidth={PULSE_WIDTH}
                            strokeLinecap="round"
                            strokeDasharray="0 2"
                            filter="url(#os-soft)"
                          />
                        </mask>
                      ))}
                    </g>
                    <mask id="os-scan" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                      <path d={d(map.loop)} className="os-scan" pathLength={1} fill="none" stroke="#fff" strokeWidth={70} strokeLinecap="round" />
                    </mask>
                    {/* края вариантов станций растворяются: вставка не видна даже там,
                        где шумоподавление на краю кадра чуть разошлось с основой */}
                    <radialGradient id="os-feather">
                      <stop offset="0.62" stopColor="#fff" />
                      <stop offset="1" stopColor="#000" />
                    </radialGradient>
                    {ids.map((id) => (
                      <mask key={id} id={`os-feather-${id}`} maskContentUnits="objectBoundingBox">
                        <rect width="1" height="1" fill="url(#os-feather)" />
                      </mask>
                    ))}
                  </defs>

                  {/* обход мониторинга: свет бежит по контуру всегда; когда активна
                      дозорная колонна — контур горит целиком */}
                  <image href={src('lit-loop')} {...boxAttrs(L['lit-loop'])} mask="url(#os-scan)" className="os-breathe" />
                  <image
                    href={src('lit-loop')}
                    {...boxAttrs(L['lit-loop'])}
                    style={{ opacity: active === 'watch' ? 0.85 : 0, transition: 'opacity .8s ease' }}
                  />

                  {/* станции: вариант «горит» проявляется целиком */}
                  {ids.map((id) => (
                    <image
                      key={id}
                      href={src(`lit-${id}`)}
                      {...boxAttrs(L[`lit-${id}`])}
                      mask={`url(#os-feather-${id})`}
                      style={{ opacity: active === id ? 1 : 0, transition: 'opacity .7s ease' }}
                    />
                  ))}

                  {/* ток: вариант «паз горит» под бегущей маской */}
                  {Object.keys(map.channels).map((k) => (
                    <image
                      key={k}
                      href={src(`lit-${k}`)}
                      {...boxAttrs(L[`lit-${k}`])}
                      mask={`url(#os-pulse-${k})`}
                      // доехал — свет в пазу гаснет, загорается станция
                      style={{ opacity: leg?.channel === k && moving ? 1 : 0, transition: `opacity ${moving ? '.12s' : '.9s'} ease` }}
                    />
                  ))}
                </svg>

                {/* Ореол: тот же свет, размытый и положенный экраном. В рендере
                    свечения нет — без ореола импульс читался тонкой линией.
                    Только в тёмной теме: на белом стекле экран ничего не даёт. */}
                {dark && (
                  <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full mix-blend-screen" aria-hidden>
                    <defs>
                      <filter id="os-bloom" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="16" />
                      </filter>
                    </defs>
                    {Object.keys(map.channels).map((k) => (
                      <image
                        key={k}
                        href={src(`lit-${k}`)}
                        {...boxAttrs(L[`lit-${k}`])}
                        mask={`url(#os-pulse-${k})`}
                        filter="url(#os-bloom)"
                        style={{ opacity: leg?.channel === k && moving ? 0.9 : 0, transition: `opacity ${moving ? '.12s' : '.9s'} ease` }}
                      />
                    ))}
                    {ids.map((id) => (
                      <image
                        key={id}
                        href={src(`lit-${id}`)}
                        {...boxAttrs(L[`lit-${id}`])}
                        mask={`url(#os-feather-${id})`}
                        filter="url(#os-bloom)"
                        style={{ opacity: active === id ? 0.45 : 0, transition: 'opacity .7s ease' }}
                      />
                    ))}
                  </svg>
                )}
                </div>

                {/* луч и пылинки из «Kling» — только в тёмной теме */}
                {dark && (
                  <div className="os-shaft pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                    <div className="os-beam" />
                    {DUST.map((p, i) => (
                      <i
                        key={i}
                        className="os-dust"
                        style={{
                          left: `${p.x}%`,
                          top: `${p.y}%`,
                          width: p.s,
                          height: p.s,
                          filter: p.blur ? 'blur(2px)' : undefined,
                          animationDuration: `${p.dur}s`,
                          animationDelay: `${p.delay}s`
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* подписи, выноска активной станции */}
                {ids.map((id) => {
                  const m = map.modules[id];
                  const st = station(id);
                  const on = active === id;
                  // у правого края кадра подпись встаёт слева от модуля
                  const flip = m.label[0] > W * 0.82;
                  const lab = flip ? m.labelLeft : m.label;
                  // у верхнего края выноске над крышкой некуда — она под подписью
                  const low = m.peak[1] < H * 0.18;
                  const callout = low
                    ? { left: pct(lab[0], W), top: pct(lab[1], H), transform: `translate(${flip ? 'calc(-100% - 12px)' : '12px'}, ${on ? '18px' : '10px'})` }
                    : { left: pct(m.peak[0], W), top: pct(m.peak[1], H), transform: `translate(-50%, ${on ? 'calc(-100% - 16px)' : 'calc(-100% - 6px)'})` };
                  return (
                    <div key={id}>
                      <span
                        // на телефоне сцена шире экрана, и пять подписей теснились
                        // с выноской: там видна только подпись активной станции
                        className={`pointer-events-none absolute -translate-y-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-rail transition-[color,opacity] duration-500 ${
                          flip ? '-translate-x-full pr-3' : 'pl-3'
                        } ${on ? '' : 'max-sm:opacity-0'}`}
                        style={{ left: pct(lab[0], W), top: pct(lab[1], H), color: on ? 'var(--fg)' : 'var(--fg-dim)' }}
                      >
                        <b className="font-normal text-faint">{st?.n}</b> {st?.name}
                      </span>
                      {st && (
                        <div
                          className="glass pointer-events-none absolute whitespace-nowrap rounded-[10px] px-3 py-2 text-[12px] leading-snug transition-[opacity,transform] duration-500"
                          style={{ ...callout, opacity: on ? 1 : 0 }}
                        >
                          <span className="block font-mono text-[9px] uppercase tracking-rail text-faint">{st.role}</span>
                          {st.event}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* жетон заказа едет за головой импульса */}
                <div
                  ref={token}
                  className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-[170%] items-center gap-2 whitespace-nowrap rounded-full border border-line-strong bg-bg/80 py-1 pl-1 pr-3 text-[11px] backdrop-blur transition-opacity duration-300"
                  style={{ opacity: moving && leg?.channel !== 'guard' ? 1 : 0 }}
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
                      onClick={() => select(id)}
                    >
                      <title>{station(id)?.name}</title>
                    </polygon>
                  ))}
                </svg>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
);

function boxAttrs(b?: Box) {
  return b ? { x: b.x, y: b.y, width: b.w, height: b.h, preserveAspectRatio: 'none' } : {};
}

export default OrderScheme;
