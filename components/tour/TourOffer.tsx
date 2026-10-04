'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { askTour, tourRunning } from '@/lib/tour';
import { tourFor } from '@/content/tour';

/** Полминуты без действий на первом экране — человек, похоже, не понимает, куда нажать. */
const IDLE_MS = 30_000;
/** Три разворота прокрутки подряд — ищет и не находит. */
const FLIPS = 3;
const FLIP_WINDOW_MS = 20_000;
/** Короче этого разворот не считается: так листают, дочитывая абзац. */
const LEG_PX = 160;
/** Предложение само уходит, если на него не ответили. */
const HIDE_MS = 25_000;

const OFFERED = 'ct-tour-offered';
const VISITED = 'ct-visited';
const FIRST = 'ct-first-visit';

/**
 * Первый ли это визит. Помнится на всю вкладку: решается на первой
 * странице, иначе переход на вторую сделал бы визит «не первым».
 */
function firstVisit(): boolean {
  try {
    const known = sessionStorage.getItem(FIRST);
    if (known) return known === '1';
    const first = !localStorage.getItem(VISITED);
    sessionStorage.setItem(FIRST, first ? '1' : '0');
    localStorage.setItem(VISITED, '1');
    return first;
  } catch {
    return false;
  }
}

function offered(): boolean {
  try {
    return localStorage.getItem(OFFERED) === '1';
  } catch {
    return true;
  }
}

/**
 * Не поверх плашки cookie, открытого меню и самой экскурсии. Панель меню
 * лежит в документе и закрытой — важно, видна ли она, а не есть ли.
 */
const busy = () =>
  tourRunning() ||
  [...document.querySelectorAll('[role="region"][aria-label="Cookie"], [role="dialog"][aria-label="Меню"]')].some(
    (el) => typeof el.checkVisibility !== 'function' || el.checkVisibility()
  );

/**
 * Мягкое предложение экскурсии (HELP.md, этап 5): одной строкой, один
 * раз на браузер, только на первом визите и только по признакам
 * растерянности. На заявке не появляется никогда — там человек занят.
 *
 * Заказчик не любит шаблонные приёмы, поэтому строка тихая: без
 * точек, подпрыгиваний и таймеров на виду; ответили «Не надо» или
 * промолчали — больше не появится.
 */
export default function TourOffer() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    if (pathname === '/contact' || !tourFor(pathname) || offered() || !firstVisit()) return;

    let idle = 0;
    let retry = 0;
    let lastY = scrollY;
    let dirY = 0;
    let legFrom = scrollY;
    let flips: number[] = [];

    const fire = () => {
      if (busy()) {
        retry = window.setTimeout(fire, 5000);
        return;
      }
      try {
        localStorage.setItem(OFFERED, '1');
      } catch {
        /* не запомнится — значит, не запомнится */
      }
      cleanup();
      setOpen(true);
    };
    const restartIdle = () => {
      clearTimeout(idle);
      // «без действий» считается только на первом экране
      if (scrollY < innerHeight * 0.6) idle = window.setTimeout(fire, IDLE_MS);
    };
    const onScroll = () => {
      const y = scrollY;
      const d = Math.sign(y - lastY);
      if (d && d !== dirY) {
        const now = performance.now();
        if (dirY && Math.abs(lastY - legFrom) >= LEG_PX) {
          flips = [...flips.filter((t) => now - t < FLIP_WINDOW_MS), now];
          if (flips.length >= FLIPS) return fire();
        }
        dirY = d;
        legFrom = lastY;
      }
      lastY = y;
      restartIdle();
    };
    const cleanup = () => {
      clearTimeout(idle);
      clearTimeout(retry);
      removeEventListener('scroll', onScroll);
      removeEventListener('pointerdown', restartIdle);
      removeEventListener('keydown', restartIdle);
    };

    restartIdle();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('pointerdown', restartIdle);
    addEventListener('keydown', restartIdle);
    return cleanup;
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(false), HIDE_MS);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;
  return (
    <div role="region" aria-label="Подсказка" className="tour-offer">
      <span className="text-[14px] leading-snug text-fg">{pathname === '/' ? 'Показать, что где на сайте?' : 'Показать, что на этой странице?'}</span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            askTour();
          }}
          className="brief-chip !border-fg !bg-fg !py-2 !text-[13px] !text-bg"
        >
          Показать
        </button>
        <button type="button" onClick={() => setOpen(false)} className="brief-chip !py-2 !text-[13px]">
          Не надо
        </button>
      </span>
    </div>
  );
}
