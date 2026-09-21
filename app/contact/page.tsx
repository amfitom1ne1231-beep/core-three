import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import HeroSilk from '@/components/HeroSilk';
import LeadForm from '@/components/LeadForm';
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
 * Заявка.
 *
 * Единственная страница, где форма важнее всего остального, поэтому она
 * стоит в первом экране целиком — без прокрутки, без «узнать подробнее».
 * Шаги после заявки уехали ниже отдельной секцией: раньше они делили
 * первый экран с формой, и получалось два одинаково важных столбца,
 * из которых один — обещание, а второй — действие.
 */
export default function ContactPage() {
  const { contact } = SITE;

  return (
    <>
      {/* тот же материал, что на главной: заявка — продолжение того же мира */}
      <HeroSilk />
      <main id="content" className="relative z-10 w-full">
        <section data-chapter="contact" className="relative overflow-hidden" aria-label="Заявка">
          <div className="grid items-center gap-[clamp(36px,6vh,72px)] px-4 pb-[clamp(56px,10vh,120px)] pt-[clamp(112px,18vh,196px)] sm:px-8 lg:min-h-[100svh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-[clamp(48px,6vw,112px)] lg:px-[72px]">
            <div data-hero>
              <span className="rail-label">{contact.label}</span>
              <h1
                className="display m-0 mt-6 text-[clamp(36px,5.6vw,92px)]"
                aria-label={`${contact.title} ${contact.titleAccent}`}
              >
                <RevealText text={contact.title} as="span" className="block" decorative />
                <RevealText
                  text={contact.titleAccent}
                  as="span"
                  className="title-accent block"
                  delay={0.12}
                  decorative
                />
              </h1>
              <p className="m-0 mt-8 max-w-[42ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">
                {contact.lead}
              </p>

              {/* Три факта, которые чаще всего спрашивают перед тем, как
                  написать. Стоят до формы, а не после: именно они решают,
                  писать ли вообще. */}
              <ul className="m-0 mt-[clamp(28px,5vh,52px)] flex list-none flex-wrap gap-x-[clamp(16px,3vw,44px)] gap-y-3 border-t border-line p-0 pt-6">
                <li className="rail-label">Ответ в течение дня</li>
                <li className="rail-label">Разбор задачи — 0 ₽</li>
                <li className="rail-label">Смета до старта</li>
              </ul>

              <div className="mt-[clamp(24px,4vh,40px)] flex flex-wrap items-center gap-x-5 gap-y-3">
                <span className="rail-label">{contact.direct}</span>
                <a
                  data-magnetic
                  href={`https://t.me/${SITE.telegram}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="border border-line px-[18px] py-[11px] font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
                >
                  Telegram
                </a>
                <a
                  href={`mailto:${SITE.email}`}
                  className="text-[13px] text-dim underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-fg"
                >
                  {SITE.email}
                </a>
              </div>
            </div>

            {/* ---------- форма ---------- */}
            <div
              data-cursor="ring"
              className="glass self-start p-[clamp(20px,3vw,44px)]"
            >
              <div className="mb-[clamp(20px,3vh,32px)] flex items-center justify-between gap-4 border-b border-line pb-4">
                <span className="rail-label">Заявка</span>
                <span className="rail-label">Три поля</span>
              </div>
              <LeadForm />
            </div>
          </div>
        </section>

        {/* ---------- что дальше ---------- */}
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
