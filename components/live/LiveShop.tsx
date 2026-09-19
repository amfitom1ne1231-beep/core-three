'use client';

import { useRef } from 'react';
import { Check, LiveScreen, Pointer, useLoop, type LiveProps } from './kit';

const BRONZE = '#c9a27e';

/** Иллюстрации товаров — простые формы, без картинок. */
function Mug() {
  return (
    <svg viewBox="0 0 80 64" className="h-[62px] w-[78px]">
      <rect x="14" y="14" width="40" height="38" rx="7" fill="#b98f69" />
      <path d="M54 22h6a8 8 0 0 1 0 16h-6" fill="none" stroke="#b98f69" strokeWidth="5" />
      <rect x="14" y="14" width="40" height="7" rx="3.5" fill="#d9b58f" />
    </svg>
  );
}
function Candle() {
  return (
    <svg viewBox="0 0 80 64" className="h-[62px] w-[78px] overflow-visible">
      <ellipse data-flame cx="40" cy="12" rx="5" ry="9" fill="#f2b35e" style={{ transformOrigin: '40px 20px' }} />
      <ellipse cx="40" cy="12" rx="12" ry="14" fill="#f2b35e" opacity="0.18" />
      <rect x="27" y="22" width="26" height="36" rx="4" fill="#dcd2c4" />
      <rect x="39" y="18" width="2" height="6" fill="#3a332c" />
    </svg>
  );
}
function Throw() {
  return (
    <svg viewBox="0 0 80 64" className="h-[62px] w-[78px]">
      <rect x="10" y="36" width="60" height="16" rx="5" fill="#8a6f55" />
      <rect x="14" y="24" width="52" height="14" rx="5" fill="#a2856a" />
      <rect x="18" y="13" width="44" height="13" rx="5" fill="#bf9f80" />
      <path d="M22 44h36" stroke="#6f5843" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  );
}

const ITEMS = [
  { name: 'Кружка «Утро»', price: '1 290 ₽', Art: Mug },
  { name: 'Свеча «Кедр»', price: '1 190 ₽', Art: Candle },
  { name: 'Плед «Дюна»', price: '3 490 ₽', Art: Throw }
];

/**
 * Магазин: каталог, товар летит в корзину, выезжает оформление, оплата
 * проходит. Стиль — графит и бронза, тёплый в отличие от остальных кадров.
 */
export default function LiveShop({ playing }: LiveProps) {
  const root = useRef<HTMLDivElement>(null);

  useLoop(root, playing, (tl) => {
    tl.from('[data-top]', { opacity: 0, y: -8, duration: 0.5 }, 0)
      .from('[data-card]', { y: 24, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.1 }, 0.1)
      .fromTo('[data-pointer]', { x: 500, y: 350, opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.8)
      .to('[data-pointer]', { x: 268, y: 254, duration: 1.0, ease: 'power2.inOut' }, 0.9)
      .to('[data-add="1"]', { scale: 0.92, duration: 0.1, yoyo: true, repeat: 1 }, 1.9)
      .to('[data-add-label="1"]', { yPercent: -100, duration: 0.3, ease: 'power2.inOut' }, 2.0)
      // товар летит в корзину: сначала вверх, потом к иконке
      .fromTo(
        '[data-fly]',
        { x: 257, y: 109, scale: 1, opacity: 0 },
        { opacity: 1, duration: 0.15 },
        2.0
      )
      .to('[data-fly]', { x: 500, duration: 0.75, ease: 'power1.in' }, 2.05)
      .to('[data-fly]', { y: 6, scale: 0.35, duration: 0.75, ease: 'power3.out' }, 2.05)
      .to('[data-fly]', { opacity: 0, duration: 0.15 }, 2.75)
      .fromTo('[data-badge]', { scale: 0 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' }, 2.78)
      // оформление
      .from('[data-drawer]', { xPercent: 100, duration: 0.7, ease: 'expo.out' }, 3.05)
      .to('[data-pointer]', { x: 440, y: 196, duration: 0.8, ease: 'power2.inOut' }, 3.2)
      .to('[data-pay]', { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1 }, 4.05)
      .to('[data-pay-label]', { yPercent: -100, duration: 0.35, ease: 'power2.inOut' }, 4.15)
      .to('[data-pay]', { backgroundColor: '#3f7d58', duration: 0.35 }, 4.15)
      .to('[data-pointer]', { opacity: 0, duration: 0.3 }, 4.4)
      .to('[data-shop]', { opacity: 0, duration: 0.45 }, 5.6)
      .set({}, {}, 6.1);

    // пламя свечи живёт всегда, даже на «законченном» кадре
    tl.to('[data-flame]', { scaleY: 1.18, scaleX: 0.88, duration: 0.35, yoyo: true, repeat: 16, ease: 'sine.inOut' }, 0);
  });

  return (
    <LiveScreen>
      <div ref={root} className="absolute inset-0 bg-[#141416] font-sans text-[#ede9e3]">
        <div data-shop className="absolute inset-0">
          <header data-top className="absolute inset-x-7 top-5 flex items-center justify-between">
            <span className="text-[13px] font-bold tracking-[0.24em]">ЛАВКА</span>
            <nav className="flex gap-5 text-[10px] text-[#8c877f]">
              <span>Каталог</span>
              <span>Новинки</span>
              <span>Доставка</span>
            </nav>
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

          <div className="absolute left-7 top-[62px] flex gap-3.5">
            {ITEMS.map(({ name, price, Art }, i) => (
              <div key={name} data-card className="w-[158px] rounded-[10px] bg-[#1d1d21] p-2.5">
                <div className="flex h-[118px] items-center justify-center rounded-lg bg-[linear-gradient(160deg,#2a2a30,#1b1b1f)]">
                  <Art />
                </div>
                <p className="m-0 mt-2.5 text-[11px] leading-tight text-[#cfcac2]">{name}</p>
                <p className="m-0 mt-0.5 text-[13px] font-semibold">{price}</p>
                <span
                  data-add={i}
                  className="mt-2.5 flex h-7 items-start justify-center overflow-hidden rounded-full border text-[10px]"
                  style={{ borderColor: i === 1 ? BRONZE : '#3a3a40', color: i === 1 ? BRONZE : '#8c877f' }}
                >
                  <span data-add-label={i} className="flex flex-col items-center leading-7">
                    <span>В корзину</span>
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" /> Добавлено
                    </span>
                  </span>
                </span>
              </div>
            ))}
          </div>

          {/* летящий товар */}
          <span
            data-fly
            className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#2a2a30] opacity-0"
          >
            <i className="block h-5 w-3.5 rounded-sm bg-[#dcd2c4]" />
          </span>

          {/* оформление */}
          <aside
            data-drawer
            className="absolute bottom-0 right-0 top-0 w-[212px] border-l border-white/5 bg-[#1a1a1e] p-5 shadow-[-30px_0_60px_rgba(0,0,0,0.4)]"
          >
            <p className="m-0 font-mono text-[9px] uppercase tracking-[0.18em] text-[#8c877f]">Корзина</p>
            <div className="mt-4 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#26262b]">
                <i className="block h-5 w-3.5 rounded-sm bg-[#dcd2c4]" />
              </span>
              <span className="text-[11px] leading-tight">
                Свеча «Кедр»
                <b className="block font-semibold">1 190 ₽</b>
              </span>
            </div>
            <div className="mt-5 space-y-1.5 border-t border-white/5 pt-4 text-[10.5px] text-[#8c877f]">
              <p className="m-0 flex justify-between">
                <span>Доставка завтра</span>
                <span>0 ₽</span>
              </p>
              <p className="m-0 flex justify-between text-[13px] font-semibold text-[#ede9e3]">
                <span>Итого</span>
                <span>1 190 ₽</span>
              </p>
            </div>
            <span
              data-pay
              className="mt-5 flex h-10 items-start justify-center overflow-hidden rounded-lg text-[12px] font-semibold text-[#141416]"
              style={{ background: BRONZE }}
            >
              <span data-pay-label className="flex flex-col items-center leading-10">
                <span>Оплатить</span>
                <span className="flex items-center gap-1.5 text-white">
                  <Check className="h-3.5 w-3.5" /> Оплачено
                </span>
              </span>
            </span>
            <p className="m-0 mt-3 text-center text-[9.5px] text-[#8c877f]">СБП · карта · в рассрочку</p>
          </aside>

          <Pointer />
        </div>
      </div>
    </LiveScreen>
  );
}
