'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

type Node = (typeof SITE.anatomy.nodes)[number];

const VIEW = { w: 1240, h: 320 };

/** Дорожка между слоями: выход из правого края в левый край следующего. */
function linkPath(a: Node, b: Node) {
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  const mid = (x1 + x2) / 2;
  return `M${x1} ${y1} H${mid} V${y2} H${x2}`;
}

/** Связь контура наблюдения со слоем: сверху вниз, штрихом. */
function watchPath(ops: Node, target: Node) {
  const x = target.x + target.w / 2;
  return `M${x} ${ops.y + ops.h} V${target.y}`;
}

export default function Anatomy() {
  const section = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  const { nodes, links, steps } = SITE.anatomy;
  // ключи — обычные строки: id приходят и из наведения, и из списков шагов
  const byId = useMemo(() => new Map<string, Node>(nodes.map((n) => [n.id, n])), [nodes]);
  const ops = byId.get('ops')!;

  // Активны слои текущего шага; наведение имеет приоритет над скроллом.
  const activeIds = useMemo(() => {
    if (hovered) return new Set([hovered]);
    return new Set<string>(steps[step]?.nodes ?? []);
  }, [hovered, step, steps]);

  const inspected = hovered ? byId.get(hovered) : null;

  useEffect(() => {
    const el = section.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Десктоп: схема закреплена, шаги переключаются по скроллу.
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const trigger = ScrollTrigger.create({
          trigger: el,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            const next = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
            setStep(next);
          }
        });
        return () => trigger.kill();
      });

      // Мобильный: шаги идут карточками, схема прокручивается по горизонтали.
      mm.add('(max-width: 1023px)', () => {
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
      className="relative z-10 w-full bg-bg lg:h-[240svh]"
      aria-label="Анатомия проекта"
    >
      {/* материал манифеста растворяется в секции, а не обрезается линией */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[22vh] -translate-y-full"
        style={{ background: 'linear-gradient(180deg, rgb(5 6 8 / 0) 0%, rgb(5 6 8 / 0.65) 55%, var(--bg) 100%)' }}
        aria-hidden
      />
      <div className="flex min-h-[100svh] flex-col justify-center gap-[clamp(24px,5vh,56px)] px-4 py-[14vh] sm:px-8 lg:sticky lg:top-0 lg:px-[72px] lg:py-[12vh]">
        <div>
          <span className="rail-label">{SITE.anatomy.label}</span>
          <h2 className="display m-0 mt-4 text-[clamp(28px,5vw,76px)]">{SITE.anatomy.title}</h2>
        </div>

        <div className="grid gap-[clamp(20px,4vh,44px)] lg:grid-cols-[minmax(220px,300px)_1fr] lg:items-center lg:gap-12">
          {/* шаги: на десктопе ведёт скролл, на мобильном — карточки */}
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
                    className="m-0 mt-1.5 max-w-[34ch] text-[clamp(12px,1vw,14px)] leading-relaxed transition-all duration-500"
                    style={{ color: 'var(--fg-dim)', opacity: on ? 1 : 0.35 }}
                  >
                    {s.text}
                  </p>
                </li>
              );
            })}
          </ol>

          {/* схема */}
          <div className="relative min-w-0">
            {/* до 1024px широкая схема нечитаема: 1240 единиц viewBox сжались бы
                в пару сотен пикселей. Вместо неё — вертикальный разрез слоёв. */}
            <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:hidden">
              {nodes.map((n) => {
                const on = activeIds.has(n.id);
                return (
                  <li
                    key={n.id}
                    className="border-l-2 bg-elev px-4 py-3 transition-colors duration-500"
                    style={{ borderColor: on ? 'var(--accent)' : 'var(--line)' }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
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
                  </li>
                );
              })}
            </ul>

            <div className="hidden lg:block">
              <svg
                viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
                className="block h-auto w-[860px] lg:w-full"
                role="img"
                aria-label="Схема: посетитель, фронт, контент и каталог, автоматизация, платежи и CRM, поверх — контур наблюдения"
              >
                {/* подписи плоскостей */}
                <text x="24" y="16" className="plane-label">
                  {SITE.anatomy.planes.top}
                </text>
                <text x="24" y={VIEW.h - 10} className="plane-label">
                  {SITE.anatomy.planes.bottom}
                </text>

                {/* связи контура наблюдения */}
                {['front', 'data', 'auto', 'money'].map((id) => {
                  const target = byId.get(id)!;
                  const on = hovered
                    ? hovered === 'ops' || hovered === id
                    : activeIds.has('ops') && activeIds.has(id);
                  return (
                    <path
                      key={`watch-${id}`}
                      d={watchPath(ops, target)}
                      className="watch-line"
                      data-on={on || undefined}
                    />
                  );
                })}

                {/* дорожки данных: тонкая линия плюс бегущий по ней импульс */}
                {links.map((l, i) => {
                  const a = byId.get(l.from)!;
                  const b = byId.get(l.to)!;
                  const d = linkPath(a, b);
                  // при осмотре слоя его дорожки остаются живыми, иначе схема
                  // под курсором выглядит выключенной
                  const on = hovered
                    ? l.from === hovered || l.to === hovered
                    : activeIds.has(l.from) && activeIds.has(l.to);
                  return (
                    <g key={`${l.from}-${l.to}`}>
                      <path d={d} className="link-base" data-on={on || undefined} />
                      <path
                        d={d}
                        className="link-pulse"
                        data-on={on || undefined}
                        style={{ animationDelay: `${i * 0.55}s` }}
                      />
                    </g>
                  );
                })}

                {/* слои */}
                {nodes.map((n) => {
                  const on = activeIds.has(n.id);
                  return (
                    <g
                      key={n.id}
                      className="node"
                      data-on={on || undefined}
                      data-group={n.group}
                      onMouseEnter={() => setHovered(n.id)}
                      onMouseLeave={() => setHovered((cur) => (cur === n.id ? null : cur))}
                      onFocus={() => setHovered(n.id)}
                      onBlur={() => setHovered((cur) => (cur === n.id ? null : cur))}
                      tabIndex={0}
                      role="button"
                      aria-label={`${n.title}. ${n.desc}`}
                    >
                      <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="3" className="node-box" />
                      <text x={n.x + 18} y={n.y + 38} className="node-title">
                        {n.title}
                      </text>
                      <text x={n.x + 18} y={n.y + 62} className="node-tech">
                        {n.tech}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* панель осмотра: на месте подсказки появляется состав слоя */}
            <div className="mt-4 hidden min-h-[68px] border-t border-line pt-4 lg:block">
              {inspected ? (
                <div>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-[10px] tracking-rail text-accent">
                      {inspected.tech}
                    </span>
                  </div>
                  <p className="m-0 mt-2 max-w-[60ch] text-[clamp(12px,1vw,15px)] leading-relaxed text-dim">
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
