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

/**
 * Тех-строка узла переносится по ширине рамки.
 *
 * Подписи набраны моноширинным, поэтому ширину можно считать точно, не
 * измеряя: при 9.5px с трекингом 0.14em знак занимает ровно 7.05 единицы
 * viewBox. Раньше строка шла одной линией и вылезала за рамку узла —
 * «ЭКВАЙРИНГ · CRM · ДОСТАВКА» на 183 единицы при доступных 146, — а у
 * крайнего справа узла обрезалась ещё и краем схемы. На приборе подпись
 * не может лежать поверх соседней рамки, иначе это снова блок-схема.
 */
const TECH_CH = 7.05;
const TECH_PAD = 14;

function techLines(tech: string, boxWidth: number): string[] {
  const budget = Math.floor((boxWidth - TECH_PAD * 2) / TECH_CH);
  const lines: string[] = [];
  for (const part of tech.split(' · ')) {
    const last = lines[lines.length - 1];
    if (last && last.length + 3 + part.length <= budget) lines[lines.length - 1] = `${last} · ${part}`;
    else lines.push(part);
  }
  return lines;
}

/** Сколько держится один шаг, пока схема проигрывается сама. */
const STEP_MS = 3800;

export default function Anatomy() {
  const section = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [inView, setInView] = useState(false);
  const [held, setHeld] = useState(false);

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

  /**
   * Узел объявлен кнопкой, значит обязан что-то делать: клик и Enter
   * переводят схему на шаг, в котором этот слой участвует, и останавливают
   * автопрокрутку — так же, как клик по шагу слева. Раньше роль обещала
   * действие, которого не было.
   */
  const selectNode = (id: string) => {
    const i = steps.findIndex((s) => (s.nodes as readonly string[]).includes(id));
    if (i >= 0) setStep(i);
    setHeld(true);
  };

  const linkOn = (from: string, to: string) => {
    if (hovered === 'ops') return false;
    return activeIds.has(from) && activeIds.has(to);
  };

  /**
   * Строка осмотра всегда несёт содержание. Раньше в покое она держала
   * инструкцию «наведите на слой» — подсказку к тому, что и так видно:
   * слой под курсором подсвечивается сам. Теперь в покое показан слой,
   * на который пришёл текущий шаг, и строка живёт вместе со схемой.
   */
  const inspected = useMemo(() => {
    if (hovered) return byId.get(hovered) ?? null;
    const chain = steps[step]?.nodes ?? [];
    return byId.get(chain[chain.length - 1] ?? '') ?? null;
  }, [hovered, step, steps, byId]);

  /**
   * Появление схемы. Рамка панели и раньше раскрывалась по скроллу, но
   * содержимое внутри было готовым с первого кадра — прибор возникал
   * собранным. Теперь он собирается по тому самому потоку, который
   * объясняет: слои встают слева направо, связи протягиваются следом.
   * Один раз, на входе секции в экран.
   */
  useEffect(() => {
    const el = section.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const panel = el.querySelector<HTMLElement>('[data-panel]');
        if (!panel) return;

        // порядок сборки — порядок потока, а не порядок в разметке
        const nodeEls = [...CHAIN, 'ops']
          .map((id) => el.querySelector<SVGGElement>(`[data-node="${id}"]`))
          .filter((n): n is SVGGElement => Boolean(n));

        const onPanel = { trigger: panel, start: 'top 82%', once: true } as const;

        if (nodeEls.length) {
          gsap.from(nodeEls, {
            opacity: 0,
            duration: 0.4,
            delay: 0.15,
            ease: 'power2.out',
            stagger: 0.09,
            scrollTrigger: onPanel
          });
        }

        const links = el.querySelectorAll<SVGGElement>('[data-link]');
        if (links.length) {
          gsap.from(links, {
            opacity: 0,
            duration: 0.5,
            delay: 0.45,
            ease: 'none',
            stagger: 0.09,
            scrollTrigger: onPanel
          });
        }

        // на узкой колонке схемы нет — там собирается разрез слоёв
        const rows = el.querySelectorAll<HTMLElement>('[data-row]');
        if (rows.length) {
          gsap.from(rows, {
            opacity: 0,
            y: 10,
            duration: 0.45,
            delay: 0.1,
            ease: 'power2.out',
            stagger: 0.06,
            scrollTrigger: onPanel
          });
        }

        const steps = el.querySelectorAll<HTMLElement>('[data-step]');
        if (steps.length) {
          gsap.from(steps, {
            opacity: 0,
            y: 12,
            duration: 0.5,
            ease: 'power2.out',
            stagger: 0.07,
            scrollTrigger: { trigger: el, start: 'top 82%', once: true }
          });
        }
      });
    }, el);

    return () => ctx.revert();
  }, []);

  // Секция больше не занимает два экрана скролла: шаги проигрываются сами,
  // пока схема на экране, и замирают, когда её рассматривают.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 70%',
      end: 'bottom 30%',
      onToggle: (self) => setInView(self.isActive)
    });
    return () => trigger.kill();
  }, []);

  /**
   * Первое наведение на схему останавливает прокрутку шагов насовсем:
   * человек начал рассматривать — торопить его нечем. Раньше пауза
   * снималась только кликом по шагу, а уводя курсор, читающий снова
   * получал смену кадра через 3.8 с.
   */
  useEffect(() => {
    if (!hovered) return;
    setHeld(true);
  }, [hovered]);

  useEffect(() => {
    if (!inView || held || hovered) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      setStep((prev) => (prev + 1) % steps.length);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [inView, held, hovered, steps.length]);

  return (
    <section
      ref={section}
      data-chapter="anatomy"
      className="relative z-10 w-full"
      aria-label="Анатомия проекта"
    >

      <div data-recede className="flex flex-col justify-center gap-[clamp(24px,5vh,56px)] px-4 py-[12vh] sm:px-8 lg:px-[56px]">
        <div>
          <div className="flex items-center justify-between gap-4">
            <span className="rail-label">{SITE.anatomy.label}</span>
            {/* Пауза тем же приёмом, что в карусели направлений: на сайте
                две вещи крутятся сами, и останавливаться они должны
                одинаково. */}
            <button
              type="button"
              onClick={() => setHeld((v) => !v)}
              aria-label={held ? 'Продолжить показ шагов' : 'Остановить показ шагов'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
            >
              {held ? (
                <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                  <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                  <rect x="2" y="1.5" width="2.6" height="9" fill="currentColor" />
                  <rect x="7.4" y="1.5" width="2.6" height="9" fill="currentColor" />
                </svg>
              )}
            </button>
          </div>
          <h2 data-skew className="display m-0 mt-4 text-[clamp(28px,5vw,76px)]">
            {SITE.anatomy.title} <span className="title-accent">{SITE.anatomy.titleAccent}</span>
          </h2>
        </div>

        <div className="grid gap-[clamp(20px,4vh,44px)] xl:grid-cols-[minmax(200px,264px)_1fr] xl:items-center xl:gap-10">
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {steps.map((s, i) => {
              const on = i === step;
              return (
                <li key={s.n} data-step className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(i);
                      setHeld(true);
                    }}
                    className="block w-full border-l pl-4 text-left transition-colors duration-500"
                    style={{ borderColor: on ? 'var(--accent)' : 'var(--line)' }}
                    aria-current={on || undefined}
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
                    // 0.35 поверх text-dim давали ~1.6:1 — текст неактивного
                    // шага не читался вовсе, а через 3.8 с он станет активным
                    style={{ opacity: on ? 1 : 0.55 }}
                  >
                    {s.text}
                  </p>
                  {/* полоса таймера: видно, что шаг сменится сам */}
                  <span
                    className="mt-3 block h-px w-full origin-left bg-accent"
                    style={{
                      transform: `scaleX(${on ? 1 : 0})`,
                      opacity: on ? 0.8 : 0,
                      transition: on && !held && !hovered
                        ? `transform ${STEP_MS}ms linear, opacity .3s`
                        : 'transform .3s, opacity .3s'
                    }}
                    aria-hidden
                  />
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Панель-прибор: рамка, шапка с плоскостями, поле схемы, строка осмотра */}
          {/* стекло: сквозь панель виден тот же материал, что под всей страницей */}
          <div
            data-panel
            data-reveal="clip"
            className="relative min-w-0 overflow-hidden rounded-lg border border-line bg-bg/60 backdrop-blur-xl"
          >
            <div className="relative">
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
                      data-row
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
                          style={{ opacity: on ? 1 : 0.55 }}
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
                      <g key={`${l.from}-${l.to}`} data-link>
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
                        data-node={n.id}
                        data-on={on || undefined}
                        onMouseEnter={() => setHovered(n.id)}
                        onMouseLeave={() => setHovered((cur) => (cur === n.id ? null : cur))}
                        onFocus={() => setHovered(n.id)}
                        onBlur={() => setHovered((cur) => (cur === n.id ? null : cur))}
                        onClick={() => selectNode(n.id)}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return;
                          e.preventDefault();
                          selectNode(n.id);
                        }}
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
                        {/* у широкого узла глиф и заголовок стоят в одну
                            строку, поэтому глиф опущен по центру полосы, а
                            заголовок сдвинут вправо: при общем отступе
                            иконка ложилась прямо на «М» слова «Мониторинг» */}
                        <Glyph id={n.id} x={n.x + 14} y={n.y + (wide ? 20 : 14)} />
                        <text x={n.x + n.w - 14} y={n.y + 28} className="node-id">
                          {wide ? '00' : String(CHAIN.indexOf(n.id) + 1).padStart(2, '0')}
                        </text>
                        <text
                          x={n.x + (wide ? 50 : 14)}
                          y={wide ? n.y + 40 : n.y + 62}
                          className="node-title"
                        >
                          {'short' in n ? n.short : n.title}
                        </text>
                        {!wide && <path d={`M${n.x + 14} ${n.y + 76} H${n.x + n.w - 14}`} className="node-div" />}
                        {/* широкому узлу переносить нечего: у него 790 единиц ширины */}
                        {wide ? (
                          <text x={n.x + 172} y={n.y + 40} className="node-tech">
                            {n.tech}
                          </text>
                        ) : (
                          techLines(n.tech, n.w).map((line, i) => (
                            <text key={line} x={n.x + 14} y={n.y + 94 + i * 13} className="node-tech">
                              {line}
                            </text>
                          ))
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* строка осмотра живёт внутри прибора, а не под ним */}
            <div className="hidden min-h-[64px] items-start border-t border-line px-4 py-3 sm:px-5 xl:flex">
              {inspected && (
                <div>
                  <span className="font-mono text-[10px] tracking-rail text-accent">
                    {inspected.title} · {inspected.tech}
                  </span>
                  <p className="m-0 mt-1.5 max-w-[68ch] text-[clamp(12px,1vw,14px)] leading-relaxed text-dim">
                    {inspected.desc}
                  </p>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
