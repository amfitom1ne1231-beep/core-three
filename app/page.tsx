import HeroSilk from '@/components/HeroSilk';
import RevealText from '@/components/RevealText';
import { SITE } from '@/content/site';

export default function Home() {
  return (
    <>
      <HeroSilk />
      <main id="content" className="relative z-10 w-full">
        <section className="relative flex h-[100svh] select-none flex-col justify-center px-4 sm:px-8 lg:px-[72px]">
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
            className="display m-0 text-[clamp(38px,8.4vw,132px)]"
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
            className="mt-[clamp(20px,3vh,38px)] max-w-[46ch] font-mono text-[clamp(11px,1.05vw,13px)] uppercase leading-[1.75] tracking-label text-dim"
            delay={0.3}
            spread={0.7}
          />

          <div className="mt-[clamp(28px,4vh,52px)] flex flex-wrap gap-3.5">
            <a
              href={SITE.hero.primary.href}
              className="border border-fg bg-fg px-[22px] py-[13px] font-mono text-[11px] uppercase tracking-label text-bg transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-white"
            >
              {SITE.hero.primary.label}
            </a>
            <a
              href={SITE.hero.secondary.href}
              className="border border-line px-[22px] py-[13px] font-mono text-[11px] uppercase tracking-label text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
            >
              {SITE.hero.secondary.label}
            </a>
          </div>

          <div className="rail-label absolute bottom-[clamp(20px,5vh,54px)] left-4 sm:left-8 lg:left-[72px]">
            {SITE.hero.scrollHint}
          </div>
        </section>

        {/* заглушка следующей секции: проверяем стык шейдера с контентом */}
        <section className="relative min-h-[80vh] border-t border-line bg-bg px-4 py-[18vh] sm:px-8 lg:px-[72px]">
          <p className="rail-label mb-8">02 / Манифест — следующий шаг волны 1</p>
          <p className="display m-0 max-w-[30ch] text-[clamp(26px,4vw,62px)] text-faint">
            Скорость <strong className="inline text-fg">без потери качества.</strong>
          </p>
        </section>
      </main>
    </>
  );
}
