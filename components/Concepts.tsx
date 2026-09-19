'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import ConceptPreview from './concept-previews';
import VideoBackdrop from './VideoBackdrop';
import { SITE } from '@/content/site';

/**
 * Витрина концептов. Превью схематичные: живые демо — волна 3, но пустая
 * витрина вредит сильнее честной схемы.
 *
 * На наведении превью «плывёт»: SVG-фильтр смещения по шуму. Когда появятся
 * настоящие скриншоты демо, эффект останется тем же — поменяется только
 * содержимое под фильтром.
 */
export default function Concepts() {
  const root = useRef<HTMLElement>(null);

  const warp = (slug: string, on: boolean) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = root.current;
    if (!el) return;
    const disp = el.querySelector(`#warp-${slug} feDisplacementMap`);
    const turb = el.querySelector(`#warp-${slug} feTurbulence`);
    if (!disp || !turb) return;

    gsap.to(disp, {
      attr: { scale: on ? 15 : 0 },
      duration: on ? 0.55 : 0.4,
      ease: on ? 'power2.out' : 'power2.inOut'
    });
    gsap.to(turb, {
      attr: { baseFrequency: on ? 0.028 : 0.012 },
      duration: 0.7,
      ease: 'power2.out'
    });
  };

  return (
    <section
      ref={root}
      className="relative z-10 w-full overflow-hidden border-t border-line bg-bg"
      aria-label="Концепты"
    >
      {/* капля на тёмной поверхности: движение только в верхней полосе */}
      <VideoBackdrop
        src="/video/drop.mp4"
        poster="/video/drop-poster.jpg"
        className="h-[46vh]"
        opacity={0.3}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[46vh]"
        style={{
          background:
            'linear-gradient(180deg, rgb(5 6 8 / 0.55) 0%, rgb(5 6 8 / 0.78) 60%, var(--bg) 100%)'
        }}
        aria-hidden
      />

      <div className="relative px-4 py-[14vh] sm:px-8 lg:px-[72px]">
        <span className="rail-label">{SITE.concepts.label}</span>
        <div className="mt-4 grid gap-[clamp(20px,4vh,40px)] lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <h2 className="display m-0 whitespace-pre-line text-[clamp(28px,5.2vw,80px)]">
            {SITE.concepts.title}
          </h2>
          <p className="m-0 max-w-[46ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
            {SITE.concepts.lead}
          </p>
        </div>

        <ul className="m-0 mt-[clamp(32px,7vh,80px)] grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {SITE.concepts.items.map((c) => (
            <li key={c.slug}>
              <article
                className="group flex h-full flex-col border border-line bg-elev transition-colors duration-500 hover:border-line-strong"
                onMouseEnter={() => warp(c.slug, true)}
                onMouseLeave={() => warp(c.slug, false)}
              >
                <div className="relative overflow-hidden border-b border-line bg-bg">
                  <svg viewBox="0 0 320 200" className="block h-auto w-full text-fg" aria-hidden>
                    <defs>
                      <filter id={`warp-${c.slug}`} x="-10%" y="-10%" width="120%" height="120%">
                        <feTurbulence
                          type="fractalNoise"
                          baseFrequency="0.012"
                          numOctaves={2}
                          seed={c.slug.length * 7}
                          result="noise"
                        />
                        <feDisplacementMap
                          in="SourceGraphic"
                          in2="noise"
                          scale={0}
                          xChannelSelector="R"
                          yChannelSelector="G"
                        />
                      </filter>
                    </defs>
                    <g filter={`url(#warp-${c.slug})`}>
                      <ConceptPreview kind={c.kind} />
                    </g>
                  </svg>
                  <span className="absolute right-3 top-3 border border-line bg-bg/80 px-2 py-1 font-mono text-[8px] uppercase tracking-rail text-faint">
                    {c.status}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <span className="rail-label">{c.niche}</span>
                  <h3 className="m-0 mt-3 text-[clamp(17px,1.5vw,21px)] font-medium leading-tight">
                    {c.title}
                  </h3>
                  <ul className="m-0 mt-4 flex flex-1 list-none flex-col gap-1.5 p-0">
                    {c.points.map((p) => (
                      <li key={p} className="flex gap-2 text-[12.5px] leading-relaxed text-dim">
                        <span className="text-faint" aria-hidden>
                          —
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
