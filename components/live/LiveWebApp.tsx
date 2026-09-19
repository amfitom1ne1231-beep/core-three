'use client';

import { useRef } from 'react';
import { Check, LiveScreen, useLoop, type LiveProps } from './kit';

const TG = '#2481cc';

const MENU = [
  { name: 'Капучино', note: '250 мл', price: '290 ₽', tone: '#c9a27e' },
  { name: 'Флэт уайт', note: '200 мл', price: '310 ₽', tone: '#7a5236' },
  { name: 'Сырники', note: 'со сметаной', price: '250 ₽', tone: '#e8d8c0' }
];

/**
 * Telegram Web App: меню кофейни внутри мессенджера. Два касания,
 * главная кнопка считает сумму, заказ уходит — и тут же приходит
 * заведению. Стиль — светлое приложение в телефоне на стальном градиенте.
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
      .from('[data-chip]', { opacity: 0, y: 6, duration: 0.35, stagger: 0.06 }, 0.4)
      .from('[data-row]', { opacity: 0, x: 14, duration: 0.45, ease: 'power2.out', stagger: 0.08 }, 0.55);
    tap('[data-plus="0"]', 1.3);
    tl.to('[data-sum]', { yPercent: -33.333, duration: 0.35, ease: 'power2.inOut' }, 1.35);
    tap('[data-plus="2"]', 2.0);
    tl.to('[data-sum]', { yPercent: -66.666, duration: 0.35, ease: 'power2.inOut' }, 2.05);
    tap('[data-main]', 2.75);
    tl.from('[data-done]', { xPercent: 100, duration: 0.6, ease: 'expo.out' }, 3.0)
      .fromTo('[data-ring]', { strokeDashoffset: 113 }, { strokeDashoffset: 28, duration: 1.6, ease: 'power1.inOut' }, 3.3)
      .from('[data-order]', { x: 30, opacity: 0, duration: 0.6, ease: 'expo.out' }, 3.4)
      .from('[data-side]', { x: -20, opacity: 0, duration: 0.6, ease: 'expo.out' }, 0.9)
      .to('[data-app]', { opacity: 0, duration: 0.45 }, 5.6)
      .set({}, {}, 6.1);
  });

  return (
    <LiveScreen>
      <div
        ref={root}
        className="absolute inset-0 font-sans"
        style={{ background: 'linear-gradient(135deg, #6e8fb3 0%, #2c5282 45%, #0b2c56 100%)' }}
      >
        <div data-app className="absolute inset-0">
          <div className="absolute left-1/2 top-4 h-64 w-64 -translate-x-1/2 rounded-full bg-white/20 blur-3xl" />

          {/* подпись слева */}
          <div data-side className="absolute left-7 top-[132px] w-[130px] text-white">
            <p className="m-0 font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">Внутри Telegram</p>
            <p className="m-0 mt-2 text-[17px] font-semibold leading-[1.15]">Без установки и регистрации</p>
          </div>

          {/* телефон */}
          <div
            data-phone
            className="absolute left-[182px] top-[14px] h-[368px] w-[196px] rounded-[30px] bg-[#0b0b0d] p-[7px] shadow-[0_40px_80px_rgba(0,0,0,0.45)]"
          >
            <div className="relative h-full overflow-hidden rounded-[24px] bg-white text-[#111]">
              <div className="flex h-9 items-center justify-between px-3 text-[10px]">
                <span style={{ color: TG }}>Закрыть</span>
                <b className="text-[11px]">Зерно</b>
                <span className="text-[#999]">•••</span>
              </div>
              <div className="flex gap-1.5 px-3">
                {['Кофе', 'Десерты', 'Завтраки'].map((c, i) => (
                  <span
                    key={c}
                    data-chip
                    className="rounded-full px-2.5 py-1 text-[9.5px]"
                    style={i === 0 ? { background: TG, color: '#fff' } : { background: '#f1f1f4', color: '#555' }}
                  >
                    {c}
                  </span>
                ))}
              </div>
              <ul className="m-0 mt-3 list-none p-0">
                {MENU.map((m, i) => (
                  <li key={m.name} data-row className="flex items-center gap-2.5 border-b border-[#f1f1f4] px-3 py-2.5">
                    <i className="block h-8 w-8 shrink-0 rounded-full" style={{ background: m.tone }} />
                    <span className="flex-1 leading-tight">
                      <b className="block text-[10.5px] font-semibold">{m.name}</b>
                      <span className="text-[9px] text-[#999]">{m.note}</span>
                    </span>
                    <span className="text-[10px] font-semibold">{m.price}</span>
                    <span
                      data-plus={i}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[13px] leading-none text-white"
                      style={{ background: TG }}
                    >
                      +
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
                  <span>Заказать · 0 ₽</span>
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
                <span className="mt-1 text-[10px] text-[#888]">Будет готов через 7 минут</span>
              </div>

              <i data-touch className="pointer-events-none absolute h-7 w-7 rounded-full bg-[#2481cc]/40 opacity-0" />
            </div>
          </div>

          {/* заказ приходит заведению */}
          <div
            data-order
            className="absolute left-[396px] top-[150px] w-[140px] rounded-xl border border-white/10 bg-[#0b1320]/85 p-3 text-white shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur"
          >
            <p className="m-0 flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#8fb3dc]">
              <Check className="h-3 w-3" /> Новый заказ
            </p>
            <p className="m-0 mt-1.5 text-[13px] font-semibold">№24 · 540 ₽</p>
            <p className="m-0 mt-0.5 text-[9.5px] text-white/55">Капучино, сырники</p>
          </div>
        </div>
      </div>
    </LiveScreen>
  );
}
