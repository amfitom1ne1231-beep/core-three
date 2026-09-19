'use client';

import { useRef } from 'react';
import { Check, LiveScreen, useLoop, type LiveProps } from './kit';

/**
 * Бот с интеграциями: запись на занятие прямо в переписке, оплата,
 * выгрузка в таблицу и CRM. Стиль — ночная тема Telegram: узнаётся
 * сразу, и сразу понятно, где это будет жить.
 */
export default function LiveBot({ playing }: LiveProps) {
  const root = useRef<HTMLDivElement>(null);

  useLoop(root, playing, (tl) => {
    const pop = (sel: string, at: number, origin = '0% 100%') =>
      tl.from(sel, { scale: 0.86, y: 10, opacity: 0, transformOrigin: origin, duration: 0.45, ease: 'back.out(1.8)' }, at);

    tl.from('[data-head]', { opacity: 0, y: -8, duration: 0.45 }, 0);
    pop('[data-m1]', 0.3);
    tl.from('[data-kb]', { opacity: 0, y: 6, duration: 0.35, stagger: 0.08 }, 0.7);
    // нажатие кнопки — вспышка
    tl.to('[data-kb-hit]', { backgroundColor: 'rgba(106,168,222,0.45)', duration: 0.15, yoyo: true, repeat: 1 }, 1.3);
    pop('[data-m2]', 1.55, '100% 100%');
    tl.from('[data-typing]', { opacity: 0, duration: 0.2 }, 1.95)
      .to('[data-dot]', { y: -3, duration: 0.22, yoyo: true, repeat: 3, stagger: 0.1, ease: 'sine.inOut' }, 2.0)
      .to('[data-typing]', { opacity: 0, duration: 0.15 }, 2.85);
    pop('[data-m3]', 2.9);
    tl.to('[data-pay-hit]', { backgroundColor: '#6aa8de', duration: 0.15, yoyo: true, repeat: 1 }, 3.5);
    pop('[data-m4]', 3.8);
    tl.from('[data-chip]', { x: 18, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.15 }, 4.1)
      .to('[data-chat]', { opacity: 0, duration: 0.45 }, 5.6)
      .set({}, {}, 6.1);
  });

  const bubble = 'max-w-[300px] rounded-2xl px-3.5 py-2 text-[12px] leading-[1.45]';
  const time = 'ml-2 align-bottom font-mono text-[8.5px] text-[#6c7883]';

  return (
    <LiveScreen>
      <div ref={root} className="absolute inset-0 bg-[#0e1621] font-sans text-[#e9eef3]">
        {/* фон переписки */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
            backgroundSize: '18px 18px'
          }}
        />
        <header data-head className="absolute inset-x-0 top-0 flex h-11 items-center gap-3 bg-[#17212b] px-4">
          <span className="text-[16px] text-[#6c7883]">‹</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#6aa8de,#2b5278)] text-[11px] font-semibold">
            П
          </span>
          <span className="leading-tight">
            <b className="block text-[12.5px] font-semibold">Йога-студия «Прана»</b>
            <span className="text-[9.5px] text-[#6c7883]">бот</span>
          </span>
        </header>

        <div data-chat className="absolute inset-x-0 bottom-0 top-11 px-6 pt-4">
          <div className="mx-auto flex w-[420px] flex-col gap-2">
            <div data-m1 className={`${bubble} self-start rounded-bl-md bg-[#182533]`}>
              Здравствуйте! На какое занятие записать?
              <span className={time}>18:02</span>
            </div>
            <div className="flex w-[300px] gap-1.5 self-start">
              <span data-kb data-kb-hit className="flex h-7 flex-1 items-center justify-center rounded-lg bg-white/[0.08] text-[11px]">
                Хатха · 19:00
              </span>
              <span data-kb className="flex h-7 flex-1 items-center justify-center rounded-lg bg-white/[0.08] text-[11px]">
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
              <div data-m3 className={`${bubble} w-[300px] rounded-bl-md bg-[#182533]`}>
                Записала! Осталось 3 места. Оплатить 800 ₽ сейчас?
                <span data-pay-hit className="mt-2 flex h-8 items-center justify-center rounded-lg bg-[#5288c1] text-[11.5px] font-semibold text-white">
                  Оплатить 800 ₽
                </span>
              </div>
            </div>

            <div data-m4 className={`${bubble} flex items-center gap-2 self-start rounded-bl-md bg-[#182533]`}>
              <Check className="h-4 w-4 shrink-0" color="#6ee7a8" />
              Оплата прошла. Напомню за два часа.
            </div>
          </div>

          {/* куда уходят данные */}
          <div className="absolute bottom-5 right-6 flex flex-col items-end gap-1.5">
            {['→ Google Таблица', '→ amoCRM', '→ календарь'].map((c) => (
              <span
                key={c}
                data-chip
                className="rounded-full border border-white/10 bg-[#17212b] px-2.5 py-1 font-mono text-[9px] text-[#8fb3dc]"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </LiveScreen>
  );
}
