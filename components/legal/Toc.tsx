'use client';

import { useEffect, useRef, useState } from 'react';
import { scrollToEl } from '@/lib/scroll';

/**
 * Оглавление документа.
 *
 * Было списком ссылок, который не знал, где читатель: в политике
 * одиннадцать разделов, и на середине непонятно ни сколько прочитано,
 * ни в каком разделе находишься. Теперь у оглавления есть рельс
 * прогресса и подсветка текущего раздела — тот же приём, что у линии
 * времени на других страницах.
 *
 * На телефоне оглавление свёрнуто в «Содержание»: одиннадцать пунктов
 * перед текстом — это экран, который перелистывают не глядя, а в
 * документе оглавление как раз нужно, чтобы прыгнуть к нужному пункту.
 */
export default function Toc({ sections }: { sections: readonly { id: string; title: string }[] }) {
  const [at, setAt] = useState(0);
  const [p, setP] = useState(0);
  const open = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!nodes.length) return;

    const article = nodes[0].parentElement;

    const update = () => {
      // текущий раздел — последний, чей заголовок уже выше трети экрана
      const line = innerHeight * 0.33;
      let i = 0;
      nodes.forEach((el, k) => {
        if (el.getBoundingClientRect().top <= line) i = k;
      });
      setAt(i);

      if (article) {
        const r = article.getBoundingClientRect();
        const done = -r.top + innerHeight * 0.5;
        setP(Math.max(0, Math.min(1, done / Math.max(r.height, 1))));
      }
    };

    let raf = 0;
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); });
    };
    update();
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
    };
  }, [sections]);

  const list = (
    <ol className="relative m-0 flex list-none flex-col gap-3 p-0 pl-5">
      {/* рельс: пройденное — акцентом */}
      <span className="pointer-events-none absolute left-0 top-1 h-[calc(100%-8px)] w-px bg-line" aria-hidden>
        <span
          className="absolute inset-0 origin-top bg-accent transition-transform duration-300"
          style={{ transform: `scaleY(${p.toFixed(3)})` }}
        />
      </span>

      {sections.map((s, i) => (
        <li key={s.id} className="flex gap-3 text-[13px] leading-snug">
          <span
            className="w-6 shrink-0 font-mono text-[10px] leading-[1.9] tracking-rail transition-colors duration-300"
            style={{ color: i === at ? 'var(--accent)' : 'var(--fg-faint)' }}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <a
            href={`#${s.id}`}
            onClick={(e) => {
              // прокрутку ведёт Lenis: нативный переход по якорю он
              // отменяет собственной целью и возвращает страницу назад
              const el = document.getElementById(s.id);
              if (!el) return;
              e.preventDefault();
              // −96: раздел не должен уезжать под плавающую шапку
              scrollToEl(el, -96);
              if (open.current) open.current.open = false;
            }}
            className="transition-colors duration-300 hover:text-fg"
            style={{ color: i === at ? 'var(--fg)' : 'var(--fg-dim)' }}
          >
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {/* телефон: свёрнутое содержание */}
      <details ref={open} className="group border-y border-line lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between py-4 marker:content-none">
          <span className="rail-label">Содержание</span>
          <span
            className="font-mono text-[14px] leading-none text-accent transition-transform duration-300 group-open:rotate-45"
            aria-hidden
          >
            +
          </span>
        </summary>
        <div className="pb-6">{list}</div>
      </details>

      <nav aria-label="Содержание" className="hidden lg:block">
        <div className="sticky top-28">{list}</div>
      </nav>
    </>
  );
}
