'use client';

import { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import Mark from './Mark';
import MobileMenu from './MobileMenu';
import ThemeToggle from './ThemeToggle';
import { setHeaderHidden } from '@/lib/chrome';
import { contactHref } from '@/lib/lead';
import { SITE } from '@/content/site';
import Cta from './Cta';

/** Страницы направлений: пункт «Услуги» горит на любой из них. */
const SERVICE_PATHS: string[] = SITE.pages.map((p) => p.href);

/**
 * Шапка прячется при движении вниз и возвращается при движении вверх:
 * иначе она перекрывает подписи у нижней кромки первого экрана.
 */
export default function Header() {
  const ref = useRef<HTMLElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
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
    setHeaderHidden(false);
    gsap.to(ref.current, { yPercent: 0, duration: 0.25, ease: 'power2.out' });
  }, []);

  useEffect(() => {
    const el = ref.current;
    const veil = scrim.current;
    if (!el) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = scrollY;
    let veiled = false;

    const onScroll = () => {
      const y = scrollY;

      /**
       * Подложка. Шапка плавающая и прозрачная: стоит ей вернуться при
       * движении вверх, она ложится прямо на содержимое — над сценой
       * атласа знак и «Обсудить проект» попадали на гигантский номер и
       * верхнюю кромку живой вставки. Ниже первого экрана под шапку
       * подводится мягкая завеса — читаются и она, и то, что под ней.
       *
       * Это не анимация, а разборчивость, поэтому работает и при
       * prefers-reduced-motion — там завеса просто появляется сразу.
       */
      const needVeil = y > innerHeight * 0.6;
      if (veil && needVeil !== veiled) {
        veiled = needVeil;
        gsap.to(veil, { opacity: needVeil ? 1 : 0, duration: reduced ? 0 : 0.35, ease: 'none' });
      }

      if (reduced || pinned.current) return;

      const delta = y - last;
      // мелкие подёргивания игнорируем, иначе шапка дрожит
      if (Math.abs(delta) < 6) return;
      last = y;

      const shouldHide = delta > 0 && y > 120;
      if (shouldHide === hidden.current) return;
      hidden.current = shouldHide;
      // пульт навигации берёт знак на себя ровно тогда, когда шапка ушла
      setHeaderHidden(shouldHide);

      gsap.to(el, {
        yPercent: shouldHide ? -130 : 0,
        duration: 0.45,
        ease: 'power3.out'
      });
    };

    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      ref={ref}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex items-center justify-between px-4 py-4 sm:px-8 lg:px-[72px]"
    >
      {/* завеса: растворяется книзу, поэтому кромки у неё не видно */}
      <div
        ref={scrim}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[180%] opacity-0"
        style={{
          background:
            'linear-gradient(180deg, rgb(var(--bg-rgb) / 0.92) 0%, rgb(var(--bg-rgb) / 0.72) 45%, rgb(var(--bg-rgb) / 0) 100%)'
        }}
      />

      <Link
        href="/"
        /* -my-2 py-2: знак в шапке был 28px по высоте — область нажатия
           доводится до 44, при этом сам знак и строка не сдвигаются */
        className="pointer-events-auto -my-2 flex items-center gap-2.5 py-2 text-fg transition-colors duration-300 hover:text-accent"
      >
        {/* сюда садится знак прелоадера на всех страницах, кроме главной */}
        {/* с планшета знак и имя крупнее: в шапке они терялись, особенно
            на светлом материале; на телефоне место занято переключателем темы */}
        <span data-header-mark className="block h-7 w-7 md:h-9 md:w-9">
          <Mark className="h-full w-full" />
        </span>
        <span data-header-word className="font-mono text-[11px] uppercase tracking-rail md:text-[13px]">
          {SITE.name}
        </span>
      </Link>

      {/* Где ты — видно и в шапке: текущий раздел светлее и с тем же
          штрихом, что у выбранной темы. «Услуги» горят на всех четырёх
          страницах направлений — ссылка ведёт на первую из них. */}
      <nav aria-label="Разделы" className="pointer-events-auto hidden items-center gap-7 md:flex">
        {SITE.nav.map((item) => {
          const here = item.href === '/sites' ? SERVICE_PATHS.includes(pathname) : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={here ? 'page' : undefined}
              // 10px и приглушённый цвет на подвижном материале сливались с фоном
              className={`relative -my-2 py-2 font-mono text-[12px] uppercase tracking-rail transition-colors duration-300 hover:text-fg ${
                here ? 'text-fg' : 'text-fg/80'
              }`}
            >
              {item.label}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1 block h-px origin-left bg-accent transition-transform duration-300"
                style={{ transform: `scaleX(${here ? 1 : 0})` }}
              />
            </Link>
          );
        })}
      </nav>

      {/* Свет: одна круглая кнопка рядом с навигацией. На телефоне она
          тоже в шапке — внизу раскрытого меню переключатель не находили. */}
      <ThemeToggle />

      {/* Главное действие — сплошной кнопкой: контурная в углу терялась.
          На узких экранах вместо кнопки — меню: CTA лежит внутри него */}
      <Cta href={contactHref(pathname)} size="sm" className="pointer-events-auto !hidden md:!inline-flex">
        {SITE.hero.primary.label}
      </Cta>

      <MobileMenu onOpenChange={onMenu} />
    </header>
  );
}
