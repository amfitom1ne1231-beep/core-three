'use client';

import { useId, useRef } from 'react';
import { Check, LiveScreen, Pointer, countTo, useLoop, type LiveProps } from './kit';

/**
 * Акварель ученика — главный кадр лендинга курса рисования.
 *
 * Фотографий у нас нет, но курс учит рисовать, и его витрина — сами
 * работы. Акварель собрана из SVG-фильтров: турбулентность рвёт край
 * заливки так, как краска растекается по мокрой бумаге, второй шум даёт
 * зерно листа. Появляется она мазком — маска прорисовывается кистью.
 */
function Watercolor() {
  // свои идентификаторы: вставка бывает на странице не одна (карусель,
  // пульт), а одинаковые id фильтров в SVG забирают друг у друга
  const u = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (name: string) => `${name}-${u}`;
  return (
    <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden>
      <defs>
        <filter id={id('lw-bleed')} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="0.6" />
        </filter>
        <filter id={id('lw-edge')} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={id('lw-paper')}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" />
          <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.35  0 0 0 0.09 0" />
        </filter>
        <linearGradient id={id('lw-sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fb4d9" />
          <stop offset="0.55" stopColor="#e9c9a6" />
          <stop offset="1" stopColor="#f1d9bb" />
        </linearGradient>
        <mask id={id('lw-brush')}>
          {/* кисть: широкие горизонтальные проходы сверху вниз */}
          <path
            data-brush
            d="M-10 12 H210 M210 34 H-10 M-10 56 H210 M210 78 H-10 M-10 100 H210 M210 122 H-10 M-10 144 H210"
            fill="none"
            stroke="#fff"
            strokeWidth="26"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
          />
        </mask>
      </defs>
      <rect width="200" height="150" fill="#f6efe3" />
      <g mask={`url(#${id('lw-brush')})`}>
        <g filter={`url(#${id('lw-bleed')})`} opacity="0.92">
          <rect x="4" y="4" width="192" height="92" fill={`url(#${id('lw-sky')})`} />
          <circle cx="138" cy="58" r="15" fill="#f2a65a" opacity="0.85" />
          <path d="M-5 92 C30 70 52 64 80 78 C104 90 118 66 148 70 C170 73 186 84 205 80 V150 H-5Z" fill="#6b8f8a" opacity="0.8" />
          <path d="M-5 104 C26 92 60 96 92 104 C130 114 160 98 205 102 V150 H-5Z" fill="#3f6470" opacity="0.85" />
          <path d="M-5 120 C40 112 90 118 130 122 C160 125 182 118 205 120 V150 H-5Z" fill="#2c4a5a" opacity="0.8" />
          {/* отражение солнца в воде */}
          <ellipse cx="138" cy="128" rx="18" ry="2.2" fill="#f2c28c" opacity="0.7" />
          <ellipse cx="136" cy="134" rx="11" ry="1.6" fill="#f2c28c" opacity="0.55" />
        </g>
        {/* тонкие штрихи поверх заливки — рука ученика */}
        <g filter={`url(#${id('lw-edge')})`} fill="none" stroke="#243a46" strokeWidth="0.9" strokeLinecap="round" opacity="0.55">
          <path d="M60 86 l3 -10 l3 10 M66 84 l2.5 -8 l2.5 8" />
          <path d="M22 72 q8 -4 14 0 M28 66 q6 -3 11 0" />
        </g>
      </g>
      <rect width="200" height="150" filter={`url(#${id('lw-paper')})`} />
    </svg>
  );
}

/**
 * Лендинг курса: работа ученика проступает мазком, человек жмёт
 * «Записаться», заполняет два поля — и заявка приходит автору в Telegram.
 * Ночная сталь вокруг светлого листа: работа — главный свет кадра.
 */
export default function LiveLanding({ playing }: LiveProps) {
  const root = useRef<HTMLDivElement>(null);
  const fillId = `ll-fill-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useLoop(root, playing, (tl) => {
    const q = (s: string) => root.current?.querySelector(s) ?? null;
    const type = (sel: string, text: string, at: number, per = 0.055) => {
      const el = q(sel);
      if (!el) return;
      const box = { n: 0 };
      tl.fromTo(
        box,
        { n: 0 },
        {
          n: text.length,
          duration: text.length * per,
          ease: 'none',
          onUpdate: () => {
            el.textContent = text.slice(0, Math.round(box.n));
          }
        },
        at
      );
    };

    tl.from('[data-win]', { y: 22, opacity: 0, duration: 0.7, ease: 'power3.out' }, 0)
      .from('[data-kicker]', { opacity: 0, duration: 0.4 }, 0.25)
      .from('[data-hl]', { yPercent: 110, duration: 0.8, ease: 'expo.out', stagger: 0.1 }, 0.3)
      .from('[data-sub]', { opacity: 0, y: 8, duration: 0.5 }, 0.65)
      .from('[data-art]', { y: 14, rotate: 3, opacity: 0, duration: 0.8, ease: 'power3.out' }, 0.35)
      .fromTo('[data-brush]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power1.inOut' }, 0.5)
      .from('[data-cta]', { scale: 0.85, opacity: 0, duration: 0.5, ease: 'back.out(2)' }, 0.9)
      .from('[data-proof]', { opacity: 0, y: 6, duration: 0.4 }, 1.05)
      // курсор идёт к кнопке и нажимает
      .fromTo('[data-pointer]', { x: 470, y: 340, opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.4)
      .to('[data-pointer]', { x: 96, y: 222, duration: 1.0, ease: 'power2.inOut' }, 1.5)
      .to('[data-cta]', { scale: 0.93, duration: 0.12, yoyo: true, repeat: 1 }, 2.5)
      .fromTo('[data-ripple]', { scale: 0, opacity: 0.55 }, { scale: 3.2, opacity: 0, duration: 0.8, ease: 'power2.out' }, 2.52)
      // форма записи выезжает поверх страницы
      .from('[data-veil]', { opacity: 0, duration: 0.3 }, 2.65)
      .from('[data-form]', { y: 18, opacity: 0, duration: 0.5, ease: 'expo.out' }, 2.7)
      .to('[data-pointer]', { x: 186, y: 146, duration: 0.4, ease: 'power2.inOut' }, 2.9);
    type('[data-f-name]', 'Ольга', 3.15);
    type('[data-f-phone]', '+7 912 480-42-17', 3.55, 0.035);
    tl.to('[data-pointer]', { x: 214, y: 232, duration: 0.45, ease: 'power2.inOut' }, 4.05)
      .to('[data-send]', { scale: 0.95, duration: 0.1, yoyo: true, repeat: 1 }, 4.5)
      .to('[data-send-label]', { yPercent: -50, duration: 0.3, ease: 'power2.inOut' }, 4.58)
      .to('[data-pointer]', { opacity: 0, duration: 0.3 }, 4.8)
      // заявка у автора: уведомление и счётчик за день
      .from('[data-toast]', { x: 40, opacity: 0, duration: 0.6, ease: 'expo.out' }, 4.8)
      .from('[data-stats]', { x: 24, opacity: 0, duration: 0.6, ease: 'power3.out' }, 1.2)
      .fromTo('[data-spark]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.out' }, 1.4)
      .fromTo('[data-spark-fill]', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 1.9)
      .fromTo('[data-spark-dot]', { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, 4.95)
      // форма закрывается сама: законченный кадр — страница с работой,
      // а не модальное окно поверх неё
      .to('[data-form]', { opacity: 0, y: -10, duration: 0.4, ease: 'power2.in' }, 5.5)
      .to('[data-veil]', { opacity: 0, duration: 0.4 }, 5.55)
      .to('[data-win], [data-stats], [data-toast]', { opacity: 0, duration: 0.45 }, 6.9)
      .set({}, {}, 7.4);
    countTo(tl, q('[data-leads]'), 17, 18, 4.95, { duration: 0.4 });
    countTo(tl, q('[data-conv]'), 5.8, 6.4, 4.95, { decimals: 1, suffix: '%', duration: 0.8 });
  }, 0.84);

  // заявки за неделю: ровный рост и сегодняшний скачок
  const pts = [8, 9, 7, 11, 12, 14, 18].map((v, i) => [i * 17, 44 - v * 2] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

  return (
    <LiveScreen>
      <div
        ref={root}
        className="absolute inset-0 font-sans text-white"
        style={{ background: 'radial-gradient(120% 90% at 78% -10%, #24497a 0%, #0c1b31 46%, #05080d 100%)' }}
      >
        <div className="absolute -top-20 right-10 h-56 w-56 rounded-full opacity-50 blur-3xl" style={{ background: '#3d6aa3' }} />

        {/* окно браузера */}
        <div
          data-win
          className="absolute left-6 top-7 h-[322px] w-[372px] overflow-hidden rounded-xl border border-white/10 bg-[#0b1320] shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
        >
          <div className="flex h-7 items-center gap-1.5 border-b border-white/5 px-3">
            <i className="h-2 w-2 rounded-full bg-[#ff5f57]/80" />
            <i className="h-2 w-2 rounded-full bg-[#febc2e]/80" />
            <i className="h-2 w-2 rounded-full bg-[#28c840]/80" />
            <span className="ml-3 flex items-center gap-1 rounded-full bg-white/5 px-3 py-0.5 font-mono text-[9px] text-white/50">
              <svg viewBox="0 0 12 12" className="h-2 w-2" fill="currentColor">
                <path d="M3.5 5V4a2.5 2.5 0 0 1 5 0v1h.5v5h-6V5Zm1 0h3V4a1.5 1.5 0 0 0-3 0Z" />
              </svg>
              anna-tishina.ru
            </span>
          </div>
          <div className="flex items-center justify-between px-5 pt-3 text-[9px] text-white/45">
            <b className="text-[10.5px] font-semibold tracking-[0.02em] text-white/85">Анна Тишина</b>
            <span className="flex gap-3">
              <span>Программа</span>
              <span>Работы учеников</span>
              <span>Цены</span>
            </span>
          </div>

          <div className="relative px-5 pt-4">
            <p data-kicker className="m-0 w-[170px] font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#8fb3dc]">
              Поток 12.10 · 6 недель
            </p>
            <h4 className="m-0 mt-2 w-[176px] whitespace-nowrap text-[24px] font-semibold leading-[1.04] tracking-[-0.02em]">
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
            <p data-sub className="m-0 mt-2.5 w-[170px] text-[10.5px] leading-[1.5] text-white/55">
              Акварель с нуля: живые разборы, домашние работы и чат с автором.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span
                data-cta
                className="relative inline-flex h-8 items-center overflow-hidden rounded-full bg-[#f2a65a] px-4 text-[11px] font-semibold text-[#1a1208]"
              >
                Записаться
                <i data-ripple className="absolute left-1/2 top-1/2 -ml-4 -mt-4 h-8 w-8 rounded-full bg-white" />
              </span>
              <span className="text-[10.5px] text-white/60">
                4 900 ₽ <s className="text-white/35">6 500</s>
              </span>
            </div>
            <div data-proof className="mt-4 flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {[
                  ['ОК', '#c9d6e6'],
                  ['МС', '#e9c9a6'],
                  ['ДП', '#8fb3dc']
                ].map(([t, c]) => (
                  <i
                    key={t}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-[#0b1320] text-[6.5px] font-bold not-italic text-[#0b1320]"
                    style={{ background: c }}
                  >
                    {t}
                  </i>
                ))}
              </div>
              <span className="text-[9.5px] leading-tight text-white/50">
                <b className="font-semibold text-white/80">★ 4,9</b> · 412 учеников
              </span>
            </div>

            {/* работа ученика — на листе, чуть под углом, как на столе */}
            <figure
              data-art
              className="absolute right-4 top-3 m-0 w-[158px] rotate-[2deg] rounded-[4px] bg-[#f6efe3] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
            >
              <div className="h-[118px] overflow-hidden rounded-[2px]">
                <Watercolor />
              </div>
              <figcaption className="px-0.5 pb-0.5 pt-1.5 font-mono text-[7.5px] text-[#6d5f4d]">
                Работа Марины, 2-я неделя
              </figcaption>
            </figure>
          </div>

          {/* форма записи */}
          <div data-veil className="absolute inset-x-0 bottom-0 top-7 bg-[#05080d]/60 backdrop-blur-[2px]" />
          <div
            data-form
            className="absolute left-1/2 top-[70px] w-[236px] -translate-x-1/2 rounded-[14px] border border-white/10 bg-[#101b2c] p-4 shadow-[0_30px_60px_rgba(0,0,0,0.55)]"
          >
            <p className="m-0 text-[13px] font-semibold">Запись на поток</p>
            <p className="m-0 mt-0.5 text-[9.5px] text-white/45">Ответим в Telegram в течение часа</p>
            <label className="mt-3 block">
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/40">Имя</span>
              <span className="mt-1 flex h-7 items-center rounded-[8px] border border-[#8fb3dc]/60 bg-white/[0.03] px-2.5 text-[11px]">
                <span data-f-name>Ольга</span>
                <i className="ml-px inline-block h-3 w-px animate-pulse bg-white/70" />
              </span>
            </label>
            <label className="mt-2 block">
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/40">Телефон</span>
              <span className="mt-1 flex h-7 items-center rounded-[8px] border border-white/10 bg-white/[0.03] px-2.5 text-[11px]">
                <span data-f-phone>+7 912 480-42-17</span>
              </span>
            </label>
            <span
              data-send
              className="mt-3 flex h-8 items-start justify-center overflow-hidden rounded-[9px] bg-[#f2a65a] text-[11px] font-semibold text-[#1a1208]"
            >
              <span data-send-label className="flex flex-col items-center leading-8">
                <span>Записаться на поток</span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Готово, до встречи!
                </span>
              </span>
            </span>
          </div>
        </div>

        {/* заявки за день */}
        <div
          data-stats
          className="absolute left-[392px] top-[124px] w-[146px] rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm"
        >
          <p className="m-0 font-mono text-[8px] uppercase tracking-[0.16em] text-white/45">Заявки сегодня</p>
          <p className="m-0 mt-1 flex items-baseline gap-1.5">
            <b data-leads className="text-[24px] font-semibold tracking-[-0.02em]">
              18
            </b>
            <span className="rounded-full bg-[#28c840]/15 px-1.5 py-0.5 font-mono text-[8.5px] text-[#7ee29a]">+38%</span>
          </p>
          <svg viewBox="-2 0 108 48" className="mt-1 block h-[46px] w-full overflow-visible">
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f2a65a" stopOpacity="0.35" />
                <stop offset="1" stopColor="#f2a65a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path data-spark-fill d={`${line} L102 48 L0 48 Z`} fill={`url(#${fillId})`} />
            <path data-spark d={line} pathLength={1} strokeDasharray="1" fill="none" stroke="#f2a65a" strokeWidth="1.6" strokeLinejoin="round" />
            <circle data-spark-dot cx="102" cy="8" r="3" fill="#f2a65a" stroke="#0c1b31" strokeWidth="1.5" />
          </svg>
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-[9px] text-white/50">
            <span>Конверсия</span>
            <b data-conv className="font-semibold text-white/85">
              6,4%
            </b>
          </div>
        </div>

        {/* заявка пришла автору */}
        <div
          data-toast
          className="absolute left-[330px] top-3 flex w-[212px] items-center gap-2.5 rounded-xl border border-white/10 bg-[#0f1a2b]/95 px-3 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2aabee] text-[10px] font-bold">
            АТ
          </span>
          <span className="min-w-0 leading-tight">
            <b className="block text-[10.5px] font-semibold">Новая заявка на поток</b>
            <span className="block truncate text-[9.5px] text-white/55">Ольга, +7 912 480-42-17</span>
          </span>
          <span className="ml-auto self-start font-mono text-[8px] text-white/35">сейчас</span>
        </div>

        <Pointer />
      </div>
    </LiveScreen>
  );
}
