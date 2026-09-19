'use client';

import { useEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';

/**
 * Общее для живых вставок атласа.
 *
 * Вставка — маленький «экран» продукта, который мы делаем: лендинг, блог,
 * магазин, бот, мини-приложение, мониторинг. Рисуется в фиксированных
 * координатах LIVE_W × LIVE_H, рамка карусели масштабирует её целиком —
 * поэтому внутри можно думать в пикселях, как в макете.
 *
 * Играет только активная вставка. Остальные стоят на «законченном» кадре
 * (rest): соседняя карточка в карусели показывает готовый результат,
 * а не пустое начало анимации.
 */

export const LIVE_W = 560;
export const LIVE_H = 380;

export type LiveProps = { playing: boolean };

/** Каждый цикл заканчивается затуханием такой длины — с него вставка стартует. */
const OUTRO = 0.5;
/** Сколько держать законченный кадр после активации: длительность перехода карусели. */
const HOLD = 0.85;

export function useLoop(
  root: RefObject<HTMLElement | null>,
  playing: boolean,
  build: (tl: gsap.core.Timeline) => void,
  rest = 0.72
) {
  const tl = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const t = gsap.timeline({ repeat: -1, repeatDelay: 0.2, paused: true });
      build(t);
      tl.current = t;
    }, el);
    return () => {
      ctx.revert();
      tl.current = null;
    };
    // сценарий вставки статичен — строится один раз
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = tl.current;
    if (!t) return;
    t.pause().progress(rest);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!playing || reduced) return;
    // Кадр только что стал активным. Пока идёт превращение в карусели,
    // держим законченное состояние — пустой кадр посреди перехода
    // выглядит провалом. Потом уводим его штатным затуханием цикла,
    // и вставка собирается с начала.
    const start = gsap.delayedCall(HOLD, () => {
      t.play(Math.max(0, t.duration() - OUTRO));
    });
    return () => {
      start.kill();
    };
  }, [playing, rest]);
}

/** Счётчик внутри таймлайна: число меняется в тексте элемента. */
export function countTo(
  tl: gsap.core.Timeline,
  el: Element | null,
  from: number,
  to: number,
  at: number | string,
  { duration = 1.1, decimals = 0, suffix = '' }: { duration?: number; decimals?: number; suffix?: string } = {}
) {
  if (!el) return;
  const box = { v: from };
  const fmt = (v: number) =>
    v.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  // fromTo, а не to: на каждом витке цикла счёт начинается заново
  tl.fromTo(
    box,
    { v: from },
    {
      v: to,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = fmt(box.v);
      }
    },
    at
  );
}

/** Стрелка курсора — «кто-то пользуется продуктом прямо сейчас». */
export function Pointer({ className = '' }: { className?: string }) {
  return (
    <svg
      data-pointer
      viewBox="0 0 24 24"
      className={`pointer-events-none absolute left-0 top-0 h-[22px] w-[22px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] ${className}`}
    >
      <path d="M4 2.5 19 13.2l-6.6 1.1 3.7 6.9-2.7 1.4-3.7-6.9L4.8 20Z" fill="#fff" stroke="#0a0a0a" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/** Галочка для подтверждений. */
export function Check({ className = '', color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path d="M3.5 8.4 6.6 11.4 12.5 4.8" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Рамка «экрана»: фиксированный размер, масштаб приходит сверху через --live-k. */
export function LiveScreen({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`absolute left-0 top-0 origin-top-left overflow-hidden ${className}`}
      style={{ width: LIVE_W, height: LIVE_H, transform: 'scale(var(--live-k, 1))' }}
    >
      {children}
    </div>
  );
}
