import type { Metadata } from 'next';
import Assembly from '@/components/Assembly';
import Cta from '@/components/Cta';
import Footer from '@/components/Footer';
import HeroMark from '@/components/HeroMark';
import HeroPick from '@/components/HeroPick';
import Journey from '@/components/Journey';
import Manifesto from '@/components/Manifesto';
import PhoneHome from '@/components/phone/PhoneHome';
import RevealText from '@/components/RevealText';
import ScrollScenes from '@/components/ScrollScenes';
import { SITE } from '@/content/site';
import { plain } from '@/content/glossary';

const url = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// Остальное — заголовок, описание, картинка — главная берёт из корня.
// Свой блок openGraph ей задавать нельзя: Next сливает метаданные не вглубь,
// и вместе с ним главная теряет картинку превью — файл opengraph-image
// лежит в корне, а не рядом с этой страницей. Проверено на живом сайте.
export const metadata: Metadata = { alternates: { canonical: '/' } };

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
      itemOffered: { '@type': 'Service', name: `${s.title} ${s.titleAccent}`, description: plain(s.summary) }
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
      <main id="content" className="relative z-10 w-full">
        {/* На телефоне главная своя: четыре сцены по экрану (MOBILE.md).
            Прежняя — всё, что в этой обёртке, — остаётся шире 640 px. */}
        <PhoneHome />
        <div className="max-sm:hidden">
        {/* overflow-x-clip: знак выходит за край и на скролле растёт — страница
            не должна от этого становиться шире экрана, а по вертикали лучи
            разлетаются свободно */}
        <section
          data-chapter="hero"
          data-cursor="ring"
          // Телефон: две строки — текст и место под знак. Знак занимает
          // то, что осталось под кнопками, и не может на них наехать:
          // раньше он стоял от низа экрана, и на iPhone, где видимая
          // высота меньше, закрывал «Смотреть концепты».
          className="relative z-20 h-[100svh] select-none overflow-x-clip max-sm:grid max-sm:h-auto max-sm:min-h-[100svh] max-sm:grid-rows-[auto_minmax(0,1fr)]"
          aria-label="Начало"
        >
          {/* знак-объект: прилетает из прелоадера, тянется за курсором, на скролле разлетается.
              Обёртка существует только на телефоне (вторая строка сетки, от её
              высоты знак считает свой размер); шире она растворяется */}
          <div className="max-sm:relative max-sm:row-start-2 max-sm:min-h-[150px] max-sm:[container-type:size] sm:contents">
            <HeroMark />
          </div>

          {/* текст — отдельный слой: на скролле он уходит вглубь, а знак разлетается */}
          <div
            data-hero
            // на телефоне текст наверху, знак поднимается снизу; на десктопе они рядом;
            // на планшете в портрете текст наверху, знак целиком под ним
            // md:will-change — слой текста уходит вглубь по прокрутке: закреплён
            // текстурой, чтобы уменьшение не перерисовывало заголовок каждый кадр
            className="relative z-10 flex h-full flex-col justify-start px-4 pt-[clamp(150px,23vh,210px)] md:[will-change:transform,opacity] max-sm:row-start-1 max-sm:h-auto max-sm:pt-[136px] sm:px-8 lg:justify-center lg:px-[72px] lg:pt-0 tp:justify-start tp:pt-[150px]"
          >
            {/* рельс трёх ядер — имена с дескриптора логотипа */}
            <div className="absolute left-4 right-4 top-[clamp(88px,14vh,150px)] max-sm:top-[84px] flex flex-wrap gap-x-[clamp(12px,3vw,40px)] gap-y-2 sm:left-8 sm:right-8 lg:left-[72px] lg:right-[72px] tp:top-[104px]">
              {SITE.cores.map((core) => (
                <span key={core.n} className="rail-label">
                  <b>{core.n}</b> / {core.name}
                </span>
              ))}
            </div>

            {/* заголовок озвучивается целиком, посимвольная разбивка скрыта от читалок */}
            <h1
              className="display m-0 text-[clamp(56px,9.4vw,160px)] tp:text-[min(11.5vw,112px)]"
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
              className="mt-[clamp(20px,3.4vh,40px)] max-w-[38ch] text-[clamp(15px,1.3vw,19px)] leading-[1.6] text-dim tp:max-w-[50ch] tp:text-[17px]"
              delay={0.3}
              spread={0.7}
            />

            <div className="mt-[clamp(28px,4vh,52px)] flex flex-wrap gap-3.5">
              <Cta href={SITE.hero.primary.href}>{SITE.hero.primary.label}</Cta>
              <Cta href={SITE.hero.secondary.href} tone="ghost">
                {SITE.hero.secondary.label}
              </Cta>
            </div>

            {/* вход в подбор с первого экрана — как на телефоне */}
            <HeroPick className="mt-[clamp(16px,2.4vh,26px)]" />

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
        <Journey />
        <Assembly />
        </div>
      </main>
      {/* на телефоне финал и контакты — четвёртая сцена */}
      <div className="max-sm:hidden">
        <Footer />
      </div>
      <ScrollScenes />
    </>
  );
}
