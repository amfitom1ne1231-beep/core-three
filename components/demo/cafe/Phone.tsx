'use client';

import { useRef, useState } from 'react';
import PhoneFrame from '../PhoneFrame';
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
 * Корпус — общий `PhoneFrame`, рамка устройства рисуется только с `lg`.
 */
export default function Phone({ className = '' }: { className?: string }) {
  const [app, setApp] = useState(false);
  const [cart, setCart] = useState<Line[]>([]);
  const chat = useRef<ChatHandle>(null);

  const closeApp = (receipt: Receipt | null) => {
    setApp(false);
    if (receipt) {
      setCart([]);
      chat.current?.resume('ordered', receipt);
    }
  };

  return (
    <PhoneFrame
      className={className}
      bar={{ bg: TG.head, fg: TG.fg }}
      edge="rgba(28,25,23,0.16)"
      frameClass="lg:shadow-[0_40px_80px_-30px_rgba(28,25,23,0.45)]"
      screenClass="h-[clamp(430px,62vh,560px)] lg:h-[600px]"
    >
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
    </PhoneFrame>
  );
}
