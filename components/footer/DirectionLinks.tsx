'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { LIVE_W } from '../live/kit';
import { LIVE_BY_KEY } from '../live/map';
import { SITE } from '@/content/site';

/**
 * Направления в подвале.
 *
 * Отдельного блока «соседние направления» над финалом больше нет — он
 * был третьей концовкой подряд. Переход к направлениям живёт здесь,
 * обычной колонкой ссылок, а то, что в прежнем блоке нравилось, осталось:
 * за курсором едет живой кадр направления, на которое наведено.
 *
 * Мышь только: на тач-устройстве кадру неоткуда взяться. Играет ровно
 * один кадр — тот, под которым сейчас курсор.
 */
export default function DirectionLinks({ label, links }: { label: string; links: readonly { label: string; href: string }[] }) {
  const card = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<string | null>(null);

  useEffect(() => {
    const el = card.current;
    if (!el) return;
    if (!matchMedia('(pointer: fine)').matches) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    // кадр стоит над курсором: ссылки в самом низу страницы, под ним места нет
    const move = (e: PointerEvent) => {
      xTo(e.clientX + 24);
      yTo(e.clientY - 206);
    };
    // первая позиция ставится без анимации, иначе кадр прилетает из угла
    const place = (e: PointerEvent) => gsap.set(el, { x: e.clientX + 24, y: e.clientY - 206 });
    addEventListener('pointermove', place, { once: true });
    addEventListener('pointermove', move, { passive: true });
    return () => {
      removeEventListener('pointermove', place);
      removeEventListener('pointermove', move);
    };
  }, []);

  // у страницы направления может быть несколько граней — показываем первую
  const shown = at === null ? null : SITE.services.find((s) => s.href === at) ?? null;
  const Live = shown ? LIVE_BY_KEY[shown.live] ?? LIVE_BY_KEY.landing : null;

  return (
    <nav aria-label={label}>
      <span className="rail-label">{label}</span>
      <ul className="m-0 mt-4 flex list-none flex-col gap-0.5 p-0 sm:gap-2.5" onMouseLeave={() => setAt(null)}>
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              onMouseEnter={() => setAt(l.href)}
              onFocus={() => setAt(l.href)}
              onBlur={() => setAt(null)}
              className="block py-3.5 text-[13px] text-dim transition-colors duration-300 hover:text-fg sm:py-0"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      <div
        ref={card}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[120] hidden h-[182px] w-[268px] overflow-hidden border border-line-strong bg-elev transition-opacity duration-300 [@media(pointer:fine)]:block"
        style={{ opacity: shown ? 1 : 0, ['--live-k' as string]: (268 / LIVE_W).toFixed(4) }}
      >
        {Live && <Live playing />}
      </div>
    </nav>
  );
}
