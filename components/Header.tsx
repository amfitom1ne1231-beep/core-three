import Link from 'next/link';
import Mark from './Mark';
import { SITE } from '@/content/site';

export default function Header() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex items-center justify-between px-4 py-4 sm:px-8 lg:px-[72px]">
      <Link
        href="/"
        className="pointer-events-auto flex items-center gap-2.5 text-fg transition-colors duration-300 hover:text-accent"
      >
        <Mark className="h-7 w-7" />
        <span className="font-mono text-[11px] uppercase tracking-rail">{SITE.name}</span>
      </Link>

      <nav className="pointer-events-auto hidden items-center gap-7 md:flex">
        {SITE.nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="font-mono text-[10px] uppercase tracking-rail text-dim transition-colors duration-300 hover:text-fg"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <Link
        href={SITE.hero.primary.href}
        className="pointer-events-auto border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
      >
        {SITE.hero.primary.label}
      </Link>
    </header>
  );
}
