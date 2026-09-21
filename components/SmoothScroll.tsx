'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { setLenis } from '@/lib/scroll';

gsap.registerPlugin(ScrollTrigger);

/** Предел скоса, градусы: дальше текст начинает читаться криво. */
const SKEW_MAX = 2.2;
/** Градусов на пиксель скорости за кадр. */
const SKEW_K = 0.06;

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

    /**
     * 1.1 секунды хода читались как задержка: колесо уже остановилось,
     * а страница ещё едет. 0.85 с и кривая четвёртой степени — трогается
     * резче, садится так же мягко, и рука перестаёт чувствовать, что
     * страница отвечает с опозданием.
     */
    const lenis = new Lenis({
      duration: 0.85,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
      touchMultiplier: 1.6
    });

    setLenis(lenis);
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    /**
     * Скос по скорости скролла: страница «тянется» за колесом. Только
     * для мыши — на телефоне скролл нативный, а кадры дороже.
     *
     * Размытие отсюда убрано, а стили в покое больше не снимаются.
     * Из-за них и мерцало: `filter` заводит элементу собственный слой,
     * а снятие `transform` и `filter` возвращает текст с серой
     * растеризации на субпиксельную. На каждой остановке прокрутки
     * крупные заголовки перерисовывались целиком — это и читалось как
     * вспышка на долю секунды. Теперь скос просто паркуется в ноль:
     * элемент всё время в одном режиме, перерисовывать нечего.
     */
    let skew = 0;
    let dirty = false;
    const skewTick = () => {
      const target = gsap.utils.clamp(-SKEW_MAX, SKEW_MAX, -lenis.velocity * SKEW_K);
      skew += (target - skew) * 0.12;
      const els = () => document.querySelectorAll<HTMLElement>('[data-skew]');
      if (Math.abs(skew) < 0.01 && Math.abs(target) < 0.01) {
        // приехали: паркуем ровно в ноль и больше ничего не трогаем
        if (dirty) {
          els().forEach((el) => {
            el.style.transform = 'skewY(0deg)';
          });
          dirty = false;
        }
        skew = 0;
        return;
      }
      dirty = true;
      els().forEach((el) => {
        el.style.transform = `skewY(${skew.toFixed(3)}deg)`;
      });
    };
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine) gsap.ticker.add(skewTick);

    return () => {
      setLenis(null);
      gsap.ticker.remove(tick);
      gsap.ticker.remove(skewTick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return null;
}
