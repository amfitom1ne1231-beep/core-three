'use client';

import { useEffect, useId, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import MarkColor from './MarkColor';
import { LIVE_H, LIVE_W, type LiveProps } from './live/kit';
import LiveBot from './live/LiveBot';
import LiveLanding from './live/LiveLanding';
import LiveOps from './live/LiveOps';
import LiveShop from './live/LiveShop';
import { isHeaderHidden, onHeaderToggle } from '@/lib/chrome';
import { scrollToY } from '@/lib/scroll';

/**
 * Пульт навигации.
 *
 * Знак из шапки, уехав вверх вместе с ней, возвращается сюда: ниже первого
 * экрана он становится плавающим пультом, а при полном возврате наверх
 * отдаёт себя обратно шапке. Раскрывается в компактный путеводитель.
 *
 * Место у пульта одно — левый нижний угол. Он там и остаётся: прыгающий
 * по экрану элемент сам по себе отвлекает сильнее, чем помогает, а угол
 * у сетки сайта всё равно свободен — боковое поле секций 72px, и пульт
 * в него укладывается. Вместо перелётов — тихое покачивание.
 *
 * Открывается не только наведением: наведение — приятный, но не
 * единственный путь, на тачскрине его нет вовсе, поэтому клик и клавиатура
 * работают наравне. Пульт живёт от `md` — на телефоне за навигацию уже
 * отвечает меню в шапке, а плавающий элемент там сам стал бы помехой.
 */

/**
 * Размер пульта и отступ от края подобраны под сетку сайта: у секций
 * боковое поле 72px, и 56 + 24 укладываются в него, не наезжая на текст.
 */
const SIZE = 56;
const EDGE = 24;
/** Ниже этой доли экрана знак уходит из шапки в пульт. */
const HANDOFF = 0.75;
/** Ширина живого экрана в панели и его высота по пропорции вставки. */
const SCREEN_W = 252;
const SCREEN_H = Math.round((SCREEN_W / LIVE_W) * LIVE_H);

/**
 * Строки путеводителя. У направлений есть живой экран — та же вставка,
 * что играет в карусели на главной; у служебных разделов его нет, и они
 * уходят в компактную строку внизу.
 */
const ROUTES: { href: string; label: string; n: string; live: ComponentType<LiveProps> }[] = [
  { href: '/sites', label: 'Сайты и лендинги', n: '01', live: LiveLanding },
  { href: '/ecommerce', label: 'Интернет-магазины', n: '03', live: LiveShop },
  { href: '/bots', label: 'Боты и Telegram Web App', n: '04', live: LiveBot },
  { href: '/monitoring', label: 'Мониторинг и поддержка', n: '06', live: LiveOps }
];

const EXTRA = [
  { href: '/concepts', label: 'Концепты' },
  { href: '/about', label: 'О нас' },
  { href: '/privacy', label: 'Политика' }
];

/** Знак повёрнут на 120° — силуэт тот же: полный оборот незаметно бесшовен. */
const TURN = 120;

export default function NavPod() {
  const pod = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const panelId = useId();
  // свой идентификатор для градиентов знака: на странице он не один
  // (шапка, футер), а в SVG одинаковые id забирают заливки друг у друга
  const markId = useId();
  const pathname = usePathname();

  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(false);
  /** Какое направление показывает живой экран панели. */
  const [active, setActive] = useState(0);

  const liveRef = useRef(false);
  liveRef.current = live;

  const spin = useRef<HTMLSpanElement>(null);
  const float = useRef<HTMLDivElement>(null);

  // закрываем при переходе — панель не должна пережить страницу
  useEffect(() => setOpen(false), [pathname]);

  /* ---------------- появление, вращение, покачивание ---------------- */

  useEffect(() => {
    const el = pod.current;
    const bob = float.current;
    if (!el || !bob) return;
    if (!matchMedia('(min-width: 768px)').matches) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    /**
     * Знак проворачивается вместе с прокруткой.
     *
     * Шаг — 120°: у знака трёхкратная симметрия, поэтому на каждой трети
     * оборота силуэт совпадает сам с собой и вращение читается бесконечным
     * без единого стыка. Один экран прокрутки — одна треть оборота.
     */
    const spinTo = reduced
      ? null
      : gsap.quickTo(spin.current, 'rotation', { duration: 0.55, ease: 'power2.out' });

    // Парение: медленное всплытие на четыре пикселя и обратно. Отдельный
    // слой — внешний занят появлением, внутренний вращением; наложи их
    // друг на друга, и каждая анимация затирала бы чужой трансформ.
    const idle = reduced
      ? null
      : gsap.to(bob, { y: -4, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    let raf = 0;
    const sync = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        /**
         * Знак на странице один. Пульт берёт его на себя, только когда
         * ушла шапка: ниже первого экрана и при движении вниз. Стоит
         * потянуть страницу вверх — шапка возвращается, пульт убирается,
         * и знак снова там, где его ищут.
         */
        const on = scrollY > innerHeight * HANDOFF && isHeaderHidden();
        if (on !== liveRef.current) {
          liveRef.current = on;
          setLive(on);
          if (!on) setOpen(false);
        }
        if (on) spinTo?.((scrollY / innerHeight) * TURN);
      });
    };

    sync();
    const off = onHeaderToggle(sync);
    addEventListener('scroll', sync, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      idle?.kill();
      off();
      removeEventListener('scroll', sync);
    };
  }, []);

  // знак прилетает из шапки и туда же уходит: масштаб с прозрачностью
  // читаются как передача, а не как появление второго знака
  useEffect(() => {
    const el = pod.current;
    if (!el) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.to(el, {
      autoAlpha: live ? 1 : 0,
      scale: live ? 1 : 0.6,
      duration: reduced ? 0 : 0.42,
      ease: 'power3.out'
    });
  }, [live]);

  /* ---------------- поведение ---------------- */

  const home = () => {
    // на главной «домой» — это вернуться к началу, а не перезагрузить её
    if (pathname === '/') {
      setOpen(false);
      scrollToY(0);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!shell.current?.contains(e.target as Node)) setOpen(false);
    };
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', onDown);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div
      ref={pod}
      // left/top держим в нуле: положение задаётся трансформом, поэтому
      // перелёт между углами идёт на композиторе и не трогает layout
      /**
       * Появление ведёт GSAP, а не CSS-свойство `scale`: трансформ
       * элемента принадлежит GSAP целиком, и инлайновый `scale` от React
       * в его матрицу не попадал — знак оставался в 0.6 и рендерился
       * 33px вместо 56, заодно проваливая область нажатия.
       */
      className="pointer-events-none fixed z-[120] hidden opacity-0 md:block"
      style={{ left: EDGE, bottom: EDGE }}
      aria-hidden={!live}
    >
      {/* слой парения: медленно всплывает и опускается */}
      <div ref={float}>
      <div
        ref={shell}
        className="pointer-events-auto relative"
        style={{ width: SIZE, height: SIZE }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? 'Скрыть навигацию' : 'Навигация по сайту'}
          onClick={() => setOpen((v) => !v)}
          onFocus={() => setOpen(true)}
          className="grid h-full w-full place-items-center rounded-full border border-line bg-bg/80 text-fg backdrop-blur-md transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          {/* знак проворачивается своим слоем: внешние заняты появлением
              и парением */}
          <span ref={spin} className="block h-8 w-8">
            <MarkColor id={markId} className="h-full w-full" />
          </span>
        </button>

        {/* Панель лежит абсолютом и раскрывается вверх от знака: пульт
            стоит в нижнем левом углу, поэтому другого направления у неё
            и быть не может. */}
        <div
          id={panelId}
          className={`absolute bottom-[calc(100%+10px)] left-0 w-[268px] origin-bottom-left rounded-[18px] border border-line bg-bg/85 p-2 backdrop-blur-md transition-[opacity,transform] duration-300 ${
            open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-[0.94] opacity-0'
          }`}
          aria-hidden={!open}
        >
          {/**
           * Живой экран направления. Играет ровно одна вставка — та, на
           * которой сейчас палец или курсор: шесть одновременных таймлайнов
           * в меню никому не нужны. Закрытая панель не держит ни одной.
           */}
          <div
            className="relative mb-2 overflow-hidden rounded-[12px] border border-line bg-elev"
            style={{ width: SCREEN_W, height: SCREEN_H }}
            aria-hidden
          >
            {open &&
              ROUTES.map((r, i) => {
                const Live = r.live;
                return (
                  <div
                    key={r.href}
                    className="absolute inset-0 transition-opacity duration-300"
                    style={{
                      // вставка нарисована в макетных координатах, рамка её масштабирует
                      ['--live-k' as string]: (SCREEN_W / LIVE_W).toFixed(4),
                      opacity: i === active ? 1 : 0
                    }}
                  >
                    <Live playing={i === active} />
                  </div>
                );
              })}
          </div>

          <ul className="m-0 flex list-none flex-col p-0">
            {ROUTES.map((r, i) => {
              const here = pathname === r.href;
              return (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    tabIndex={open ? undefined : -1}
                    aria-current={here ? 'page' : undefined}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className={`flex items-baseline gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] leading-snug transition-colors duration-200 ${
                      i === active ? 'bg-elev text-fg' : 'text-dim hover:text-fg'
                    } ${here ? 'text-accent' : ''}`}
                  >
                    <span className="font-mono text-[10px] tracking-rail text-faint">{r.n}</span>
                    {r.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* служебные разделы: живого экрана у них нет, поэтому строкой */}
          <div className="mt-1 flex flex-wrap gap-x-1 px-3 pb-1 pt-2">
            {EXTRA.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                tabIndex={open ? undefined : -1}
                aria-current={pathname === e.href ? 'page' : undefined}
                className={`rounded-[8px] px-1.5 py-1 font-mono text-[9px] uppercase tracking-rail transition-colors duration-200 hover:text-fg ${
                  pathname === e.href ? 'text-accent' : 'text-faint'
                }`}
              >
                {e.label}
              </Link>
            ))}
          </div>

          <div className="mt-1 flex gap-2 border-t border-line pt-2">
            <Link
              href="/contact"
              tabIndex={open ? undefined : -1}
              className="flex-1 rounded-[10px] border border-fg bg-fg px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-rail text-bg transition-colors duration-200 hover:border-accent hover:bg-accent hover:text-white"
            >
              Обсудить
            </Link>
            <Link
              href="/"
              onClick={home}
              tabIndex={open ? undefined : -1}
              aria-label="В начало"
              className="grid w-12 place-items-center rounded-[10px] border border-line text-dim transition-colors duration-200 hover:border-accent hover:text-accent"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
