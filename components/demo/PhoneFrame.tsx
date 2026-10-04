'use client';

import { useEffect, useState } from 'react';

/**
 * Корпус телефона для демо, где продукт живёт в Telegram.
 *
 * Статус-бар с настоящими часами, «остров» и полоса жеста «домой» —
 * без них экран читается как картинка приложения, а не как телефон.
 * Рамка устройства рисуется только начиная с `from`: на телефоне рамка
 * телефона внутри телефона — шутка, которая мешает пользоваться.
 *
 * Классы рамки — два готовых набора, а не склейка из `from`: Tailwind
 * собирает утилиты статически и склеенное имя не увидит.
 */
const FRAME = {
  lg: {
    outer: 'max-w-[380px] rounded-[20px] border lg:max-w-[352px] lg:rounded-[46px] lg:border-[10px]',
    inner: 'rounded-[10px] lg:rounded-[36px]',
    deco: 'hidden lg:block'
  },
  md: {
    outer: 'max-w-[440px] rounded-[20px] border md:max-w-[352px] md:rounded-[46px] md:border-[10px]',
    inner: 'rounded-[10px] md:rounded-[36px]',
    deco: 'hidden md:block'
  }
} as const;

export default function PhoneFrame({
  bar,
  edge,
  from = 'lg',
  frameClass = '',
  screenClass,
  className = '',
  style,
  children
}: {
  /** Цвета статус-бара: он продолжает шапку того, что открыто на экране. */
  bar: { bg: string; fg: string };
  /** Цвет кромки корпуса — под фон страницы вокруг. */
  edge: string;
  from?: keyof typeof FRAME;
  /** Тень и прочее для корпуса — под фон страницы. */
  frameClass?: string;
  /** Высота экрана: фиксирована, иначе переходы внутри прыгают. */
  screenClass: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const f = FRAME[from];
  const [now, setNow] = useState('');

  // часы идут настоящие, но только после монтирования:
  // на сервере времени браузера нет, и разметка разошлась бы
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
    };
    tick();
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={className} style={style}>
      <div
        className={`relative mx-auto w-full overflow-hidden ${f.outer} ${frameClass}`}
        style={{ borderColor: edge, background: '#101418' }}
      >
        <div className={`relative overflow-hidden ${f.inner}`}>
          <div
            className="relative flex h-[30px] shrink-0 items-center justify-between px-5 text-[11px] font-medium"
            style={{ background: bar.bg, color: bar.fg }}
          >
            <span className="tabular-nums">{now || ' '}</span>
            {/* «остров» перекрывает середину строки — как на настоящем аппарате */}
            <span
              aria-hidden
              className={`absolute left-1/2 top-[5px] h-[19px] w-[78px] -translate-x-1/2 rounded-full bg-black ${f.deco}`}
            />
            <span aria-hidden className="flex items-center gap-1.5 opacity-80">
              <svg viewBox="0 0 16 10" className="h-[9px] w-[14px]" fill="currentColor">
                <rect x="0" y="6.5" width="2.4" height="3.5" rx="0.6" />
                <rect x="4" y="4.5" width="2.4" height="5.5" rx="0.6" />
                <rect x="8" y="2.3" width="2.4" height="7.7" rx="0.6" />
                <rect x="12" y="0" width="2.4" height="10" rx="0.6" />
              </svg>
              <svg viewBox="0 0 24 12" className="h-[9px] w-[18px]" fill="none">
                <rect x="0.6" y="0.6" width="19" height="10.8" rx="2.6" stroke="currentColor" strokeWidth="1.1" />
                <rect x="2.3" y="2.3" width="13" height="7.4" rx="1.4" fill="currentColor" />
                <path d="M21.4 4.2v3.6a2 2 0 0 0 0-3.6Z" fill="currentColor" />
              </svg>
            </span>
          </div>

          <div className={`relative ${screenClass}`}>
            {children}
            <span
              aria-hidden
              className={`pointer-events-none absolute bottom-[5px] left-1/2 z-[60] h-[4px] w-[108px] -translate-x-1/2 rounded-full bg-current opacity-25 ${f.deco}`}
              style={{ color: bar.fg }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
