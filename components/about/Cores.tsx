'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MARK_ARMS } from '../mark-geometry';
import { ABOUT } from '@/content/about';
import Words from '../Words';

gsap.registerPlugin(ScrollTrigger);

/**
 * Три ядра.
 *
 * Триада живёт на сайте в трёх местах: рельс первого экрана называет её,
 * манифест ею говорит, а здесь она наконец показывается. Показывать её
 * есть чем: знак и есть три одинаковых элемента, повёрнутых на 120°, —
 * метафора не придумана к логотипу, а вынута из него.
 *
 * Поэтому ядро подсвечивается не плашкой, а своим лучом в знаке: читаешь
 * «Честность» — горит луч честности, остальные два уходят в тень. Порядок
 * лучей в `mark-geometry` совпадает с порядком ядер, и это не совпадение:
 * генератор знака назвал их теми же именами.
 *
 * На широком экране знак один и закреплён сбоку. На телефоне закреплённая
 * полоса со знаком ложилась поверх текста ядра и показывала номер того,
 * что уже уехало, — там у каждого ядра свой знак в строке заголовка,
 * подсвеченный своим лучом. Метафора та же, накладок нет.
 */

/** Знак с одним горящим лучом. Остальные два уходят в тень, а не исчезают:
    фигура держится тремя, и это всё сообщение. */
function ArmMark({ at, className }: { at: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {MARK_ARMS.map((a, i) => (
        <g
          key={a.arm}
          style={{
            fill: i === at ? 'var(--accent)' : 'currentColor',
            opacity: i === at ? 1 : 0.22,
            transition: 'opacity .7s ease, fill .7s ease'
          }}
        >
          {a.facets.map((f) => (
            <path key={f.facet} d={f.d} fillOpacity={f.opacity} />
          ))}
        </g>
      ))}
    </svg>
  );
}
export default function Cores() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      el.querySelectorAll<HTMLElement>('[data-core]').forEach((block, i) => {
        ScrollTrigger.create({
          trigger: block,
          // середина экрана: ядро загорается, когда его текст в чтении
          start: 'top 62%',
          end: 'bottom 62%',
          onToggle: (self) => {
            if (self.isActive) setActive(i);
          }
        });
      });
    }, el);

    return () => ctx.revert();
  }, []);

  const arm = MARK_ARMS[active];

  return (
    <section ref={root} data-chapter="manifesto" className="relative z-10 w-full border-t border-line" aria-label={ABOUT.cores.label}>
      <div className="px-4 section-y sm:px-8 lg:px-[72px]">
        <span className="rail-label">{ABOUT.cores.label}</span>
        <div className="mt-4 grid gap-[clamp(16px,3vh,32px)] lg:grid-cols-[1.7fr_1fr] lg:items-end">
          <h2 className="display m-0 text-[clamp(26px,4.2vw,64px)]">
            {ABOUT.cores.title} <span className="title-accent">{ABOUT.cores.titleAccent}</span>
          </h2>
          <p className="m-0 max-w-[40ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">{ABOUT.cores.text}</p>
        </div>

        <div className="mt-[clamp(28px,5vh,64px)] grid gap-[clamp(20px,4vh,48px)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] lg:gap-[clamp(40px,5vw,96px)]">
          {/* ---------- знак ---------- */}
          <div className="hidden lg:sticky lg:top-[24vh] lg:block lg:self-start">
            <ArmMark at={active} className="w-full max-w-[320px] text-fg" />
            <p className="sr-only">Подсвечено ядро «{arm.core}»</p>
            <div className="mt-8">
              <span className="rail-label">
                <b>{ABOUT.cores.detail[active].n}</b> / 03
              </span>
              <p className="m-0 mt-3 text-[clamp(16px,1.6vw,24px)] font-medium leading-none">{arm.core}</p>
            </div>
          </div>

          {/* ---------- ядра ---------- */}
          <ol className="m-0 list-none p-0">
            {ABOUT.cores.detail.map((c, i) => (
              <li
                key={c.n}
                data-core
                className="border-t border-line py-[clamp(28px,6vh,72px)] last:border-b lg:min-h-[52vh] lg:py-[clamp(40px,8vh,96px)]"
              >
                <div className="flex items-center gap-4 lg:items-baseline">
                  <ArmMark at={i} className="h-10 w-10 shrink-0 text-fg lg:hidden" />
                  <span
                    className="hidden font-mono text-[11px] tracking-rail transition-colors duration-500 lg:inline"
                    style={{ color: i === active ? 'var(--accent)' : 'var(--fg-faint)' }}
                  >
                    {c.n}
                  </span>
                  <h3 className="display m-0 text-[clamp(24px,3.4vw,52px)]">{c.name}</h3>
                </div>
                <p className="m-0 mt-5 max-w-[52ch] text-[clamp(14px,1.25vw,18px)] leading-relaxed text-dim">
                  <Words text={c.text} />
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
