import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Material from '@/components/Material';
import { SITE } from '@/content/site';

export const metadata: Metadata = {
  title: 'Страница не найдена'
};

/**
 * 404. Пока разделы волны 2 не собраны, сюда ведут ссылки из шапки
 * и футера, поэтому текст честный: страница может быть ещё в сборке.
 */
export default function NotFound() {
  return (
    <>
      <main id="content" className="relative z-10 w-full">
        <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden bg-bg px-4 py-[16vh] sm:px-8 lg:px-[72px]">
          <Material preset="deep" opacity={0.55} />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgb(var(--bg-rgb) / 0.92) 0%, rgb(var(--bg-rgb) / 0.7) 45%, rgb(var(--bg-rgb) / 0.25) 100%)'
            }}
            aria-hidden
          />

          <span
            className="pointer-events-none absolute bottom-[6vh] right-4 font-mono text-[clamp(96px,22vw,340px)] leading-none tracking-[-0.04em] text-fg/[0.07] sm:right-8 lg:right-[72px]"
            aria-hidden
          >
            404
          </span>

          <div className="relative">
            <span className="rail-label">404 / Не найдено</span>
            <h1 className="display m-0 mt-6 text-[clamp(38px,7vw,112px)]">
              Этой страницы <span className="accent-serif block">пока нет.</span>
            </h1>
            <p className="m-0 mt-8 max-w-[44ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">
              Раздел может быть ещё в сборке — сайт растёт вместе со студией. Или ссылка устарела. Главная и заявка
              на месте.
            </p>
            <div className="mt-10 flex flex-wrap gap-3.5">
              <Link
                data-magnetic
                href="/"
                className="border border-fg bg-fg px-[22px] py-[13px] font-mono text-[11px] uppercase tracking-label text-bg transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-white"
              >
                На главную
              </Link>
              <Link
                data-magnetic
                href={SITE.hero.primary.href}
                className="border border-line px-[22px] py-[13px] font-mono text-[11px] uppercase tracking-label text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
              >
                {SITE.hero.primary.label}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer cta={false} />
    </>
  );
}
