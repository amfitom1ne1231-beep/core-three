'use client';

import Link from 'next/link';
import RevealText from './RevealText';
import ScrollScenes from './ScrollScenes';
import { DIRECTION_MATERIAL } from './Material';
import LiveLanding from './live/LiveLanding';
import { LIVE_BY_KEY } from './live/map';
import Includes from './service/Includes';
import Passport from './service/Passport';
import Process from './service/Process';
import Stage from './service/Stage';
import Words from './Words';
import type { ServicePage as Page } from '@/content/services';
import { SITE } from '@/content/site';
import Cta from './Cta';

/**
 * Страница направления. Четыре штуки на одном шаблоне: отличается
 * содержимое, а не вёрстка — иначе четыре страницы разъедутся уже
 * на второй правке.
 *
 * Чем отличается кадр направления: своя живая вставка на первом экране
 * (та же, что в карусели на главной) и своя фактура в главе состава.
 * Акцентный цвет при этом один на весь сайт — в брифе палитра описана
 * как монохром плюс один акцент, и четыре разных акцента превратили бы
 * студию в четыре студии.
 *
 * Ритм секций повторяет главную: кадр — устройство — линия времени —
 * разговор — вопросы — переход. Каждая секция владеет экраном, и ни одна
 * не повторяет плотность соседней; до этого страница шла шестью
 * одинаковыми сетками подряд и читалась документацией.
 */
export default function ServicePage({ page, children }: { page: Page; children?: React.ReactNode }) {
  const Live = LIVE_BY_KEY[page.live] ?? LiveLanding;
  const material = DIRECTION_MATERIAL[page.n] ?? 'silk';
  /**
   * Задача кадра ищется по самой вставке, а не по номеру направления:
   * в карусели на главной та же вставка подписана той же строкой, и
   * связь должна держаться за то, что человек видит, — за кадр.
   */
  const task = SITE.services.find((s) => s.live === page.live)?.task;

  return (
    <>
      <main id="content" className="relative z-10 w-full">
        {/* ---------- первый экран ---------- */}
        <section data-chapter="hero" className="relative overflow-x-clip" aria-label="Начало">
          {/* номер направления как якорь сцены: тот же приём, что у гигантских
              чисел в карусели на главной — по нему видно, где ты в атласе */}
          <span
            className="pointer-events-none absolute -left-[0.06em] bottom-[-0.18em] hidden font-mono text-[clamp(200px,26vw,420px)] leading-none tracking-[-0.05em] text-fg/[0.045] lg:block tp:hidden"
            aria-hidden
          >
            {page.n}
          </span>

          <div className="relative grid items-center gap-[clamp(32px,6vh,64px)] px-4 pb-[clamp(56px,10vh,120px)] pt-[clamp(120px,19vh,200px)] sm:px-8 lg:min-h-[100svh] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-[clamp(40px,5vw,88px)] lg:px-[72px] tp:min-h-0 tp:grid-cols-1 tp:gap-11 tp:pt-[136px]">
            <div data-hero>
              {/* номер тот же, что в атласе: страница — продолжение карусели */}
              <span className="rail-label">
                <b>{page.n}</b> / {page.group}
              </span>
              <h1
                className="display m-0 mt-6 text-[clamp(32px,4.8vw,80px)] tp:mt-5 tp:text-[min(8vw,80px)]"
                aria-label={`${page.title} ${page.titleAccent}`}
              >
                <RevealText text={page.title} as="span" className="block" decorative />
                <RevealText
                  text={page.titleAccent}
                  as="span"
                  className="title-accent block"
                  delay={0.12}
                  decorative
                />
              </h1>
              <p className="m-0 mt-8 max-w-[46ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim tp:max-w-[50ch] tp:text-[17px]">
                <Words text={page.lead} />
              </p>
              <div className="mt-9 flex flex-wrap gap-3.5">
                <Cta href={`/contact?type=${page.kind}`}>Обсудить проект</Cta>
                <Cta href="/concepts" tone="ghost">
                  Посмотреть демо
                </Cta>
              </div>

              <div className="scroll-cue mt-[clamp(28px,5vh,56px)] hidden lg:block tp:hidden" aria-hidden />
            </div>

            {/* кадр направления: живая вставка во всю правую половину */}
            <Stage live={Live} task={task} />
          </div>
        </section>

        {/* ---------- состав работы ---------- */}
        <Includes items={page.includes} material={material} group={page.group} slug={page.slug} />

        {/* слот под то, что есть не у каждого направления: у ботов здесь
            живая проба сценария, остальные страницы идут дальше */}
        {children}

        {/* ---------- как идёт работа ---------- */}
        <Process steps={page.steps} />

        {/* ---------- кому это, стек, сроки ---------- */}
        <Passport page={page} />

        {/* ---------- вопросы ---------- */}
        {/* Главы материала стоят и на вопросах, и на переходе к соседям:
            без `data-chapter` эти секции попадали в смесь соседних глав,
            и под ними работал яркий финал — белый текст ложился на
            светлое серебро материала. */}
        <section data-chapter="atlas" className="relative z-10 w-full border-t border-line" aria-label="Вопросы">
          <div className="grid gap-[clamp(28px,5vh,56px)] px-4 section-y sm:px-8 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)] lg:gap-[clamp(40px,5vw,96px)] lg:px-[72px]">
            <div>
              <span className="rail-label">Вопросы</span>
              <h2 className="display m-0 mt-4 text-[clamp(26px,3.6vw,52px)]">
                Спрашивают <span className="title-accent">чаще всего</span>
              </h2>
            </div>
            <div>
              {page.faq.map((f) => (
                <details key={f.q} className="group border-t border-line last:border-b">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-[clamp(18px,2.6vh,28px)] text-[clamp(16px,1.4vw,20px)] font-medium leading-snug transition-colors duration-300 marker:content-none hover:text-accent">
                    {f.q}
                    <span
                      className="mt-1.5 shrink-0 font-mono text-[15px] leading-none text-accent transition-transform duration-300 group-open:rotate-45"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <p className="m-0 max-w-[58ch] pb-[clamp(18px,2.6vh,28px)] text-[14.5px] leading-relaxed text-dim">
                    <Words text={f.a} />
                  </p>
                </details>
              ))}

              {/* вопрос, которого нет в списке, — тоже повод написать */}
              <p className="m-0 mt-8 text-[14px] leading-relaxed text-dim">
                Не нашли своего вопроса?{' '}
                <Link
                  href={`/contact?type=${page.kind}`}
                  className="text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-accent"
                >
                  Спросите напрямую
                </Link>{' '}
                — отвечаем в течение дня.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* сцены на скролле: первый экран уходит вглубь, кадры раскрываются
          из рамки, покидаемые секции отступают — то же, что на главной */}
      <ScrollScenes />
    </>
  );
}
