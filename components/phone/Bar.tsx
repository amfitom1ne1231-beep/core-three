'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Mark from '@/components/Mark';
import { navigate } from '@/lib/phone';
import { SITE } from '@/content/site';

const SERVICE_PATHS: string[] = SITE.pages.map((p) => p.href);

/** Название экрана в верхней строке; у главной его нет — там стоит имя студии. */
const titleOf = (pathname: string) =>
  SERVICE_PATHS.includes(pathname)
    ? 'Услуги'
    : pathname.startsWith('/concepts')
      ? 'Демо'
      : pathname.startsWith('/about')
        ? 'О нас'
        : pathname.startsWith('/help')
          ? 'Помощь'
          : pathname.startsWith('/contact')
            ? 'Заявка'
            : pathname.startsWith('/privacy') || pathname.startsWith('/consent')
              ? 'Документы'
              : '';

/**
 * Верхняя строка телефона: знак слева, название экрана по центру, справа
 * «?» — помощь. Навигации здесь нет — она вся внизу, под большим пальцем.
 */
export default function Bar({ onHelp, helpOpen }: { onHelp: () => void; helpOpen: boolean }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const home = pathname === '/';
  const title = titleOf(pathname);

  return (
    <header
      className="phone-bar pointer-events-none fixed inset-x-0 top-0 z-[100] sm:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* завеса: строка читается над любым содержимым, кромки у неё нет */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[190%]"
        style={{ background: 'linear-gradient(180deg, rgb(var(--bg-rgb) / 0.94) 0%, rgb(var(--bg-rgb) / 0.78) 48%, rgb(var(--bg-rgb) / 0) 100%)' }}
      />
      <div className="relative flex h-[52px] items-center px-4">
        <Link
          href="/"
          aria-label={home ? undefined : 'На главную'}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            if (!home) navigate(() => router.push('/'));
          }}
          className="pointer-events-auto -my-2 flex items-center gap-2.5 py-2 text-fg"
        >
          <span data-header-mark className="block h-7 w-7">
            <Mark className="h-full w-full" />
          </span>
          {home && <span className="font-mono text-[11px] uppercase tracking-rail">{SITE.name}</span>}
        </Link>
        {title && <span className="absolute left-1/2 -translate-x-1/2 text-[15px] font-medium text-fg">{title}</span>}
        {/* помощь — в одно касание с любого экрана (HelpSheet) */}
        <button
          type="button"
          onClick={onHelp}
          aria-label="Помощь: что на этом экране"
          aria-expanded={helpOpen}
          className="pointer-events-auto ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-bg/40 text-[15px] font-medium text-fg backdrop-blur transition-transform duration-200 active:scale-95"
        >
          ?
        </button>
      </div>
    </header>
  );
}
