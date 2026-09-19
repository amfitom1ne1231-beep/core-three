'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * Плавный скролл и его связка с ScrollTrigger.
 *
 * Lenis двигает страницу собственным циклом, поэтому ScrollTrigger обязан
 * обновляться от него, а сам Lenis — тикать из тикера GSAP. Иначе
 * закреплённые секции отстают от контента на кадр и дрожат.
 *
 * При prefers-reduced-motion инерция не включается вовсе: для части людей
 * она физически неприятна. ScrollTrigger при этом продолжает работать
 * на нативном скролле.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      touchMultiplier: 1.6
    });

    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return null;
}
