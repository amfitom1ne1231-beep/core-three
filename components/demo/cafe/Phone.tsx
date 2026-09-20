'use client';

import { useEffect, useRef, useState } from 'react';
import BotChat, { type ChatHandle, type Receipt } from './BotChat';
import MiniApp, { type Line } from './MiniApp';
import { TG } from './shared';

/**
 * Телефон с Telegram внутри — главный экспонат демо.
 *
 * Он держит два режима и корзину между ними: из переписки открывается
 * мини-приложение, после оплаты чек возвращается в ту же переписку.
 * Именно этот стык и продаётся — разрозненные «бот» и «меню» показать
 * легко, связку между ними показать нечем, кроме работающей связки.
 *
 * Рамка устройства рисуется только с `lg`: на телефоне рамка телефона
 * внутри телефона — шутка, которая мешает пользоваться.
 */
export default function Phone({ className = '' }: { className?: string }) {
  const [app, setApp] = useState(false);
  const [cart, setCart] = useState<Line[]>([]);
  const [now, setNow] = useState('');
  const chat = useRef<ChatHandle>(null);

  // часы статус-бара идут настоящие, но только после монтирования:
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

  const closeApp = (receipt: Receipt | null) => {
    setApp(false);
    if (receipt) {
      setCart([]);
      chat.current?.resume('ordered', receipt);
    }
  };

  return (
    <div className={className}>
      <div
        className="relative mx-auto w-full max-w-[380px] overflow-hidden rounded-[20px] border lg:max-w-[352px] lg:rounded-[46px] lg:border-[10px] lg:p-0 lg:shadow-[0_40px_80px_-30px_rgba(28,25,23,0.45)]"
        style={{ borderColor: 'rgba(28,25,23,0.16)', background: '#101418' }}
      >
        <div className="relative overflow-hidden rounded-[10px] lg:rounded-[36px]">
          {/* статус-бар: без него экран читается как картинка, а не как телефон */}
          <div
            className="relative flex h-[30px] shrink-0 items-center justify-between px-5 text-[11px] font-medium"
            style={{ background: TG.head, color: TG.fg }}
          >
            <span className="tabular-nums">{now || ' '}</span>
            {/* «остров» перекрывает середину строки — как на настоящем аппарате */}
            <span
              aria-hidden
              className="absolute left-1/2 top-[5px] hidden h-[19px] w-[78px] -translate-x-1/2 rounded-full bg-black lg:block"
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

          {/* экран: высота фиксирована, иначе переход чат↔приложение прыгает */}
          <div className="relative h-[clamp(430px,62vh,560px)] lg:h-[600px]">
            {/* чат остаётся смонтированным под приложением: переписка не должна
                начинаться заново каждый раз, когда закрыли меню */}
            <div className="absolute inset-0" style={{ visibility: app ? 'hidden' : 'visible' }} aria-hidden={app}>
              <BotChat ref={chat} onOpenApp={() => setApp(true)} />
            </div>

            {app && (
              <div className="absolute inset-0 motion-safe:animate-[sheet_0.32s_cubic-bezier(0.22,1,0.36,1)]">
                <MiniApp cart={cart} setCart={setCart} onClose={closeApp} />
              </div>
            )}

            {/* полоса жеста «домой»: на аппарате она есть всегда, и без неё
                экран читается как картинка приложения, а не как телефон */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-[5px] left-1/2 hidden h-[4px] w-[108px] -translate-x-1/2 rounded-full bg-white/25 lg:block"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
