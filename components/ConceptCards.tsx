'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ConceptPreview from './concept-previews';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

/**
 * Карточки концептов. Живут отдельно от секции, потому что витрина стоит
 * в двух местах: главой на главной и целой страницей `/concepts`.
 *
 * Собранное демо — ссылка с подсвеченной рамкой и приглашением открыть.
 * Несобранное — та же карточка, но без ссылки и без подсветки: рамка,
 * которая реагирует на курсор, обещает переход, и обещание надо
 * либо выполнять, либо не давать.
 *
 * Искажение превью работает у всех — это фактура, а не приглашение нажать.
 */
export default function ConceptCards({ className = '' }: { className?: string }) {
  const root = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(el.children, {
          opacity: 0,
          y: 16,
          duration: 0.55,
          ease: 'power2.out',
          stagger: 0.08,
          clearProps: 'transform',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true }
        });
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
    // до 640px — свайп-ряд: четыре карточки столбиком стоили телефону
    // два с половиной экрана
    <ul
      ref={root}
      data-lenis-prevent-horizontal
      className={`-mx-4 m-0 flex snap-x snap-mandatory scroll-px-4 list-none gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] after:w-px after:shrink-0 after:content-[''] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:after:hidden xl:grid-cols-4 [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {SITE.concepts.items.map((c) => (
        <li key={c.slug} className="w-[78vw] max-w-[340px] shrink-0 snap-start sm:w-auto sm:max-w-none">
          <article
            className={`group flex h-full flex-col border border-line bg-elev transition-colors duration-300 ${
              c.ready ? 'hover:border-line-strong' : ''
            }`}
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
            </div>

            <div className="relative flex flex-1 flex-col p-5">
              <span className="rail-label">{c.niche}</span>
              <h3 className="m-0 mt-3 text-[clamp(17px,1.5vw,21px)] font-medium leading-tight">
                {c.ready ? (
                  // растянутая ссылка: нажимается вся карточка, но в разметке
                  // остаётся одна ссылка с внятным именем, а не оболочка
                  // вокруг заголовка, списка и картинки
                  <Link
                    href={`/concepts/${c.slug}`}
                    className="transition-colors duration-300 before:absolute before:inset-0 before:content-[''] hover:text-accent"
                  >
                    {c.title}
                  </Link>
                ) : (
                  c.title
                )}
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
              {c.ready && (
                <span className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-rail text-accent">
                  Открыть демо
                  <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden>
                    →
                  </span>
                </span>
              )}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
