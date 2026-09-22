'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * Знак в объёме — рендер Blender (brand/blender/mark3d.py) с прозрачным фоном.
 *
 * Прозрачное видео браузеры понимают по-разному: Chrome и Firefox —
 * WebM с альфой (VP9), Safari — только HEVC с альфой. Выбираем по
 * движку, а не списком `<source>`: Chrome на маке тоже заявляет, что
 * играет HEVC, и взял бы его — без прозрачности, на чёрной плашке.
 *
 * Два ролика:
 *  - `loop` — петля 8 с: знак собран, лучи расходятся, камера открывает
 *    объём, лучи возвращаются. Играет сама;
 *  - `build` — 4 с: из разобранного в собранный. Не играет сама —
 *    ей управляют снаружи (`seek`), например ходом брифа.
 *
 * Грузится, только когда подошла к экрану; вне экрана и на скрытой
 * вкладке — пауза. При reduced motion и Save-Data — только постер.
 */

export type MarkVideoHandle = {
  /** Довести ролик до доли 0..1 плавно, проигрыванием вперёд или прыжком назад. */
  seek: (fraction: number) => void;
};

type Props = {
  variant: 'loop' | 'build';
  className?: string;
  /** Для `build`: с какой доли начинать. */
  initial?: number;
};

const isSafari = () =>
  typeof navigator !== 'undefined' && /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);

const MarkVideo = forwardRef<MarkVideoHandle, Props>(function MarkVideo({ variant, className = '', initial = 0 }, ref) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  // постер снимаем, когда пошёл первый кадр: видео прозрачное, и постер
  // под ним просвечивал бы вторым знаком
  const [ready, setReady] = useState(false);
  const target = useRef(initial);
  const raf = useRef(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (reduced || conn?.saveData) return;

    const file = `/video/mark/${variant}.${isSafari() ? 'mov' : 'webm'}`;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setSrc((s) => s ?? file);
        const v = video.current;
        if (!v || variant !== 'loop') return;
        if (e.isIntersecting && !document.hidden) v.play().catch(() => {});
        else v.pause();
      },
      { rootMargin: '300px' }
    );
    io.observe(el);
    const onHide = () => {
      const v = video.current;
      if (!v || variant !== 'loop') return;
      if (document.hidden) v.pause();
      else v.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [variant]);

  /**
   * Ход к цели: вперёд — обычным проигрыванием (плавно при любой частоте
   * ключевых кадров), назад — прыжком. Останавливаемся, дойдя до цели.
   */
  const drive = () => {
    cancelAnimationFrame(raf.current);
    const v = video.current;
    if (!v || !v.duration) return;
    const to = target.current * v.duration;
    if (to < v.currentTime - 0.05) {
      v.pause();
      v.currentTime = to;
      return;
    }
    if (to - v.currentTime < 0.04) {
      v.pause();
      return;
    }
    v.play().catch(() => {});
    const tick = () => {
      if (v.currentTime >= to - 0.02) {
        v.pause();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  useImperativeHandle(ref, () => ({
    seek: (fraction: number) => {
      target.current = Math.max(0, Math.min(1, fraction));
      drive();
    }
  }));

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const poster = `/video/mark/${variant}-poster.webp`;

  return (
    <div ref={wrap} className={`relative ${className}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300"
        style={{ opacity: ready ? 0 : 1 }}
        draggable={false}
      />
      {src && (
        <video
          ref={video}
          src={src}
          className="absolute inset-0 h-full w-full object-contain"
          muted
          playsInline
          loop={variant === 'loop'}
          autoPlay={variant === 'loop'}
          preload="auto"
          onLoadedData={() => setReady(true)}
          onLoadedMetadata={(e) => {
            if (variant === 'build') {
              e.currentTarget.currentTime = initial * e.currentTarget.duration;
              drive();
            }
          }}
        />
      )}
    </div>
  );
});

export default MarkVideo;
