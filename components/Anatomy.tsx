'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Glyph from './anatomy-glyphs';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

type Node = (typeof SITE.anatomy.nodes)[number];

const VIEW = { w: 1000, h: 280 };
/** Порядок потока: наведение на слой подсвечивает весь путь до него. */
const CHAIN = ['visitor', 'front', 'data', 'auto', 'money'];

function linkPath(a: Node, b: Node) {
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  const mid = (x1 + x2) / 2;
  return `M${x1} ${y1} H${mid} V${y2} H${x2}`;
}

function watchPath(ops: Node, target: Node) {
  const x = target.x + target.w / 2;
  return `M${x} ${ops.y + ops.h} V${target.y}`;
}

/** Угловые засечки: дешёвая деталь, от которой схема читается прибором. */
function Ticks({ n, len = 8 }: { n: Node; len?: number }) {
  const { x, y, w, h } = n;
  return (
    <g className="node-ticks" aria-hidden>
      <path d={`M${x} ${y + len} V${y} H${x + len}`} />
      <path d={`M${x + w - len} ${y} H${x + w} V${y + len}`} />
      <path d={`M${x + w} ${y + h - len} V${y + h} H${x + w - len}`} />
      <path d={`M${x + len} ${y + h} H${x} V${y + h - len}`} />
    </g>
  );
}

export default function Anatomy() {
  const section = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  const { nodes, links, steps, panel } = SITE.anatomy;
  const byId = useMemo(() => new Map<string, Node>(nodes.map((n) => [n.id, n])), [nodes]);
  const ops = byId.get('ops')!;

  /** Наведение имеет приоритет над скроллом и тянет за собой весь путь. */
  const activeIds = useMemo(() => {
    if (hovered) {
      if (hovered === 'ops') return new Set<string>(['ops', ...CHAIN]);
      const upto = CHAIN.indexOf(hovered);
      return new Set<string>(upto >= 0 ? CHAIN.slice(0, upto + 1) : [hovered]);
    }
    return new Set<string>(steps[step]?.nodes ?? []);
  }, [hovered, step, steps]);

  const linkOn = (from: string, to: string) => {
    if (hovered === 'ops') return false;
    return activeIds.has(from) && activeIds.has(to);
  };

  const inspected = hovered ? byId.get(hovered) : null;

  useEffect(() => {
    const el = section.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(min-width: 1280px) and (prefers-reduced-motion: no-preference)', () => {
        const trigger = ScrollTrigger.create({
          trigger: el,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            setStep(Math.min(steps.length - 1, Math.floor(self.progress * steps.length)));
          }
        });
        return () => trigger.kill();
      });

      mm.add('(max-width: 1279px)', () => {
        const triggers = steps.map((_, i) =>
          ScrollTrigger.create({
            trigger: el.querySelectorAll('[data-step]')[i],
            start: 'top 70%',
            end: 'bottom 30%',
            onEnter: () => setStep(i),
            onEnterBack: () => setStep(i)
          })
        );
        return () => triggers.forEach((t) => t.kill());
      });
    }, el);

    return () => ctx.revert();
  }, [steps]);

  return (
    <section
      ref={section}
      className="relative z-10 w-full bg-bg xl:h-[240svh]"
      aria-label="Анатомия проекта"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[22vh] -translate-y-full"
        style={{
          background:
            'linear-gradient(180deg, rgb(5 6 8 / 0) 0%, rgb(5 6 8 / 0.65) 55%, var(--bg) 100%)'
        }}
        aria-hidden
      />

      <div className="flex min-h-[100svh] flex-col justify-center gap-[clamp(24px,5vh,56px)] px-4 py-[14vh] sm:px-8 xl:sticky xl:top-0 lg:px-[56px] xl:py-[12vh]">
        <div>
          <span className="rail-label">{SITE.anatomy.label}</span>
          <h2 className="display m-0 mt-4 text-[clamp(28px,5vw,76px)]">{SITE.anatomy.title}</h2>
        </div>

        <div className="grid gap-[clamp(20px,4vh,44px)] xl:grid-cols-[minmax(200px,264px)_1fr] xl:items-center xl:gap-10">
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {steps.map((s, i) => {
              const on = i === step;
              return (
                <li
                  key={s.n}
                  data-step
                  className="border-l pl-4 transition-colors duration-500"
                  style={{ borderColor: on ? 'var(--accent)' : 'var(--line)' }}
                >
                  <div className="flex items-baseline gap-3">
                    <span
                      className="font-mono text-[10px] tracking-rail transition-colors duration-500"
                      style={{ color: on ? 'var(--accent)' : 'var(--fg-faint)' }}
                    >
                      {s.n}
                    </span>
                    <span
                      className="text-[clamp(15px,1.4vw,20px)] font-medium transition-colors duration-500"
                      style={{ color: on ? 'var(--fg)' : 'var(--fg-faint)' }}
                    >
                      {s.title}
                    </span>
                  </div>
                  <p
                    className="m-0 mt-1.5 max-w-[34ch] text-[clamp(12px,1vw,14px)] leading-relaxed text-dim transition-opacity duration-500"
                    style={{ opacity: on ? 1 : 0.35 }}
                  >
                    {s.text}
                  </p>
                </li>
              );
            })}
          </ol>

          {/* Панель-прибор: рамка, шапка с плоскостями, поле схемы, строка осмотра */}
          <div className="min-w-0 border border-line bg-elev/40">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
              <span className="font-mono text-[10px] uppercase tracking-rail text-fg">
                {panel.title}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="border px-2 py-1 font-mono text-[9px] uppercase tracking-rail transition-colors duration-500"
                  style={{
                    borderColor: activeIds.has('ops') ? 'var(--accent)' : 'var(--line)',
                    color: activeIds.has('ops') ? 'var(--accent)' : 'var(--fg-faint)'
                  }}
                >
                  {SITE.anatomy.planes.top}
                </span>
                <span className="border border-line px-2 py-1 font-mono text-[9px] uppercase tracking-rail text-faint">
                  {SITE.anatomy.planes.bottom}
                </span>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-rail text-faint">
                {panel.meta}
              </span>
            </div>

            <div className="px-3 py-4 sm:px-5">
              {/* до 1024px широкая схема нечитаема: вместо неё разрез слоёв */}
              <ul className="m-0 flex list-none flex-col gap-2 p-0 xl:hidden">
                {nodes.map((n) => {
                  const on = activeIds.has(n.id);
                  return (
                    <li
                      key={n.id}
                      className="flex gap-3 border-l-2 bg-elev px-3 py-3 transition-colors duration-500"
                      style={{ borderColor: on ? 'var(--accent)' : 'var(--line)' }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="mt-0.5 h-5 w-5 shrink-0"
                        fill="none"
                        stroke={on ? 'var(--accent)' : 'var(--fg-faint)'}
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <Glyph id={n.id} x={0} y={0} />
                      </svg>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <span
                            className="text-[15px] font-medium transition-colors duration-500"
                            style={{ color: on ? 'var(--fg)' : 'var(--fg-faint)' }}
                          >
                            {n.title}
                          </span>
                          <span
                            className="font-mono text-[9px] tracking-rail transition-colors duration-500"
                            style={{ color: on ? 'var(--accent)' : 'var(--fg-faint)' }}
                          >
                            {n.tech}
                          </span>
                        </div>
                        <p
                          className="m-0 mt-1.5 text-[12px] leading-relaxed text-dim transition-opacity duration-500"
                          style={{ opacity: on ? 1 : 0.4 }}
                        >
                          {n.desc}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden xl:block">
                <svg
                  viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
                  className="block h-auto w-full"
                  role="img"
                  aria-label="Схема: посетитель, фронт, контент и каталог, автоматизация, платежи и CRM, поверх — контур наблюдения"
                >
                  <defs>
                    <pattern id="ct-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="1" cy="1" r="1" className="grid-dot" />
                    </pattern>
                    <linearGradient id="ct-node" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(255 255 255 / 0.045)" />
                      <stop offset="100%" stopColor="rgb(255 255 255 / 0.012)" />
                    </linearGradient>
                    <filter id="ct-glow" x="-40%" y="-400%" width="180%" height="900%">
                      <feGaussianBlur stdDeviation="3" />
                    </filter>
                    <marker
                      id="ct-arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M0 1 L9 5 L0 9 Z" className="arrow-idle" />
                    </marker>
                    <marker
                      id="ct-arrow-on"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6.5"
                      markerHeight="6.5"
                      orient="auto-start-reverse"
                    >
                      <path d="M0 1 L9 5 L0 9 Z" className="arrow-on" />
                    </marker>
                  </defs>

                  <rect width={VIEW.w} height={VIEW.h} fill="url(#ct-grid)" />

                  {['front', 'data', 'auto', 'money'].map((id) => {
                    const target = byId.get(id)!;
                    const on = activeIds.has('ops') && activeIds.has(id);
                    return (
                      <path
                        key={`watch-${id}`}
                        d={watchPath(ops, target)}
                        className="watch-line"
                        data-on={on || undefined}
                      />
                    );
                  })}

                  {links.map((l, i) => {
                    const a = byId.get(l.from)!;
                    const b = byId.get(l.to)!;
                    const d = linkPath(a, b);
                    const on = linkOn(l.from, l.to);
                    const labelX = (a.x + a.w + b.x) / 2;
                    const labelY = a.y + a.h / 2 - 11;
                    return (
                      <g key={`${l.from}-${l.to}`}>
                        <path
                          d={d}
                          className="link-base"
                          data-on={on || undefined}
                          markerEnd={on ? 'url(#ct-arrow-on)' : 'url(#ct-arrow)'}
                        />
                        {/* шлейф и ядро пакета: свечение отдельным размытым штрихом */}
                        <path
                          d={d}
                          className="link-trail"
                          data-on={on || undefined}
                          filter="url(#ct-glow)"
                          style={{ animationDelay: `${i * 0.55}s` }}
                        />
                        <path
                          d={d}
                          className="link-pulse"
                          data-on={on || undefined}
                          style={{ animationDelay: `${i * 0.55}s` }}
                        />
                        <text x={labelX} y={labelY} className="link-label" data-on={on || undefined}>
                          {l.label}
                        </text>
                      </g>
                    );
                  })}

                  {nodes.map((n) => {
                    const on = activeIds.has(n.id);
                    const wide = n.id === 'ops';
                    return (
                      <g
                        key={n.id}
                        className="node"
                        data-on={on || undefined}
                        onMouseEnter={() => setHovered(n.id)}
                        onMouseLeave={() => setHovered((cur) => (cur === n.id ? null : cur))}
                        onFocus={() => setHovered(n.id)}
                        onBlur={() => setHovered((cur) => (cur === n.id ? null : cur))}
                        tabIndex={0}
                        role="button"
                        aria-label={`${n.title}. ${n.desc}`}
                      >
                        <rect x={n.x} y={n.y} width={n.w} height={n.h} className="node-box" />
                        <rect
                          x={n.x + 4}
                          y={n.y + 4}
                          width={n.w - 8}
                          height={n.h - 8}
                          className="node-inner"
                        />
                        <Ticks n={n} />
                        <Glyph id={n.id} x={n.x + 14} y={n.y + 14} />
                        <text x={n.x + n.w - 14} y={n.y + 28} className="node-id">
                          {wide ? '00' : String(CHAIN.indexOf(n.id) + 1).padStart(2, '0')}
                        </text>
                        <text x={n.x + 14} y={wide ? n.y + 40 : n.y + 66} className="node-title">
                          {n.title}
                        </text>
                        {!wide && <path d={`M${n.x + 14} ${n.y + 80} H${n.x + n.w - 14}`} className="node-div" />}
                        <text
                          x={wide ? n.x + 168 : n.x + 14}
                          y={wide ? n.y + 40 : n.y + 100}
                          className="node-tech"
                        >
                          {n.tech}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* строка осмотра живёт внутри прибора, а не под ним */}
            <div className="hidden min-h-[64px] items-start border-t border-line px-4 py-3 sm:px-5 xl:flex">
              {inspected ? (
                <div>
                  <span className="font-mono text-[10px] tracking-rail text-accent">
                    {inspected.tech}
                  </span>
                  <p className="m-0 mt-1.5 max-w-[68ch] text-[clamp(12px,1vw,14px)] leading-relaxed text-dim">
                    {inspected.desc}
                  </p>
                </div>
              ) : (
                <span className="rail-label">{SITE.anatomy.hint}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
