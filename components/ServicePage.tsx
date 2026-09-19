'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import gsap from 'gsap';
import RevealText from './RevealText';
import { LIVE_W, LIVE_H, type LiveProps } from './live/kit';
import LiveBlog from './live/LiveBlog';
import LiveBot from './live/LiveBot';
import LiveLanding from './live/LiveLanding';
import LiveOps from './live/LiveOps';
import LiveShop from './live/LiveShop';
import LiveWebApp from './live/LiveWebApp';
import type { ServicePage as Page } from '@/content/services';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

/** Те же вставки, что играют в карусели атласа: направление узнаётся по кадру. */
const LIVE: Record<string, ComponentType<LiveProps>> = {
  landing: LiveLanding,
  blog: LiveBlog,
  shop: LiveShop,
  bot: LiveBot,
  webapp: LiveWebApp,
  ops: LiveOps
};

/**
 * Страница направления. Четыре штуки на одном шаблоне: отличается контент,
 * а не вёрстка — иначе четыре страницы разъедутся уже на второй правке.
 *
 * Медиа-анкор здесь — живая вставка из атласа, а не картинка: тот же кадр,
 * который человек уже видел в карусели на главной. Играет только пока
 * секция на экране.
 */
export default function ServicePage({ page, children }: { page: Page; children?: React.ReactNode }) {
  const Live = LIVE[page.live] ?? LiveLanding;
  const stage = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  // масштаб вставки: она нарисована в макетных координатах LIVE_W×LIVE_H
  useEffect(() => {
    const el = stage.current;
    if (!el) return;

    const measure = () => {
      el.style.setProperty('--live-k', (el.clientWidth / LIVE_W).toFixed(4));
      el.style.height = `${(el.clientWidth / LIVE_W) * LIVE_H}px`;
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // вставка крутится только на экране — за кадром она просто жжёт батарею
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <main id="content" className="relative z-10 w-full">
      {/* ---------- первый экран ---------- */}
      <section data-chapter="hero" className="relative overflow-hidden">
        <div className="grid items-center gap-[clamp(32px,6vh,64px)] px-4 pb-[10vh] pt-[clamp(120px,19vh,200px)] sm:px-8 lg:grid-cols-[1fr_minmax(0,1.05fr)] lg:gap-[clamp(40px,5vw,88px)] lg:px-[72px]">
          <div>
            {/* номер тот же, что в атласе: страница — продолжение карусели */}
            <span className="rail-label">
              <b>{page.n}</b> / {page.group}
            </span>
            <h1
              className="display m-0 mt-6 text-[clamp(36px,5.6vw,92px)]"
              aria-label={`${page.title} ${page.titleAccent}`}
            >
              <RevealText text={page.title} as="span" className="block" decorative />
              <RevealText
                text={page.titleAccent}
                as="span"
                className="accent-serif block"
                delay={0.12}
                decorative
              />
            </h1>
            <p className="m-0 mt-8 max-w-[46ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">
              {page.lead}
            </p>
            <div className="mt-9 flex flex-wrap gap-3.5">
              <Link
                data-magnetic
                href={`/contact?type=${page.kind}`}
                className="border border-fg bg-fg px-[22px] py-[13px] font-mono text-[11px] uppercase tracking-label text-bg transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-white"
              >
                Обсудить проект
              </Link>
              <Link
                href="/#directions"
                className="border border-line px-[22px] py-[13px] font-mono text-[11px] uppercase tracking-label text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
              >
                Другие направления
              </Link>
            </div>
          </div>

          {/* медиа-анкор: та же вставка, что в карусели на главной */}
          <div
            ref={stage}
            data-cursor="ring"
            className="relative w-full overflow-hidden rounded-[10px] border border-line bg-elev"
          >
            <Live playing={live} />
          </div>
        </div>
      </section>

      {/* ---------- что входит ---------- */}
      <section data-chapter="anatomy" className="relative border-t border-line">
        <div className="px-4 py-[12vh] sm:px-8 lg:px-[72px]">
          <span className="rail-label">Состав работы</span>
          <h2 className="display m-0 mt-4 max-w-[18ch] text-[clamp(26px,4.2vw,64px)]">
            Что входит <span className="accent-serif">в запуск</span>
          </h2>
          <ul className="m-0 mt-[clamp(28px,5vh,56px)] grid list-none gap-px border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-3">
            {page.includes.map((it) => (
              <li key={it.title} className="bg-bg p-[clamp(18px,2vw,30px)]">
                <h3 className="m-0 text-[clamp(16px,1.3vw,19px)] font-medium leading-snug">{it.title}</h3>
                <p className="m-0 mt-2.5 text-[13.5px] leading-relaxed text-dim">{it.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* слот под то, что есть не у каждого направления: у ботов здесь
          живая проба сценария, остальные страницы идут дальше */}
      {children}

      {/* ---------- как идёт работа ---------- */}
      <section data-chapter="atlas" className="relative border-t border-line">
        <div className="grid gap-[clamp(32px,6vh,64px)] px-4 py-[12vh] sm:px-8 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)] lg:gap-[clamp(40px,5vw,96px)] lg:px-[72px]">
          <div>
            <span className="rail-label">Как идёт работа</span>
            <h2 className="display m-0 mt-4 text-[clamp(26px,3.6vw,52px)]">
              Четыре шага, <span className="accent-serif">без сюрпризов</span>
            </h2>
          </div>
          <ol className="m-0 list-none p-0">
            {page.steps.map((s) => (
              <li key={s.n} className="grid grid-cols-[3.25rem_1fr] gap-x-2 border-t border-line py-6 last:border-b">
                <span className="font-mono text-[11px] tracking-rail text-accent">{s.n}</span>
                <div>
                  <h3 className="m-0 text-[clamp(17px,1.5vw,22px)] font-medium leading-snug">{s.title}</h3>
                  <p className="m-0 mt-2 max-w-[52ch] text-[14px] leading-relaxed text-dim">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- кому это, стек, сроки ---------- */}
      <section data-chapter="concepts" className="relative border-t border-line">
        <div className="grid gap-[clamp(36px,6vh,72px)] px-4 py-[12vh] sm:px-8 lg:grid-cols-2 lg:gap-[clamp(40px,5vw,96px)] lg:px-[72px]">
          <div>
            <span className="rail-label">{page.audience.label}</span>
            <h2 className="display m-0 mt-4 text-[clamp(26px,3.6vw,52px)]">{page.audience.title}</h2>
            <ul className="m-0 mt-8 flex list-none flex-col gap-4 p-0">
              {page.audience.items.map((it) => (
                <li key={it} className="flex gap-3 text-[14.5px] leading-relaxed text-dim">
                  <span className="mt-2 h-px w-4 shrink-0 bg-accent" aria-hidden />
                  {it}
                </li>
              ))}
            </ul>
          </div>

          <div className="self-start border border-line bg-bg/55 p-[clamp(20px,2.4vw,36px)] backdrop-blur-md">
            <span className="rail-label">Стек</span>
            <ul className="m-0 mt-4 flex list-none flex-wrap gap-1.5 p-0">
              {page.stack.map((t) => (
                <li
                  key={t}
                  className="border border-line px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-rail text-faint"
                >
                  {t}
                </li>
              ))}
            </ul>
            <dl className="m-0 mt-8">
              {page.terms.map((t) => (
                <div key={t.label} className="border-t border-line py-4">
                  <dt className="rail-label">{t.label}</dt>
                  <dd className="m-0 mt-2 text-[14px] leading-relaxed text-dim">{t.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ---------- вопросы ---------- */}
      <section className="relative border-t border-line">
        <div className="grid gap-[clamp(28px,5vh,56px)] px-4 py-[12vh] sm:px-8 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)] lg:gap-[clamp(40px,5vw,96px)] lg:px-[72px]">
          <div>
            <span className="rail-label">Вопросы</span>
            <h2 className="display m-0 mt-4 text-[clamp(26px,3.6vw,52px)]">
              Спрашивают <span className="accent-serif">чаще всего</span>
            </h2>
          </div>
          <div>
            {page.faq.map((f) => (
              <details key={f.q} className="group border-t border-line last:border-b">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-[clamp(16px,1.4vw,20px)] font-medium leading-snug marker:content-none">
                  {f.q}
                  <span
                    className="mt-1.5 shrink-0 font-mono text-[15px] leading-none text-accent transition-transform duration-300 group-open:rotate-45"
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="m-0 max-w-[58ch] pb-6 text-[14px] leading-relaxed text-dim">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- соседние направления ---------- */}
      <section className="relative border-t border-line">
        <div className="px-4 py-[10vh] sm:px-8 lg:px-[72px]">
          <span className="rail-label">Соседние направления</span>
          <ul className="m-0 mt-6 grid list-none gap-px border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-3">
            {SITE.services
              .filter((s) => s.href !== `/${page.slug}`)
              .map((s) => (
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
            {/* шестая ячейка: без неё в сетке на три колонки светится дырка
                цветом разделителя — направлений пять, а мест шесть */}
            <li className="bg-bg">
              <Link
                href="/#directions"
                className="flex h-full items-baseline gap-4 p-[clamp(16px,1.8vw,26px)] text-dim transition-colors duration-300 hover:bg-elev hover:text-fg"
              >
                <span className="font-mono text-[11px] tracking-rail text-faint">—</span>
                <span className="text-[clamp(15px,1.2vw,18px)] font-medium">
                  Все направления <span aria-hidden>→</span>
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
