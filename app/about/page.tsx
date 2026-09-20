import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import HeroSilk from '@/components/HeroSilk';
import Mark from '@/components/Mark';
import RevealText from '@/components/RevealText';
import { ABOUT } from '@/content/about';
import { SITE } from '@/content/site';

export const metadata: Metadata = {
  title: ABOUT.meta.title,
  description: ABOUT.meta.description,
  alternates: { canonical: '/about' },
  openGraph: {
    title: `${ABOUT.meta.title} — CoreThree`,
    description: ABOUT.meta.description,
    url: '/about'
  }
};

/**
 * О студии. Третье место, где живёт триада ядер (первое — рельс первого
 * экрана, второе — манифест): здесь она раскрывается, а не просто
 * называется.
 *
 * Блок команды построен на ролях без имён — их в брифе не было, а
 * выдумывать людей на странице про честность нельзя. Имена подставятся
 * в `ABOUT.team.items[].name`, вёрстка их уже ждёт.
 */
export default function AboutPage() {
  return (
    <>
      <HeroSilk />
      <main id="content" className="relative z-10 w-full">
        {/* ---------- первый экран ---------- */}
        <section data-chapter="hero" className="relative overflow-hidden">
          <div className="grid items-end gap-[clamp(32px,6vh,64px)] px-4 pb-[10vh] pt-[clamp(120px,19vh,200px)] sm:px-8 lg:grid-cols-[1.25fr_1fr] lg:px-[72px]">
            <div>
              <span className="rail-label">{ABOUT.label}</span>
              <h1
                className="display m-0 mt-6 text-[clamp(36px,6vw,104px)]"
                aria-label={`${ABOUT.title} ${ABOUT.titleAccent}`}
              >
                <RevealText text={ABOUT.title} as="span" className="block" decorative />
                <RevealText
                  text={ABOUT.titleAccent}
                  as="span"
                  className="title-accent block"
                  delay={0.12}
                  decorative
                />
              </h1>
            </div>
            <p className="m-0 max-w-[44ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">
              {ABOUT.lead}
            </p>
          </div>

          {/* короткие цифры вместо пустоты под заголовком */}
          <dl className="m-0 grid grid-cols-2 gap-px border-y border-line bg-line lg:grid-cols-4">
            {ABOUT.numbers.items.map((it) => (
              <div key={it.text} className="bg-bg px-4 py-[clamp(20px,3vh,36px)] sm:px-8 lg:px-[72px]">
                <dt className="display m-0 text-[clamp(28px,3.2vw,48px)] leading-none">{it.value}</dt>
                <dd className="m-0 mt-3 text-[13px] leading-snug text-dim">{it.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- три ядра ---------- */}
        <section data-chapter="manifesto" className="relative">
          <div className="grid gap-[clamp(32px,6vh,64px)] px-4 py-[13vh] sm:px-8 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)] lg:gap-[clamp(40px,5vw,96px)] lg:px-[72px]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <span className="rail-label">{ABOUT.cores.label}</span>
              <h2 className="display m-0 mt-4 text-[clamp(26px,3.6vw,52px)]">
                {ABOUT.cores.title} <span className="title-accent">{ABOUT.cores.titleAccent}</span>
              </h2>
              <Mark className="mt-8 h-20 w-20 text-fg/70" />
              <p className="m-0 mt-8 max-w-[38ch] text-[14px] leading-relaxed text-dim">{ABOUT.cores.text}</p>
            </div>

            <ol className="m-0 list-none p-0">
              {ABOUT.cores.detail.map((c) => (
                <li key={c.n} className="border-t border-line py-[clamp(24px,4vh,44px)] last:border-b">
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-[11px] tracking-rail text-accent">{c.n}</span>
                    <h3 className="display m-0 text-[clamp(22px,2.6vw,38px)]">{c.name}</h3>
                  </div>
                  <p className="m-0 mt-4 max-w-[54ch] text-[15px] leading-relaxed text-dim">{c.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- команда ---------- */}
        <section data-chapter="anatomy" className="relative border-t border-line">
          <div className="px-4 py-[13vh] sm:px-8 lg:px-[72px]">
            <span className="rail-label">{ABOUT.team.label}</span>
            <div className="mt-4 grid gap-[clamp(16px,3vh,32px)] lg:grid-cols-[1.15fr_1fr] lg:items-end">
              <h2 className="display m-0 text-[clamp(26px,4.2vw,64px)]">
                {ABOUT.team.title} <span className="title-accent">{ABOUT.team.titleAccent}</span>
              </h2>
              <p className="m-0 max-w-[44ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
                {ABOUT.team.lead}
              </p>
            </div>

            <ul className="m-0 mt-[clamp(28px,5vh,56px)] grid list-none gap-px border border-line bg-line p-0 lg:grid-cols-3">
              {ABOUT.team.items.map((m) => (
                <li key={m.role} className="flex flex-col bg-bg p-[clamp(20px,2.2vw,34px)]">
                  <span className="rail-label">{m.role}</span>
                  {/* имя появится, когда его дадут: роль работает и без него */}
                  {m.name ? (
                    <h3 className="display m-0 mt-4 text-[clamp(22px,2.2vw,32px)]">{m.name}</h3>
                  ) : null}
                  <p className="m-0 mt-4 flex-1 text-[14px] leading-relaxed text-dim">{m.text}</p>
                  <ul className="m-0 mt-6 flex list-none flex-wrap gap-1.5 p-0">
                    {m.owns.map((o) => (
                      <li
                        key={o}
                        className="border border-line px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-rail text-faint"
                      >
                        {o}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- принципы ---------- */}
        <section data-chapter="atlas" className="relative border-t border-line">
          <div className="px-4 py-[13vh] sm:px-8 lg:px-[72px]">
            <span className="rail-label">{ABOUT.principles.label}</span>
            <h2 className="display m-0 mt-4 max-w-[20ch] text-[clamp(26px,4.2vw,64px)]">
              {ABOUT.principles.title}{' '}
              <span className="title-accent">{ABOUT.principles.titleAccent}</span>
            </h2>
            <ul className="m-0 mt-[clamp(28px,5vh,56px)] grid list-none gap-px border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-3">
              {ABOUT.principles.items.map((p) => (
                <li key={p.title} className="bg-bg p-[clamp(18px,2vw,30px)]">
                  <h3 className="m-0 text-[clamp(16px,1.3vw,19px)] font-medium leading-snug">{p.title}</h3>
                  <p className="m-0 mt-2.5 text-[13.5px] leading-relaxed text-dim">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- границы ---------- */}
        <section data-chapter="concepts" className="relative border-t border-line">
          <div className="grid gap-[clamp(28px,5vh,56px)] px-4 py-[13vh] sm:px-8 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)] lg:gap-[clamp(40px,5vw,96px)] lg:px-[72px]">
            <div>
              <span className="rail-label">{ABOUT.limits.label}</span>
              <h2 className="display m-0 mt-4 text-[clamp(26px,3.6vw,52px)]">
                {ABOUT.limits.title} <span className="title-accent">{ABOUT.limits.titleAccent}</span>
              </h2>
              <p className="m-0 mt-6 max-w-[34ch] text-[14px] leading-relaxed text-dim">{ABOUT.limits.lead}</p>
            </div>
            <ul className="m-0 list-none p-0">
              {ABOUT.limits.items.map((it) => (
                <li
                  key={it}
                  className="flex gap-4 border-t border-line py-6 text-[15px] leading-relaxed text-dim last:border-b"
                >
                  <span className="mt-3 h-px w-5 shrink-0 bg-line-strong" aria-hidden />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- переход к направлениям ---------- */}
        <section className="relative border-t border-line">
          <div className="px-4 py-[10vh] sm:px-8 lg:px-[72px]">
            <span className="rail-label">Чем занимаемся</span>
            <ul className="m-0 mt-6 grid list-none gap-px border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-3">
              {SITE.services.map((s) => (
                <li key={s.n} className="bg-bg">
                  <Link
                    href={s.href}
                    className="flex items-baseline gap-4 p-[clamp(16px,1.8vw,26px)] transition-colors duration-300 hover:bg-elev"
                  >
                    <span className="font-mono text-[11px] tracking-rail text-faint">{s.n}</span>
                    <span className="text-[clamp(15px,1.2vw,18px)] font-medium">
                      {s.title} <span className="text-dim">{s.titleAccent}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
