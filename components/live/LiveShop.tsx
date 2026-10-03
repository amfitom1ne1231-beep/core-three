'use client';

import { useRef } from 'react';
import { Check, LiveScreen, Pointer, countTo, useLoop, type LiveProps } from './kit';

const BRONZE = '#c9a27e';

/**
 * Товары сняты в Blender (brand/blender/products.py), а не нарисованы
 * иконками: рядом с настоящим интерфейсом плоская кружка читалась макетом.
 * Фон кадра — тот же графит, что у карточки, поэтому снимок не лежит
 * на ней наклейкой, а продолжает её.
 */
const ITEMS = [
  { name: 'Кружка «Утро»', note: 'Керамика ручной работы', price: '1 290 ₽', img: '/live/mug.webp', rate: '4,9', reviews: 214, colors: ['#d6c3a6', '#5d6b73', '#2f2b28'] },
  { name: 'Свеча «Кедр»', note: 'Соевый воск · 40 часов', price: '1 190 ₽', img: '/live/candle.webp', rate: '4,8', reviews: 126, badge: 'Хит' },
  { name: 'Плед «Дюна»', note: 'Шерсть мериноса', price: '3 490 ₽', old: '4 100 ₽', img: '/live/throw.webp', rate: '5,0', reviews: 58, badge: '−15%' }
];

function Stars({ rate, reviews }: { rate: string; reviews: number }) {
  return (
    <span className="flex items-center gap-1 text-[9.5px] text-[#8c877f]">
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
        <path d="M6 1l1.5 3.1 3.4.5-2.5 2.4.6 3.4L6 8.8 2.9 10.4l.6-3.4L1 4.6l3.4-.5Z" fill={BRONZE} />
      </svg>
      <b className="font-semibold text-[#ede9e3]">{rate}</b>
      <span>· {reviews} отзывов</span>
    </span>
  );
}

/**
 * Магазин: человек выбирает свечу, она летит в корзину, корзина считает,
 * сколько осталось до бесплатной доставки, оплата проходит — и приходит
 * номер заказа со сроком. Графит и бронза — тёплый кадр среди холодных.
 */
export default function LiveShop({ playing }: LiveProps) {
  const root = useRef<HTMLDivElement>(null);

  useLoop(root, playing, (tl) => {
    const q = (s: string) => root.current?.querySelector(s) ?? null;

    tl.from('[data-top]', { opacity: 0, y: -8, duration: 0.5 }, 0)
      .from('[data-chip]', { opacity: 0, y: 4, duration: 0.3, stagger: 0.05 }, 0.15)
      .from('[data-card]', { y: 24, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.1 }, 0.2)
      .from('[data-img]', { scale: 1.12, duration: 1.2, ease: 'power3.out', stagger: 0.1 }, 0.2)
      .fromTo('[data-pointer]', { x: 520, y: 360, opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.8)
      // курсор наводится на свечу — карточка приподнимается
      .to('[data-pointer]', { x: 250, y: 150, duration: 0.8, ease: 'power2.inOut' }, 0.9)
      .to('[data-card="1"]', { y: -4, boxShadow: '0 18px 36px rgba(0,0,0,0.45)', duration: 0.35, ease: 'power2.out' }, 1.45)
      .to('[data-img="1"]', { scale: 1.05, duration: 0.6, ease: 'power2.out' }, 1.45)
      .to('[data-pointer]', { x: 262, y: 286, duration: 0.55, ease: 'power2.inOut' }, 1.75)
      .to('[data-add="1"]', { scale: 0.92, duration: 0.1, yoyo: true, repeat: 1 }, 2.3)
      .to('[data-add-label="1"]', { yPercent: -50, duration: 0.3, ease: 'power2.inOut' }, 2.38)
      .to('[data-add="1"]', { backgroundColor: BRONZE, color: '#141416', duration: 0.3 }, 2.38)
      // снимок товара летит в корзину: дугой вверх и к значку
      .fromTo('[data-fly]', { x: 214, y: 92, scale: 1, opacity: 0 }, { opacity: 1, duration: 0.12 }, 2.4)
      .to('[data-fly]', { x: 506, duration: 0.7, ease: 'power1.in' }, 2.45)
      .to('[data-fly]', { y: 4, scale: 0.28, duration: 0.7, ease: 'power3.out' }, 2.45)
      .to('[data-fly]', { opacity: 0, duration: 0.12 }, 3.1)
      .fromTo('[data-badge]', { scale: 0 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' }, 3.12)
      // корзина
      .from('[data-drawer]', { xPercent: 100, duration: 0.7, ease: 'expo.out' }, 3.3)
      .fromTo('[data-ship]', { scaleX: 0 }, { scaleX: 0.4, duration: 0.8, ease: 'power2.out' }, 3.7)
      .to('[data-pointer]', { x: 452, y: 300, duration: 0.8, ease: 'power2.inOut' }, 3.5)
      .to('[data-pay]', { scale: 0.95, duration: 0.1, yoyo: true, repeat: 1 }, 4.35)
      // оплачено: лист корзины сменяется подтверждением
      .to('[data-cart-body]', { opacity: 0, y: -8, duration: 0.3 }, 4.5)
      .from('[data-paid]', { opacity: 0, y: 10, duration: 0.45, ease: 'power3.out' }, 4.65)
      .fromTo('[data-paid-ring]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out' }, 4.7)
      .from('[data-paid-check]', { scale: 0, duration: 0.35, ease: 'back.out(2.5)' }, 5.05)
      .to('[data-pointer]', { opacity: 0, duration: 0.3 }, 4.6)
      .to('[data-shop]', { opacity: 0, duration: 0.45 }, 6.6)
      .set({}, {}, 7.1);
    countTo(tl, q('[data-left]'), 3000, 1810, 3.8, { duration: 0.8, suffix: ' ₽' });

    // пламя на снимке не шевелится — зато огонёк у бейджа «Хит» живой
    tl.to('[data-hot]', { scale: 1.25, duration: 0.5, yoyo: true, repeat: 13, ease: 'sine.inOut' }, 0);
  });

  return (
    <LiveScreen>
      <div ref={root} className="absolute inset-0 bg-[#141416] font-sans text-[#ede9e3]">
        <div data-shop className="absolute inset-0">
          <header data-top className="absolute inset-x-7 top-4 flex items-center gap-4">
            <span className="text-[13px] font-bold tracking-[0.24em]">ЛАВКА</span>
            <span className="flex h-7 flex-1 items-center gap-2 rounded-full bg-[#1f1f23] px-3 text-[10px] text-[#6f6a63]">
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="7" cy="7" r="4.5" />
                <path d="m10.5 10.5 3 3" strokeLinecap="round" />
              </svg>
              Свечи, пледы, керамика
            </span>
            <span className="text-[10px] text-[#8c877f]">Доставка по Москве</span>
            <span className="relative block h-5 w-5">
              <svg viewBox="0 0 20 20" className="h-5 w-5">
                <path d="M4 7h12l-1 10H5L4 7Z" fill="none" stroke="#ede9e3" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M7.5 7V5.5a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="#ede9e3" strokeWidth="1.4" />
              </svg>
              <b
                data-badge
                className="absolute -right-2 -top-2 flex h-[15px] w-[15px] items-center justify-center rounded-full text-[9px] font-bold text-[#141416]"
                style={{ background: BRONZE }}
              >
                1
              </b>
            </span>
          </header>

          <div className="absolute left-7 top-[50px] flex gap-1.5">
            {['Всё', 'Керамика', 'Свечи', 'Текстиль', 'Подарки'].map((c, i) => (
              <span
                key={c}
                data-chip
                className="rounded-full px-2.5 py-1 text-[9.5px]"
                style={i === 0 ? { background: '#ede9e3', color: '#141416' } : { background: '#1f1f23', color: '#8c877f' }}
              >
                {c}
              </span>
            ))}
          </div>

          <div className="absolute left-7 top-[84px] flex gap-3.5">
            {ITEMS.map((it, i) => (
              <div key={it.name} data-card={i} className="w-[158px] overflow-hidden rounded-[12px] bg-[#1c1c20]">
                <div className="relative h-[134px] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" data-img={i} src={it.img} alt="" className="h-full w-full object-cover" draggable={false} />
                  {it.badge && (
                    <span
                      className="absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-semibold"
                      style={it.badge === 'Хит' ? { background: '#ede9e3', color: '#141416' } : { background: BRONZE, color: '#141416' }}
                    >
                      {it.badge === 'Хит' && <i data-hot className="block h-1.5 w-1.5 rounded-full bg-[#e0702f]" />}
                      {it.badge}
                    </span>
                  )}
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/35 backdrop-blur">
                    <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="#ede9e3" strokeWidth="1.6">
                      <path d="M8 13.5S2.5 10.2 2.5 6.2A2.9 2.9 0 0 1 8 4.9a2.9 2.9 0 0 1 5.5 1.3c0 4-5.5 7.3-5.5 7.3Z" />
                    </svg>
                  </span>
                </div>
                <div className="px-2.5 pb-2.5 pt-2">
                  <Stars rate={it.rate} reviews={it.reviews} />
                  <p className="m-0 mt-1 text-[11px] font-medium leading-tight text-[#ede9e3]">{it.name}</p>
                  <p className="m-0 text-[9px] text-[#77726b]">{it.note}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="m-0 text-[12.5px] font-semibold">
                      {it.price}
                      {it.old && <s className="ml-1.5 text-[9.5px] font-normal text-[#6f6a63]">{it.old}</s>}
                    </p>
                    {it.colors && (
                      <span className="flex gap-1">
                        {it.colors.map((c) => (
                          <i key={c} className="block h-2.5 w-2.5 rounded-full border border-white/15" style={{ background: c }} />
                        ))}
                      </span>
                    )}
                  </div>
                  <span
                    data-add={i}
                    className="mt-2 flex h-7 items-start justify-center overflow-hidden rounded-full border text-[10px]"
                    style={{ borderColor: i === 1 ? BRONZE : '#34343a', color: i === 1 ? BRONZE : '#8c877f' }}
                  >
                    <span data-add-label={i} className="flex flex-col items-center leading-7">
                      <span>В корзину</span>
                      <span className="flex items-center gap-1 font-semibold">
                        <Check className="h-3 w-3" /> В корзине
                      </span>
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* летящий товар — тот же снимок, что в карточке */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-fly
            src="/live/candle.webp"
            loading="lazy"
            decoding="async"
            alt=""
            className="absolute left-0 top-0 h-12 w-12 rounded-full object-cover opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.5)]"
          />

          {/* корзина */}
          <aside
            data-drawer
            className="absolute bottom-0 right-0 top-0 w-[216px] border-l border-white/5 bg-[#19191c] p-4 shadow-[-30px_0_60px_rgba(0,0,0,0.45)]"
          >
            <div data-cart-body>
              <p className="m-0 flex items-baseline justify-between">
                <span className="text-[13px] font-semibold">Корзина</span>
                <span className="text-[9.5px] text-[#8c877f]">1 товар</span>
              </p>
              <div className="mt-3 flex items-center gap-2.5 rounded-[10px] bg-[#222226] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src="/live/candle.webp" alt="" className="h-11 w-11 rounded-[8px] object-cover" />
                <span className="flex-1 text-[10.5px] leading-tight">
                  Свеча «Кедр»
                  <span className="block text-[9px] text-[#77726b]">Соевый воск</span>
                </span>
                <b className="text-[11px] font-semibold">1 190 ₽</b>
              </div>

              <div className="mt-3 rounded-[10px] border border-white/5 p-2.5">
                <p className="m-0 text-[9.5px] text-[#8c877f]">
                  До бесплатной доставки <b data-left className="font-semibold text-[#ede9e3]">1 810 ₽</b>
                </p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#2a2a2f]">
                  <i data-ship className="block h-full w-full origin-left rounded-full" style={{ background: BRONZE, transform: 'scaleX(0.4)' }} />
                </div>
              </div>

              <div className="mt-3 space-y-1 text-[10px] text-[#8c877f]">
                <p className="m-0 flex justify-between">
                  <span>Доставка завтра, 10–14</span>
                  <span>290 ₽</span>
                </p>
                <p className="m-0 flex justify-between pt-1 text-[13px] font-semibold text-[#ede9e3]">
                  <span>Итого</span>
                  <span>1 480 ₽</span>
                </p>
              </div>
              <span
                data-pay
                className="mt-3 flex h-10 items-center justify-center gap-2 rounded-[10px] text-[11.5px] font-semibold text-[#141416]"
                style={{ background: BRONZE }}
              >
                Оплатить через СБП
              </span>
              <p className="m-0 mt-2 text-center text-[9px] text-[#6f6a63]">или картой · долями без переплат</p>
            </div>

            {/* оплачено */}
            <div data-paid className="absolute inset-x-4 top-[88px] flex flex-col items-center text-center">
              <span className="relative flex h-14 w-14 items-center justify-center">
                <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
                  <circle data-paid-ring cx="28" cy="28" r="25" pathLength={1} fill="none" stroke={BRONZE} strokeWidth="2.2" strokeDasharray="1" />
                </svg>
                <span data-paid-check>
                  <Check className="h-6 w-6" color={BRONZE} />
                </span>
              </span>
              <b className="mt-3 text-[13px] font-semibold">Заказ №2048 оплачен</b>
              <span className="mt-1 text-[10px] leading-snug text-[#8c877f]">
                Привезём завтра до 14:00.
                <br />
                Чек — на почте и в Telegram.
              </span>
            </div>
          </aside>

          <Pointer />
        </div>
      </div>
    </LiveScreen>
  );
}
