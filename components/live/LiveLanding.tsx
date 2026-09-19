'use client';

import { useRef } from 'react';
import { Check, LiveScreen, Pointer, countTo, useLoop, type LiveProps } from './kit';

/**
 * Лендинг: страница курса собирается, человек жмёт «Записаться»,
 * приходит заявка, конверсия растёт. Стиль — ночная сталь: глубокий
 * синий, свечение сверху, акцентная кнопка.
 */
export default function LiveLanding({ playing }: LiveProps) {
  const root = useRef<HTMLDivElement>(null);

  useLoop(root, playing, (tl) => {
    const q = (s: string) => root.current?.querySelector(s) ?? null;

    tl.from('[data-win]', { y: 22, opacity: 0, duration: 0.7, ease: 'power3.out' }, 0)
      .from('[data-kicker]', { opacity: 0, duration: 0.4 }, 0.25)
      .from('[data-hl]', { yPercent: 110, duration: 0.8, ease: 'expo.out', stagger: 0.1 }, 0.3)
      .from('[data-sub]', { opacity: 0, y: 8, duration: 0.5 }, 0.7)
      .from('[data-cta]', { scale: 0.85, opacity: 0, duration: 0.5, ease: 'back.out(2)' }, 0.9)
      .from('[data-ava]', { scale: 0, duration: 0.35, ease: 'back.out(2)', stagger: 0.07 }, 1.0)
      .from('[data-stats]', { x: 28, opacity: 0, duration: 0.7, ease: 'power3.out' }, 1.1)
      .from('[data-bar]', { scaleY: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06 }, 1.3)
      // курсор идёт к кнопке и нажимает
      .fromTo('[data-pointer]', { x: 470, y: 330, opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.4)
      .to('[data-pointer]', { x: 120, y: 232, duration: 1.1, ease: 'power2.inOut' }, 1.5)
      .to('[data-cta]', { scale: 0.93, duration: 0.12, yoyo: true, repeat: 1 }, 2.6)
      .fromTo('[data-ripple]', { scale: 0, opacity: 0.55 }, { scale: 3.2, opacity: 0, duration: 0.8, ease: 'power2.out' }, 2.62)
      .from('[data-toast]', { x: 40, opacity: 0, duration: 0.6, ease: 'expo.out' }, 2.8)
      .to('[data-bar-last]', { scaleY: 1.9, duration: 0.8, ease: 'power3.out' }, 2.9)
      .to('[data-pointer]', { opacity: 0, duration: 0.4 }, 3.5)
      .to('[data-win], [data-stats], [data-toast]', { opacity: 0, duration: 0.45 }, 5.6)
      .set({}, {}, 6.1);
    countTo(tl, q('[data-conv]'), 2.1, 6.4, 2.9, { decimals: 1, suffix: '%', duration: 1.3 });
  });

  return (
    <LiveScreen>
      <div
        ref={root}
        className="absolute inset-0 font-sans text-white"
        style={{
          background: 'radial-gradient(120% 90% at 78% -10%, #24497a 0%, #0c1b31 46%, #05080d 100%)'
        }}
      >
        <div
          className="absolute -top-20 right-10 h-56 w-56 rounded-full opacity-60 blur-3xl"
          style={{ background: '#3d6aa3' }}
        />

        {/* окно браузера */}
        <div
          data-win
          className="absolute left-7 top-8 h-[304px] w-[356px] overflow-hidden rounded-xl border border-white/10 bg-[#0b1320]/90 shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
        >
          <div className="flex h-7 items-center gap-1.5 border-b border-white/5 px-3">
            <i className="h-2 w-2 rounded-full bg-white/15" />
            <i className="h-2 w-2 rounded-full bg-white/15" />
            <i className="h-2 w-2 rounded-full bg-white/15" />
            <span className="ml-3 rounded-full bg-white/5 px-3 py-0.5 font-mono text-[9px] text-white/45">kurs-anny.ru</span>
          </div>
          <div className="px-6 pt-6">
            <p data-kicker className="m-0 font-mono text-[9px] uppercase tracking-[0.18em] text-[#8fb3dc]">
              Онлайн-курс · 6 недель
            </p>
            <h4 className="m-0 mt-3 text-[31px] font-semibold leading-[1.02] tracking-[-0.02em]">
              <span className="block overflow-hidden">
                <span data-hl className="block">
                  Рисуйте
                </span>
              </span>
              <span className="block overflow-hidden">
                <span data-hl className="block">
                  с первого дня
                </span>
              </span>
            </h4>
            <p data-sub className="m-0 mt-3 max-w-[260px] text-[11px] leading-[1.5] text-white/55">
              Живые разборы, домашние задания и чат с автором курса.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <span data-cta className="relative inline-flex h-9 items-center rounded-full bg-[#6e9bcc] px-5 text-[12px] font-semibold text-[#05080d]">
                Записаться
                <i data-ripple className="absolute left-1/2 top-1/2 -ml-4 -mt-4 h-8 w-8 rounded-full bg-white" />
              </span>
              <span className="text-[11px] text-white/50">от 4 900 ₽</span>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {['#c9d6e6', '#8fb3dc', '#55769a'].map((c) => (
                  <i key={c} data-ava className="h-5 w-5 rounded-full border border-[#0b1320]" style={{ background: c }} />
                ))}
              </div>
              <span className="text-[10px] text-white/45">412 учеников</span>
            </div>
          </div>
        </div>

        {/* карточка конверсии */}
        <div
          data-stats
          className="absolute left-[400px] top-[118px] w-[134px] rounded-xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm"
        >
          <p className="m-0 font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/45">Конверсия</p>
          <p data-conv className="m-0 mt-1 text-[26px] font-semibold tracking-[-0.02em]">
            6,4%
          </p>
          <div className="mt-2 flex h-[54px] items-end gap-[5px]">
            {[18, 26, 22, 30, 28, 34].map((h, i) => (
              <i
                key={i}
                data-bar
                className="block w-[12px] origin-bottom rounded-sm bg-white/20"
                style={{ height: h }}
              />
            ))}
            <i data-bar data-bar-last className="block h-[26px] w-[12px] origin-bottom rounded-sm bg-[#6e9bcc]" />
          </div>
          <span className="mt-2 inline-block rounded-full bg-[#6e9bcc]/15 px-2 py-0.5 font-mono text-[9px] text-[#a9c6e6]">
            +204%
          </span>
        </div>

        {/* заявка пришла */}
        <div
          data-toast
          className="absolute left-[322px] top-4 flex w-[212px] items-center gap-2.5 rounded-xl border border-white/10 bg-[#0f1a2b] px-3 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6e9bcc]/20 text-[#a9c6e6]">
            <Check className="h-3.5 w-3.5" />
          </span>
          <span className="leading-tight">
            <b className="block text-[11px] font-semibold">Новая заявка</b>
            <span className="text-[9.5px] text-white/50">Ответим за 15 минут</span>
          </span>
        </div>

        <Pointer />
      </div>
    </LiveScreen>
  );
}
