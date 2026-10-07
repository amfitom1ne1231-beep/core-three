'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MessengerMark from '@/components/MessengerMark';
import ThemeToggle from '@/components/ThemeToggle';
import Sheet from './Sheet';
import { navigate } from '@/lib/phone';
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
 * Сама карточка — общий `Sheet`.
 */
export default function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readTheme());
    return onThemeChange(setTheme);
  }, []);

  const go = (href: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onClose();
    navigate(() => router.push(href));
  };

  return (
    <Sheet open={open} onClose={onClose} label="Ещё">
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
    </Sheet>
  );
}
