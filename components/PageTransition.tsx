'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import MarkColor from './MarkColor';
import { DEMOS } from '@/content/concepts';
import { SITE } from '@/content/site';
import { closePageGate, isRevealed, openPageGate } from '@/lib/boot';
import { scrollToTop } from '@/lib/scroll';

gsap.registerPlugin(ScrollTrigger);

/**
 * Переход между страницами — три луча знака.
 *
 * Экран делится на три сектора по 120° — ровно как расходятся лучи знака
 * из центра: вверх, вправо-вниз и влево-вниз. Сектора съезжаются к центру,
 * их стыки складываются в «игрек» — остов знака, — поверх проявляется сам
 * знак и имя страницы, куда идём. Пока экран накрыт, меняется маршрут;
 * потом сектора расходятся наружу, и открывается новая страница.
 *
 * Ссылки не переписываются по одной: переход ловит клик на уровне
 * документа, до того как его увидит `next/link`. Поэтому он работает
 * одинаково для `Link`, для обычных `<a>` и для ссылок, которые появятся
 * завтра. Назад-вперёд в браузере шторка не закрывает — страница уже
 * сменилась, — но расходится так же, чтобы жест был один.
 *
 * Чего не трогает: новые вкладки, модификаторы, скачивания, якоря на той
 * же странице, чужие домены и `data-no-transition`. При reduced motion
 * и на скрытой вкладке переход не включается вовсе — там кадры не идут.
 */

const NAMES: Record<string, string> = {
  '/': 'Главная',
  '/contact': 'Обсудить проект',
  '/concepts': 'Концепты',
  '/about': 'О нас',
  '/privacy': 'Политика',
  '/consent': 'Согласие',
  ...Object.fromEntries(SITE.pages.map((p) => [p.href, p.label])),
  ...Object.fromEntries(DEMOS.map((d) => [`/concepts/${d.slug}`, d.title]))
};

/** Направления лучей знака на экране, градусы: вверх, вправо-вниз, влево-вниз. */
const RAYS = [-90, 30, 150];

type Phase = 'idle' | 'cover' | 'wait' | 'reveal';

function sectors(w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  // радиус с запасом: хорда сектора на 30° от биссектрисы должна уйти за углы
  const r = Math.hypot(w, h);
  const at = (deg: number, k = r) => {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * k, cy + Math.sin(a) * k] as const;
  };
  return RAYS.map((a, i) => {
    const b = RAYS[(i + 1) % 3] + (i === 2 ? 360 : 0);
    const mid = (a + b) / 2;
    // сектора заходят друг на друга на градус: встык между соседними
    // многоугольниками остаётся волосяная щель сглаживания, и в неё
    // просвечивала страница
    const pts = [[cx, cy], at(a - 1), at(mid), at(b + 1)];
    const d = `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')} Z`;
    const rad = (mid * Math.PI) / 180;
    return { d, dx: Math.cos(rad) * r, dy: Math.sin(rad) * r, ray: at(a, Math.max(w, h)) };
  });
}

export default function PageTransition() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const center = useRef<HTMLDivElement>(null);
  const phase = useRef<Phase>('idle');
  const target = useRef<string | null>(null);
  const [geo, setGeo] = useState(() => ({ w: 1440, h: 900, s: sectors(1440, 900) }));
  const [label, setLabel] = useState('');

  const measure = useCallback(() => {
    const w = innerWidth;
    const h = innerHeight;
    setGeo({ w, h, s: sectors(w, h) });
    return sectors(w, h);
  }, []);

  /** Расхождение: сектора уходят наружу, ворота страницы открываются. */
  const reveal = useCallback((fromCovered: boolean) => {
    const el = root.current;
    const s = svg.current;
    const c = center.current;
    if (!el || !s || !c) return;
    phase.current = 'reveal';
    const panels = s.querySelectorAll<SVGPathElement>('[data-panel]');
    const rays = s.querySelectorAll<SVGLineElement>('[data-ray]');
    const geoNow = sectors(innerWidth, innerHeight);

    if (fromCovered) {
      // назад-вперёд: страница уже сменилась, шторка встаёт мгновенно
      el.style.visibility = 'visible';
      gsap.set(panels, { x: 0, y: 0 });
      gsap.set(c, { opacity: 0 });
      gsap.set(rays, { opacity: 0 });
    }

    // страница под шторкой уже на месте — с лёгким приближением навстречу
    const main = document.querySelector<HTMLElement>('main');
    const tl = gsap.timeline({
      onComplete: () => {
        el.style.visibility = 'hidden';
        phase.current = 'idle';
        if (main) gsap.set(main, { clearProps: 'transform,transformOrigin' });
      }
    });
    tl.to(c, { opacity: 0, scale: 1.08, duration: 0.3, ease: 'power2.in' }, 0)
      .to(rays, { opacity: 0, duration: 0.25 }, 0)
      .to(
        panels,
        {
          x: (i) => geoNow[i].dx,
          y: (i) => geoNow[i].dy,
          duration: 0.8,
          ease: 'expo.inOut',
          stagger: 0.05
        },
        0.08
      )
      // ворота открываются, когда сектора пошли: вход новой страницы
      // успевает начаться, пока шторка ещё уходит, — движение не рвётся
      .call(openPageGate, undefined, 0.32);
    if (main) {
      tl.fromTo(
        main,
        { scale: 1.035, transformOrigin: '50% 30%' },
        { scale: 1, duration: 1.0, ease: 'expo.out' },
        0.12
      );
    }
  }, []);

  /** Схождение: сектора съезжаются к центру, затем меняется маршрут. */
  const cover = useCallback(
    (href: string) => {
      const el = root.current;
      const s = svg.current;
      const c = center.current;
      if (!el || !s || !c) {
        router.push(href);
        return;
      }
      phase.current = 'cover';
      target.current = href.split(/[?#]/)[0];
      setLabel(NAMES[target.current] ?? '');
      router.prefetch(href);
      closePageGate();

      const geoNow = measure();
      const panels = s.querySelectorAll<SVGPathElement>('[data-panel]');
      const rays = s.querySelectorAll<SVGLineElement>('[data-ray]');
      el.style.visibility = 'visible';
      gsap.set(panels, { x: (i) => geoNow[i].dx, y: (i) => geoNow[i].dy });
      gsap.set(rays, { opacity: 0, strokeDashoffset: 1 });
      gsap.set(c, { opacity: 0, scale: 0.86 });

      gsap
        .timeline({
          onComplete: () => {
            phase.current = 'wait';
            router.push(href, { scroll: false });
          }
        })
        .to(panels, { x: 0, y: 0, duration: 0.62, ease: 'expo.inOut', stagger: 0.045 }, 0)
        // стыки секторов прорисовываются из центра — остов знака
        .to(rays, { opacity: 1, strokeDashoffset: 0, duration: 0.5, ease: 'power3.out' }, 0.42)
        .to(c, { opacity: 1, scale: 1, duration: 0.45, ease: 'expo.out' }, 0.46)
        .to({}, { duration: 0.12 });
    },
    [measure, router]
  );

  /* ---------------- перехват ссылок ---------------- */

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || !(a instanceof HTMLAnchorElement)) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download') || a.dataset.noTransition !== undefined) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // та же страница: якорь или повторный клик — ведёт себя как обычно
      if (url.pathname === location.pathname) return;
      if (!isRevealed() || document.hidden) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      e.preventDefault();
      e.stopPropagation();
      if (phase.current !== 'idle') return;
      cover(url.pathname + url.search + url.hash);
    };
    // захват на окне: раньше, чем клик дойдёт до обработчика next/link
    addEventListener('click', onClick, true);
    return () => removeEventListener('click', onClick, true);
  }, [cover]);

  /* ---------------- смена маршрута ---------------- */

  // сравниваем с прошлым адресом, а не с первым запуском: в строгом режиме
  // эффект монтируется дважды, и второй запуск выглядел бы переходом
  const prev = useRef(pathname);
  useEffect(() => {
    if (prev.current === pathname) return;
    prev.current = pathname;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (phase.current === 'wait' || phase.current === 'cover') {
      // Новая страница смонтирована под шторкой. Прокрутка — в начало мимо
      // анимации, пересчёт закреплённых сцен — до того, как их увидят.
      scrollToTop();
      let raf = 0;
      const go = () => {
        ScrollTrigger.refresh();
        reveal(false);
      };
      // два кадра: первый — разметка, второй — шрифты и размеры сцен
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(go);
      });
      // страховка на вкладке, где кадры не идут
      const t = setTimeout(() => {
        if (phase.current === 'wait' || phase.current === 'cover') go();
      }, 500);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    }

    // назад-вперёд: шторка не закрывалась — только расходится
    if (phase.current === 'idle' && !reduced && !document.hidden && isRevealed()) {
      setLabel(NAMES[pathname] ?? '');
      closePageGate();
      reveal(true);
    }
  }, [pathname, reveal]);

  // пока прелоадер не ушёл, размеры считаем по окну при первом клике
  useEffect(() => {
    measure();
    const onResize = () => {
      if (phase.current === 'idle') measure();
    };
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, [measure]);

  const { w, h, s } = geo;

  return (
    <div
      ref={root}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[190]"
      style={{ visibility: 'hidden' }}
    >
      <svg ref={svg} className="absolute inset-0 h-full w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          {/* грани знака: тёмная, основная синяя и глубокая — как на логотипе */}
          <linearGradient id="pt-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--tr-a1)" />
            <stop offset="1" stopColor="var(--tr-a2)" />
          </linearGradient>
          <linearGradient id="pt-b" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--tr-b1)" />
            <stop offset="1" stopColor="var(--tr-b2)" />
          </linearGradient>
          <linearGradient id="pt-c" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="var(--tr-c1)" />
            <stop offset="1" stopColor="var(--tr-c2)" />
          </linearGradient>
        </defs>
        {s.map((p, i) => (
          <path key={i} data-panel d={p.d} fill={`url(#pt-${'abc'[i]})`} />
        ))}
        {/* стыки: тонкий свет по лучам из центра */}
        {s.map((p, i) => (
          <line
            key={`r${i}`}
            data-ray
            x1={w / 2}
            y1={h / 2}
            x2={p.ray[0]}
            y2={p.ray[1]}
            pathLength={1}
            strokeDasharray="1 1"
            stroke="var(--accent)"
            strokeOpacity="0.55"
            strokeWidth="1"
          />
        ))}
      </svg>

      <div ref={center} className="absolute inset-0 flex flex-col items-center justify-center opacity-0">
        <MarkColor id="pt-mark" className="h-[clamp(64px,8vw,96px)] w-[clamp(64px,8vw,96px)] drop-shadow-[0_0_40px_rgba(110,155,204,0.35)]" />
        <span className="mt-6 font-mono text-[10px] uppercase tracking-rail text-white/60">CoreThree</span>
        <span className="mt-2 max-w-[80vw] text-center text-[clamp(22px,2.6vw,36px)] font-medium tracking-[-0.01em] text-white">
          {label}
        </span>
      </div>
    </div>
  );
}
