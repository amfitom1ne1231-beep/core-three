import type { Metadata } from 'next';
import Cores from '@/components/about/Cores';
import Footer from '@/components/Footer';
import RevealText from '@/components/RevealText';
import ScrollScenes from '@/components/ScrollScenes';
import { ABOUT } from '@/content/about';
import { pageMeta } from '@/lib/meta';

export const metadata: Metadata = pageMeta({ title: ABOUT.meta.title, description: ABOUT.meta.description, path: '/about' });

/**
 * О студии.
 *
 * Третье место, где живёт триада ядер: на первом экране она названа,
 * в манифесте звучит, здесь — показывается самим знаком (см. `Cores`).
 *
 * Блока команды нет: имён, ролей и числа людей страница не называет —
 * решение заказчика. На его месте — «что нужно от вас».
 */
export default function AboutPage() {
  return (
    <>
      <main id="content" className="relative z-10 w-full">
        {/* ---------- первый экран ---------- */}
        <section data-chapter="hero" className="relative overflow-hidden" aria-label="Начало">
          <div data-hero className="px-4 pb-[clamp(40px,7vh,88px)] pt-[clamp(120px,19vh,200px)] sm:px-8 lg:px-[72px] tp:pb-10 tp:pt-[136px]">
            <span className="rail-label">{ABOUT.label}</span>
            <div className="mt-6 grid items-end gap-[clamp(28px,5vh,56px)] lg:grid-cols-[1.6fr_1fr] lg:gap-[clamp(40px,5vw,96px)] tp:grid-cols-1">
              <h1
                className="display m-0 text-[clamp(32px,5vw,86px)] tp:text-[min(8vw,80px)]"
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
              <p className="m-0 max-w-[44ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim tp:max-w-[50ch] tp:text-[17px]">{ABOUT.lead}</p>
            </div>
          </div>

          {/* короткие цифры: четыре ответа, за которыми обычно пишут */}
          <dl className="m-0 grid grid-cols-2 gap-px border-y border-line bg-line lg:grid-cols-4 tp:grid-cols-4">
            {ABOUT.numbers.items.map((it) => (
              <div key={it.text} className="bg-bg px-4 py-[clamp(20px,3.4vh,40px)] sm:px-8 lg:px-[72px] tp:px-6">
                <dt className="display m-0 text-[clamp(30px,3.6vw,56px)] leading-none">{it.value}</dt>
                <dd className="m-0 mt-3 text-[13px] leading-snug text-dim">{it.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- три ядра: сцена со знаком ---------- */}
        <Cores />

        {/* ---------- что нужно от вас ---------- */}
        <section data-chapter="anatomy" className="relative border-t border-line" aria-label={ABOUT.start.label}>
          <div className="px-4 section-y sm:px-8 lg:px-[72px]">
            <span className="rail-label">{ABOUT.start.label}</span>
            <div className="mt-4 grid gap-[clamp(16px,3vh,32px)] lg:grid-cols-[1.7fr_1fr] lg:items-end">
              <h2 className="display m-0 text-[clamp(26px,4.2vw,64px)]">
                {ABOUT.start.title} <span className="title-accent">{ABOUT.start.titleAccent}</span>
              </h2>
              <p className="m-0 max-w-[40ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
                {ABOUT.start.lead}
              </p>
            </div>

            <ol className="m-0 mt-[clamp(28px,5vh,64px)] grid list-none gap-px border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-3">
              {ABOUT.start.items.map((it, i) => (
                <li
                  key={it.title}
                  className="group relative flex flex-col overflow-hidden bg-bg p-[clamp(20px,2.4vw,38px)] transition-colors duration-500 hover:bg-elev"
                >
                  {/* номер крупно — та же система якорей, что на страницах направлений */}
                  <span
                    className="pointer-events-none absolute -bottom-[0.24em] right-[0.04em] font-mono text-[clamp(72px,7vw,120px)] leading-none tracking-[-0.05em] text-fg/[0.05] transition-colors duration-500 group-hover:text-fg/[0.09]"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="relative m-0 text-[clamp(17px,1.5vw,22px)] font-medium leading-snug">{it.title}</h3>
                  <p className="relative m-0 mt-4 max-w-[38ch] pb-[clamp(28px,3vw,48px)] text-[14.5px] leading-relaxed text-dim">{it.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- правила ---------- */}
        <section data-chapter="atlas" className="relative border-t border-line" aria-label={ABOUT.principles.label}>
          <div className="px-4 section-y sm:px-8 lg:px-[72px]">
            <span className="rail-label">{ABOUT.principles.label}</span>
            <h2 className="display m-0 mt-4 max-w-[20ch] text-[clamp(26px,4.2vw,64px)]">
              {ABOUT.principles.title} <span className="title-accent">{ABOUT.principles.titleAccent}</span>
            </h2>

            {/* Не сетка одинаковых рамок, а перечень: правила читают
                подряд, а не выбирают из них. Номер и волосяная линия
                держат ритм, рамки только дробили бы страницу. */}
            <ol className="m-0 mt-[clamp(28px,5vh,64px)] grid list-none gap-x-[clamp(40px,5vw,96px)] p-0 lg:grid-cols-2">
              {ABOUT.principles.items.map((p, i) => (
                <li key={p.title} className="grid grid-cols-[2.75rem_1fr] items-baseline gap-x-2 border-t border-line py-[clamp(18px,3vh,30px)]">
                  <span className="font-mono text-[11px] tracking-rail text-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="m-0 text-[clamp(16px,1.4vw,20px)] font-medium leading-snug">{p.title}</h3>
                    <p className="m-0 mt-2.5 max-w-[46ch] text-[13.5px] leading-relaxed text-dim">{p.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- границы ---------- */}
        <section data-chapter="concepts" className="relative border-t border-line" aria-label={ABOUT.limits.label}>
          <div className="grid gap-[clamp(28px,5vh,56px)] px-4 section-y sm:px-8 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)] lg:gap-[clamp(40px,5vw,96px)] lg:px-[72px]">
            <div className="lg:sticky lg:top-28 lg:self-start">
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
                  className="flex gap-5 border-t border-line py-[clamp(18px,3vh,30px)] text-[clamp(15px,1.35vw,19px)] leading-[1.5] text-dim last:border-b"
                >
                  <span className="mt-[0.7em] h-px w-5 shrink-0 bg-line-strong" aria-hidden />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        </section>

      </main>
      <Footer />
      <ScrollScenes />
    </>
  );
}
