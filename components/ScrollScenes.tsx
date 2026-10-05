'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Переходы между сценами по мотивам Spyker. Всё привязано к скроллу
 * (scrub), поэтому движение идёт ровно с пальцем или колесом и
 * откатывается назад при прокрутке вверх.
 *
 *  - data-hero: первый экран уходит вглубь — уменьшается и гаснет;
 *  - data-reveal="clip": медиа раскрывается из рамки в полный размер;
 *  - data-parallax-media: ролик внутри рамки едет медленнее самой рамки;
 *  - data-recede: секция, которую покидают, чуть отступает и тускнеет,
 *    а следующая наезжает поверх — появляется глубина между сценами.
 *
 * При prefers-reduced-motion ничего из этого не включается.
 *
 * На телефоне — тоже: первый экран гас и уменьшался, пока его кнопки
 * были ещё на виду, а уходящая секция тускнела под пальцем, хотя её ещё
 * читали — на экране в один блок высотой «глубина между сценами» выглядит
 * поломкой. Там блоки просто стоят и появляются один раз (Reveal).
 */
export default function ScrollScenes() {
  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
        const hero = document.querySelector<HTMLElement>('[data-hero]');
        if (hero) {
          gsap.to(hero, {
            scale: 0.86,
            yPercent: -4,
            opacity: 0,
            ease: 'none',
            transformOrigin: '50% 35%',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
          });
        }

        document.querySelectorAll<HTMLElement>('[data-reveal="clip"]').forEach((el) => {
          gsap.fromTo(
            el,
            { clipPath: 'inset(9% 7% 9% 7% round 16px)' },
            {
              clipPath: 'inset(0% 0% 0% 0% round 0px)',
              ease: 'none',
              scrollTrigger: { trigger: el, start: 'top 96%', end: 'top 48%', scrub: 0.5 }
            }
          );
        });

        // ролик в рамке едет медленнее рамки — глубина внутри окна
        document.querySelectorAll<HTMLElement>('[data-parallax-media]').forEach((el) => {
          gsap.fromTo(
            el,
            { yPercent: -6 },
            {
              yPercent: 6,
              ease: 'none',
              scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
            }
          );
        });

        document.querySelectorAll<HTMLElement>('[data-recede]').forEach((el) => {
          gsap.to(el, {
            scale: 0.955,
            opacity: 0.4,
            ease: 'none',
            transformOrigin: '50% 100%',
            scrollTrigger: { trigger: el, start: 'bottom 55%', end: 'bottom top', scrub: true }
          });
        });
      });
    });
    return () => ctx.revert();
  }, []);

  return null;
}
