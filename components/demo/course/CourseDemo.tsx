'use client';

import { useState } from 'react';
import DemoFrame from '../DemoFrame';
import Reveal from '../reveal';
import Enroll from './Enroll';
import Sketch from './Sketch';
import { display, text } from './fonts';
import { C, DISPLAY, money, plural } from './shared';
import { COPY, COURSE, FAQ, REVIEWS, TIERS, WEEKS, WORKS, type Tier } from '@/content/concepts/course';
import { demoBySlug } from '@/content/concepts';

const META = demoBySlug('course')!;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: C.accent }}>
      {children}
    </span>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="m-0 mt-4 text-[clamp(28px,4vw,52px)] font-medium uppercase leading-[1.04] tracking-[0.01em]"
      style={{ fontFamily: DISPLAY }}
    >
      {children}
    </h2>
  );
}

/**
 * Демо «Рисуйте с первого дня» — лендинг эксперта.
 *
 * Показывается то, что обещает витрина: программа, работы, отзывы,
 * запись с оплатой и бот-воронка после заявки. Последнее и есть
 * отличие лендинга эксперта от любого другого: продажа не кончается
 * оплатой, после неё человека нужно довести до первого урока.
 *
 * Клиент тот же, что в живой вставке карусели на главной: доехавший
 * оттуда попадает внутрь того, что уже видел в кадре.
 */
export default function CourseDemo() {
  const [tier, setTier] = useState<Tier | null>(null);
  const [week, setWeek] = useState(0);

  return (
    <DemoFrame meta={META}>
      <div
        className={`${display.variable} ${text.variable} min-h-screen`}
        style={{ background: C.bg, color: C.ink, fontFamily: 'var(--course-text), system-ui, sans-serif' }}
      >
        <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: C.bg }} />

        {/* ---------- шапка ---------- */}
        <header
          className="sticky z-40 border-b backdrop-blur-sm"
          style={{ top: 'var(--demo-bar)', borderColor: C.lineSoft, background: 'rgba(20,26,38,0.9)' }}
        >
          <div className="mx-auto flex max-w-[1140px] items-center gap-6 px-5 py-3.5 sm:px-8">
            <a href="#top" className="text-[17px] font-medium uppercase tracking-[0.06em]" style={{ fontFamily: DISPLAY }}>
              {COURSE.author}
            </a>

            <nav className="ml-auto hidden items-center gap-7 md:flex">
              {COPY.nav.map((n) => (
                <a key={n.href} href={n.href} className="text-[13.5px]" style={{ color: C.muted }}>
                  {n.label}
                </a>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setTier(TIERS[1])}
              className="ml-auto shrink-0 rounded-[8px] px-4 py-2 text-[12.5px] font-semibold transition-opacity duration-300 hover:opacity-90 md:ml-0"
              style={{ background: C.accent, color: C.onAccent }}
            >
              Записаться
            </button>
          </div>
        </header>

        <main id="top">
          {/* ---------- первый экран ---------- */}
          <section className="mx-auto max-w-[1140px] px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20">
            <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_minmax(0,0.9fr)] lg:gap-16">
              <Reveal>
                <Label>{COPY.hero.label}</Label>
                <h1
                  className="m-0 mt-5 text-[clamp(44px,8vw,104px)] font-semibold uppercase leading-[0.92] tracking-[0.005em]"
                  style={{ fontFamily: DISPLAY }}
                >
                  {COPY.hero.title}
                  <span className="block" style={{ color: C.accent }}>
                    {COPY.hero.titleAccent}
                  </span>
                </h1>
                <p className="m-0 mt-7 max-w-[46ch] text-[clamp(15px,1.25vw,17px)] leading-relaxed" style={{ color: C.muted }}>
                  {COPY.hero.lead}
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTier(TIERS[1])}
                    className="rounded-[10px] px-6 py-3.5 text-[14.5px] font-semibold transition-opacity duration-300 hover:opacity-90"
                    style={{ background: C.accent, color: C.onAccent }}
                  >
                    {COPY.hero.primary}
                  </button>
                  <a
                    href="#program"
                    className="rounded-[10px] border px-6 py-3.5 text-[14px] transition-colors duration-300"
                    style={{ borderColor: C.line, color: C.ink }}
                  >
                    {COPY.hero.secondary}
                  </a>
                </div>

                <dl className="m-0 mt-10 flex flex-wrap gap-x-10 gap-y-4">
                  {[
                    { v: COURSE.students, t: 'ученика прошли' },
                    { v: 18, t: 'уроков по 30 минут' },
                    { v: COURSE.weeks, t: plural(COURSE.weeks, 'неделя', 'недели', 'недель') }
                  ].map((s) => (
                    <div key={s.t}>
                      <dt className="text-[26px] leading-none tabular-nums" style={{ fontFamily: DISPLAY }}>
                        {s.v}
                      </dt>
                      <dd className="m-0 mt-1.5 text-[12.5px]" style={{ color: C.faint }}>
                        {s.t}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Reveal>

              {/* работа ученика крупно: обещание курса показано, а не описано */}
              <Reveal delay={90} className="relative">
                <div className="rounded-[14px] border p-8" style={{ borderColor: C.line, background: C.deep }}>
                  <Sketch shape="vase" className="mx-auto h-auto w-full max-w-[280px]" />
                </div>
                <p className="m-0 mt-4 text-center text-[12.5px]" style={{ color: C.faint }}>
                  Работа четвёртой недели. Автор начинала с палочек и кружков.
                </p>
              </Reveal>
            </div>
          </section>

          {/* ---------- работы учеников ---------- */}
          <section id="works" className="scroll-mt-24 border-t" style={{ borderColor: C.lineSoft, background: C.deep }}>
            <div className="mx-auto max-w-[1140px] px-5 py-16 sm:px-8 sm:py-20">
              <Reveal>
                <Label>{COPY.works.label}</Label>
                <Head>{COPY.works.title}</Head>
                <p className="m-0 mt-5 max-w-[52ch] text-[14.5px] leading-relaxed" style={{ color: C.muted }}>
                  {COPY.works.lead}
                </p>
              </Reveal>

              <ul className="m-0 mt-10 grid list-none gap-3 p-0 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
                {WORKS.map((w, i) => (
                  <Reveal as="li" key={w.shape} delay={i * 60}>
                    <figure
                      className="m-0 flex h-full flex-col rounded-[12px] border p-5 transition-transform duration-300 hover:-translate-y-1"
                      style={{ borderColor: C.line, background: C.card }}
                    >
                      <Sketch shape={w.shape} className="mx-auto h-auto w-full max-w-[150px]" />
                      <figcaption className="mt-4 text-[12px]" style={{ color: C.faint }}>
                        {w.week} · {w.who}
                      </figcaption>
                    </figure>
                  </Reveal>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------- программа ---------- */}
          <section id="program" className="scroll-mt-24 border-t" style={{ borderColor: C.lineSoft }}>
            <div className="mx-auto max-w-[1140px] px-5 py-16 sm:px-8 sm:py-20">
              <Reveal>
                <Label>{COPY.program.label}</Label>
                <Head>{COPY.program.title}</Head>
                <p className="m-0 mt-5 max-w-[52ch] text-[14.5px] leading-relaxed" style={{ color: C.muted }}>
                  {COPY.program.lead}
                </p>
              </Reveal>

              {/* Раскрывается одна неделя за раз: шесть развёрнутых карточек —
                  это простыня, которую не читают, а закрытый список без
                  подробностей не отвечает на «что я буду делать». */}
              <ul className="m-0 mt-10 list-none border-t p-0" style={{ borderColor: C.line }}>
                {WEEKS.map((w, i) => {
                  const on = i === week;
                  return (
                    <li key={w.n} className="border-b" style={{ borderColor: C.line }}>
                      <button
                        type="button"
                        onClick={() => setWeek(on ? -1 : i)}
                        aria-expanded={on}
                        className="flex w-full items-center gap-5 py-5 text-left"
                      >
                        <span className="text-[15px] tabular-nums" style={{ fontFamily: DISPLAY, color: on ? C.accent : C.faint }}>
                          {w.n}
                        </span>
                        <span className="flex-1 text-[clamp(17px,2vw,24px)] font-medium uppercase leading-tight" style={{ fontFamily: DISPLAY }}>
                          {w.title}
                        </span>
                        <span
                          className="shrink-0 text-[18px] leading-none transition-transform duration-300"
                          style={{ color: C.accent, transform: on ? 'rotate(45deg)' : 'none' }}
                          aria-hidden
                        >
                          +
                        </span>
                      </button>

                      {on && (
                        <div className="grid gap-4 pb-6 sm:grid-cols-[1fr_auto] sm:items-center" style={{ animation: 'ct-rise .35s ease both' }}>
                          <p className="m-0 max-w-[60ch] text-[14.5px] leading-relaxed" style={{ color: C.muted }}>
                            {w.text}
                          </p>
                          <span className="text-[12.5px]" style={{ color: C.faint }}>
                            На выходе: {w.work}
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* ---------- отзывы ---------- */}
          <section id="reviews" className="scroll-mt-24 border-t" style={{ borderColor: C.lineSoft, background: C.deep }}>
            <div className="mx-auto max-w-[1140px] px-5 py-16 sm:px-8 sm:py-20">
              <Reveal>
                <Label>{COPY.reviews.label}</Label>
                <Head>{COPY.reviews.title}</Head>
              </Reveal>

              <ul className="m-0 mt-10 grid list-none gap-3 p-0 sm:gap-4 lg:grid-cols-3">
                {REVIEWS.map((r, i) => (
                  <Reveal as="li" key={r.who} delay={i * 70}>
                    <figure className="m-0 flex h-full flex-col rounded-[12px] border p-6" style={{ borderColor: C.line, background: C.card }}>
                      <blockquote className="m-0 flex-1 text-[14.5px] leading-relaxed" style={{ color: C.ink }}>
                        {r.text}
                      </blockquote>
                      <figcaption className="mt-5 text-[12.5px]" style={{ color: C.faint }}>
                        <span style={{ color: C.ink }}>{r.who}</span> · {r.week}
                      </figcaption>
                    </figure>
                  </Reveal>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------- тарифы ---------- */}
          <section id="price" className="scroll-mt-24 border-t" style={{ borderColor: C.lineSoft }}>
            <div className="mx-auto max-w-[1140px] px-5 py-16 sm:px-8 sm:py-20">
              <Reveal>
                <Label>{COPY.price.label}</Label>
                <Head>{COPY.price.title}</Head>
                <p className="m-0 mt-5 text-[14.5px]" style={{ color: C.muted }}>
                  {COPY.price.lead}
                </p>
              </Reveal>

              <ul className="m-0 mt-10 grid list-none gap-3 p-0 sm:gap-4 lg:grid-cols-3">
                {TIERS.map((t, i) => (
                  <Reveal as="li" key={t.id} delay={i * 70}>
                    <div
                      className="flex h-full flex-col rounded-[14px] border p-6"
                      style={{ borderColor: t.best ? C.accent : C.line, background: t.best ? C.raise : C.card }}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[18px] font-medium uppercase" style={{ fontFamily: DISPLAY }}>
                          {t.name}
                        </span>
                        {t.best && (
                          <span className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ background: C.accent, color: C.onAccent }}>
                            Берут чаще
                          </span>
                        )}
                      </div>

                      <p className="m-0 mt-4 flex items-baseline gap-2.5">
                        <span className="text-[30px] leading-none tabular-nums" style={{ fontFamily: DISPLAY }}>
                          {money(t.price)}
                        </span>
                        {t.old && (
                          <span className="text-[14px] line-through" style={{ color: C.faint }}>
                            {money(t.old)}
                          </span>
                        )}
                      </p>

                      <p className="m-0 mt-3 text-[13.5px] leading-relaxed" style={{ color: C.muted }}>
                        {t.text}
                      </p>

                      <ul className="m-0 mt-5 flex flex-1 list-none flex-col gap-2 p-0">
                        {t.includes.map((x) => (
                          <li key={x} className="flex gap-2.5 text-[13.5px]" style={{ color: C.muted }}>
                            <span style={{ color: C.accent }} aria-hidden>
                              —
                            </span>
                            {x}
                          </li>
                        ))}
                      </ul>

                      {t.seats && (
                        <p className="m-0 mt-5 text-[12.5px]" style={{ color: C.accent }}>
                          Осталось {t.seats} {plural(t.seats, 'место', 'места', 'мест')}: разбирает автор лично
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => setTier(t)}
                        className="mt-6 w-full rounded-[10px] px-5 py-3 text-[14px] font-semibold transition-opacity duration-200 hover:opacity-90"
                        style={
                          t.best
                            ? { background: C.accent, color: C.onAccent }
                            : { background: 'transparent', color: C.ink, border: `1px solid ${C.line}` }
                        }
                      >
                        Записаться
                      </button>
                    </div>
                  </Reveal>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------- автор ---------- */}
          <section className="border-t" style={{ borderColor: C.lineSoft, background: C.deep }}>
            <div className="mx-auto grid max-w-[1140px] items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)] lg:gap-16">
              <Reveal>
                <div className="rounded-[14px] border p-8" style={{ borderColor: C.line, background: C.card }}>
                  <Sketch shape="profile" className="mx-auto h-auto w-full max-w-[200px]" />
                </div>
              </Reveal>
              <Reveal delay={80}>
                <Label>{COPY.author.label}</Label>
                <Head>{COPY.author.title}</Head>
                <p className="m-0 mt-3 text-[13px]" style={{ color: C.faint }}>
                  {COURSE.role}
                </p>
                <p className="m-0 mt-5 max-w-[54ch] text-[15px] leading-relaxed" style={{ color: C.muted }}>
                  {COPY.author.text}
                </p>
              </Reveal>
            </div>
          </section>

          {/* ---------- вопросы ---------- */}
          <section className="border-t" style={{ borderColor: C.lineSoft }}>
            <div className="mx-auto max-w-[1140px] px-5 py-16 sm:px-8 sm:py-20">
              <Reveal>
                <Label>{COPY.faq.label}</Label>
                <Head>{COPY.faq.title}</Head>
              </Reveal>
              <div className="mt-10 grid gap-x-12 gap-y-0 lg:grid-cols-2">
                {FAQ.map((f) => (
                  <div key={f.q} className="border-t py-5" style={{ borderColor: C.line }}>
                    <p className="m-0 text-[15px] font-medium">{f.q}</p>
                    <p className="m-0 mt-2.5 max-w-[52ch] text-[14px] leading-relaxed" style={{ color: C.muted }}>
                      {f.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- последний призыв ---------- */}
          <section className="border-t" style={{ borderColor: C.lineSoft, background: C.deep }}>
            <div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-8 px-5 py-14 sm:px-8 sm:py-16">
              <div>
                <p className="m-0 text-[clamp(24px,3.4vw,40px)] font-medium uppercase leading-tight" style={{ fontFamily: DISPLAY }}>
                  Старт {COURSE.start}
                </p>
                <p className="m-0 mt-3 text-[14px]" style={{ color: C.muted }}>
                  Поток идёт шесть недель, следующий — в декабре.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTier(TIERS[1])}
                className="rounded-[10px] px-7 py-4 text-[15px] font-semibold transition-opacity duration-300 hover:opacity-90"
                style={{ background: C.accent, color: C.onAccent }}
              >
                Записаться на поток
              </button>
            </div>
          </section>
        </main>

        <footer className="border-t" style={{ borderColor: C.lineSoft }}>
          <div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] sm:px-8" style={{ color: C.faint }}>
            <span style={{ fontFamily: DISPLAY, color: C.ink }}>{COURSE.author}</span>
            <span>{COURSE.tg}</span>
            <span>Оферта · Возврат в первые две недели</span>
          </div>
        </footer>

        {tier && <Enroll tier={tier} onClose={() => setTier(null)} />}
      </div>
    </DemoFrame>
  );
}
