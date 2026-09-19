'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Плавный скролл. При prefers-reduced-motion не включается вовсе —
 * инерция для части людей физически неприятна.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      touchMultiplier: 1.6
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
