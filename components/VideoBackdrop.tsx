'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Фоновое видео. Всё, что нужно, чтобы оно не навредило:
 *
 *  - грузится только когда секция подходит к экрану;
 *  - на скрытой вкладке и вне экрана ставится на паузу;
 *  - при prefers-reduced-motion или Save-Data не грузится вовсе —
 *    остаётся постер;
 *  - цикл бесшовный: два элемента с перекрёстным затуханием, потому что
 *    ролик из генератора не склеивается сам с собой;
 *  - кадр слегка увеличен, чтобы срезать водяной знак генератора.
 */
export default function VideoBackdrop({
  src,
  poster,
  className = '',
  crop = 1.26,
  fade = 0.8,
  opacity = 0.55
}: {
  src: string;
  poster: string;
  className?: string;
  /** Увеличение кадра: срезает водяной знак по правому нижнему углу. */
  crop?: number;
  /** Длительность перекрёстного затухания, секунды. */
  fade?: number;
  opacity?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const a = useRef<HTMLVideoElement>(null);
  const b = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const conn = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const cheap = Boolean(conn?.saveData) || /(^|-)2g$/.test(conn?.effectiveType ?? '');
    if (reduced || cheap) return;

    const io = new IntersectionObserver(([entry]) => setEnabled(entry.isIntersecting), {
      rootMargin: '300px'
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const first = a.current;
    const second = b.current;
    if (!enabled || !first || !second) return;

    let front = first;
    let back = second;
    let swapping = false;

    const play = (v: HTMLVideoElement) => {
      v.play().catch(() => {
        /* автозапуск могли запретить — остаётся постер */
      });
    };

    const onTime = () => {
      if (swapping || !front.duration) return;
      if (front.currentTime < front.duration - fade) return;
      swapping = true;
      back.currentTime = 0;
      play(back);
      back.style.opacity = '1';
      front.style.opacity = '0';
      const prev = front;
      front = back;
      back = prev;
      window.setTimeout(() => {
        prev.pause();
        swapping = false;
      }, fade * 1000);
    };

    first.style.opacity = '1';
    second.style.opacity = '0';
    play(first);

    first.addEventListener('timeupdate', onTime);
    second.addEventListener('timeupdate', onTime);

    const onHide = () => {
      if (document.hidden) {
        first.pause();
        second.pause();
      } else {
        play(front);
      }
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      first.removeEventListener('timeupdate', onTime);
      second.removeEventListener('timeupdate', onTime);
      document.removeEventListener('visibilitychange', onHide);
      first.pause();
      second.pause();
    };
  }, [enabled, fade]);

  const common = 'absolute inset-0 h-full w-full object-cover';
  const style = {
    transform: `scale(${crop}) translate(-2.5%, -3.5%)`,
    transition: `opacity ${fade}s linear`,
    filter: 'saturate(0.55) contrast(1.05)'
  };

  return (
    <div
      ref={wrap}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity }}
      aria-hidden
    >
      {/* постер лежит снизу: он же единственный кадр при reduced-motion */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${poster})`, transform: style.transform, filter: style.filter }}
      />
      <video ref={a} className={common} style={style} src={enabled ? src : undefined} muted playsInline preload="none" />
      <video ref={b} className={common} style={style} src={enabled ? src : undefined} muted playsInline preload="none" />
    </div>
  );
}
