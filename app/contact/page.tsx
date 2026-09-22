import type { Metadata } from 'next';
import Brief from '@/components/contact/Brief';
import Footer from '@/components/Footer';
import HeroSilk from '@/components/HeroSilk';
import RevealText from '@/components/RevealText';
import ScrollScenes from '@/components/ScrollScenes';
import Process from '@/components/service/Process';
import { SITE } from '@/content/site';

export const metadata: Metadata = {
  title: 'Обсудить проект',
  description: SITE.contact.lead,
  alternates: { canonical: '/contact' }
};

/**
 * Заявка — главный разговор сайта, поэтому она не форма, а бриф.
 *
 * Слева пять коротких вопросов кликами, справа на глазах собирается
 * бриф: что запускаем, этап, что подключить, срок, честный ориентир
 * по неделям и живой экран того, что выбрано. Знак в карточке
 * собирается из трёх лучей по ходу заполнения.
 *
 * Шаги после заявки — ниже отдельной секцией: они отвечают на «а что
 * потом», но не должны делить первый экран с самим разговором.
 */
export default function ContactPage() {
  const { contact } = SITE;

  const intro = (
    <div data-hero className="mb-[clamp(40px,7vh,72px)]">
      <span className="rail-label">{contact.label}</span>
      <h1 className="display m-0 mt-6 text-[clamp(40px,6vw,104px)]" aria-label={`${contact.title} ${contact.titleAccent}`}>
        <RevealText text={contact.title} as="span" className="block" decorative />
        <RevealText text={contact.titleAccent} as="span" className="block font-bold tracking-[-0.035em]" delay={0.12} decorative />
      </h1>
      <p className="m-0 mt-7 max-w-[52ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">{contact.lead}</p>

      {/* три факта, которые спрашивают раньше, чем пишут */}
      <ul className="m-0 mt-8 flex list-none flex-wrap gap-x-[clamp(16px,3vw,40px)] gap-y-3 p-0">
        {contact.facts.map((f) => (
          <li key={f} className="rail-label flex items-center gap-2">
            <i className="block h-1 w-1 rounded-full bg-accent" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      <p className="m-0 mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        <span className="rail-label">{contact.direct}</span>
        <a
          href={`https://t.me/${SITE.telegram}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:decoration-accent"
        >
          Telegram {SITE.telegramLabel}
        </a>
        <a href={`mailto:${SITE.email}`} className="text-dim underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-fg">
          {SITE.email}
        </a>
      </p>
    </div>
  );

  return (
    <>
      {/* тот же материал, что на главной: заявка — продолжение того же мира */}
      <HeroSilk />
      <main id="content" className="relative z-10 w-full">
        <section
          data-chapter="contact"
          className="relative px-4 pb-[clamp(56px,10vh,120px)] pt-[clamp(112px,16vh,176px)] sm:px-8 lg:px-[72px]"
          aria-label="Заявка"
        >
          <Brief intro={intro} />
        </section>

        <Process
          steps={contact.steps}
          label="Что дальше"
          title="Три шага"
          titleAccent="после заявки"
          lead="Ни одного из них не будет без вашего согласия — ни созвона, ни счёта."
          chapter="concepts"
        />
      </main>
      <Footer cta={false} />
      <ScrollScenes />
    </>
  );
}
