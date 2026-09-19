'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollToY } from '@/lib/scroll';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

/**
 * Атлас возможностей: шесть направлений едут по горизонтали, пока секция
 * закреплена. Группировка функциональная — «Сайты и магазины», «Боты и
 * автоматизация», «Поддержка и мониторинг», — чтобы на сайте не возникло
 * второй триады помимо трёх ядер.
 */
export default function Atlas() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const { services, groups } = SITE;
  const groupLabel = (id: string) => groups.find((g) => g.id === id)?.label ?? '';

  useEffect(() => {
    const sec = section.current;
    const tr = track.current;
    if (!sec || !tr) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Десктоп: скролл превращается в горизонтальный ход каретки.
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        // запас справа, чтобы последняя карточка не липла к краю
        const distance = () => Math.max(0, tr.scrollWidth - innerWidth + 72);

        const tween = gsap.fromTo(
          tr,
          { x: 0 },
          {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
              trigger: sec,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 0.7,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                setActive(Math.round(self.progress * (services.length - 1)));
              }
            }
          }
        );
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          gsap.set(tr, { x: 0 });
        };
      });

      // Мобильный: обычная свайп-карусель, активную карточку определяем по скроллу каретки.
      mm.add('(max-width: 1023px)', () => {
        const onScroll = () => {
          const i = Math.round((tr.scrollLeft / Math.max(tr.scrollWidth - tr.clientWidth, 1)) * (services.length - 1));
          setActive(i);
        };
        tr.addEventListener('scroll', onScroll, { passive: true });
        return () => tr.removeEventListener('scroll', onScroll);
      });
    }, sec);

    return () => ctx.revert();
  }, [services.length]);

  /** Клик по рельсу: прокручиваем страницу к нужному положению каретки. */
  const goTo = (i: number) => {
    const sec = section.current;
    const tr = track.current;
    if (!sec) return;

    if (innerWidth < 1024 && tr) {
      const card = tr.children[i] as HTMLElement | undefined;
      card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      return;
    }
    const total = sec.offsetHeight - innerHeight;
    const y = sec.offsetTop + (total * i) / (services.length - 1);
    scrollToY(y);
  };

  return (
    <section
      ref={section}
      className="relative z-10 w-full border-t border-line bg-bg lg:h-[420svh]"
      aria-label="Атлас возможностей"
    >
      <div className="flex min-h-[100svh] flex-col justify-center gap-[clamp(24px,5vh,56px)] overflow-hidden py-[14vh] lg:sticky lg:top-0 lg:py-[12vh]">
        <div className="px-4 sm:px-8 lg:px-[72px]">
          <span className="rail-label">04 / Что мы делаем</span>
          <h2 className="display m-0 mt-4 text-[clamp(28px,5vw,76px)]">
            Шесть направлений.
          </h2>
        </div>

        {/* каретка: на десктопе её двигает скролл, на мобильном — палец */}
        {/* data-lenis-prevent обязателен: иначе Lenis перехватывает жест
            над вложенным скроллером и карусель не листается пальцем */}
        <div
          ref={track}
          data-lenis-prevent
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:px-8 lg:snap-none lg:overflow-visible lg:px-[72px]"
        >
          {services.map((s, i) => {
            const on = i === active;
            return (
              <article
                key={s.n}
                className="relative flex w-[86vw] shrink-0 snap-start flex-col justify-between border bg-elev p-6 transition-colors duration-500 sm:w-[70vw] sm:p-8 lg:w-[clamp(420px,32vw,560px)]"
                style={{ borderColor: on ? 'var(--line-strong)' : 'var(--line)' }}
              >
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="rail-label">{groupLabel(s.group)}</span>
                    <span
                      className="font-mono text-[clamp(28px,3vw,44px)] leading-none transition-colors duration-500"
                      style={{ color: on ? 'var(--accent)' : 'var(--fg-faint)', opacity: on ? 0.9 : 0.35 }}
                    >
                      {s.n}
                    </span>
                  </div>

                  <h3
                    className="m-0 mt-6 text-[clamp(22px,2.3vw,34px)] font-medium leading-tight transition-colors duration-500"
                    style={{ color: on ? 'var(--fg)' : 'var(--fg-dim)' }}
                  >
                    {s.title}
                  </h3>

                  <p className="m-0 mt-4 max-w-[44ch] text-[clamp(13px,1.05vw,15px)] leading-relaxed text-dim">
                    {s.summary}
                  </p>
                </div>

                <div className="mt-8">
                  <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
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
                    className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:text-accent"
                  >
                    Смотреть
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* рельс прогресса: кликабельный, показывает все шесть направлений */}
        <div className="px-4 sm:px-8 lg:px-[72px]">
          <ol className="m-0 flex list-none gap-0 border-t border-line p-0">
            {services.map((s, i) => {
              const on = i === active;
              return (
                <li key={s.n} className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={on || undefined}
                    className="group flex w-full items-baseline gap-2 border-t-2 pt-3 text-left transition-colors duration-500"
                    style={{ borderColor: on ? 'var(--accent)' : 'transparent', marginTop: -1 }}
                  >
                    <span
                      className="font-mono text-[9px] tracking-rail transition-colors duration-500"
                      style={{ color: on ? 'var(--accent)' : 'var(--fg-faint)' }}
                    >
                      {s.n}
                    </span>
                    <span
                      className="hidden truncate font-mono text-[9px] uppercase tracking-rail transition-colors duration-500 group-hover:text-fg lg:block"
                      style={{ color: on ? 'var(--fg)' : 'var(--fg-faint)' }}
                    >
                      {s.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
