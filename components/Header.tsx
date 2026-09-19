'use client';

import { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import Mark from './Mark';
import MobileMenu from './MobileMenu';
import { contactHref } from '@/lib/lead';
import { SITE } from '@/content/site';

/**
 * Шапка прячется при движении вниз и возвращается при движении вверх:
 * иначе она перекрывает подписи у нижней кромки первого экрана.
 */
export default function Header() {
  const ref = useRef<HTMLElement>(null);
  const pinned = useRef(false);
  const hidden = useRef(false);
  const pathname = usePathname();

  /** Пока открыто меню, шапка держится на месте: в ней кнопка закрытия. */
  const onMenu = useCallback((open: boolean) => {
    pinned.current = open;
    if (!open || !ref.current) return;
    // состояние сбрасываем вместе с положением, иначе после закрытия меню
    // шапка считает себя спрятанной и не уезжает на следующем скролле
    hidden.current = false;
    gsap.to(ref.current, { yPercent: 0, duration: 0.25, ease: 'power2.out' });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let last = scrollY;

    const onScroll = () => {
      if (pinned.current) return;
      const y = scrollY;
      const delta = y - last;
      // мелкие подёргивания игнорируем, иначе шапка дрожит
      if (Math.abs(delta) < 6) return;
      last = y;

      const shouldHide = delta > 0 && y > 120;
      if (shouldHide === hidden.current) return;
      hidden.current = shouldHide;

      gsap.to(el, {
        yPercent: shouldHide ? -130 : 0,
        duration: 0.45,
        ease: 'power3.out'
      });
    };

    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      ref={ref}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex items-center justify-between px-4 py-4 sm:px-8 lg:px-[72px]"
    >
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

      {/* на узких экранах вместо кнопки — меню: CTA лежит внутри него */}
      <Link
        data-magnetic
        href={contactHref(pathname)}
        className="pointer-events-auto hidden border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:border-accent hover:text-accent md:block"
      >
        {SITE.hero.primary.label}
      </Link>

      <MobileMenu onOpenChange={onMenu} />
    </header>
  );
}
