'use client';

import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import MarkColor from './MarkColor';
import { LIVE_H, LIVE_W, type LiveProps } from './live/kit';
import LiveBlog from './live/LiveBlog';
import LiveBot from './live/LiveBot';
import LiveLanding from './live/LiveLanding';
import LiveOps from './live/LiveOps';
import LiveShop from './live/LiveShop';
import LiveWebApp from './live/LiveWebApp';
import { isHeaderHidden, onHeaderToggle } from '@/lib/chrome';
import { scrollToY } from '@/lib/scroll';
import { SITE } from '@/content/site';

/**
 * Пульт навигации.
 *
 * Знак из шапки, уехав вверх вместе с ней, возвращается сюда: ниже первого
 * экрана он становится плавающим пультом, а при полном возврате наверх
 * отдаёт себя обратно шапке. Раскрывается в компактный путеводитель.
 *
 * Главное требование — не мешать. Пульт не висит в одном углу: перед
 * каждым кадром он сверяет свою рамку с рамками текста и медиа и садится
 * в первый свободный угол, а когда свободного нет — в наименее занятый.
 * Отсюда и вся геометрия ниже.
 *
 * Открывается не только наведением: наведение — приятный, но не
 * единственный путь, на тачскрине его нет вовсе, поэтому клик и клавиатура
 * работают наравне. Пульт живёт от `md` — на телефоне за навигацию уже
 * отвечает меню в шапке, а плавающий элемент там сам стал бы помехой.
 */

/**
 * Размер свёрнутого пульта и отступ от края подобраны под сетку сайта:
 * у секций боковое поле 72px, и 56 + 10 укладываются в него целиком.
 * Поэтому у пульта всегда есть куда сесть, не наехав на текст.
 */
const SIZE = 56;
const EDGE = 10;
/** Запас вокруг пульта: вплотную к тексту он всё равно мешает. */
const CLEAR = 6;
/** Зазор между знаком и раскрытой панелью. */
const PANEL_GAP = 10;
/** Перекрытие мельче этого считаем шумом округления, а не помехой. */
const NOISE = 400;
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

type Slot = { id: string; x: number; y: number; up: boolean; right: boolean };
type Box = { l: number; t: number; r: number; b: number };

/** Что пульт обязан облетать: текст, схемы, живые вставки, форма. */
const GUARD =
  'h1,h2,h3,p,ol,ul,dl,form,figure,table,svg[role="img"],[data-live],[data-pod-avoid]';

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) *
  Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

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
  /** Куда раскрывать панель, чтобы она не упиралась в край окна. */
  const [dir, setDir] = useState({ up: true, right: true });

  const openRef = useRef(false);
  openRef.current = open;
  const liveRef = useRef(false);
  liveRef.current = live;

  const moveX = useRef<((v: number) => void) | null>(null);
  const moveY = useRef<((v: number) => void) | null>(null);
  const slot = useRef<string>('');
  const panel = useRef<HTMLDivElement>(null);
  const spin = useRef<HTMLSpanElement>(null);
  /** Размер панели нужен до её показа, поэтому меряем и запоминаем. */
  const panelSize = useRef({ w: 268, h: 300 });

  // закрываем при переходе — панель не должна пережить страницу
  useEffect(() => setOpen(false), [pathname]);

  /* ---------------- выбор угла ---------------- */

  const place = useCallback(() => {
    const el = pod.current;
    if (!el || !liveRef.current) return;

    const vw = innerWidth;
    const vh = innerHeight;
    // Считаем по свёрнутому пульту, а не по раскрытому: панель лежит
    // абсолютом и в размер не входит. Раньше она входила, пульт считался
    // объектом в 360px высотой и «не помещался» никуда — отсюда и наезды
    // на текст в трети положений.
    const w = SIZE;
    const h = SIZE;
    const midY = Math.round((vh - h) / 2);
    const left = EDGE;
    const right = vw - w - EDGE;

    // up/right говорят, в какую сторону раскрывать панель из этого угла
    const slots: Slot[] = [
      { id: 'bl', x: left, y: vh - h - EDGE, up: true, right: true },
      { id: 'br', x: right, y: vh - h - EDGE, up: true, right: false },
      { id: 'ml', x: left, y: midY, up: false, right: true },
      { id: 'mr', x: right, y: midY, up: false, right: false },
      { id: 'tl', x: left, y: EDGE + 80, up: false, right: true },
      { id: 'tr', x: right, y: EDGE + 80, up: false, right: false }
    ];

    // все чтения layout — до единой записи, иначе каждый кадр упирается
    // в принудительный пересчёт
    const guards: Box[] = [];
    document.querySelectorAll<HTMLElement>(GUARD).forEach((g) => {
      if (el.contains(g)) return;
      const r = g.getBoundingClientRect();
      if (r.width < 24 || r.height < 12) return;
      if (r.bottom < 0 || r.top > vh) return;
      guards.push({ l: r.left - CLEAR, t: r.top - CLEAR, r: r.right + CLEAR, b: r.bottom + CLEAR });
    });

    /**
     * Рамка пульта в этом углу. Свёрнутый — квадрат со знаком; раскрытый
     * занимает ещё и панель, поэтому угол для него выбирается по всей
     * занимаемой площади: открытое меню тоже не должно ложиться на текст,
     * раз уж его можно открыть просто наведением.
     */
    const boxAt = (s: Slot): Box => {
      const pill: Box = { l: s.x, t: s.y, r: s.x + w, b: s.y + h };
      if (!openRef.current) return pill;
      const pw = panelSize.current.w;
      const ph = panelSize.current.h;
      const pl = s.right ? s.x : s.x + w - pw;
      const pt = s.up ? s.y - PANEL_GAP - ph : s.y + h + PANEL_GAP;
      return {
        l: Math.min(pill.l, pl),
        t: Math.min(pill.t, pt),
        r: Math.max(pill.r, pl + pw),
        b: Math.max(pill.b, pt + ph)
      };
    };

    const cost = (s: Slot) => {
      const box = boxAt(s);
      let c = 0;
      for (const g of guards) c += overlap(box, g);
      // угол, из которого панель вылезает за край окна, не годится вовсе
      if (box.l < 0 || box.t < 0 || box.r > vw || box.b > vh) c += 1e6;
      return c;
    };

    let best = slots[0];
    let bestCost = Infinity;
    for (const s of slots) {
      const c = cost(s);
      if (c < bestCost) {
        bestCost = c;
        best = s;
      }
      if (c <= NOISE) break;
    }

    /**
     * Гистерезис: пока текущий угол свободен, никуда не переезжаем, а
     * переезжаем только ради заметно лучшего места. Иначе пульт скачет
     * от каждого пикселя прокрутки.
     *
     * Скидку текущему углу давать нельзя: с ней он оставался занятым
     * углом, лишь бы не двигаться, и наезжал на текст там, где поле
     * секции уже (у схемы оно 56px против 72px у остальных).
     */
    const current = slots.find((s) => s.id === slot.current);
    if (current) {
      const cc = cost(current);
      if (cc <= NOISE || bestCost > cc - NOISE * 2) {
        best = current;
        bestCost = cc;
      }
    }

    setDir({ up: best.up, right: best.right });
    if (best.id === slot.current) return;
    slot.current = best.id;
    moveX.current?.(best.x);
    moveY.current?.(best.y);
  }, []);

  /* ---------------- появление и перелёт ---------------- */

  useEffect(() => {
    const el = pod.current;
    if (!el) return;
    if (!matchMedia('(min-width: 768px)').matches) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduced ? 0 : 0.7;
    moveX.current = gsap.quickTo(el, 'x', { duration: dur, ease: 'power3.out' });
    moveY.current = gsap.quickTo(el, 'y', { duration: dur, ease: 'power3.out' });

    /**
     * Знак проворачивается вместе с прокруткой.
     *
     * Шаг — 120°: у знака трёхкратная симметрия, поэтому на каждой трети
     * оборота силуэт совпадает сам с собой и вращение читается бесконечным
     * без единого стыка. Один экран прокрутки — одна треть оборота.
     */
    const spinTo = reduced
      ? null
      : gsap.quickTo(spin.current, 'rotate', { duration: 0.55, ease: 'power2.out' });

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
        if (on) {
          place();
          spinTo?.((scrollY / innerHeight) * TURN);
        }
      });
    };

    sync();
    const off = onHeaderToggle(sync);
    addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      off();
      removeEventListener('scroll', sync);
      removeEventListener('resize', sync);
    };
  }, [place]);

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

  // раскрытие меняет размер — угол пересчитывается под новую рамку
  useEffect(() => {
    const p = panel.current;
    if (p) panelSize.current = { w: p.offsetWidth, h: p.offsetHeight };
    if (live) requestAnimationFrame(place);
  }, [open, live, place]);

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

  const links = SITE.footer.columns.flatMap((c) => [...c.links]);

  return (
    <div
      ref={pod}
      // left/top держим в нуле: положение задаётся трансформом, поэтому
      // перелёт между углами идёт на композиторе и не трогает layout
      /**
       * Появление ведёт GSAP, а не CSS-свойство `scale`.
       *
       * Положение пульта двигает `gsap.quickTo(el, 'x'|'y')`, то есть
       * трансформ элемента принадлежит GSAP целиком: он запекает в свою
       * матрицу и масштаб тоже. Инлайновый `scale` от React в эту матрицу
       * не попадал — знак так и оставался в 0.6 и рендерился 33px вместо
       * 56, заодно проваливая область нажатия.
       */
      className="pointer-events-none fixed left-0 top-0 z-[120] hidden opacity-0 md:block"
      aria-hidden={!live}
    >
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
          <MarkColor id={markId} className="h-7 w-7" />
        </button>

        {/* Панель лежит абсолютом: в размер пульта она не входит, иначе
            свёрнутый пульт считался бы объектом в три сотни пикселей
            и не помещался бы никуда. Сторона раскрытия приходит из
            выбранного угла — так панель не упирается в край окна. */}
        <div
          ref={panel}
          id={panelId}
          className={`absolute w-[268px] rounded-[18px] border border-line bg-bg/85 p-2 backdrop-blur-md transition-[opacity,transform] duration-300 ${
            dir.up ? 'bottom-[calc(100%+10px)] origin-bottom' : 'top-[calc(100%+10px)] origin-top'
          } ${dir.right ? 'left-0' : 'right-0'} ${
            open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-[0.94] opacity-0'
          }`}
          aria-hidden={!open}
        >
          <span className="rail-label block px-3 pb-2 pt-2">Направления</span>
          <ul className="m-0 flex list-none flex-col p-0">
            {links.map((l) => {
              const here = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    tabIndex={open ? undefined : -1}
                    aria-current={here ? 'page' : undefined}
                    className={`block rounded-[10px] px-3 py-2.5 text-[13.5px] leading-snug transition-colors duration-200 hover:bg-elev ${
                      here ? 'text-accent' : 'text-dim hover:text-fg'
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex gap-2 border-t border-line pt-2">
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
  );
}
