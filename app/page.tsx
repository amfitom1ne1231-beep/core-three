import Anatomy from '@/components/Anatomy';
import Atlas from '@/components/Atlas';
import Concepts from '@/components/Concepts';
import Footer from '@/components/Footer';
import HeroMark from '@/components/HeroMark';
import HeroSilk from '@/components/HeroSilk';
import Manifesto from '@/components/Manifesto';
import RevealText from '@/components/RevealText';
import ScrollScenes from '@/components/ScrollScenes';
import { SITE } from '@/content/site';

const url = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Разметка для поисковиков: кто мы, чем занимаемся, как связаться. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: SITE.name,
  url,
  logo: new URL('/icon.svg', url).toString(),
  image: new URL('/opengraph-image', url).toString(),
  email: SITE.email,
  description: SITE.hero.lead,
  slogan: `${SITE.hero.title} ${SITE.hero.titleStrong}`,
  areaServed: 'RU',
  knowsLanguage: 'ru',
  sameAs: [`https://t.me/${SITE.telegram}`],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Направления',
    itemListElement: SITE.services.map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: `${s.title} ${s.titleAccent}`, description: s.summary }
    }))
  }
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // данные свои и статичные, экранирование < — от закрытия тега внутри строки
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <HeroSilk />
      <main id="content" className="relative z-10 w-full">
        {/* overflow-x-clip: знак выходит за край и на скролле растёт — страница
            не должна от этого становиться шире экрана, а по вертикали лучи
            разлетаются свободно */}
        <section data-chapter="hero" data-cursor="ring" className="relative z-20 h-[100svh] select-none overflow-x-clip">
          {/* знак-объект: прилетает из прелоадера, тянется за курсором, на скролле разлетается */}
          <HeroMark />

          {/* текст — отдельный слой: на скролле он уходит вглубь, а знак разлетается */}
          <div
            data-hero
            // на телефоне текст наверху, знак поднимается снизу; на десктопе они рядом
            className="relative z-10 flex h-full flex-col justify-start px-4 pt-[clamp(150px,23vh,210px)] sm:px-8 lg:justify-center lg:px-[72px] lg:pt-0"
          >
            {/* рельс трёх ядер — имена с дескриптора логотипа */}
            <div className="absolute left-4 right-4 top-[clamp(88px,14vh,150px)] flex flex-wrap gap-x-[clamp(12px,3vw,40px)] gap-y-2 sm:left-8 sm:right-8 lg:left-[72px] lg:right-[72px]">
              {SITE.cores.map((core) => (
                <span key={core.n} className="rail-label">
                  <b>{core.n}</b> / {core.name}
                </span>
              ))}
            </div>

            {/* заголовок озвучивается целиком, посимвольная разбивка скрыта от читалок */}
            <h1
              className="display m-0 text-[clamp(56px,9.4vw,160px)]"
              aria-label={`${SITE.hero.title} ${SITE.hero.titleStrong}`}
            >
              <RevealText text={SITE.hero.title} as="span" className="block" decorative />
              <RevealText
                text={SITE.hero.titleStrong}
                as="span"
                className="block font-bold tracking-[-0.035em]"
                delay={0.12}
                decorative
              />
            </h1>

            <RevealText
              text={SITE.hero.lead}
              as="p"
              className="mt-[clamp(20px,3.4vh,40px)] max-w-[38ch] text-[clamp(15px,1.3vw,19px)] leading-[1.6] text-dim"
              delay={0.3}
              spread={0.7}
            />

            <div className="mt-[clamp(28px,4vh,52px)] flex flex-wrap gap-3.5">
              <a
                data-magnetic
                href={SITE.hero.primary.href}
                className="border border-fg bg-fg px-[22px] py-[13px] font-mono text-[11px] uppercase tracking-label text-bg transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-white"
              >
                {SITE.hero.primary.label}
              </a>
              <a
                data-magnetic
                href={SITE.hero.secondary.href}
                className="border border-line bg-bg/30 px-[22px] py-[13px] font-mono text-[11px] uppercase tracking-label text-fg backdrop-blur-sm transition-colors duration-300 hover:border-accent hover:text-accent"
              >
                {SITE.hero.secondary.label}
              </a>
            </div>

            {/* Подсказка прокрутки без слов: штрих уходит вниз и возвращается.
                Фраза «прокрутите — дальше устройство работы» объясняла то,
                что человек и так делает первым движением.
                На телефоне внизу стоит знак — там и штрих лишний. */}
            <div
              className="scroll-cue absolute bottom-[clamp(20px,5vh,54px)] left-4 hidden sm:left-8 lg:left-[72px] lg:block"
              aria-hidden
            />
          </div>
        </section>

        <Manifesto />
        <Anatomy />
        <Atlas />
        <Concepts />
      </main>
      <Footer />
      <ScrollScenes />
    </>
  );
}
