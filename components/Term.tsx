'use client';

import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { onest, SITE_FONT } from './siteFont';
import type { Word } from '@/content/glossary';

/**
 * Слово из словаря прямо в тексте (HELP.md, этап 4): тонкий пунктир,
 * по нажатию — объяснение в одну-две строки и ссылка в словарь.
 *
 * Только по нажатию, без всплывания на наведение — решение заказчика:
 * ничего не должно выскакивать само, пока человек просто читает.
 * Закрывается повторным нажатием, Esc, нажатием мимо, а ещё само —
 * когда слово уехало с экрана или скрылось: слова стоят и в сценах,
 * которые листаются сами (путь заказа, карусель направлений).
 *
 * Карточка уходит порталом в body: у сцен на главной на предках висят
 * transform и overflow — внутри них `fixed` цеплялся бы не за окно,
 * а карточку обрезало бы. Положение пересчитывается каждый кадр, пока
 * она открыта, поэтому она едет вместе со словом при прокрутке.
 */
export default function Term({ word, children }: { word: Word; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const cardId = useId();

  const close = useCallback((focusBack: boolean) => {
    setOpen(false);
    if (focusBack) btn.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;

    const place = () => {
      const b = btn.current;
      const c = card.current;
      if (!b || !c) return;
      const r = b.getBoundingClientRect();
      const shown = typeof b.checkVisibility === 'function' ? b.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
      if (!shown || r.width === 0 || r.bottom < 0 || r.top > innerHeight) {
        setOpen(false);
        return;
      }
      const w = c.offsetWidth;
      const h = c.offsetHeight;
      // под словом, а если снизу не помещается — над ним
      const below = r.bottom + 10 + h <= innerHeight - 8 || r.top - 10 - h < 8;
      c.style.left = `${Math.round(Math.min(Math.max(8, r.left - 12), innerWidth - w - 8))}px`;
      c.style.top = `${Math.round(below ? r.bottom + 10 : r.top - 10 - h)}px`;
      raf = requestAnimationFrame(place);
    };
    place();
    // фокус — в карточку: читалка прочтёт объяснение, Tab дойдёт до ссылки
    card.current?.focus({ preventScroll: true });

    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!card.current?.contains(t) && !btn.current?.contains(t)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="term"
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={card}
            id={cardId}
            role="dialog"
            aria-label={word.term}
            tabIndex={-1}
            // портал лежит мимо оболочки сайта — шрифт задаём сами
            className={`${onest.variable} term-card`}
            style={{ fontFamily: SITE_FONT }}
            onKeyDown={(e) => {
              // внутри одна ссылка: Tab дальше неё возвращает к слову, а не в конец страницы
              if (e.key === 'Tab' && (e.shiftKey || document.activeElement !== card.current)) {
                e.preventDefault();
                close(true);
              }
            }}
          >
            <p className="m-0 text-[15px] font-medium leading-snug text-fg">{word.term}</p>
            <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-dim">{word.text}</p>
            <div className="mt-2.5">
              <Link
                href={`/help#word-${word.id}`}
                onClick={() => setOpen(false)}
                className="-my-2 inline-flex items-center gap-2 py-2 font-mono text-[10px] uppercase tracking-rail text-dim transition-colors duration-300 hover:text-accent"
              >
                В словаре
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
