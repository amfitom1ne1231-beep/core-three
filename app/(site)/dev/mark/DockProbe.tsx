'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Mark from '@/components/Mark';

type Tab = 'home' | 'services' | 'demo' | 'more';

const ICONS: Record<Exclude<Tab, 'home'>, React.ReactNode> = {
  services: <path d="M12 3.5 19.4 7.75v8.5L12 20.5l-7.4-4.25v-8.5Z M12 12v8.5 M12 12 4.6 7.75 M12 12l7.4-4.25" />,
  demo: <path d="M8 3.5h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z M10.5 17.5h3" />,
  more: <path d="M5.5 12h.01 M12 12h.01 M18.5 12h.01" strokeWidth="2.4" />
};

const TABS: [Tab, string][] = [
  ['home', 'Главная'],
  ['services', 'Услуги'],
  ['demo', 'Демо'],
  ['more', 'Ещё']
];

/**
 * Проба нижней панели (MOBILE.md). Заказчик: «чтобы низ не сливался —
 * надо, чтобы всплывал низ или ещё что-то, но чтобы не выглядело как
 * колхоз». В Safari внизу стоит панель самого браузера, и вторая полоса
 * вплотную к ней читается заплаткой.
 *
 * Поэтому панель — отдельный остров: стоит с зазором от краёв, а при
 * прокрутке вниз, когда Safari сворачивает свою панель, сжимается до одной
 * круглой кнопки заявки. Движение вверх или конец страницы — всплывает
 * обратно. Сжатие — обрезкой и прозрачностью, без пересчёта раскладки.
 */
export default function DockProbe() {
  const [tab, setTab] = useState<Tab>('home');
  const [small, setSmall] = useState(false);

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

  const item = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      aria-current={tab === id ? 'page' : undefined}
      tabIndex={small ? -1 : 0}
      onClick={() => setTab(id)}
      className={`flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors duration-200 ${tab === id ? 'text-fg' : 'text-faint'}`}
    >
      {id === 'home' ? (
        <Mark className="h-[22px] w-[22px]" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {ICONS[id]}
        </svg>
      )}
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );

  return (
    <nav
      aria-label="Разделы"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex justify-center px-3"
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
          style={{
            clipPath: small ? 'inset(0 calc(50% - 32px) round 32px)' : 'inset(0 0 round 24px)',
            opacity: small ? 0 : 1
          }}
        >
          <div className={`flex flex-1 transition-opacity duration-200 ${small ? 'opacity-0' : 'opacity-100'}`}>
            {item(...TABS[0])}
            {item(...TABS[1])}
          </div>
          <div className="w-[84px] shrink-0" />
          <div className={`flex flex-1 transition-opacity duration-200 ${small ? 'opacity-0' : 'opacity-100'}`}>
            {item(...TABS[2])}
            {item(...TABS[3])}
          </div>
        </div>

        {/* главное действие: круглая кнопка, приподнята над островом и остаётся при сжатии */}
        <Link
          href="/contact"
          aria-label="Обсудить проект"
          className="absolute left-1/2 top-[-16px] flex h-[64px] w-[64px] -translate-x-1/2 items-center justify-center rounded-full bg-fg text-bg shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-[5px] ring-bg/80 transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95"
          style={{ transform: `translate(-50%, ${small ? 16 : 0}px) scale(${small ? 0.86 : 1})` }}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 17 17 7 M9 7h8v8" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
