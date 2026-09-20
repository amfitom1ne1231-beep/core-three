'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Единый вход секции: короткое всплытие с проявлением.
 *
 * До этого вход был у одной карусели направлений, а схема, футер и всё
 * остальное просто возникали на месте готовыми — страница шла рывками:
 * то сцена въезжает, то блок появляется кадром. Один жест на весь сайт
 * убирает этот разнобой.
 *
 * Сдвиг намеренно маленький. На инерционном скролле Lenis всё, что едет
 * дальше ~16px и дольше ~0.6s, читается не как появление, а как
 * подлагивание: глаз уже довёл страницу, а блок всё ещё догоняет.
 *
 * Анимируются потомки с `data-rise`; если таких нет — прямые дети.
 * Маркер свой, а не `data-reveal`: тем уже помечены сцены со scrub-клипом
 * в `ScrollScenes`, и общий селектор забирал бы их себе.
 * Привязка идёт через `gsap.from` со `scrollTrigger`: так секция, которую
 * при загрузке уже пролистали, доигрывается в конечное состояние сама,
 * а не остаётся невидимой.
 */
export default function Reveal({
  children,
  className,
  id,
  y = 14,
  stagger = 0.07,
  duration = 0.55,
  start = 'top 85%'
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Сдвиг снизу. Больше 16px — это уже слайд, а не проявление. */
  y?: number;
  stagger?: number;
  duration?: number;
  start?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const marked = el.querySelectorAll<HTMLElement>('[data-rise]');
    const targets = marked.length ? Array.from(marked) : (Array.from(el.children) as HTMLElement[]);
    if (!targets.length) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(targets, {
          opacity: 0,
          y,
          duration,
          ease: 'power2.out',
          stagger,
          // хвост трансформа мешает субпиксельному рендеру текста
          clearProps: 'transform',
          scrollTrigger: { trigger: el, start, once: true }
        });
      });
    }, el);

    return () => ctx.revert();
  }, [y, stagger, duration, start]);

  return (
    <div ref={ref} id={id} className={className}>
      {children}
    </div>
  );
}
