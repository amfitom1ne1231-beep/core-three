'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { isRevealed, revealReady } from '@/lib/boot';

/**
 * Проявление текста через шум: порядок появления знаков берётся не слева
 * направо, а из шумового поля — буквы всплывают пятнами, как проступает
 * изображение. Совпадает с фактурой материала на фоне.
 */

/** Дешёвый двумерный value-noise: хватает, чтобы задержки не выглядели случайной пылью. */
function noise2(x: number, y: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = noise2(xi, yi);
  const b = noise2(xi + 1, yi);
  const c = noise2(xi, yi + 1);
  const d = noise2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export default function RevealText({
  text,
  as: Tag = 'span',
  className,
  charClassName,
  delay = 0,
  spread = 0.55,
  scale = 0.16,
  decorative = false
}: {
  text: string;
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div';
  className?: string;
  charClassName?: string;
  /** Сдвиг начала относительно снятия прелоадера. */
  delay?: number;
  /** Разброс задержек между знаками, секунды. */
  spread?: number;
  /** Масштаб шума: меньше — крупнее пятна. */
  scale?: number;
  /** Текст озвучивает родитель — тогда блок скрывается от читалок целиком. */
  decorative?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const chars = el.querySelectorAll<HTMLElement>('[data-char]');
    if (!chars.length) return;

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(chars, { opacity: 1, y: 0, filter: 'none' });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(chars, { opacity: 0, y: '0.3em', filter: 'blur(10px)' });

      const showNow = () => gsap.set(chars, { opacity: 1, y: 0, filter: 'none' });

      const run = () => {
        // Кадры на скрытой вкладке не идут — текст остался бы невидимым.
        // Показываем сразу: анимацию всё равно никто не увидит.
        if (document.hidden) {
          showNow();
          return;
        }
        chars.forEach((char) => {
          const col = Number(char.dataset.col ?? 0);
          const row = Number(char.dataset.row ?? 0);
          const n = smooth(col * scale, row * 1.7);
          gsap.to(char, {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.85,
            ease: 'power2.out',
            delay: delay + n * spread
          });
        });
      };

      if (isRevealed()) run();
      else revealReady.then(run);
    }, el);

    return () => ctx.revert();
  }, [delay, spread, scale]);

  const lines = text.split('\n');

  return (
    <Tag
      ref={ref as never}
      className={className}
      aria-label={decorative ? undefined : text}
      aria-hidden={decorative || undefined}
    >
      {lines.map((line, row) => (
        <span key={row} className="inline" aria-hidden>
          {[...line].map((ch, col) => (
            <span
              key={col}
              data-char
              data-col={col}
              data-row={row}
              className={charClassName}
              style={{ display: 'inline-block', whiteSpace: 'pre', willChange: 'opacity, transform, filter' }}
            >
              {ch}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
