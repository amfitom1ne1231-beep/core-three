'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MARK_ARMS, MARK_CENTER } from './mark-geometry';
import { BEVEL, FACET_FILL } from './mark-palette';
import { isRevealed, preloaderLeaving } from '@/lib/boot';
import { CORE_PHASE, CORE_SPEED, silkClock } from '@/lib/silk';

gsap.registerPlugin(ScrollTrigger);

/** Глубина лучей: при наклоне «невозможный» треугольник расходится в объёме. */
const DEPTH = [70, 0, -70];
const PERSPECTIVE = 1400;
/** Куда разлетается каждый луч на скролле: вверх, вправо-вниз, влево-вниз. */
const OUT = [
  [0, -1],
  [0.87, 0.5],
  [-0.87, 0.5]
];

const ORIGIN = `50% ${MARK_CENTER.y}%`;

/**
 * Знак-объект первого экрана. Три луча — три ядра, как на знаке, но теперь
 * это предмет: прелоадер собирает знак, и он перелетает сюда; наклоняется
 * за курсором, и лучи на разной глубине расходятся в объёме; дышит светом
 * в такт ядрам материала; на скролле лучи разлетаются, и камера проходит
 * сквозь центр в манифест.
 */
export default function HeroMark() {
  const wrap = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const layers = useRef<HTMLDivElement[]>([]);
  const halos = useRef<HTMLDivElement[]>([]);
  const bloom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = wrap.current;
    const sc = scene.current;
    const tl = tilt.current;
    if (!w || !sc || !tl) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const cleanups: Array<() => void> = [];

    // Лучи стоят на разной глубине, но в покое совпадают пиксель в пиксель:
    // масштаб гасит перспективное увеличение каждого слоя.
    layers.current.forEach((el, i) => {
      gsap.set(el, { z: DEPTH[i], scale: (PERSPECTIVE - DEPTH[i]) / PERSPECTIVE });
    });

    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set(w, { opacity: 1 });
        return;
      }

      // 1. Перелёт из прелоадера. Если прелоадер уже отыграл (вернулись
      // на главную по ссылке) — прямоугольник устарел, знак просто проявляется.
      gsap.set(w, { opacity: 0 });
      const leaving: Promise<DOMRect | null> = isRevealed()
        ? Promise.resolve(null)
        : Promise.race([preloaderLeaving, new Promise<null>((r) => setTimeout(() => r(null), 7000))]);
      leaving.then((from) => {
        const to = sc.getBoundingClientRect();
        if (!from || !to.width) {
          gsap.fromTo(w, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'expo.out' });
          return;
        }
        const dx = from.left + from.width / 2 - (to.left + to.width / 2);
        const dy = from.top + from.height / 2 - (to.top + to.height / 2);
        gsap.fromTo(
          w,
          { x: dx, y: dy, scale: from.width / to.width, opacity: 1 },
          { x: 0, y: 0, scale: 1, duration: 1.5, ease: 'expo.inOut' }
        );
        // лучи на лету чуть проворачиваются — сборка продолжается
        gsap.from(layers.current, { rotate: -18, duration: 1.5, ease: 'expo.inOut', stagger: 0.05 });
      });

      // 2. Наклон за курсором
      if (fine) {
        const rx = gsap.quickTo(tl, 'rotationY', { duration: 0.9, ease: 'power3' });
        const ry = gsap.quickTo(tl, 'rotationX', { duration: 0.9, ease: 'power3' });
        const onMove = (e: PointerEvent) => {
          const nx = e.clientX / innerWidth - 0.5;
          const ny = e.clientY / innerHeight - 0.5;
          rx(nx * 34);
          ry(-ny * 24);
        };
        addEventListener('pointermove', onMove, { passive: true });
        cleanups.push(() => removeEventListener('pointermove', onMove));
      } else {
        // без мыши знак медленно покачивается сам
        gsap.to(tl, { rotationY: 16, rotationX: -6, duration: 5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }

      // 3. Скролл: лучи разлетаются, камера проходит сквозь центр
      const hero = w.closest('section');
      if (hero) {
        const size = () => sc.offsetWidth;
        // шкала таймлайна 0..1 = весь уход первого экрана; у каждого твина
        // явная длительность, иначе пропорции скраба плывут
        const st = gsap.timeline({
          defaults: { duration: 1 },
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8, invalidateOnRefresh: true }
        });
        /**
         * Лучи расходятся линейно, а не с разгоном.
         *
         * Было `power1.in`: на трети прокрутки первого экрана знак
         * расходился всего на девятую часть пути, и распад читался
         * только в самом конце — когда смотреть на него уже поздно.
         * Линейная шкала на той же прокрутке даёт треть, то есть жест
         * начинается с первого движения колеса. Конец тот же: дальше
         * менять нечего.
         */
        layers.current.forEach((el, i) => {
          st.to(el, { x: () => OUT[i][0] * size() * 0.7, y: () => OUT[i][1] * size() * 0.7, ease: 'none' }, 0);
        });
        // смаз в полёте: лучи уходят на скорости — смаз идёт за ней,
        // поэтому и он потерял разгон вместе с движением
        st.fromTo(layers.current, { filter: 'blur(0px)' }, { filter: 'blur(6px)', ease: 'power1.in' }, 0);
        // вспышка ядер в момент прохода сквозь центр
        if (bloom.current) {
          st.fromTo(
            bloom.current,
            { opacity: 0, scale: 0.4, xPercent: -50, yPercent: -50 },
            { opacity: 1, scale: 1.3, ease: 'power2.in', duration: 0.3 },
            0.42
          )
            .to(bloom.current, { opacity: 0, scale: 1.8, ease: 'power1.out', duration: 0.26 }, 0.72);
        }
        st.to(
          sc,
          {
            // к центру экрана и сквозь него; offsetLeft — без учёта трансформов перелёта
            x: () => innerWidth / 2 - (w.offsetLeft + sc.offsetWidth / 2),
            scale: 3.2,
            opacity: 0,
            ease: 'power2.in'
          },
          0
        );
      }
    });

    // 4. Дыхание ядер в такт материалу
    const t0 = performance.now();
    const breathe = () => {
      const t = silkClock.live ? silkClock.t : ((performance.now() - t0) / 1000) * 0.135;
      halos.current.forEach((h, i) => {
        const b = 0.78 + 0.22 * Math.sin(t * CORE_SPEED[i] * 3 + CORE_PHASE[i]);
        const wgt = silkClock.w[i] ?? 1;
        h.style.opacity = Math.max(0, Math.min(1, (b - 0.56) * 2.2 * wgt)).toFixed(3);
      });
    };
    if (!reduced) gsap.ticker.add(breathe);
    else breathe();

    return () => {
      gsap.ticker.remove(breathe);
      cleanups.forEach((f) => f());
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={wrap}
      aria-hidden
      // центр по вертикали через top, а не translate: трансформы здесь ведёт GSAP
      className="pointer-events-none absolute bottom-[-9svh] right-[-12vw] z-0 w-[84vw] max-w-[460px] sm:right-[-4vw] lg:bottom-auto lg:right-[clamp(24px,6vw,120px)] lg:top-[calc(50%-min(32vh,20vw))] lg:w-[min(64vh,40vw)] lg:max-w-none"
    >
      <div
        ref={scene}
        className="relative aspect-square w-full"
        // точка схода — центр знака: иначе слои разной глубины в покое не совпадут
        style={{ perspective: PERSPECTIVE, perspectiveOrigin: ORIGIN }}
      >
        {/* свет ядер: вспыхивает, когда камера проходит сквозь центр знака */}
        <div
          ref={bloom}
          // центрирование — через xPercent/yPercent в таймлайне: трансформы здесь ведёт GSAP
          className="pointer-events-none absolute left-1/2 aspect-square w-[90%] rounded-full opacity-0"
          style={{
            top: `${MARK_CENTER.y}%`,
            background:
              'radial-gradient(circle, rgba(236,243,252,0.95) 0%, rgba(160,195,235,0.55) 22%, rgba(110,155,204,0.18) 48%, rgba(110,155,204,0) 70%)'
          }}
        />
        <div ref={tilt} className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
          {MARK_ARMS.map((arm, i) => (
            <div
              key={arm.arm}
              ref={(el) => {
                if (el) layers.current[i] = el;
              }}
              className="absolute inset-0"
              style={{ transformOrigin: ORIGIN }}
            >
              {/* свечение ядра: размытый силуэт луча, дышит прозрачностью */}
              <div
                ref={(el) => {
                  if (el) halos.current[i] = el;
                }}
                className="absolute inset-0 will-change-[opacity]"
                style={{ filter: 'blur(28px)', opacity: 0.5 }}
              >
                <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
                  {arm.facets.map((f) => (
                    <path key={f.facet} d={f.d} fill="#6e9bcc" />
                  ))}
                </svg>
              </div>
              <svg viewBox="0 0 100 100" className="relative h-full w-full overflow-visible">
                <defs>
                  {arm.facets.map((f) => {
                    const [a, b] = FACET_FILL[f.facet] ?? FACET_FILL.column;
                    return (
                      <linearGradient key={f.facet} id={`hm-${arm.arm}-${f.facet}`} x1="0" y1="0" x2="0.35" y2="1">
                        <stop offset="0" stopColor={a} />
                        <stop offset="1" stopColor={b} />
                      </linearGradient>
                    );
                  })}
                </defs>
                {/* кромка: светлый контур под гранями заполняет зазоры, как фаски логотипа */}
                <g fill="none" stroke={BEVEL} strokeWidth="1.6" strokeLinejoin="round">
                  {arm.facets.map((f) => (
                    <path key={f.facet} d={f.d} />
                  ))}
                </g>
                {arm.facets.map((f) => (
                  <path key={f.facet} d={f.d} fill={`url(#hm-${arm.arm}-${f.facet})`} />
                ))}
              </svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
