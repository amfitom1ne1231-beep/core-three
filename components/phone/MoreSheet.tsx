'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MessengerMark from '@/components/MessengerMark';
import ThemeToggle from '@/components/ThemeToggle';
import { navigate } from '@/lib/phone';
import { lockScroll } from '@/lib/scroll';
import { onThemeChange, readTheme, type Theme } from '@/lib/theme';
import { OPERATOR } from '@/content/legal';
import { SITE } from '@/content/site';

const row = 'flex min-h-[52px] items-center justify-between gap-4 border-b border-line py-3 text-[16px] text-fg';
const chevron = (
  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 3.5 4.5 4.5L6 12.5" />
  </svg>
);

/**
 * «Ещё» — карточка снизу: всё, чему не нашлось вкладки. «О нас», «Помощь»,
 * свет, контакты, документы. Раньше это жило в меню-гамбургере, которого
 * на телефоне больше нет.
 *
 * Настоящий диалог: Escape и касание затемнения закрывают, страница под
 * карточкой заморожена. Карточку можно стянуть вниз за верхнюю кромку.
 */
export default function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [pull, setPull] = useState(0);
  const drag = useRef<{ y: number } | null>(null);

  useEffect(() => {
    setTheme(readTheme());
    return onThemeChange(setTheme);
  }, []);

  useEffect(() => {
    lockScroll(open);
    if (!open) return;
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

  const go = (href: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onClose();
    navigate(() => router.push(href));
  };

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
        aria-label="Ещё"
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

        <nav aria-label="Разделы">
          <Link href="/about" onClick={go('/about')} className={row}>
            О нас {chevron}
          </Link>
          <Link href="/help" onClick={go('/help')} className={row}>
            Помощь {chevron}
          </Link>
        </nav>

        <div className={row}>
          <span>
            Свет
            <span className="ml-2 text-[13px] text-faint">{theme === 'light' ? 'светлая тема' : theme === 'dark' ? 'тёмная тема' : ''}</span>
          </span>
          <ThemeToggle className="!static !translate-x-0" />
        </div>

        <span className="rail-label mt-6 block">Связь</span>
        <a href={`https://t.me/${SITE.telegram}`} target="_blank" rel="noreferrer noopener" className={row}>
          <span className="flex items-center gap-3">
            <MessengerMark kind="telegram" size={18} />
            Telegram <span className="text-dim">{SITE.telegramLabel}</span>
          </span>
          {chevron}
        </a>
        <a href={SITE.max} target="_blank" rel="noreferrer noopener" className={row}>
          <span className="flex items-center gap-3">
            <MessengerMark kind="max" size={18} />
            {SITE.maxLabel}
          </span>
          {chevron}
        </a>
        <a href={`mailto:${SITE.email}`} className={row}>
          {SITE.email} {chevron}
        </a>

        <span className="rail-label mt-6 block">Документы</span>
        <Link href="/privacy" onClick={go('/privacy')} className={row}>
          Политика обработки данных {chevron}
        </Link>
        <Link href="/consent" onClick={go('/consent')} className={row}>
          Согласие на обработку {chevron}
        </Link>

        <p className="mt-5 font-mono text-[9px] uppercase leading-relaxed tracking-rail text-faint">
          © 2026 {SITE.name} · Самозанятый {OPERATOR.name} · ИНН {OPERATOR.inn}
        </p>
      </div>
    </div>
  );
}
