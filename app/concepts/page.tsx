import type { Metadata } from 'next';
import ConceptCards from '@/components/ConceptCards';
import DemoBand from '@/components/concepts/DemoBand';
import Cta from '@/components/Cta';
import Footer from '@/components/Footer';
import HeroSilk from '@/components/HeroSilk';
import RevealText from '@/components/RevealText';
import ScrollScenes from '@/components/ScrollScenes';
import Process from '@/components/service/Process';
import { demoBySlug } from '@/content/concepts';
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
 * Витрина концептов.
 *
 * Страница обещает демо, которое проходится насквозь, а показывала
 * четыре одинаковые карточки со схемами — и собранное демо выглядело
 * ровно так же, как несобранное. Теперь у собранного своя полоса
 * во всю ширину с живым кадром самой страницы демо, а ниши, до которых
 * ещё не дошли, стоят тихой сеткой без обещаний и сроков.
 *
 * Порядок именно такой: сначала то, что есть и работает, потом то,
 * чего пока нет. Обратный порядок читался бы как извинение.
 */
export default function ConceptsPage() {
  const items = SITE.concepts.items;
  const ready = items.filter((c) => c.ready);
  const rest = items.filter((c) => !c.ready);

  return (
    <>
      <HeroSilk />
      <main id="content" className="relative z-10 w-full">
        {/* ---------- первый экран ---------- */}
        <section data-chapter="hero" className="relative overflow-hidden" aria-label="Начало">
          <div data-hero className="px-4 pb-[clamp(48px,9vh,110px)] pt-[clamp(120px,19vh,200px)] sm:px-8 lg:px-[72px]">
            <span className="rail-label">{PAGE.label}</span>
            <div className="mt-6 grid items-end gap-[clamp(28px,5vh,56px)] lg:grid-cols-[1.6fr_1fr] lg:gap-[clamp(40px,5vw,96px)]">
              <h1
                className="display m-0 text-[clamp(32px,5vw,86px)]"
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
              <p className="m-0 max-w-[44ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">{PAGE.lead}</p>
            </div>

            {/* указатель ниш: что вообще лежит ниже */}
            <ul className="m-0 mt-[clamp(32px,6vh,72px)] flex list-none flex-wrap gap-x-[clamp(16px,3vw,44px)] gap-y-3 border-t border-line p-0 pt-6">
              {items.map((c) => (
                <li key={c.slug} className="rail-label">
                  {c.niche}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- собранные демо ---------- */}
        {ready.length > 0 && (
          <section data-chapter="concepts" className="relative border-t border-line" aria-label="Собранные демо">
            <div data-recede className="flex flex-col gap-[clamp(56px,11vh,140px)] px-4 section-y sm:px-8 lg:px-[72px]">
              {ready.map((c, i) => {
                const meta = demoBySlug(c.slug);
                if (!meta) return null;
                return <DemoBand key={c.slug} item={c} meta={meta} flip={i % 2 === 1} />;
              })}
            </div>
          </section>
        )}

        {/* ---------- ниши без демо ---------- */}
        {rest.length > 0 && (
          <section data-chapter="atlas" className="relative border-t border-line" aria-label="Ниши в работе">
            <div className="px-4 section-y-tight sm:px-8 lg:px-[72px]">
              <div className="flex items-baseline justify-between gap-6">
                <span className="rail-label">Следующие ниши</span>
                <span className="rail-label">
                  <b>{ready.length}</b> / {items.length} собрано
                </span>
              </div>
              {/* Без сроков и без бейджа «готовим»: обещание на будущее
                  читается как «сейчас у нас ничего нет». Карточка просто
                  никуда не ведёт и не притворяется ссылкой. */}
              <ConceptCards items={rest} wide={false} className="mt-[clamp(24px,4vh,48px)]" />
            </div>
          </section>
        )}

        {/* ---------- как этим пользоваться ---------- */}
        <Process
          steps={PAGE.how.items}
          label={PAGE.how.label}
          title="Три шага"
          titleAccent="до брифа"
          lead="Демо не нужно читать — по нему нужно пройти. Это занимает пару минут."
          chapter="atlas"
        />

        {/* ---------- не нашли своё ---------- */}
        <section data-chapter="concepts" className="relative border-t border-line" aria-label="Не нашли своё">
          <div className="px-4 section-y sm:px-8 lg:px-[72px]">
            <div className="grid gap-[clamp(24px,4vh,48px)] lg:grid-cols-[1.6fr_1fr] lg:items-end lg:gap-[clamp(40px,5vw,96px)]">
              <h2 className="display m-0 text-[clamp(26px,4.2vw,64px)]">
                {PAGE.cta.title.replace('?', '')} <span className="title-accent">— соберём.</span>
              </h2>
              <p className="m-0 max-w-[44ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">{PAGE.cta.text}</p>
            </div>
            <Cta href={contactHref('/concepts')} className="mt-[clamp(28px,5vh,56px)]">
              {SITE.hero.primary.label}
            </Cta>
          </div>
        </section>
      </main>
      <Footer />
      <ScrollScenes />
    </>
  );
}
