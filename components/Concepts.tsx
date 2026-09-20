'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ConceptCards from './ConceptCards';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

/**
 * Глава витрины на главной. Карточки живут в `ConceptCards`: та же витрина
 * целиком развёрнута на `/concepts`, и расходиться им незачем.
 */
export default function Concepts() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const head = el.querySelector<HTMLElement>('[data-head]');
        if (!head) return;
        gsap.from(head.children, {
          opacity: 0,
          y: 14,
          duration: 0.55,
          ease: 'power2.out',
          stagger: 0.07,
          clearProps: 'transform',
          scrollTrigger: { trigger: head, start: 'top 85%', once: true }
        });
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      data-chapter="concepts"
      className="relative z-10 w-full overflow-hidden border-t border-line"
      aria-label="Концепты"
    >
      <div data-recede className="relative px-4 section-y sm:px-8 lg:px-[72px]">
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

        <ConceptCards className="mt-[clamp(32px,7vh,80px)]" />

        <Link
          href="/concepts"
          className="mt-[clamp(28px,5vh,52px)] inline-flex items-center gap-2 rounded-full border border-line px-5 py-3.5 font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:border-accent hover:text-accent sm:py-2.5"
        >
          Что такое концепт
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
