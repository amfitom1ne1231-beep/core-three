'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * «Дальше» — страница не обрывается на подвале, а предлагает следующую.
 * Порядок — тот, в котором сайт и стоит читать: от главной через
 * направления к демо, к нам и к заявке. С заявки — снова на главную.
 */
const ORDER = [
  { href: '/', label: 'Главная' },
  { href: '/sites', label: 'Сайты и лендинги' },
  { href: '/ecommerce', label: 'Интернет-магазины' },
  { href: '/bots', label: 'Боты и Telegram Web App' },
  { href: '/monitoring', label: 'Мониторинг и поддержка' },
  { href: '/concepts', label: 'Концепты' },
  { href: '/about', label: 'О нас' },
  { href: '/contact', label: 'Обсудить проект' }
];

export default function NextPage() {
  const pathname = usePathname() ?? '/';
  const at = ORDER.findIndex((p) => p.href === pathname);
  const next = ORDER[(at + 1) % ORDER.length] ?? ORDER[1];
  return (
    <Link href={next.href} className="next-page group flex items-end justify-between gap-6 py-[clamp(28px,5vh,56px)]">
      <span>
        <span className="rail-label block">Дальше</span>
        <span className="next-page-label mt-3 block text-[clamp(28px,4.6vw,76px)] font-medium leading-none tracking-[-0.02em]">
          {next.label}
        </span>
      </span>
      <span className="next-page-arrow mb-1 grid h-[clamp(48px,5vw,76px)] w-[clamp(48px,5vw,76px)] shrink-0 place-items-center rounded-full border border-line-strong">
        <svg viewBox="0 0 24 24" className="h-1/3 w-1/3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}
