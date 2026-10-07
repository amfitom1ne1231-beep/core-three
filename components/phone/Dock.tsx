'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Mark from '@/components/Mark';
import { navigate } from '@/lib/phone';
import { contactHref } from '@/lib/lead';
import { SITE } from '@/content/site';

type Tab = 'home' | 'services' | 'demo' | 'more';

const ICONS: Record<Exclude<Tab, 'home'>, React.ReactNode> = {
  services: <path d="M12 3.5 19.4 7.75v8.5L12 20.5l-7.4-4.25v-8.5Z M12 12v8.5 M12 12 4.6 7.75 M12 12l7.4-4.25" />,
  demo: <path d="M8 3.5h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z M10.5 17.5h3" />,
  more: <path d="M5.5 12h.01 M12 12h.01 M18.5 12h.01" strokeWidth="2.4" />
};

const SERVICE_PATHS: string[] = SITE.pages.map((p) => p.href);
const MORE_PATHS = ['/about', '/help', '/privacy', '/consent'];

const tabOf = (pathname: string): Tab | null =>
  pathname === '/'
    ? 'home'
    : SERVICE_PATHS.includes(pathname)
      ? 'services'
      : pathname.startsWith('/concepts')
        ? 'demo'
        : MORE_PATHS.some((p) => pathname.startsWith(p))
          ? 'more'
          : null;

/**
 * Нижняя панель телефона — остров.
 *
 * Заказчик: «чтобы низ не сливался — надо, чтобы всплывал низ, но чтобы
 * не выглядело как колхоз». В Safari внизу стоит панель самого браузера,
 * и вторая полоса вплотную к ней читается заплаткой. Поэтому панель стоит
 * с зазором от краёв, а при прокрутке вниз, когда Safari сворачивает свою,
 * сжимается до одной кнопки заявки; движение вверх или конец страницы —
 * всплывает обратно. Сжатие — обрезкой и прозрачностью, без пересчёта
 * раскладки. На главной страница не прокручивается (сцены листаются
 * внутри), и остров стоит развёрнутым.
 *
 * Заявка — круглая кнопка в центре: главное действие всегда под большим
 * пальцем. Знак на ней — тонкий плюс: стрелку заказчик попросил заменить
 * на «что-то менее выраженное».
 */
export default function Dock({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [small, setSmall] = useState(false);
  const active = moreOpen ? 'more' : tabOf(pathname);

  useEffect(() => {
    let last = scrollY;
    const onScroll = () => {
      const y = scrollY;
      const delta = y - last;
      if (Math.abs(delta) < 6) return;
      last = y;
      const atEnd = y + innerHeight >= document.documentElement.scrollHeight - 24;
      setSmall(delta > 0 && y > 80 && !atEnd);
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  // новый экран — остров развёрнут
  useEffect(() => setSmall(false), [pathname]);

  const go = (href: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (href !== pathname) navigate(() => router.push(href));
  };

  const cell = 'flex h-full flex-1 flex-col items-center justify-center gap-1 transition-[color,transform] duration-200 active:scale-95';
  const tone = (id: Tab) => (active === id ? 'text-fg' : 'text-faint');
  const icon = (id: Exclude<Tab, 'home'>) => (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[id]}
    </svg>
  );
  const label = (text: string) => <span className="text-[10px] font-medium leading-none">{text}</span>;
  const tab = (id: 'home' | 'services' | 'demo', href: string, text: string) => (
    <Link href={href} onClick={go(href)} aria-current={active === id ? 'page' : undefined} tabIndex={small ? -1 : 0} className={`${cell} ${tone(id)}`}>
      {id === 'home' ? <Mark className="h-[22px] w-[22px]" /> : icon(id)}
      {label(text)}
    </Link>
  );
  const brief = contactHref(pathname);

  return (
    <nav
      aria-label="Разделы"
      className="phone-dock pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex justify-center px-3 sm:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      {/* страница под островом уходит в темноту: текст не читается сквозь стекло */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[150px] transition-opacity duration-300"
        style={{
          background: 'linear-gradient(to top, rgb(var(--bg-rgb)) 0%, rgb(var(--bg-rgb) / 0.86) 38%, rgb(var(--bg-rgb) / 0) 100%)',
          opacity: small ? 0 : 1
        }}
      />
      <div className="pointer-events-auto relative h-[64px] w-full max-w-[420px]">
        {/* остров: стекло с волосяной кромкой; сжимается обрезкой к середине */}
        <div
          className="absolute inset-0 flex items-stretch rounded-[24px] border border-line-strong bg-elev/85 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-[clip-path,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ clipPath: small ? 'inset(0 calc(50% - 32px) round 32px)' : 'inset(0 0 round 24px)', opacity: small ? 0 : 1 }}
        >
          <div className="flex flex-1">
            {tab('home', '/', 'Главная')}
            {/* у «Услуг» появится свой экран-обзор; пока вкладка ведёт на первое направление */}
            {tab('services', '/sites', 'Услуги')}
          </div>
          <span className="flex w-[84px] shrink-0 items-end justify-center pb-[13px] text-[10px] font-medium leading-none text-faint">Заявка</span>
          <div className="flex flex-1">
            {tab('demo', '/concepts', 'Демо')}
            <button
              type="button"
              onClick={onMore}
              aria-expanded={moreOpen}
              // «О нас», «Помощь» и документы открываются отсюда — на них вкладка и горит
              aria-current={!moreOpen && active === 'more' ? 'page' : undefined}
              tabIndex={small ? -1 : 0}
              className={`${cell} ${tone('more')}`}
            >
              {icon('more')}
              {label('Ещё')}
            </button>
          </div>
        </div>

        {/* главное действие: приподнято над островом и остаётся при сжатии */}
        <Link
          href={brief}
          onClick={go(brief)}
          aria-label="Обсудить проект"
          className="absolute left-1/2 top-[-20px] flex h-[54px] w-[54px] items-center justify-center rounded-full bg-fg text-bg shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-[5px] ring-bg/80 transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:opacity-80"
          style={{ transform: `translate(-50%, ${small ? 22 : 0}px) scale(${small ? 0.96 : 1})` }}
        >
          <svg viewBox="0 0 24 24" className="h-[20px] w-[20px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <path d="M12 5.5v13 M5.5 12h13" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
