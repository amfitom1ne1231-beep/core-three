'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { setLenis } from '@/lib/scroll';

gsap.registerPlugin(ScrollTrigger);

// На iPhone адресная строка прячется и возвращается при прокрутке — окно
// меняет высоту, и ScrollTrigger пересчитывал все привязки прямо на ходу:
// анимации дёргались. Смену высоты на телефоне он теперь пропускает;
// поворот экрана и настоящая смена ширины пересчитываются как раньше.
ScrollTrigger.config({ ignoreMobileResize: true });

/** Идёт ли такт Lenis: пока страница едет, тикеру засыпать нельзя. */
let lenisTicking = false;
/** Будит тикер GSAP, если он спит. Задаёт сторож тикера, зовёт Lenis. */
let rouseTicker: () => void = () => {};

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
  /**
   * Тикер GSAP спит, когда на странице ничего не движется.
   *
   * Сам он не засыпает никогда: ScrollTrigger нарочно вешает на него пустой
   * слушатель. В итоге страница просыпалась 60 раз в секунду всё время,
   * пока открыта, — и на каждом таком кадре браузер заново считал стили
   * всех идущих CSS-анимаций, хотя на экране ничего не менялось (замер
   * по трассировке — BRIEF.md, раздел 50). Здесь тикер усыпляется, когда
   * нет ни идущих, ни ожидающих анимаций, и будится первым же движением:
   * прокруткой, колесом, касанием, клавишей. Новую анимацию GSAP будит сам.
   */
  useEffect(() => {
    let asleep = false;
    let frameAtSleep = 0;
    let quiet = 0;
    const busy = () =>
      lenisTicking || gsap.globalTimeline.getChildren(true, true, true).some((a) => !a.paused() && a.totalProgress() < 1);
    const nap = window.setInterval(() => {
      // GSAP проснулся сам (кто-то завёл анимацию) — снова следим
      if (asleep && gsap.ticker.frame !== frameAtSleep) asleep = false;
      if (asleep) return;
      quiet = busy() ? 0 : quiet + 1;
      if (quiet >= 3) {
        asleep = true;
        frameAtSleep = gsap.ticker.frame;
        gsap.ticker.sleep();
      }
    }, 400);
    const rouse = () => {
      quiet = 0;
      if (!asleep) return;
      asleep = false;
      gsap.ticker.wake();
    };
    const events = ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown', 'resize'] as const;
    events.forEach((name) => addEventListener(name, rouse, { passive: true, capture: true }));
    rouseTicker = rouse;
    return () => {
      rouseTicker = () => {};
      clearInterval(nap);
      events.forEach((name) => removeEventListener(name, rouse, { capture: true }));
      gsap.ticker.wake();
    };
  }, []);

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
    // для проверок из консоли: нативный scrollTo при живом Lenis бесполезен
    if (process.env.NODE_ENV !== 'production') (window as { __lenis?: Lenis }).__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.lagSmoothing(0);

    /**
     * Такт Lenis идёт, только пока страница едет.
     *
     * Раньше он висел в тикере GSAP постоянно, и тикер из-за этого никогда
     * не засыпал: страница просыпалась 60 раз в секунду, даже когда её
     * никто не трогал, а с ней на каждом кадре пересчитывались все идущие
     * анимации (замер по трассировке — BRIEF.md, раздел 50). Теперь такт
     * включают колесо, палец и программная прокрутка, а выключается он
     * сам, когда Lenis доехал.
     *
     * Скоса заголовков по скорости прокрутки здесь больше нет. Заголовок
     * шириной в экран на ходу вставал криво относительно линий и кнопок
     * рядом — до 1,2° в Chrome и до 2° в Safari, где колесо отдаёт скорость
     * рывками (38 px перепада между краями строки; замер — BRIEF.md,
     * раздел 51). Вместе с ним ушли четыре постоянных слоя под эти заголовки.
     */
    let ticking = false;
    let idle = 0;
    const tick = () => {
      lenis.raf(performance.now());
      // полсекунды покоя с запасом: гасить такт на первом же тихом кадре
      // нельзя — между двумя щелчками колеса бывает кадр без движения
      idle = lenis.isScrolling === 'smooth' ? 0 : idle + 1;
      if (idle > 30) {
        ticking = false;
        lenisTicking = false;
        gsap.ticker.remove(tick);
      }
    };
    const wake = () => {
      idle = 0;
      // программная прокрутка приходит и без событий мыши — тикер мог спать
      rouseTicker();
      if (ticking) return;
      ticking = true;
      lenisTicking = true;
      // Lenis считает шаг от своего прошлого кадра. После простоя тот был
      // давно, и первая же анимация «доезжала» за один кадр — страница
      // прыгала без инерции. Сверяем его часы до того, как он тронется.
      lenis.raf(performance.now());
      gsap.ticker.add(tick);
    };
    lenis.on('virtual-scroll', wake);
    // программная прокрутка (якоря, «в начало», экскурсия) идёт мимо колеса
    const scrollTo = lenis.scrollTo.bind(lenis);
    lenis.scrollTo = ((...args: Parameters<Lenis['scrollTo']>) => {
      wake();
      return scrollTo(...args);
    }) as Lenis['scrollTo'];
    wake();

    return () => {
      setLenis(null);
      lenisTicking = false;
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return null;
}
