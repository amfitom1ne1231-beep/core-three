'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import Material, { DIRECTION_MATERIAL } from '../Material';
import { SITE } from '@/content/site';

/**
 * Переход к соседним направлениям.
 *
 * Была сетка мелких ссылок в рамках — шесть одинаковых ячеек, последняя
 * заглушкой, чтобы не светилась дырка. Стали строки в полный кегль:
 * список направлений — последнее, что человек видит перед футером,
 * и он должен звать дальше, а не выглядеть подвалом.
 *
 * За курсором едет кадр с фактурой того направления, на которое
 * наведено, — тот же материал, что стоит у него на странице. Мышь
 * только: на тач-устройстве кадру неоткуда взяться, и строки работают
 * сами по себе.
 */
export default function Neighbors({
  current,
  label = 'Соседние направления'
}: {
  /** Адрес текущей страницы: её саму в списке не показываем. На «О нас»
      пусто — там перечислены все шесть. */
  current: string;
  label?: string;
}) {
  const items = SITE.services.filter((s) => s.href !== current);
  const card = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<number | null>(null);

  useEffect(() => {
    const el = card.current;
    if (!el) return;
    if (!matchMedia('(pointer: fine)').matches) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    const move = (e: PointerEvent) => {
      xTo(e.clientX + 28);
      yTo(e.clientY - 96);
    };
    // первая позиция ставится без анимации, иначе кадр прилетает из угла
    const place = (e: PointerEvent) => {
      gsap.set(el, { x: e.clientX + 28, y: e.clientY - 96 });
      removeEventListener('pointermove', place);
    };
    addEventListener('pointermove', place, { once: true });
    addEventListener('pointermove', move, { passive: true });
    return () => {
      removeEventListener('pointermove', place);
      removeEventListener('pointermove', move);
    };
  }, []);

  const shown = at === null ? null : items[at];

  return (
    <section data-chapter="concepts" className="relative z-10 w-full border-t border-line" aria-label={label}>
      <div className="px-4 section-y-tight sm:px-8 lg:px-[72px]">
        <div className="flex items-baseline justify-between gap-6">
          <span className="rail-label">{label}</span>
          <Link
            href="/#directions"
            className="font-mono text-[10px] uppercase tracking-rail text-faint transition-colors duration-300 hover:text-fg"
          >
            Все шесть <span aria-hidden>→</span>
          </Link>
        </div>

        <ul className="m-0 mt-[clamp(20px,3vh,36px)] list-none border-t border-line p-0" onMouseLeave={() => setAt(null)}>
          {items.map((s, i) => (
            <li key={s.n} className="border-b border-line">
              <Link
                href={s.href}
                data-magnetic
                onMouseEnter={() => setAt(i)}
                onFocus={() => setAt(i)}
                onBlur={() => setAt(null)}
                className="group flex items-baseline gap-[clamp(12px,2vw,32px)] py-[clamp(16px,2.6vh,30px)]"
              >
                <span className="font-mono text-[11px] tracking-rail text-faint transition-colors duration-300 group-hover:text-accent">
                  {s.n}
                </span>
                <span className="display text-[clamp(22px,3.2vw,46px)] leading-none transition-colors duration-300 group-hover:text-accent">
                  {s.title} <span className="text-dim transition-colors duration-300 group-hover:text-accent">{s.titleAccent}</span>
                </span>
                <span
                  className="ml-auto shrink-0 self-center font-mono text-[14px] text-faint transition-all duration-300 group-hover:translate-x-1 group-hover:text-accent"
                  aria-hidden
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* кадр за курсором: фактура направления и его номер */}
      <div
        ref={card}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[120] hidden h-[172px] w-[268px] overflow-hidden border border-line-strong bg-elev transition-opacity duration-300 [@media(pointer:fine)]:block"
        style={{ opacity: shown ? 1 : 0 }}
      >
        {shown && (
          <>
            <Material preset={DIRECTION_MATERIAL[shown.n] ?? 'silk'} opacity={0.72} />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgb(var(--bg-rgb) / 0.35) 0%, rgb(var(--bg-rgb) / 0.8) 100%)' }}
            />
            <div className="absolute inset-0 flex flex-col justify-between p-4">
              <span className="rail-label">
                <b>{shown.n}</b>
              </span>
              <span className="text-[15px] font-medium leading-snug">
                {shown.title} <span className="text-dim">{shown.titleAccent}</span>
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
