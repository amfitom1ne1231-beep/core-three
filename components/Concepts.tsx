'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ConceptPreview from './concept-previews';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

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

  // Рамка каждого превью раскрывается по скроллу (data-reveal="clip"),
  // а сами карточки до этого появлялись готовыми — рамка «оживала» вокруг
  // того, что уже стояло на месте. Теперь сначала входит карточка.
  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const head = el.querySelector<HTMLElement>('[data-head]');
        if (head) {
          gsap.from(head.children, {
            opacity: 0,
            y: 14,
            duration: 0.55,
            ease: 'power2.out',
            stagger: 0.07,
            scrollTrigger: { trigger: head, start: 'top 85%', once: true }
          });
        }

        const cards = el.querySelectorAll<HTMLElement>('[data-concept-card]');
        if (cards.length) {
          gsap.from(cards, {
            opacity: 0,
            y: 16,
            duration: 0.55,
            ease: 'power2.out',
            stagger: 0.08,
            scrollTrigger: { trigger: cards[0], start: 'top 90%', once: true }
          });
        }
      });
    }, el);

    return () => ctx.revert();
  }, []);

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
      data-chapter="concepts"
      className="relative z-10 w-full overflow-hidden border-t border-line"
      aria-label="Концепты"
    >

      <div data-recede className="relative px-4 py-[14vh] sm:px-8 lg:px-[72px]">
        <div data-head>
          <span className="rail-label block">{SITE.concepts.label}</span>
          <div className="mt-4 grid gap-[clamp(20px,4vh,40px)] lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <h2 data-skew className="display m-0 text-[clamp(28px,5.2vw,80px)]">
            {SITE.concepts.title} <span className="title-accent">{SITE.concepts.titleAccent}</span>
          </h2>
            <p className="m-0 max-w-[46ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
              {SITE.concepts.lead}
            </p>
          </div>
        </div>

        {/* до 640px — свайп-ряд: четыре карточки столбиком стоили телефону два с половиной экрана */}
        <ul
          data-lenis-prevent-horizontal
          className="-mx-4 m-0 mt-[clamp(32px,7vh,80px)] flex snap-x snap-mandatory scroll-px-4 list-none gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] after:w-px after:shrink-0 after:content-[''] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:after:hidden xl:grid-cols-4 [&::-webkit-scrollbar]:hidden"
        >
          {SITE.concepts.items.map((c) => (
            <li key={c.slug} data-concept-card className="w-[78vw] max-w-[340px] shrink-0 snap-start sm:w-auto sm:max-w-none">
              <article
                className="group flex h-full flex-col border border-line bg-elev transition-colors duration-500 hover:border-line-strong"
                onMouseEnter={() => warp(c.slug, true)}
                onMouseLeave={() => warp(c.slug, false)}
              >
                <div data-reveal="clip" className="relative overflow-hidden border-b border-line bg-bg">
                  <svg data-skew="blur" viewBox="0 0 320 200" className="block h-auto w-full text-fg" aria-hidden>
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
