'use client';

import { useRef } from 'react';
import { Check, LiveScreen, useLoop, type LiveProps } from './kit';

const TG = '#2481cc';

/** Снимки блюд — brand/blender/products.py, сверху на светлом столе. */
const MENU = [
  { name: 'Капучино', note: '300 мл', price: '290 ₽', img: '/live/cappuccino.webp' },
  { name: 'Флэт уайт', note: 'двойной', price: '310 ₽', img: '/live/flatwhite.webp' },
  { name: 'Сырники', note: 'со сметаной', price: '250 ₽', img: '/live/syrniki.webp' }
];

/**
 * Telegram Web App: меню кофейни внутри мессенджера. Два касания,
 * главная кнопка считает сумму, заказ уходит — и тут же падает на экран
 * бариста. Светлое приложение в телефоне на стальном градиенте.
 */
export default function LiveWebApp({ playing }: LiveProps) {
  const root = useRef<HTMLDivElement>(null);

  useLoop(root, playing, (tl) => {
    // касание пальцем: круг появляется там, где кнопка, в координатах экрана телефона
    const tap = (sel: string, at: number) =>
      tl
        .call(
          () => {
            const t = root.current?.querySelector<HTMLElement>(sel);
            const touch = root.current?.querySelector<HTMLElement>('[data-touch]');
            const screen = touch?.offsetParent as HTMLElement | null;
            if (!t || !touch || !screen) return;
            const sb = screen.getBoundingClientRect();
            // карусель масштабирует вставку — делим на итоговый масштаб
            const k = sb.width / screen.offsetWidth || 1;
            const r = t.getBoundingClientRect();
            touch.style.left = `${(r.left - sb.left + r.width / 2) / k - 14}px`;
            touch.style.top = `${(r.top - sb.top + r.height / 2) / k - 14}px`;
          },
          undefined,
          at
        )
        .fromTo('[data-touch]', { scale: 0.4, opacity: 0.7 }, { scale: 1.4, opacity: 0, duration: 0.5, ease: 'power2.out' }, at)
        .to(sel, { scale: 0.88, duration: 0.1, yoyo: true, repeat: 1 }, at);

    tl.from('[data-phone]', { y: 36, opacity: 0, duration: 0.8, ease: 'power3.out' }, 0)
      .from('[data-promo]', { opacity: 0, y: 6, duration: 0.4 }, 0.35)
      .from('[data-chip]', { opacity: 0, y: 6, duration: 0.35, stagger: 0.06 }, 0.45)
      .from('[data-row]', { opacity: 0, x: 14, duration: 0.45, ease: 'power2.out', stagger: 0.08 }, 0.6)
      .from('[data-dish]', { scale: 0.6, rotate: -40, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.08 }, 0.6)
      .from('[data-side]', { x: -20, opacity: 0, duration: 0.6, ease: 'expo.out' }, 0.9);
    tap('[data-plus="0"]', 1.4);
    tl.to('[data-step="0"]', { yPercent: -50, duration: 0.3, ease: 'power2.inOut' }, 1.45)
      .to('[data-sum]', { yPercent: -33.333, duration: 0.35, ease: 'power2.inOut' }, 1.45);
    tap('[data-plus="2"]', 2.1);
    tl.to('[data-step="2"]', { yPercent: -50, duration: 0.3, ease: 'power2.inOut' }, 2.15)
      .to('[data-sum]', { yPercent: -66.666, duration: 0.35, ease: 'power2.inOut' }, 2.15);
    tap('[data-main]', 2.85);
    tl.from('[data-done]', { xPercent: 100, duration: 0.6, ease: 'expo.out' }, 3.1)
      .fromTo('[data-ring]', { strokeDashoffset: 113 }, { strokeDashoffset: 28, duration: 1.6, ease: 'power1.inOut' }, 3.4)
      .from('[data-order]', { x: 30, opacity: 0, duration: 0.6, ease: 'expo.out' }, 3.5)
      .from('[data-ticket]', { opacity: 0, y: 5, duration: 0.3, stagger: 0.1 }, 3.8)
      .to('[data-cooking]', { backgroundColor: '#f5b83d', duration: 0.3 }, 4.6)
      .to('[data-app]', { opacity: 0, duration: 0.45 }, 6.4)
      .set({}, {}, 6.9);
  });

  return (
    <LiveScreen>
      <div
        ref={root}
        className="absolute inset-0 font-sans"
        style={{ background: 'linear-gradient(135deg, #6e8fb3 0%, #2c5282 45%, #0b2c56 100%)' }}
      >
        <div data-app className="absolute inset-0">
          {/* свечение: круг 256 px, размытый на 64 px, записан градиентом —
              `filter: blur` Safari пересчитывал на каждом кадре перехода тем */}
          <div
            className="absolute left-1/2 h-[588px] w-[588px] -translate-x-1/2"
            style={{ top: -150, background: 'radial-gradient(closest-side, rgb(255 255 255 / 0.173) 0%, rgb(255 255 255 / 0.167) 10%, rgb(255 255 255 / 0.15) 20%, rgb(255 255 255 / 0.123) 30%, rgb(255 255 255 / 0.091) 40%, rgb(255 255 255 / 0.059) 50%, rgb(255 255 255 / 0.033) 60%, rgb(255 255 255 / 0.016) 70%, rgb(255 255 255 / 0.006) 80%, rgb(255 255 255 / 0.002) 90%, transparent 100%)' }}
          />

          {/* подпись слева */}
          <div data-side className="absolute left-6 top-[96px] w-[140px] text-white">
            <p className="m-0 font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/60">Кофейня «Зерно»</p>
            <p className="m-0 mt-2 text-[17px] font-semibold leading-[1.15]">Меню и оплата прямо в Telegram</p>
            <ul className="m-0 mt-4 list-none space-y-2 p-0 text-[10px] text-white/75">
              {['Без установки и регистрации', 'Бонусы копятся сами', 'Заказ — к нужной минуте'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0" color="#bfe0ff" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* телефон */}
          <div
            data-phone
            className="absolute left-[178px] top-[12px] h-[372px] w-[204px] rounded-[32px] bg-[#0b0b0d] p-[7px] shadow-[0_40px_80px_rgba(0,0,0,0.45)]"
          >
            <div className="relative h-full overflow-hidden rounded-[25px] bg-[#f4f4f6] text-[#111]">
              <div className="flex h-9 items-center justify-between bg-white px-3 text-[10px]">
                <span style={{ color: TG }}>Закрыть</span>
                <b className="text-[11px]">Зерно</b>
                <span className="text-[#999]">•••</span>
              </div>

              <div data-promo className="mx-2.5 mt-2 flex items-center gap-2 rounded-[12px] bg-[#1d2a38] px-3 py-2 text-white">
                <span className="leading-tight">
                  <b className="block text-[10px] font-semibold">Второй капучино −50%</b>
                  <span className="text-[8.5px] text-white/60">до 11:00 по будням</span>
                </span>
                <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-white/15 px-1.5 py-0.5 font-mono text-[8px]">124 б.</span>
              </div>

              <div className="mt-2 flex gap-1.5 overflow-hidden px-2.5">
                {['Кофе', 'Завтраки', 'Десерты', 'С собой'].map((c, i) => (
                  <span
                    key={c}
                    data-chip
                    className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[9px]"
                    style={i === 0 ? { background: TG, color: '#fff' } : { background: '#fff', color: '#555' }}
                  >
                    {c}
                  </span>
                ))}
              </div>

              <ul className="m-0 mx-2.5 mt-2 list-none overflow-hidden rounded-[12px] bg-white p-0">
                {MENU.map((m, i) => (
                  <li key={m.name} data-row className="flex items-center gap-2 border-b border-[#f1f1f4] px-2 py-1.5 last:border-b-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" data-dish src={m.img} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" draggable={false} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <b className="block whitespace-nowrap text-[10.5px] font-semibold">{m.name}</b>
                      <span className="block whitespace-nowrap text-[8.5px] text-[#999]">{m.note}</span>
                      <span className="text-[10px] font-semibold">{m.price}</span>
                    </span>
                    {/* кнопка превращается в счётчик: так делает сам Telegram-магазин */}
                    <span data-plus={i} className="h-6 w-[50px] shrink-0 overflow-hidden rounded-full" style={{ background: i === 1 ? '#eef2f7' : TG }}>
                      <span data-step={i} className="flex flex-col">
                        <span className="flex h-6 items-center justify-center text-[10px] font-semibold" style={{ color: i === 1 ? TG : '#fff' }}>
                          +
                        </span>
                        <span className="flex h-6 items-center justify-between px-2 text-[11px] font-semibold text-white">
                          <span>−</span>
                          <span className="text-[10px]">1</span>
                          <span>+</span>
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {/* главная кнопка Telegram считает сумму */}
              <div
                data-main
                className="absolute inset-x-2.5 bottom-2.5 flex h-10 items-start justify-center overflow-hidden rounded-xl text-[11px] font-semibold text-white"
                style={{ background: TG }}
              >
                <span data-sum className="flex flex-col items-center leading-10">
                  <span>Корзина пуста</span>
                  <span>Заказать · 290 ₽</span>
                  <span>Заказать · 540 ₽</span>
                </span>
              </div>

              {/* заказ принят */}
              <div data-done className="absolute inset-0 flex flex-col items-center justify-center bg-white px-4 text-center">
                <svg viewBox="0 0 44 44" className="h-16 w-16 -rotate-90">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#eef3f8" strokeWidth="4" />
                  <circle
                    data-ring
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke={TG}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="113"
                    strokeDashoffset="28"
                  />
                </svg>
                <b className="mt-3 text-[13px]">Заказ №24 принят</b>
                <span className="mt-1 text-[10px] text-[#888]">Будет готов к 8:45 · стойка у окна</span>
                <span className="mt-3 rounded-full bg-[#eef6ff] px-2.5 py-1 text-[9px]" style={{ color: TG }}>
                  +27 бонусов
                </span>
              </div>

              <i data-touch className="pointer-events-none absolute h-7 w-7 rounded-full bg-[#2481cc]/40 opacity-0" />
            </div>
          </div>

          {/* заказ на экране бариста */}
          <div
            data-order
            className="absolute left-[396px] top-[104px] w-[146px] rounded-[12px] border border-white/10 bg-[#0b1320]/90 p-3 text-white shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur"
          >
            <p className="m-0 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.16em] text-[#8fb3dc]">
              <span>Бариста · экран</span>
              <span>8:38</span>
            </p>
            <p className="m-0 mt-2 flex items-baseline justify-between">
              <b className="text-[14px] font-semibold">№24</b>
              <span className="text-[9.5px] text-white/60">к 8:45</span>
            </p>
            <ul className="m-0 mt-2 list-none space-y-1.5 border-t border-white/10 p-0 pt-2">
              {[MENU[0], MENU[2]].map((m) => (
                <li key={m.name} data-ticket className="flex items-center gap-2 text-[10px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={m.img} alt="" className="h-5 w-5 rounded-full object-cover" />
                  <span className="flex-1 leading-tight">
                    {m.name}
                    <span className="block text-[8.5px] text-white/45">{m.note}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="m-0 mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[9.5px]">
              <span className="flex items-center gap-1.5">
                <i data-cooking className="block h-1.5 w-1.5 rounded-full bg-[#3ddc84]" /> Готовим
              </span>
              <b className="font-semibold">540 ₽</b>
            </p>
          </div>
        </div>
      </div>
    </LiveScreen>
  );
}
