'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import gsap from 'gsap';
import { Check, countTo } from '@/components/live/kit';
import { SITE } from '@/content/site';

/**
 * Живые экраны схемы: один и тот же заказ на каждой станции.
 *
 * Куб с значком не объясняет, что на станции происходит, — экран
 * объясняет. Анна находит магазин в поиске, кладёт в корзину кружку
 * и свечу, оформляет заказ в боте, платит по СБП; мониторинг проверяет
 * всё, через что она прошла. Заказ, сумма и товары сквозные: что выбрано
 * в «Каталоге», то и оплачено в «Оплате» (сумма — из content/site.ts).
 *
 * Магазин — та же «ЛАВКА», что в живом экране магазина в карусели,
 * товары сняты в Blender (brand/blender/products.py).
 *
 * Экран рисуется в фиксированных координатах SCREEN_W × SCREEN_H,
 * масштаб приходит сверху через --screen-k. Играет только экран текущего
 * кадра — с начала, один раз, и остаётся на законченном состоянии.
 */

export const SCREEN_W = 300;
export const SCREEN_H = 400;

const BRONZE = '#c9a27e';
const GREEN = '#6ee7a8';
const { order } = SITE.journey;
const MUG = { name: 'Кружка «Утро»', price: 1290, img: '/live/mug.webp' };
const CANDLE = { name: 'Свеча «Кедр»', price: 1190, img: '/live/candle.webp' };
const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`;

type ScreenProps = { playing: boolean };

/** Сценарий экрана: строится один раз, играет с начала при каждом показе. */
function useScene(root: RefObject<HTMLElement | null>, playing: boolean, build: (tl: gsap.core.Timeline) => void) {
  const tl = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const t = gsap.timeline({ paused: true });
      build(t);
      tl.current = t;
    }, el);
    return () => {
      ctx.revert();
      tl.current = null;
    };
    // сценарий экрана статичен — строится один раз
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = tl.current;
    if (!t) return;
    // без движения — сразу законченный кадр
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) t.progress(1);
    else if (playing) t.restart();
  }, [playing]);
}

/** Нажатие: кружок расходится от точки касания. */
function Tap({ id, className }: { id: string; className: string }) {
  return <i data-tap={id} className={`pointer-events-none absolute block h-9 w-9 rounded-full opacity-0 ${className}`} />;
}
const tap = (tl: gsap.core.Timeline, id: string, at: number) =>
  tl.fromTo(`[data-tap="${id}"]`, { scale: 0.2, opacity: 0.7 }, { scale: 1, opacity: 0, duration: 0.5, ease: 'power2.out' }, at);

function CartIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M4 7h12l-1 10H5L4 7Z" />
      <path d="M7.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ 01 · сайт */

function ScreenSite({ playing }: ScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  useScene(root, playing, (tl) => {
    tl.from('[data-q]', { clipPath: 'inset(0 100% 0 0)', duration: 0.6, ease: 'steps(12)' }, 0.15)
      .from('[data-res]', { opacity: 0, y: 8, duration: 0.35, stagger: 0.08 }, 0.6);
    tap(tl, 'res', 1.45);
    tl.to('[data-res="0"]', { backgroundColor: 'rgba(21,88,214,0.08)', duration: 0.2 }, 1.45)
      .fromTo('[data-load]', { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'power2.inOut' }, 1.65)
      .from('[data-site]', { yPercent: 100, duration: 0.6, ease: 'expo.out' }, 1.95)
      .from('[data-hero]', { scale: 1.14, duration: 1.4, ease: 'power3.out' }, 1.95)
      .from('[data-line]', { opacity: 0, y: 10, duration: 0.45, stagger: 0.08 }, 2.3)
      .from('[data-speed]', { opacity: 0, y: 8, scale: 0.92, duration: 0.45, ease: 'back.out(1.8)' }, 2.9);
    countTo(tl, root.current?.querySelector('[data-sec]') ?? null, 0, 0.8, 2.9, { duration: 0.6, decimals: 1 });
  });

  return (
    <div ref={root} className="absolute inset-0 bg-white font-sans text-[#1f2328]">
      {/* выдача поиска */}
      <i data-load className="absolute inset-x-0 top-0 block h-0.5 origin-left bg-[#1558d6]" />
      <div className="mx-4 mt-5 flex h-9 items-center gap-2 rounded-full border border-[#dfe1e5] px-3.5 text-[12px] shadow-[0_1px_4px_rgba(32,33,36,0.12)]">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-[#5f6368]" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3 3" strokeLinecap="round" />
        </svg>
        <span data-q className="whitespace-nowrap">
          свеча ручной работы
        </span>
      </div>

      <div className="relative mt-4 space-y-1.5 px-2.5">
        <div data-res="0" className="rounded-[10px] px-2 py-2.5">
          <p className="m-0 flex items-center gap-1.5 text-[9.5px] text-[#5f6368]">
            <b className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-[#141416] text-[8px] font-bold" style={{ color: BRONZE }}>
              Л
            </b>
            ЛАВКА › свечи
          </p>
          <p className="m-0 mt-1 text-[13.5px] font-medium leading-snug text-[#1558d6]">Свечи ручной работы — ЛАВКА</p>
          <p className="m-0 mt-0.5 text-[10.5px] leading-snug text-[#4d5156]">Соевый воск, 40 часов горения. Доставка по Москве завтра.</p>
        </div>
        {[62, 48].map((w) => (
          <div key={w} data-res className="space-y-1.5 px-2 py-2.5">
            <i className="block h-2 w-[30%] rounded bg-[#e8eaed]" />
            <i className="block h-2.5 rounded bg-[#d2dcf5]" style={{ width: `${w}%` }} />
            <i className="block h-2 w-[88%] rounded bg-[#eceef0]" />
            <i className="block h-2 w-[56%] rounded bg-[#eceef0]" />
          </div>
        ))}
        <Tap id="res" className="left-[92px] top-[28px] bg-[#1558d6]/30" />
      </div>

      {/* сайт открылся */}
      <div data-site className="absolute inset-0 bg-[#141416] text-[#ede9e3]">
        <header className="flex h-10 items-center justify-between px-4">
          <span className="text-[12px] font-bold tracking-[0.24em]">ЛАВКА</span>
          <CartIcon />
        </header>
        <div className="h-[168px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-hero loading="lazy" decoding="async" src={CANDLE.img} alt="" className="h-full w-full object-cover" draggable={false} />
        </div>
        <div className="px-4 pt-3.5">
          <p data-line className="m-0 text-[9px] uppercase tracking-[0.18em]" style={{ color: BRONZE }}>
            Свечи · ручная работа
          </p>
          <p data-line className="m-0 mt-1.5 text-[20px] font-semibold leading-tight">{CANDLE.name}</p>
          <p data-line className="m-0 mt-1 text-[11px] text-[#8c877f]">Соевый воск · 40 часов</p>
          <div data-line className="mt-3 flex items-center justify-between">
            <b className="text-[16px] font-semibold">{rub(CANDLE.price)}</b>
            <span className="flex h-8 items-center rounded-full px-4 text-[11px] font-semibold text-[#141416]" style={{ background: BRONZE }}>
              В каталог
            </span>
          </div>
        </div>
        <p data-speed className="absolute bottom-3.5 left-4 m-0 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10.5px] ring-1 ring-white/15">
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
            <path d="M7 .5 2 7h3.2L4.6 11.5 10 5H6.6Z" fill={GREEN} />
          </svg>
          Открылось за <b data-sec className="font-semibold tabular-nums">0,8</b> с
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 02 · каталог */

function ScreenCatalog({ playing }: ScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  useScene(root, playing, (tl) => {
    const add = (i: number, at: number) => {
      tap(tl, `add${i}`, at);
      tl.to(`[data-add="${i}"]`, { backgroundColor: BRONZE, color: '#141416', borderColor: BRONZE, duration: 0.25 }, at + 0.1).to(
        `[data-add-label="${i}"]`,
        { yPercent: -50, duration: 0.3, ease: 'power2.inOut' },
        at + 0.1
      );
    };
    const count = root.current?.querySelector('[data-badge-n]') ?? null;
    const sum = root.current?.querySelector('[data-sum]') ?? null;
    // числа ставятся вызовом, а не твином: при повторном показе сценарий
    // перематывается без событий, и прошлый итог остался бы в корзине
    tl.call(() => {
      if (count) count.textContent = '1';
      if (sum) sum.textContent = rub(MUG.price);
    }, [], 0.01)
      .from('[data-top]', { opacity: 0, y: -8, duration: 0.4 }, 0)
      .from('[data-card]', { y: 22, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.12 }, 0.15)
      .from('[data-img]', { scale: 1.12, duration: 1.1, ease: 'power3.out', stagger: 0.12 }, 0.15)
      .from('[data-sync]', { opacity: 0, duration: 0.4 }, 0.7);
    add(0, 1.3);
    tl.fromTo('[data-badge]', { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }, 1.5).from('[data-bar]', { yPercent: 130, duration: 0.55, ease: 'expo.out' }, 1.5);
    add(1, 2.4);
    tl.to('[data-n]', { yPercent: -50, duration: 0.3, ease: 'power2.inOut' }, 2.55)
      .to('[data-badge]', { scale: 1.3, duration: 0.14, yoyo: true, repeat: 1 }, 2.55)
      .call(() => {
        if (count) count.textContent = '2';
      }, [], 2.6)
      .fromTo('[data-go]', { x: 0 }, { x: 4, duration: 0.35, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 3.5);
    countTo(tl, sum, MUG.price, MUG.price + CANDLE.price, 2.55, { duration: 0.7, suffix: ' ₽' });
  });

  return (
    <div ref={root} className="absolute inset-0 bg-[#141416] font-sans text-[#ede9e3]">
      <header data-top className="flex h-11 items-center justify-between px-4">
        <span className="text-[12px] font-bold tracking-[0.24em]">ЛАВКА</span>
        <span className="relative">
          <CartIcon />
          <b
            data-badge
            className="absolute -right-2 -top-1.5 flex h-[15px] w-[15px] items-center justify-center rounded-full text-[9px] font-bold text-[#141416]"
            style={{ background: BRONZE }}
          >
            <span data-badge-n>2</span>
          </b>
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2.5 px-4">
        {[MUG, CANDLE].map((it, i) => (
          <div key={it.name} data-card className="relative overflow-hidden rounded-[12px] bg-[#1f1f23]">
            <div className="h-[104px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-img loading="lazy" decoding="async" src={it.img} alt="" className="h-full w-full object-cover" draggable={false} />
            </div>
            <div className="p-2.5">
              <p className="m-0 text-[11.5px] font-semibold leading-tight">{it.name}</p>
              <p className="m-0 mt-1 flex items-center gap-1 text-[9px] text-[#8c877f]">
                <i className="block h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} /> в наличии
              </p>
              <b className="mt-1.5 block text-[13.5px] font-semibold">{rub(it.price)}</b>
              <span data-add={i} className="mt-2 block h-7 overflow-hidden rounded-full border border-white/25 text-center text-[10px] font-medium leading-[26px]">
                <span data-add-label={i} className="flex flex-col">
                  <span>В корзину</span>
                  <span>В корзине ✓</span>
                </span>
              </span>
            </div>
            <Tap id={`add${i}`} className="bottom-1 left-1/2 -ml-[18px] bg-white/40" />
          </div>
        ))}
      </div>

      <p data-sync className="m-0 mt-3 flex items-center gap-1.5 px-4 text-[9.5px] text-[#8c877f]">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke={BRONZE} strokeWidth="1.3" strokeLinecap="round" aria-hidden>
          <path d="M10 6a4 4 0 1 1-1.2-2.85M10 1.5v2H8" />
        </svg>
        Цены и остатки — из вашей админки
      </p>

      <div data-bar className="absolute inset-x-3 bottom-3 flex h-[52px] items-center justify-between rounded-[14px] bg-[#ede9e3] px-3.5 text-[#141416]">
        <span className="leading-tight">
          <span className="block h-[13px] overflow-hidden text-[9.5px] text-[#6f6a63]">
            <span data-n className="flex flex-col leading-[13px]">
              <span>1 товар</span>
              <span>2 товара</span>
            </span>
          </span>
          <b data-sum className="block text-[14px] font-semibold tabular-nums">
            {rub(MUG.price + CANDLE.price)}
          </b>
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold">
          Оформить в Telegram
          <svg data-go viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" />
          </svg>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- 03 · бот */

function ScreenBot({ playing }: ScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  useScene(root, playing, (tl) => {
    const pop = (sel: string, at: number, origin = '0% 100%') =>
      tl.from(sel, { scale: 0.86, y: 10, opacity: 0, transformOrigin: origin, duration: 0.45, ease: 'back.out(1.8)' }, at);
    tl.from('[data-head]', { opacity: 0, y: -8, duration: 0.4 }, 0);
    pop('[data-m1]', 0.3);
    tl.from('[data-kb]', { opacity: 0, y: 6, duration: 0.3, stagger: 0.07 }, 0.75).to(
      '[data-kb-hit]',
      { backgroundColor: 'rgba(106,168,222,0.5)', duration: 0.15, yoyo: true, repeat: 1 },
      1.45
    );
    pop('[data-m2]', 1.7, '100% 100%');
    // «печатает…» — в шапке и пузырём
    tl.to('[data-status]', { yPercent: -50, duration: 0.25 }, 2.0)
      .from('[data-typing]', { opacity: 0, duration: 0.2 }, 2.05)
      .to('[data-dot]', { y: -3, duration: 0.2, yoyo: true, repeat: 3, stagger: 0.1, ease: 'sine.inOut' }, 2.1)
      .to('[data-typing]', { opacity: 0, duration: 0.15 }, 2.85)
      .to('[data-status]', { yPercent: 0, duration: 0.25 }, 2.85);
    pop('[data-m3]', 2.9);
    pop('[data-m4]', 3.5);
  });

  const bubble = 'max-w-[236px] rounded-2xl px-3 py-2 text-[11px] leading-[1.45]';
  const time = 'ml-2 align-bottom font-mono text-[8px] text-[#6c7883]';

  return (
    <div ref={root} className="absolute inset-0 bg-[#0e1621] font-sans text-[#e9eef3]">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '18px 18px' }}
      />
      <header data-head className="relative flex h-11 items-center gap-2.5 bg-[#17212b] px-3.5">
        <span className="text-[16px] text-[#6c7883]">‹</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#141416] text-[11px] font-bold" style={{ color: BRONZE }}>
          Л
        </span>
        <span className="leading-tight">
          <b className="block text-[12px] font-semibold">ЛАВКА</b>
          <span className="block h-3 overflow-hidden text-[9px]">
            <span data-status className="flex flex-col">
              <span className="text-[#6c7883]">бот · отвечает сразу</span>
              <span className="text-[#6aa8de]">печатает…</span>
            </span>
          </span>
        </span>
      </header>

      <div className="relative flex flex-col gap-1.5 px-3.5 pt-3">
        <div data-m1 className={`${bubble} self-start rounded-bl-md bg-[#182533]`}>
          {order.who}, в заказе кружка «Утро» и свеча «Кедр» — {order.sum}. Как доставить?
          <span className={time}>14:02</span>
        </div>
        <div className="grid w-[236px] grid-cols-2 gap-1 self-start">
          <span data-kb data-kb-hit className="flex h-7 items-center justify-center rounded-lg bg-white/[0.08] text-[10px]">
            Курьер · завтра
          </span>
          <span data-kb className="flex h-7 items-center justify-center rounded-lg bg-white/[0.08] text-[10px]">
            Самовывоз
          </span>
        </div>

        <div data-m2 className={`${bubble} self-end rounded-br-md bg-[#2b5278]`}>
          Курьер · завтра
          <span className={`${time} text-[#8fb3dc]`}>14:02 ✓✓</span>
        </div>

        <div className="relative self-start">
          <div data-typing className="absolute left-0 top-0 flex h-8 items-center gap-1 rounded-2xl rounded-bl-md bg-[#182533] px-3.5">
            {[0, 1, 2].map((i) => (
              <i key={i} data-dot className="block h-1.5 w-1.5 rounded-full bg-[#6c7883]" />
            ))}
          </div>
          {/* счёт в стиле платежей Telegram: карточка, сумма, кнопка */}
          <div data-m3 className="w-[236px] overflow-hidden rounded-2xl rounded-bl-md bg-[#182533]">
            <div className="flex gap-2.5 p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading="lazy" decoding="async" src={CANDLE.img} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" draggable={false} />
              <span className="leading-tight">
                <b className="block text-[11px] font-semibold">Заказ {order.id}</b>
                <span className="mt-0.5 block text-[9.5px] text-[#8b9aa8]">2 товара · курьер завтра</span>
                <b className="mt-1 block text-[12px] font-semibold">{order.sum}</b>
              </span>
            </div>
            <span className="flex h-8 items-center justify-center border-t border-white/5 bg-[#5288c1] text-[11px] font-semibold text-white">
              Оплатить {order.sum}
            </span>
          </div>
        </div>

        <div data-m4 className={`${bubble} flex items-center gap-2 self-start rounded-bl-md bg-[#182533]`}>
          <Check className="h-4 w-4 shrink-0" color={GREEN} />
          <span>
            Заказ оформлен. Оплата — в одно касание.
            <span className={time}>14:03</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- 04 · оплата и учёт */

const LEDGER: Array<[string, string]> = [
  ['Деньги на счёте', `+${order.sum}`],
  ['Заказ в CRM', `${order.id} · оплачен`],
  ['Уведомление вам', 'в Telegram']
];

function ScreenMoney({ playing }: ScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  useScene(root, playing, (tl) => {
    tl.from('[data-sheet] > *', { opacity: 0, y: 10, duration: 0.45, stagger: 0.07 }, 0.1)
      .fromTo('[data-ring]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.0, ease: 'power2.inOut' }, 0.6)
      .from('[data-paid]', { scale: 0, duration: 0.4, ease: 'back.out(2.5)' }, 1.6)
      .to('[data-ring]', { stroke: '#1f9d61', duration: 0.3 }, 1.6)
      .to('[data-state]', { yPercent: -50, duration: 0.3, ease: 'power2.inOut' }, 1.6)
      .from('[data-own]', { opacity: 0, duration: 0.4 }, 2.0)
      .from('[data-row]', { x: 18, opacity: 0, duration: 0.45, ease: 'expo.out', stagger: 0.38 }, 2.2)
      .from('[data-row-ok]', { scale: 0, duration: 0.3, ease: 'back.out(2.5)', stagger: 0.38 }, 2.45);
  });

  return (
    <div ref={root} className="absolute inset-0 bg-[#10151c] font-sans">
      {/* лист оплаты у Анны */}
      <div data-sheet className="absolute inset-x-0 top-0 flex h-[196px] flex-col items-center rounded-b-[18px] bg-[#f4f6f8] px-4 pt-4 text-[#10151c]">
        <p className="m-0 flex w-full items-center justify-between text-[10px] text-[#5d6875]">
          <span>ЛАВКА · заказ {order.id}</span>
          <b className="rounded-full border border-[#c9d1da] px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-[#10151c]">СБП</b>
        </p>
        <span className="relative mt-3.5 block h-12 w-12">
          <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" fill="none" aria-hidden>
            <circle cx="24" cy="24" r="21" stroke="#dde3ea" strokeWidth="3" />
            <circle data-ring cx="24" cy="24" r="21" stroke="#1558d6" strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" />
          </svg>
          <span data-paid className="absolute inset-0 flex items-center justify-center">
            <Check className="h-6 w-6" color="#1f9d61" />
          </span>
        </span>
        <b className="mt-2.5 text-[26px] font-semibold leading-none tabular-nums">{order.sum}</b>
        <span className="mt-2 block h-[14px] overflow-hidden text-[10.5px]">
          <span data-state className="flex flex-col text-center leading-[14px]">
            <span className="text-[#5d6875]">Подтверждение в банке…</span>
            <span className="font-medium text-[#1f9d61]">Оплачено · чек в Telegram</span>
          </span>
        </span>
      </div>

      {/* и в ту же секунду — у владельца */}
      <div className="absolute inset-x-4 top-[212px] text-[#e6edf5]">
        <p data-own className="m-0 font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#8b9aa8]">
          У вас — в ту же секунду
        </p>
        <div className="mt-2.5 space-y-1.5">
          {LEDGER.map(([name, value]) => (
            <p key={name} data-row className="m-0 flex h-[42px] items-center gap-2.5 rounded-[11px] bg-white/[0.06] px-3 text-[11px] ring-1 ring-white/[0.07]">
              <span data-row-ok className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#6ee7a8]/15">
                <Check className="h-3 w-3" color={GREEN} />
              </span>
              <span className="flex-1">{name}</span>
              <b className="font-medium tabular-nums text-[#b8c4cf]">{value}</b>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 05 · мониторинг */

const CHECKS: Array<[string, string]> = [
  ['Сайт', 'открылся за 0,8 с'],
  ['Бот', 'отвечает'],
  ['Оплата', 'проходит'],
  ['SSL-сертификат', 'действует'],
  ['Бэкап', 'сегодня, 03:00']
];

function ScreenWatch({ playing }: ScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  useScene(root, playing, (tl) => {
    tl.from('[data-head]', { opacity: 0, y: -8, duration: 0.4 }, 0)
      .from('[data-check]', { opacity: 0, duration: 0.3, stagger: 0.06 }, 0.2)
      .fromTo('[data-scan]', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.6);
    CHECKS.forEach((_, i) => {
      const at = 0.7 + i * 0.42;
      tl.to('[data-scan]', { y: i * 38, duration: 0.3, ease: 'power2.inOut' }, at)
        .from(`[data-value="${i}"]`, { opacity: 0, x: 6, duration: 0.3 }, at + 0.2)
        .from(`[data-ok="${i}"]`, { scale: 0, duration: 0.3, ease: 'back.out(2.5)' }, at + 0.25);
    });
    const done = 0.7 + CHECKS.length * 0.42;
    tl.to('[data-scan]', { opacity: 0, duration: 0.3 }, done)
      .to('[data-verdict]', { yPercent: -50, duration: 0.35, ease: 'power2.inOut' }, done)
      .to('[data-lamp]', { backgroundColor: GREEN, boxShadow: '0 0 0 5px rgba(110,231,168,0.18)', duration: 0.35 }, done)
      .from('[data-tick]', { scaleY: 0, duration: 0.3, stagger: 0.02, ease: 'power2.out' }, done + 0.1);
  });

  return (
    <div ref={root} className="absolute inset-0 bg-[#0b1119] font-sans text-[#e6edf5]">
      <header data-head className="flex h-11 items-center justify-between border-b border-white/[0.07] px-4">
        <b className="text-[11.5px] font-semibold">Проверки · ЛАВКА</b>
        <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#8b9aa8]">каждые 5 минут</span>
      </header>

      <div className="flex items-center gap-3 px-4 pt-4">
        <i data-lamp className="block h-2.5 w-2.5 rounded-full bg-[#8fc0ff]" />
        <span className="block h-[26px] overflow-hidden text-[20px] font-semibold leading-[26px]">
          <span data-verdict className="flex flex-col">
            <span>Проверяем…</span>
            <span>Всё работает</span>
          </span>
        </span>
      </div>

      <div className="relative mx-4 mt-3.5">
        <i data-scan className="absolute inset-x-[-8px] top-0 block h-[38px] rounded-[9px] bg-[#8fc0ff]/10" />
        {CHECKS.map(([name, value], i) => (
          <p key={name} data-check className="relative m-0 flex h-[38px] items-center gap-2 border-b border-white/[0.06] text-[11.5px]">
            <span className="flex-1">{name}</span>
            <span data-value={i} className="text-[10.5px] text-[#8b9aa8]">
              {value}
            </span>
            <span data-ok={i} className="flex h-4 w-4 items-center justify-center">
              <Check className="h-3.5 w-3.5" color={GREEN} />
            </span>
          </p>
        ))}
      </div>

      {/* проверки за последние два часа: одна черта — одна проверка */}
      <div className="absolute inset-x-4 bottom-4">
        <div className="flex h-5 items-end gap-[3px]">
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} data-tick className="block h-full flex-1 origin-bottom rounded-[1.5px]" style={{ background: GREEN, opacity: 0.35 + (i / 23) * 0.65 }} />
          ))}
        </div>
        <p className="m-0 mt-1.5 flex justify-between font-mono text-[8px] uppercase tracking-[0.16em] text-[#8b9aa8]">
          <span>2 часа назад</span>
          <span>сейчас</span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ рамка */

const SCREENS: Record<string, (p: ScreenProps) => ReactNode> = {
  site: ScreenSite,
  catalog: ScreenCatalog,
  bot: ScreenBot,
  money: ScreenMoney,
  watch: ScreenWatch
};

/** Пять экранов стопкой: виден и играет экран текущего кадра. */
export default function OrderScreens({ id, playing, className = '' }: { id: string; playing: boolean; className?: string }) {
  return (
    <div className={`order-screen ${className}`} aria-hidden>
      <div className="relative origin-top-left overflow-hidden" style={{ width: SCREEN_W, height: SCREEN_H, transform: 'scale(var(--screen-k, 1))' }}>
        {Object.entries(SCREENS).map(([key, Screen]) => (
          <div
            key={key}
            className="absolute inset-0"
            // прошлый экран лежит под новым, пока тот проявляется, и гаснет после:
            // погасни он сразу — сквозь новый просвечивал бы рендер
            style={{ opacity: key === id ? 1 : 0, zIndex: key === id ? 1 : 0, transition: key === id ? 'opacity .5s' : 'opacity 0s .5s' }}
          >
            <Screen playing={playing && key === id} />
          </div>
        ))}
      </div>
    </div>
  );
}
