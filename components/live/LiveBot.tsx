'use client';

import { useRef } from 'react';
import { Check, LiveScreen, useLoop, type LiveProps } from './kit';

const ROWS: Array<[string, string, string, string]> = [
  ['17:41', 'Ирина К.', 'Нидра 20:30', '800'],
  ['17:52', 'Павел С.', 'Хатха 19:00', '800'],
  ['18:02', 'Алина М.', 'Хатха 19:00', '800']
];

/**
 * Бот с интеграциями: запись на занятие прямо в переписке, счёт на
 * оплату, чек — и видно, куда это уходит дальше: строка в таблице
 * студии и сделка в CRM. Ночная тема Telegram слева, рабочие
 * инструменты студии справа.
 *
 * Раньше «интеграции» были тремя подписями со стрелками — обещанием.
 * Теперь они происходят в кадре: без этого бот выглядит чатом,
 * а продаётся именно то, что после чата никто ничего не переносит руками.
 */
export default function LiveBot({ playing }: LiveProps) {
  const root = useRef<HTMLDivElement>(null);

  useLoop(root, playing, (tl) => {
    const pop = (sel: string, at: number, origin = '0% 100%') =>
      tl.from(sel, { scale: 0.86, y: 10, opacity: 0, transformOrigin: origin, duration: 0.45, ease: 'back.out(1.8)' }, at);

    tl.from('[data-head]', { opacity: 0, y: -8, duration: 0.45 }, 0)
      .from('[data-side]', { x: 24, opacity: 0, duration: 0.6, ease: 'power3.out' }, 0.2);
    pop('[data-m1]', 0.35);
    tl.from('[data-kb]', { opacity: 0, y: 6, duration: 0.35, stagger: 0.07 }, 0.7)
      .to('[data-kb-hit]', { backgroundColor: 'rgba(106,168,222,0.5)', duration: 0.15, yoyo: true, repeat: 1 }, 1.3);
    pop('[data-m2]', 1.55, '100% 100%');
    // «печатает…» — в шапке и пузырём
    tl.to('[data-status]', { yPercent: -50, duration: 0.25 }, 1.9)
      .from('[data-typing]', { opacity: 0, duration: 0.2 }, 1.95)
      .to('[data-dot]', { y: -3, duration: 0.22, yoyo: true, repeat: 3, stagger: 0.1, ease: 'sine.inOut' }, 2.0)
      .to('[data-typing]', { opacity: 0, duration: 0.15 }, 2.8)
      .to('[data-status]', { yPercent: 0, duration: 0.25 }, 2.8);
    pop('[data-m3]', 2.85);
    tl.to('[data-pay-hit]', { backgroundColor: '#6aa8de', duration: 0.15, yoyo: true, repeat: 1 }, 3.55);
    pop('[data-m4]', 3.85);
    // данные уходят в инструменты студии
    tl.fromTo('[data-row-new]', { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 4.1)
      .fromTo('[data-row-new]', { backgroundColor: 'rgba(110,231,168,0.28)' }, { backgroundColor: 'rgba(110,231,168,0)', duration: 1.4 }, 4.3)
      .from('[data-deal]', { x: 20, opacity: 0, duration: 0.5, ease: 'expo.out' }, 4.45)
      .to('[data-stage]', { xPercent: 100, duration: 0.5, ease: 'power2.inOut' }, 4.95)
      .from('[data-remind]', { opacity: 0, y: 6, duration: 0.4 }, 5.2)
      .to('[data-chat], [data-side]', { opacity: 0, duration: 0.45 }, 6.6)
      .set({}, {}, 7.1);
  }, 0.8);

  const bubble = 'max-w-[250px] rounded-2xl px-3 py-2 text-[11px] leading-[1.45]';
  const time = 'ml-2 align-bottom font-mono text-[8px] text-[#6c7883]';

  return (
    <LiveScreen>
      <div ref={root} className="absolute inset-0 bg-[#0e1621] font-sans text-[#e9eef3]">
        {/* обои переписки */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '18px 18px' }}
        />

        <div data-chat className="absolute bottom-0 left-0 top-0 w-[330px] border-r border-black/30">
          <header data-head className="flex h-11 items-center gap-2.5 bg-[#17212b] px-3.5">
            <span className="text-[16px] text-[#6c7883]">‹</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#9fd0a8,#3f7d6a)] text-[11px] font-semibold">
              П
            </span>
            <span className="leading-tight">
              <b className="block text-[12px] font-semibold">Йога-студия «Прана»</b>
              <span className="block h-3 overflow-hidden text-[9px]">
                <span data-status className="flex flex-col">
                  <span className="text-[#6c7883]">бот · отвечает сразу</span>
                  <span className="text-[#6aa8de]">печатает…</span>
                </span>
              </span>
            </span>
          </header>

          <div className="flex flex-col gap-1.5 px-4 pt-3">
            <span className="self-center rounded-full bg-black/25 px-2 py-0.5 text-[8.5px] text-[#9fb0bf]">сегодня</span>

            <div data-m1 className={`${bubble} self-start rounded-bl-md bg-[#182533]`}>
              Здравствуйте, Алина! На какое занятие записать?
              <span className={time}>18:02</span>
            </div>
            <div className="grid w-[250px] grid-cols-2 gap-1 self-start">
              <span data-kb data-kb-hit className="flex h-7 items-center justify-center rounded-lg bg-white/[0.08] text-[10px]">
                Хатха · 19:00
              </span>
              <span data-kb className="flex h-7 items-center justify-center rounded-lg bg-white/[0.08] text-[10px]">
                Нидра · 20:30
              </span>
            </div>

            <div data-m2 className={`${bubble} self-end rounded-br-md bg-[#2b5278]`}>
              Хатха · 19:00
              <span className={`${time} text-[#8fb3dc]`}>18:02 ✓✓</span>
            </div>

            <div className="relative self-start">
              <div data-typing className="absolute left-0 top-0 flex h-8 items-center gap-1 rounded-2xl rounded-bl-md bg-[#182533] px-3.5">
                {[0, 1, 2].map((i) => (
                  <i key={i} data-dot className="block h-1.5 w-1.5 rounded-full bg-[#6c7883]" />
                ))}
              </div>
              {/* счёт в стиле платежей Telegram: карточка, сумма, кнопка */}
              <div data-m3 className="w-[250px] overflow-hidden rounded-2xl rounded-bl-md bg-[#182533]">
                <div className="flex gap-2.5 p-2.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(160deg,#3f7d6a,#1c3a33)]">
                    {/* солнце над горизонтом — знак зала «Солнце» */}
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#d9f2df" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M5 16h14M8 16a4 4 0 0 1 8 0M12 7v2M6.3 9.3l1.4 1.4M17.7 9.3l-1.4 1.4" />
                    </svg>
                  </span>
                  <span className="leading-tight">
                    <b className="block text-[11px] font-semibold">Хатха-йога · сегодня 19:00</b>
                    <span className="mt-0.5 block text-[9.5px] text-[#8b9aa8]">Зал «Солнце» · осталось 3 места</span>
                    <b className="mt-1 block text-[12px] font-semibold">800 ₽</b>
                  </span>
                </div>
                <span data-pay-hit className="flex h-8 items-center justify-center border-t border-white/5 bg-[#5288c1] text-[11px] font-semibold text-white">
                  Оплатить 800 ₽
                </span>
              </div>
            </div>

            <div data-m4 className={`${bubble} flex items-center gap-2 self-start rounded-bl-md bg-[#182533]`}>
              <Check className="h-4 w-4 shrink-0" color="#6ee7a8" />
              <span>
                Оплачено, вы записаны. Напомню в 17:00.
                <span className={time}>18:03</span>
              </span>
            </div>
          </div>
        </div>

        {/* инструменты студии */}
        <aside data-side className="absolute bottom-3 right-3 top-3 w-[208px] space-y-2.5">
          <div className="overflow-hidden rounded-[10px] bg-[#f4f6f8] text-[#1d2733] shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
            <p className="m-0 flex items-center gap-1.5 border-b border-[#dfe4ea] px-2.5 py-1.5 text-[9.5px] font-semibold">
              <i className="block h-3 w-3 rounded-[2px] bg-[#1e8e3e]" /> Записи · сентябрь
            </p>
            <table className="w-full border-collapse font-mono text-[8.5px]">
              <thead>
                <tr className="bg-[#eef1f4] text-left text-[#6b7785]">
                  {['Время', 'Имя', 'Занятие', '₽'].map((h) => (
                    <th key={h} className="border-b border-[#dfe4ea] px-1.5 py-1 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr key={r[0]} {...(i === ROWS.length - 1 ? { 'data-row-new': '' } : {})} className="text-[#1d2733]">
                    {r.map((c, j) => (
                      <td key={j} className="whitespace-nowrap border-b border-[#e8ecf0] px-1.5 py-1">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div data-deal className="rounded-[10px] bg-[#16202b] p-2.5 shadow-[0_14px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
            <p className="m-0 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.14em] text-[#8fb3dc]">
              <span>CRM · сделка</span>
              <span>#4127</span>
            </p>
            <p className="m-0 mt-1.5 text-[11px] font-semibold">Алина М. · абонемент</p>
            <p className="m-0 text-[9px] text-[#8b9aa8]">Источник: бот · Хатха 19:00</p>
            {/* этап сделки переезжает из «Записалась» в «Оплатила» */}
            <div className="relative mt-2 grid grid-cols-2 rounded-full bg-white/5 p-0.5 text-center text-[8.5px]">
              <i data-stage className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-[#2f6b47]" />
              <span className="relative py-0.5">Записалась</span>
              <span className="relative py-0.5">Оплатила</span>
            </div>
          </div>

          <p data-remind className="m-0 flex items-center gap-1.5 rounded-[10px] bg-[#16202b] px-2.5 py-2 text-[9.5px] text-[#b8c4cf] ring-1 ring-white/10">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f5b83d]/20">
              <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="#f5b83d" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v3l2 1.5" />
              </svg>
            </span>
            Напоминание в 17:00 · в календаре
          </p>
        </aside>
      </div>
    </LiveScreen>
  );
}
