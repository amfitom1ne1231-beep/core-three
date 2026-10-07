'use client';

import { useEffect, useRef, useState } from 'react';
import { createMark3D, type Mark3D } from '@/lib/mark3d';
import { preloaderLeaving } from '@/lib/boot';
import { isPhone } from '@/lib/phone';
import { onThemeChange, readTheme, type Theme } from '@/lib/theme';

/** Свет знака по теме: шар из тёмной студии или из светлой (brand/mark-live.mjs). */
const capOf = (t: Theme) => (t === 'light' ? '/mark/live/matcap-light.webp' : '/mark/live/matcap.webp');

/**
 * Знак первого экрана на телефоне: живая модель под пальцем (lib/mark3d).
 *
 * Сначала стоит снятый в Blender кадр — он есть в HTML и виден сразу;
 * модель догружается под открытым экраном и встаёт на его место без шва:
 * в покое они совпадают. Так решил заказчик: прелоадер ждёт только шрифты.
 *
 * Слабый телефон (за первые секунды кадры не держатся) и «уменьшение
 * движения» остаются со снятым кадром — сайт упрощается сам.
 *
 * Палец: вбок — знак крутится, вверх и вниз — листается экран (поэтому
 * `touch-action: pan-y`), касание — лучи расходятся и собираются.
 */
export default function PhoneMark({ className = '' }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    // шире телефона этот знак скрыт — модель там не поднимаем
    if (!el || !isPhone() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let mark: Mark3D | null = null;
    let gone = false;
    let samples = 0;
    let low = 0;
    const offTheme = onThemeChange((t) => mark?.setMatcap(capOf(t)));
    createMark3D(el, {
      matcap: capOf(readTheme()),
      onReady: () => setLive(true),
      onFps: (fps) => {
        // смотрим первые четыре секунды: три полусекунды подряд ниже 42 к/с — не тянет
        if (samples++ > 8 || !mark) return;
        low = fps < 42 ? low + 1 : 0;
        if (low >= 3) {
          mark.destroy();
          mark = null;
          setLive(false);
        }
      }
    }).then((m) => {
      if (gone) m?.destroy();
      else mark = m;
    });
    return () => {
      gone = true;
      offTheme();
      mark?.destroy();
    };
  }, []);

  // знак прелоадера не гаснет посреди экрана, а прилетает сюда
  useEffect(() => {
    let off = false;
    preloaderLeaving.then((from) => {
      const el = wrap.current;
      if (off || !from || !el || !isPhone()) return;
      const to = el.getBoundingClientRect();
      if (!to.width) return;
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      // знак занимает около 62% своей рамки — садится размер в размер
      const scale = from.width / (to.width * 0.62);
      el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: 'none' }], {
        duration: 950,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
      });
    });
    return () => {
      off = true;
    };
  }, []);

  return (
    <div ref={wrap} data-hero-mark className={`relative aspect-square select-none ${className}`}>
      {/* свечение — готовым градиентом, без размытия на странице */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[-14%]"
        style={{ background: 'radial-gradient(closest-side, rgb(var(--accent-rgb) / 0.24), rgb(var(--accent-rgb) / 0.07) 55%, transparent 78%)' }}
      />
      {/* Снятый знак: в тёмной студии и в светлой — виден тот, чья тема (стили
          в globals.css). Светлый ленивый: на тёмной странице он не грузится. */}
      {(['dark', 'light'] as const).map((t) => (
        // eslint-disable-next-line @next/next/no-img-element -- кадр из Blender уже нужного размера, оптимизатору тут делать нечего
        <img
          key={t}
          src={t === 'light' ? '/mark/live/poster-light.webp' : '/mark/live/turn-000.webp'}
          alt=""
          width={560}
          height={560}
          draggable={false}
          loading={t === 'light' ? 'lazy' : 'eager'}
          fetchPriority={t === 'light' ? 'auto' : 'high'}
          className={`only-${t} absolute inset-0 h-full w-full transition-opacity duration-300`}
          style={{ opacity: live ? 0 : 1 }}
        />
      ))}
      <canvas
        ref={canvas}
        role="img"
        aria-label="Знак CoreThree: три луча — честность, скорость, профессионализм"
        className="absolute inset-0 h-full w-full touch-pan-y transition-opacity duration-300"
        style={{ opacity: live ? 1 : 0 }}
      />
    </div>
  );
}
