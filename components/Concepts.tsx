'use client';

import { useState } from 'react';
import Link from 'next/link';
import DemoView from './concepts/DemoView';
import Reveal from './Reveal';
import { demoBySlug } from '@/content/concepts';
import { SITE } from '@/content/site';

/**
 * Глава витрины на главной.
 *
 * Была сеткой из четырёх карточек со схемами — и стояла сразу после
 * карусели направлений, где в кадрах уже едут шесть живых вставок.
 * Два ряда маленьких экранов подряд: глава читалась повтором предыдущей,
 * только беднее.
 *
 * Теперь приём прямо противоположен карусели. Там кадры едут и
 * сменяются сами, здесь стоит один и переключается списком. И
 * показывает он не схему, а саму страницу демо: после того как все
 * четыре собраны, рисовать их каркасы стало нечестно.
 *
 * Полная витрина с составом каждого демо осталась на `/concepts` —
 * сюда вынесено только доказательство, что демо существуют и работают.
 */
export default function Concepts() {
  const items = SITE.concepts.items;
  const [at, setAt] = useState(0);
  const active = items[at];
  const meta = demoBySlug(active.slug);

  return (
    <section
      data-chapter="concepts"
      className="relative z-10 w-full overflow-hidden border-t border-line"
      aria-label="Концепты"
    >
      <div data-recede className="relative px-4 section-y sm:px-8 lg:px-[72px]">
        <Reveal>
          <span className="rail-label block" data-rise>
            {SITE.concepts.label}
          </span>
          <div data-rise className="mt-4 grid gap-[clamp(20px,4vh,40px)] lg:grid-cols-[1.7fr_1fr] lg:items-end">
            <h2 data-skew className="display m-0 text-[clamp(28px,5.2vw,80px)]">
              {SITE.concepts.title} <span className="title-accent">{SITE.concepts.titleAccent}</span>
            </h2>
            <p className="m-0 max-w-[46ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
              {SITE.concepts.lead}
            </p>
          </div>
        </Reveal>

        <div className="mt-[clamp(32px,7vh,80px)] grid gap-[clamp(20px,4vh,44px)] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] lg:gap-[clamp(32px,4vw,72px)]">
          {/* ---------- ниши ---------- */}
          <ol
            role="tablist"
            aria-label="Ниши"
            aria-orientation="vertical"
            className="m-0 flex list-none flex-col p-0"
            onKeyDown={(e) => {
              const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next = (at + d + items.length) % items.length;
              setAt(next);
              (e.currentTarget.querySelectorAll('button')[next] as HTMLButtonElement | undefined)?.focus();
            }}
          >
            {items.map((c, i) => {
              const on = i === at;
              return (
                <li key={c.slug} className="border-t border-line last:border-b">
                  <button
                    type="button"
                    role="tab"
                    id={`demo-tab-${c.slug}`}
                    aria-selected={on}
                    aria-controls="demo-stage"
                    tabIndex={on ? 0 : -1}
                    onClick={() => setAt(i)}
                    onMouseEnter={() => setAt(i)}
                    onFocus={() => setAt(i)}
                    className="w-full cursor-pointer appearance-none border-0 bg-transparent px-0 py-[clamp(14px,2.2vh,24px)] text-left outline-none"
                  >
                    <span className="flex items-baseline gap-4">
                      <span
                        className={`font-mono text-[10px] uppercase tracking-rail transition-colors duration-300 ${
                          on ? 'text-accent' : 'text-faint'
                        }`}
                      >
                        {c.niche}
                      </span>
                    </span>
                    <span
                      className={`mt-2 block text-[clamp(17px,1.7vw,26px)] font-medium leading-snug transition-colors duration-300 ${
                        on ? 'text-fg' : 'text-dim'
                      }`}
                    >
                      {c.title}
                    </span>
                  </button>
                </li>
              );
            })}

            <li className="pt-[clamp(20px,3vh,32px)]">
              <Link
                href="/concepts"
                className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-3 font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
              >
                Все концепты
                <span aria-hidden>→</span>
              </Link>
            </li>
          </ol>

          {/* Кадр стоит первым на узком экране: список выше него означал бы,
              что нажатие меняет то, чего на экране нет, — ровно та же
              ошибка, что была в составе работы на страницах направлений. */}
          <div className="order-first lg:order-none">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <i className="relative flex h-1.5 w-1.5">
                  <i className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
                  <i className="relative h-1.5 w-1.5 rounded-full bg-accent" />
                </i>
                <span className="rail-label">{meta?.domain}</span>
              </span>
              <span className="rail-label">Живое демо</span>
            </div>

            <div
              id="demo-stage"
              role="tabpanel"
              aria-labelledby={`demo-tab-${active.slug}`}
              data-cursor="ring"
              data-reveal="clip"
              className="group relative aspect-[16/10] overflow-hidden rounded-[10px] border border-line bg-elev"
            >
              <DemoView
                slug={active.slug}
                kind={active.kind}
                title={meta?.title ?? active.title}
                className="h-full w-full"
              />

              {/* ссылка поверх кадра: внутри рамки чужая страница не кликается */}
              <Link
                href={`/concepts/${active.slug}`}
                className="absolute inset-0 flex items-end justify-end p-4"
                aria-label={`Открыть демо: ${active.title}`}
              >
                <span className="flex items-center gap-2 border border-line-strong bg-bg/70 px-3.5 py-2 font-mono text-[10px] uppercase tracking-rail text-fg opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                  Открыть
                  <span aria-hidden>→</span>
                </span>
              </Link>
            </div>

            <p className="m-0 mt-4 max-w-[52ch] text-[13.5px] leading-relaxed text-dim">{meta?.hint}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
