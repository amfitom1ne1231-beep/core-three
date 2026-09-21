'use client';

import DemoFrame from '../DemoFrame';
import Phone from './Phone';
import Reveal from '../reveal';
import { display, text } from './fonts';
import { C, money } from './shared';
import { CAFE, COPY, MENU } from '@/content/concepts/cafe';
import { demoBySlug } from '@/content/concepts';

const META = demoBySlug('cafe')!;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="block text-[11px] font-medium uppercase tracking-[0.2em]"
      style={{ color: C.accent }}
    >
      {children}
    </span>
  );
}

export default function CafeDemo() {
  return (
    <DemoFrame meta={META}>
      <div
        className={`${display.variable} ${text.variable} min-h-screen`}
        style={{ background: C.paper, color: C.ink, fontFamily: 'var(--cafe-text), system-ui, sans-serif' }}
      >
        {/* фон до самого края, включая перелистывание за границу */}
        <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: C.paper }} />

        {/* ---------- шапка заведения ---------- */}
        <header
          className="sticky z-40 border-b backdrop-blur-sm"
          style={{
            top: 'var(--demo-bar)',
            borderColor: C.lineSoft,
            background: 'rgba(247,243,236,0.88)'
          }}
        >
          <div className="mx-auto flex max-w-[1180px] items-center gap-6 px-5 py-3.5 sm:px-8">
            <a href="#content" className="flex items-baseline gap-2.5">
              <span
                className="text-[21px] leading-none"
                style={{ fontFamily: 'var(--cafe-display), Georgia, serif' }}
              >
                {CAFE.name}
              </span>
              <span className="hidden text-[11px] uppercase tracking-[0.18em] sm:inline" style={{ color: C.faint }}>
                {CAFE.kind}
              </span>
            </a>

            <nav className="ml-auto hidden items-center gap-7 md:flex">
              {COPY.nav.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="text-[13.5px] transition-colors duration-300 hover:text-[color:var(--h)]"
                  style={{ color: C.muted, ['--h' as string]: C.accent }}
                >
                  {n.label}
                </a>
              ))}
            </nav>

            <a
              href="#telegram"
              className="ml-auto shrink-0 rounded-full px-4 py-2 text-[12.5px] font-medium transition-opacity duration-300 hover:opacity-90 md:ml-0"
              style={{ background: C.ink, color: C.paper }}
            >
              {CAFE.tg}
            </a>
          </div>
        </header>

        <main id="content">
          {/* ---------- первый экран: слева слово, справа продукт ---------- */}
          <section className="mx-auto max-w-[1180px] px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:gap-16">
              <div>
                <Label>{CAFE.address} · {CAFE.city}</Label>
                <h1
                  className="m-0 mt-5 text-[clamp(40px,7vw,86px)] font-normal leading-[0.98] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--cafe-display), Georgia, serif' }}
                >
                  {COPY.hero.title}
                  <br />
                  <em className="not-italic" style={{ fontStyle: 'italic', color: C.accent }}>
                    {COPY.hero.titleAccent}
                  </em>
                </h1>
                <p
                  className="m-0 mt-7 max-w-[46ch] text-[clamp(15px,1.25vw,17.5px)] leading-relaxed"
                  style={{ color: C.muted }}
                >
                  {COPY.hero.lead}
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <a
                    href="#telegram"
                    className="rounded-full px-6 py-3.5 text-[14px] font-medium transition-opacity duration-300 hover:opacity-90"
                    style={{ background: C.accent, color: '#fff' }}
                  >
                    {COPY.hero.primary}
                  </a>
                  <a
                    href="#menu"
                    className="rounded-full border px-6 py-3.5 text-[14px] transition-colors duration-300"
                    style={{ borderColor: C.line, color: C.ink }}
                  >
                    {COPY.hero.secondary}
                  </a>
                </div>

                <p className="m-0 mt-8 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]" style={{ color: C.faint }}>
                  {COPY.hero.meta.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </p>
              </div>

              {/* телефон стоит в первом экране: продукт — он, а не страница */}
              <div id="telegram" className="scroll-mt-28">
                <Phone />
                <p className="mt-5 text-center text-[12px]" style={{ color: C.faint }}>
                  {COPY.telegram.hint}
                </p>
              </div>
            </div>
          </section>

          {/* ---------- что за этим стоит ---------- */}
          <section className="border-t" style={{ borderColor: C.lineSoft, background: C.paperDeep }}>
            <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
              <div className="max-w-[46ch]">
                <Label>{COPY.telegram.label}</Label>
                <h2
                  className="m-0 mt-4 text-[clamp(28px,3.6vw,46px)] font-normal leading-[1.08] tracking-[-0.015em]"
                  style={{ fontFamily: 'var(--cafe-display), Georgia, serif' }}
                >
                  {COPY.telegram.title}{' '}
                  <em style={{ fontStyle: 'italic', color: C.accent }}>{COPY.telegram.titleAccent}</em>
                </h2>
                <p className="m-0 mt-4 text-[15px] leading-relaxed" style={{ color: C.muted }}>
                  {COPY.telegram.lead}
                </p>
              </div>

              <ol className="m-0 mt-12 grid list-none gap-px p-0 sm:grid-cols-3" style={{ background: C.line }}>
                {COPY.telegram.points.map((p, i) => (
                  <Reveal as="li" key={p.n} delay={i * 90} className="p-6 sm:p-7" style={{ background: C.paperDeep }}>
                    <span className="text-[12px] tabular-nums" style={{ color: C.accent }}>
                      {p.n}
                    </span>
                    <h3 className="m-0 mt-3 text-[17px] font-medium leading-snug">{p.title}</h3>
                    <p className="m-0 mt-2.5 text-[13.5px] leading-relaxed" style={{ color: C.muted }}>
                      {p.text}
                    </p>
                  </Reveal>
                ))}
              </ol>
            </div>
          </section>

          {/* ---------- меню ---------- */}
          <section id="menu" className="scroll-mt-24 border-t" style={{ borderColor: C.lineSoft }}>
            <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
              <div className="max-w-[46ch]">
                <Label>{COPY.menu.label}</Label>
                <h2
                  className="m-0 mt-4 text-[clamp(28px,3.6vw,46px)] font-normal leading-[1.08] tracking-[-0.015em]"
                  style={{ fontFamily: 'var(--cafe-display), Georgia, serif' }}
                >
                  {COPY.menu.title}
                </h2>
                <p className="m-0 mt-4 text-[14.5px] leading-relaxed" style={{ color: C.muted }}>
                  {COPY.menu.lead}
                </p>
              </div>

              <div className="mt-12 grid gap-x-16 gap-y-12 md:grid-cols-2">
                {MENU.map((sec, i) => (
                  <Reveal as="section" key={sec.id} delay={(i % 2) * 90} className="break-inside-avoid">
                    <div className="flex items-baseline gap-3 border-b pb-2" style={{ borderColor: C.line }}>
                      <h3
                        className="m-0 text-[22px] font-normal"
                        style={{ fontFamily: 'var(--cafe-display), Georgia, serif' }}
                      >
                        {sec.label}
                      </h3>
                      {sec.note && (
                        <span className="text-[11.5px]" style={{ color: C.faint }}>
                          {sec.note}
                        </span>
                      )}
                    </div>

                    <ul className="m-0 mt-4 flex list-none flex-col gap-3.5 p-0">
                      {sec.dishes.map((d) => (
                        <li key={d.id}>
                          {/* точечная линейка между названием и ценой — приём
                              бумажного меню, здесь он на месте */}
                          <div className="flex items-baseline">
                            <span className="text-[15px]">{d.name}</span>
                            <span
                              aria-hidden
                              className="mx-2.5 min-w-[18px] flex-1 translate-y-[-3px] border-b border-dotted"
                              style={{ borderColor: C.line }}
                            />
                            <span className="shrink-0 text-[14px] tabular-nums" style={{ color: C.muted }}>
                              {money(d.price)}
                            </span>
                          </div>
                          <p className="m-0 mt-0.5 text-[12.5px] leading-snug" style={{ color: C.faint }}>
                            {d.note}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- адрес ---------- */}
          <section
            id="where"
            className="scroll-mt-24 border-t"
            style={{ borderColor: C.lineSoft, background: C.paperDeep }}
          >
            <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-16">
              <div>
                <Label>{COPY.where.label}</Label>
                <h2
                  className="m-0 mt-4 text-[clamp(28px,3.6vw,46px)] font-normal leading-[1.08] tracking-[-0.015em]"
                  style={{ fontFamily: 'var(--cafe-display), Georgia, serif' }}
                >
                  {COPY.where.title}
                </h2>
                <p className="m-0 mt-4 max-w-[44ch] text-[15px] leading-relaxed" style={{ color: C.muted }}>
                  {COPY.where.lead}
                </p>
                <p className="m-0 mt-5 max-w-[44ch] text-[13.5px] leading-relaxed" style={{ color: C.faint }}>
                  {COPY.where.note}
                </p>
              </div>

              <dl className="m-0 grid gap-px self-start" style={{ background: C.line }}>
                <div className="p-5" style={{ background: C.paperDeep }}>
                  <dt className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.faint }}>
                    Адрес
                  </dt>
                  <dd className="m-0 mt-1.5 text-[17px]">
                    {CAFE.address}, {CAFE.city}
                  </dd>
                </div>
                {CAFE.hours.map((h) => (
                  <div key={h.days} className="flex items-baseline gap-4 p-5" style={{ background: C.paperDeep }}>
                    <dt className="text-[14px]" style={{ color: C.muted }}>
                      {h.days}
                    </dt>
                    <dd className="m-0 ml-auto text-[15px] tabular-nums">{h.time}</dd>
                  </div>
                ))}
                <div className="p-5" style={{ background: C.paperDeep }}>
                  <dt className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.faint }}>
                    Телефон
                  </dt>
                  <dd className="m-0 mt-1.5 text-[17px] tabular-nums">{CAFE.phone}</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* ---------- подвал ---------- */}
          <footer className="border-t" style={{ borderColor: C.lineSoft }}>
            <div className="mx-auto flex max-w-[1180px] flex-wrap items-baseline justify-between gap-x-8 gap-y-3 px-5 py-8 text-[12.5px] sm:px-8">
              <span style={{ color: C.muted }}>
                {CAFE.name} · {CAFE.domain} · {CAFE.tg}
              </span>
              <span style={{ color: C.faint }}>{COPY.footer.by}</span>
            </div>
          </footer>
        </main>
      </div>
    </DemoFrame>
  );
}
