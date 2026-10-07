'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Mark from '@/components/Mark';
import { hasBack, navigate } from '@/lib/phone';
import { SITE } from '@/content/site';

/** Экраны направлений: в строке — короткое имя, полное стоит в заголовке экрана. */
const SERVICE: Record<string, string> = { '/sites': 'Сайты', '/ecommerce': 'Магазины', '/bots': 'Боты', '/monitoring': 'Мониторинг' };

/** Название экрана в верхней строке; у главной его нет — там стоит имя студии. */
const titleOf = (pathname: string) =>
  SERVICE[pathname] ??
  (pathname === '/services'
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
              : '');

/**
 * Верхняя строка телефона: знак слева, название экрана по центру, справа
 * «?» — помощь. Навигации здесь нет — она вся внизу, под большим пальцем.
 *
 * На внутренних экранах вместо знака стоит своя кнопка возврата: у экрана
 * направления — стрелка «назад», у заявки — крестик. Сайт, открытый
 * с домашнего экрана телефона, идёт без строки браузера, и вернуться
 * больше нечем (MOBILE.md).
 */
export default function Bar({ onHelp, helpOpen }: { onHelp: () => void; helpOpen: boolean }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const home = pathname === '/';
  const title = titleOf(pathname);
  const inner = pathname in SERVICE ? 'back' : pathname.startsWith('/contact') ? 'close' : null;

  // есть куда вернуться — возвращаемся; пришли по прямой ссылке — на экран выше
  const leave = () => navigate(() => (hasBack() ? router.back() : router.push(inner === 'back' ? '/services' : '/')));

  const round = 'pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-bg/40 text-fg backdrop-blur transition-transform duration-200 active:scale-95';

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
        {inner ? (
          <button type="button" onClick={leave} aria-label={inner === 'back' ? 'Назад' : 'Закрыть заявку'} className={round}>
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={inner === 'back' ? 'M10 3.5 5.5 8 10 12.5' : 'M4 4l8 8 M12 4l-8 8'} />
            </svg>
          </button>
        ) : (
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
        )}
        {title && <span className="absolute left-1/2 -translate-x-1/2 text-[15px] font-medium text-fg">{title}</span>}
        {/* помощь — в одно касание с любого экрана (HelpSheet) */}
        <button type="button" onClick={onHelp} aria-label="Помощь: что на этом экране" aria-expanded={helpOpen} className={`${round} ml-auto text-[15px] font-medium`}>
          ?
        </button>
      </div>
    </header>
  );
}
