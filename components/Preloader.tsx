'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Mark from './Mark';
import { MARK_CENTER } from './mark-geometry';
import { fontsReady, markLeaving, markRevealed, silkReady, withTimeout } from '@/lib/boot';

/**
 * Прелоадер. Знак собирается из трёх лучей — ровно из тех, что составляют
 * логотип. Счётчик идёт по настоящим событиям: шрифты и первый кадр
 * материала, а не по таймеру.
 */
export default function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const markBox = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = root.current;
    const box = markBox.current;
    if (!el || !box) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Материал живёт только на главной. На остальных страницах его кадр
    // не придёт никогда, и прелоадер простоял бы до таймаута.
    const silk = document.querySelector('canvas[data-silk]') ? silkReady : Promise.resolve();
    const arms = box.querySelectorAll<SVGGElement>('[data-arm]');
    const shown = { value: 0 };

    // пока грузимся — скролл не нужен
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      delete document.documentElement.dataset.booting;
      markLeaving(null);
      clearTimeout(watchdog);
      document.documentElement.style.overflow = prevOverflow;
      markRevealed();
      setDone(true);
    };

    // Страховка от любого незакрытого обещания в цепочке.
    const watchdog = setTimeout(finish, 6000);

    // На скрытой вкладке requestAnimationFrame не тикает: анимация встанет,
    // счётчик замрёт, первый кадр материала не придёт. Прелоадер — вежливость
    // для того, кто смотрит; в фоне он только риск, поэтому снимаем его сразу.
    if (document.hidden) {
      finish();
      return () => clearTimeout(watchdog);
    }
    const onHide = () => {
      if (document.hidden) finish();
    };
    document.addEventListener('visibilitychange', onHide);

    if (reduced) {
      // без анимации: ждём готовности и убираем перекрытие
      Promise.all([withTimeout(fontsReady(), 3000), withTimeout(silk, 3000)]).then(finish);
      return () => {
        clearTimeout(watchdog);
        document.removeEventListener('visibilitychange', onHide);
        document.documentElement.style.overflow = prevOverflow;
      };
    }

    const ctx = gsap.context(() => {
      // сборка знака: лучи приходят на место поворотом вокруг общего центра
      gsap.set(arms, { opacity: 0, scale: 0.86, rotate: -42, svgOrigin: `${MARK_CENTER.x} ${MARK_CENTER.y}` });
      gsap.to(arms, {
        opacity: 1,
        scale: 1,
        rotate: 0,
        duration: 1.05,
        ease: 'power3.out',
        stagger: 0.13
      });
    }, box);

    // счётчик: три источника с весами, каждый двигает цель по факту
    let target = 0;
    const bump = (weight: number) => {
      target = Math.min(1, target + weight);
      gsap.to(shown, {
        value: target,
        duration: 0.7,
        ease: 'power2.out',
        onUpdate: () => {
          if (counter.current) {
            counter.current.textContent = String(Math.round(shown.value * 100)).padStart(3, '0');
          }
        }
      });
    };

    const minTime = new Promise<void>((r) => setTimeout(r, 900));
    const steps: Array<Promise<unknown>> = [
      withTimeout(fontsReady(), 4000).then(() => bump(0.4)),
      withTimeout(silk, 4000).then(() => bump(0.4)),
      minTime.then(() => bump(0.2))
    ];

    /**
     * Куда уходит знак.
     *
     * На главной его подхватывает знак первого экрана: прелоадер отдаёт
     * свой прямоугольник, и тот перелетает в hero. На остальных страницах
     * такого знака нет, и раньше прелоадер просто гас — знак исчезал
     * посреди экрана, а через мгновение такой же возникал в шапке. Теперь
     * он сам улетает в шапку и садится ровно на её знак: это один и тот же
     * предмет, который просто встал на своё место.
     */
    const headerMark = document.querySelector<HTMLElement>('[data-header-mark]');
    const flyToHeader = !document.querySelector('[data-hero-mark]') && headerMark;
    if (flyToHeader) document.documentElement.dataset.booting = '';

    Promise.all(steps).then(() => {
      const to = headerMark?.getBoundingClientRect();
      if (flyToHeader && to && to.width && to.top >= 0) {
        const from = box.getBoundingClientRect();
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        const land = () => {
          delete document.documentElement.dataset.booting;
        };
        gsap
          .timeline({ onComplete: finish })
          .to(counter.current, { opacity: 0, y: 6, duration: 0.3, ease: 'power2.in' })
          // знак чуть собирается перед прыжком — как пружина
          .to(box, { scale: 0.92, duration: 0.26, ease: 'power2.inOut' }, 0)
          .to(box, { x: dx, y: dy, scale: to.width / from.width, duration: 1.05, ease: 'expo.inOut' }, 0.22)
          // лучи на лету проворачиваются на треть оборота — силуэт тот же,
          // а полёт читается сборкой, а не переносом картинки
          .to(arms, { rotate: 120, duration: 1.05, ease: 'expo.inOut', svgOrigin: `${MARK_CENTER.x} ${MARK_CENTER.y}` }, 0.22)
          .to(el, { backgroundColor: 'rgba(0,0,0,0)', duration: 0.8, ease: 'power2.inOut' }, 0.42)
          .call(land, undefined, 1.27)
          .to(box, { opacity: 0, duration: 0.2 }, 1.27);
        return;
      }
      gsap
        .timeline({ onComplete: finish })
        .to(box, { scale: 1.06, duration: 0.5, ease: 'power2.inOut' })
        .to(el, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, '-=0.25')
        // вместе с началом затухания: знак первого экрана подхватывает полёт из этой точки
        .call(() => markLeaving(box.getBoundingClientRect()), undefined, '<');
    });

    return () => {
      clearTimeout(watchdog);
      document.removeEventListener('visibilitychange', onHide);
      ctx.revert();
      document.documentElement.style.overflow = prevOverflow;
      delete document.documentElement.dataset.booting;
    };
  }, []);

  if (done) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-bg"
      aria-hidden
    >
      <div ref={markBox} className="w-[clamp(64px,9vw,104px)] text-fg">
        <Mark className="h-full w-full" />
      </div>
      <div className="mt-7 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-rail text-faint">
        <span ref={counter}>000</span>
        <span>/ 100</span>
      </div>
    </div>
  );
}
