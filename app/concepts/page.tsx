import type { Metadata } from 'next';
import Link from 'next/link';
import ConceptCards from '@/components/ConceptCards';
import Footer from '@/components/Footer';
import HeroSilk from '@/components/HeroSilk';
import RevealText from '@/components/RevealText';
import { contactHref } from '@/lib/lead';
import { SITE } from '@/content/site';

const PAGE = SITE.concepts.page;

export const metadata: Metadata = {
  title: PAGE.meta.title,
  description: PAGE.meta.description,
  alternates: { canonical: '/concepts' },
  openGraph: {
    title: `${PAGE.meta.title} — CoreThree`,
    description: PAGE.meta.description,
    url: '/concepts'
  }
};

/**
 * Витрина концептов целиком.
 *
 * На неё ведут четыре ссылки — шапка, футер, пульт и вторая кнопка
 * первого экрана, — и до сих пор все четыре упирались в 404. Страница
 * собрана на тех же данных, что глава на главной: витрина одна, просто
 * здесь к ней добавлено объяснение, зачем она нужна.
 */
export default function ConceptsPage() {
  return (
    <>
      <HeroSilk />
      <main id="content" className="relative z-10 w-full">
        {/* ---------- первый экран ---------- */}
        <section data-chapter="hero" className="relative overflow-hidden">
          <div className="grid items-end gap-[clamp(32px,6vh,64px)] px-4 pb-[10vh] pt-[clamp(120px,19vh,200px)] sm:px-8 lg:grid-cols-[1.25fr_1fr] lg:px-[72px]">
            <div>
              <span className="rail-label">{PAGE.label}</span>
              <h1
                className="display m-0 mt-6 text-[clamp(36px,6vw,104px)]"
                aria-label={`${PAGE.title} ${PAGE.titleAccent}`}
              >
                <RevealText text={PAGE.title} as="span" className="block" decorative />
                <RevealText
                  text={PAGE.titleAccent}
                  as="span"
                  className="title-accent block"
                  delay={0.12}
                  decorative
                />
              </h1>
            </div>
            <p className="m-0 max-w-[44ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">
              {PAGE.lead}
            </p>
          </div>
        </section>

        {/* ---------- сама витрина ---------- */}
        <section data-chapter="concepts" className="relative border-t border-line" aria-label="Концепты">
          <div className="px-4 py-[12vh] sm:px-8 lg:px-[72px]">
            <ConceptCards />
          </div>
        </section>

        {/* ---------- как этим пользоваться ---------- */}
        <section data-chapter="atlas" className="relative border-t border-line">
          <div className="px-4 py-[12vh] sm:px-8 lg:px-[72px]">
            <span className="rail-label">{PAGE.how.label}</span>
            <ol className="m-0 mt-[clamp(28px,5vh,56px)] grid list-none gap-px border border-line bg-line p-0 sm:grid-cols-3">
              {PAGE.how.items.map((it) => (
                <li key={it.n} className="bg-bg p-[clamp(18px,2vw,30px)]">
                  <span className="font-mono text-[10px] tracking-rail text-accent">{it.n}</span>
                  <h2 className="m-0 mt-3 text-[clamp(16px,1.3vw,19px)] font-medium leading-snug">
                    {it.title}
                  </h2>
                  <p className="m-0 mt-2.5 text-[13.5px] leading-relaxed text-dim">{it.text}</p>
                </li>
              ))}
            </ol>

            <div className="mt-[clamp(40px,7vh,80px)] border-t border-line pt-[clamp(28px,5vh,52px)]">
              <h2 className="display m-0 text-[clamp(24px,3.4vw,48px)]">
                {PAGE.cta.title}
              </h2>
              <p className="m-0 mt-4 max-w-[46ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
                {PAGE.cta.text}
              </p>
              <Link
                data-magnetic
                href={contactHref('/concepts')}
                className="mt-8 inline-block border border-fg bg-fg px-[22px] py-[15px] font-mono text-[11px] uppercase tracking-label text-bg transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-white"
              >
                {SITE.hero.primary.label}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
