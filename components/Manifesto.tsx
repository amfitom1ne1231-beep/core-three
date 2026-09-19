'use client';

import { Fragment, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

type Part = { word: string; accent: boolean; nbsp?: boolean };

/**
 * Разбор акцентов: **слово** — слово, к которому ведёт подсветка.
 *
 * Результат — не плоский список слов, а список единиц переноса:
 *  - знак препинания после акцента приходит отдельным токеном
 *    («качества» + «.») и без склейки отъезжает от слова;
 *  - тире по русским правилам не может начинать строку, поэтому оно
 *    уходит в конец предыдущей единицы через неразрывный пробел.
 */
function parse(text: string): Part[][] {
  const flat = text.split(/(\*\*[^*]+\*\*)/).flatMap((chunk) => {
    const accent = chunk.startsWith('**') && chunk.endsWith('**');
    const body = accent ? chunk.slice(2, -2) : chunk;
    return body
      .split(' ')
      .filter((w) => w.length > 0)
      .map((word) => ({ word, accent }));
  });

  const units: Part[][] = [];
  for (const part of flat) {
    const last = units[units.length - 1];
    if (/^[—–]$/.test(part.word) && last) {
      // тире держим на строке предыдущего слова
      last.push({ word: part.word, accent: false, nbsp: true });
    } else if (/^[.,:;!?»)]+$/.test(part.word) && last) {
      // пунктуация вплотную и без жира
      last.push({ word: part.word, accent: false });
    } else {
      units.push([part]);
    }
  }
  return units;
}

export default function Manifesto() {
  const section = useRef<HTMLElement>(null);
  const units = parse(SITE.manifesto.text);

  useEffect(() => {
    const el = section.current;
    if (!el) return;

    const wordEls = el.querySelectorAll<HTMLElement>('[data-word]');
    const coreEls = el.querySelectorAll<HTMLElement>('[data-core-label]');
    const bright = (target: HTMLElement) => (target.dataset.accent === 'true' ? 1 : 0.5);

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Десктоп: секция высокая, содержимое липнет, подсветка идёт по скроллу.
      mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.set(wordEls, { opacity: 0.12 });
        gsap.set(coreEls, { opacity: 0.22 });

        const step = 0.08;
        const total = wordEls.length * step;
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.6
          }
        });

        tl.to(wordEls, {
          opacity: (_i: number, target: HTMLElement) => bright(target),
          ease: 'none',
          duration: step * 4,
          stagger: { each: step }
        });

        // рельс: ядра загораются по ходу чтения
        coreEls.forEach((core, i) => {
          tl.to(core, { opacity: 1, duration: total * 0.12, ease: 'none' },
            total * (0.06 + i * 0.3));
        });
      });

      // Мобильный: никаких закреплений — обычный скролл со ступенчатой подсветкой.
      mm.add('(max-width: 767px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.set(wordEls, { opacity: 0.16 });
        gsap.set(coreEls, { opacity: 0.3 });

        gsap.to(wordEls, {
          opacity: (_i: number, target: HTMLElement) => bright(target),
          stagger: 0.02,
          duration: 0.5,
          ease: 'power1.out',
          scrollTrigger: { trigger: el, start: 'top 70%', end: 'bottom 60%', toggleActions: 'play none none reverse' }
        });
        gsap.to(coreEls, {
          opacity: 1,
          stagger: 0.12,
          duration: 0.4,
          scrollTrigger: { trigger: el, start: 'top 65%' }
        });
      });

      // Без анимации: текст сразу в конечном состоянии.
      mm.add('(prefers-reduced-motion: reduce)', () => {
        wordEls.forEach((w) => gsap.set(w, { opacity: bright(w) }));
        gsap.set(coreEls, { opacity: 1 });
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={section}
      className="relative z-10 w-full md:h-[260svh]"
      aria-label="Манифест"
    >
      {/* содержимое липнет к экрану, материал продолжает жить за текстом */}
      <div className="md:sticky md:top-0 flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 py-[16vh] sm:px-8 md:py-0 lg:px-[72px]">
        {/* завеса под текстом: материал остаётся видим, но контраст держится */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(180deg, rgb(5 6 8 / 0.35) 0%, rgb(5 6 8 / 0.72) 38%, rgb(5 6 8 / 0.72) 62%, rgb(5 6 8 / 0.35) 100%)'
          }}
          aria-hidden
        />

        <div className="mb-[clamp(28px,6vh,72px)] flex flex-wrap items-center gap-x-[clamp(12px,3vw,40px)] gap-y-2">
          <span className="rail-label">{SITE.manifesto.label}</span>
          {SITE.cores.map((core) => (
            <span key={core.n} data-core-label className="rail-label">
              <b>{core.name}</b>
            </span>
          ))}
        </div>

        <p
          className="display m-0 max-w-[30ch] text-[clamp(26px,4.4vw,72px)] leading-[1.06]"
          aria-label={SITE.manifesto.text.replace(/\*\*/g, '')}
        >
          {units.map((unit, i) => (
            <Fragment key={i}>
              <span className="inline-block whitespace-nowrap">
                {unit.map((part, j) => (
                  <span
                    key={j}
                    data-word
                    data-accent={part.accent ? 'true' : 'false'}
                    aria-hidden
                    className={part.accent ? 'inline-block font-bold tracking-[-0.03em]' : 'inline-block'}
                  >
                    {part.nbsp ? '\u00a0' : ''}
                    {part.word}
                  </span>
                ))}
              </span>
              {i < units.length - 1 ? ' ' : null}
            </Fragment>
          ))}
        </p>
      </div>
    </section>
  );
}
