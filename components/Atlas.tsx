'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Material from './Material';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

/**
 * Атлас направлений полосами: медиа с одной стороны, текст с другой,
 * стороны чередуются. У каждого направления свой материал — общая природа,
 * разная фактура.
 *
 * Горизонтальная каретка на закреплённой секции отсюда убрана: она стоила
 * четыре экрана скролла и всё равно показывала бледные карточки. Полоса
 * отдаёт больше за меньшую длину.
 */
export default function Atlas() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        el.querySelectorAll<HTMLElement>('[data-band]').forEach((band) => {
          const media = band.querySelector<HTMLElement>('[data-media]');
          const copy = band.querySelector<HTMLElement>('[data-copy]');

          gsap.from([copy, media], {
            opacity: 0,
            y: 34,
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.12,
            scrollTrigger: { trigger: band, start: 'top 78%', once: true }
          });

          // материал внутри рамки едет медленнее полосы
          if (media) {
            gsap.fromTo(
              media.querySelector('[data-parallax]'),
              { yPercent: -7 },
              {
                yPercent: 7,
                ease: 'none',
                scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true }
              }
            );
          }
        });
      });
    }, el);

    return () => ctx.revert();
  }, []);

  const groupLabel = (id: string) => SITE.groups.find((g) => g.id === id)?.label ?? '';

  return (
    <section
      ref={root}
      className="relative z-10 w-full border-t border-line bg-bg"
      aria-label="Направления"
    >
      <div className="px-4 pt-[11vh] sm:px-8 lg:px-[72px]">
        <span className="rail-label">{SITE.atlas.label}</span>
        <div className="mt-4 grid gap-[clamp(16px,3vh,32px)] lg:grid-cols-[1.15fr_1fr] lg:items-end">
          <h2 className="display m-0 text-[clamp(28px,5.2vw,80px)]">
            {SITE.atlas.title} <span className="accent-serif">{SITE.atlas.titleAccent}</span>
          </h2>
          <p className="m-0 max-w-[46ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
            {SITE.atlas.lead}
          </p>
        </div>
      </div>

      <div className="mt-[clamp(24px,5vh,64px)] flex flex-col">
        {SITE.services.map((s, i) => {
          const flip = i % 2 === 1;
          return (
            <article
              key={s.n}
              data-band
              className="border-t border-line px-4 py-[clamp(20px,4.5vh,52px)] sm:px-8 lg:px-[72px]"
            >
              <div
                className={`grid items-center gap-[clamp(20px,4vh,44px)] lg:grid-cols-2 lg:gap-14 ${
                  flip ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                {/* медиа-анкор: материал в рамке с плавающим чипом */}
                <div
                  data-media
                  className="relative aspect-[16/9] max-h-[48vh] overflow-hidden rounded-lg border border-line bg-elev lg:aspect-[16/10] lg:max-h-none"
                >
                  <div data-parallax className="absolute -inset-y-[8%] inset-x-0">
                    <Material preset={s.material} opacity={0.95} />
                  </div>
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(120% 95% at 28% 8%, rgb(5 6 8 / 0) 0%, rgb(5 6 8 / 0.28) 62%, rgb(5 6 8 / 0.64) 100%)'
                    }}
                  />
                  <span className="absolute left-4 top-4 font-mono text-[clamp(30px,3.4vw,52px)] leading-none text-fg/85">
                    {s.n}
                  </span>
                  <span className="absolute bottom-4 left-4 right-4 border border-line bg-bg/70 px-3 py-2 font-mono text-[9px] uppercase tracking-rail text-dim backdrop-blur-sm">
                    {groupLabel(s.group)}
                  </span>
                </div>

                <div data-copy>
                  <h3 className="display m-0 text-[clamp(26px,3.6vw,54px)]">
                    {s.title} <span className="accent-serif">{s.titleAccent}</span>
                  </h3>
                  <p className="m-0 mt-4 max-w-[46ch] text-[clamp(13px,1.05vw,16px)] leading-relaxed text-dim">
                    {s.summary}
                  </p>
                  <ul className="m-0 mt-6 flex list-none flex-wrap gap-1.5 p-0">
                    {s.stack.map((tech) => (
                      <li
                        key={tech}
                        className="border border-line px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-rail text-faint"
                      >
                        {tech}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={s.href}
                    className="mt-7 inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
                  >
                    Смотреть
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
