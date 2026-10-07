'use client';

import { useEffect, useRef, useState } from 'react';
import { lockScroll } from '@/lib/scroll';

/**
 * Карточка снизу — общая для «Ещё» и помощи.
 *
 * Настоящий диалог: Escape и касание затемнения закрывают, страница под
 * карточкой заморожена, пока она открыта. Карточку можно стянуть вниз
 * за верхнюю кромку.
 */
export default function Sheet({
  open,
  onClose,
  label,
  children
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const drag = useRef<{ y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    lockScroll(true);
    setPull(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    panel.current?.querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true });
    return () => {
      removeEventListener('keydown', onKey);
      lockScroll(false);
    };
  }, [open, onClose]);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag.current) setPull(Math.max(0, e.clientY - drag.current.y));
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (pull > 90) onClose();
    else setPull(0);
  };

  return (
    <div className="sm:hidden" aria-hidden={!open} inert={!open}>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[120] bg-black/55 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="phone-sheet fixed inset-x-0 bottom-0 z-[121] max-h-[86svh] overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-line-strong bg-elev px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          transform: open ? `translateY(${pull}px)` : 'translateY(104%)',
          transition: drag.current ? 'none' : 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      >
        {/* кромка: за неё карточку стягивают вниз */}
        <div
          className="sticky top-0 z-10 -mx-5 flex touch-none justify-center bg-elev px-5 pb-3 pt-3"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <span className="h-1 w-10 rounded-full bg-fg/25" />
        </div>
        {children}
      </div>
    </div>
  );
}
