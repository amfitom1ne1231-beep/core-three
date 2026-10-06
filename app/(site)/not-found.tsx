import type { Metadata } from 'next';
import Link from 'next/link';
import Cta from '@/components/Cta';
import Footer from '@/components/Footer';
import Material from '@/components/Material';
import { SITE } from '@/content/site';

export const metadata: Metadata = {
  title: 'Страница не найдена'
};

/**
 * 404 внутри группы (site) — с шапкой, шрифтом и материалом сайта.
 * Сюда приводит `[...missing]`: корневая 404 предзагружала бы шрифт
 * сайта на всех страницах, включая демо, — у корневого сегмента он общий.
 *
 * Пока разделы волны 2 не собраны, сюда ведут ссылки из шапки
 * и футера, поэтому текст честный: страница может быть ещё в сборке.
 */
export default function NotFound() {
  return (
    <>
      <main id="content" className="relative z-10 w-full">
        <section className="relative flex min-h-[78svh] flex-col justify-center overflow-hidden bg-bg px-4 py-[14vh] sm:px-8 lg:px-[72px]">
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
              Этой страницы <span className="title-accent block">пока нет</span>
            </h1>
            <p className="m-0 mt-8 max-w-[44ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">
              Раздел может быть ещё в сборке — сайт растёт вместе со студией. Или ссылка устарела. Главная и заявка
              на месте, а что где лежит — в{' '}
              <Link href="/help#map" className="text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-accent">
                помощи
              </Link>
              .
            </p>
            <div className="mt-10 flex flex-wrap gap-3.5">
              <Cta href="/">
                На главную
              </Cta>
              <Cta href={SITE.hero.primary.href} tone="ghost">
                {SITE.hero.primary.label}
              </Cta>
            </div>
          </div>
        </section>

        {/* Страница ошибки, с которой некуда идти, — вторая ошибка подряд:
            разделы сайта стоят сразу под ней, в подвале. */}
      </main>
      <Footer cta={false} />
    </>
  );
}
