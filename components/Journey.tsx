'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

type Station = (typeof SITE.journey.stations)[number];

/** Сколько держится станция, пока путь проигрывается сам. */
const STEP_MS = 4200;

/** Значки станций: штрих в сетке 24×24, наследуют цвет состояния. */
function Icon({ id }: { id: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (id) {
    case 'site':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="4.5" width="18" height="13" rx="2" />
          <path d="M3 8.5h18M6 6.5h.01M8.5 6.5h.01M9 20h6" />
        </svg>
      );
    case 'catalog':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <path d="M14 17h6M17 14v6" />
        </svg>
      );
    case 'bot':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 17H10l-4.5 3.5V17H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5Z" />
          <path d="M8 11.3h.01M12 11.3h.01M16 11.3h.01" strokeWidth="2.2" />
        </svg>
      );
    case 'money':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
          <path d="M2.5 9.5h19M6 14.5h4M14.5 14.5l1.5 1.5 3-3" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.1 7.5 9.5 4.4-1.4 7.5-5.1 7.5-9.5V6Z" />
          <path d="M8 12h2l1.3-2.5 2 5L14.5 12H16" />
        </svg>
      );
  }
}

/**
 * Путь одного заказа — схема, которую понимает не только разработчик.
 *
 * Прежняя «анатомия» была честной, но на чужом языке: фронт, API, CMS,
 * событие. Основатель смотрел на пять рамок и не видел в них себя.
 * Теперь схема рассказывает историю одного заказа: клиентка находит
 * сайт, выбирает в каталоге, оформляет в боте, платит — жетон её заказа
 * едет по линии, — а мониторинг полосой сверху стережёт всю цепочку.
 * На каждой станции простыми словами: что это даёт клиенту, что даёт
 * вам и какое наше направление это собирает. Технические слова остались
 * мелкой строкой — для тех, кто их ищет.
 *
 * Станции сменяются сами, пока схема на экране, и замирают от первого
 * наведения или клика; пауза — той же кнопкой, что в карусели.
 */
export default function Journey() {
  const section = useRef<HTMLElement>(null);
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const [inView, setInView] = useState(false);

  const { label, title, titleAccent, lead, order, stations } = SITE.journey;
  const track = stations.slice(0, 4);
  const watch = stations[4];
  const active: Station = stations[at];
  const guarding = at === 4;

  // автосмена — только на экране и пока схему не начали рассматривать
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 70%',
      end: 'bottom 30%',
      onToggle: (self) => setInView(self.isActive)
    });
    return () => st.kill();
  }, []);

  useEffect(() => {
    if (!inView || held) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setAt((v) => (v + 1) % stations.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [inView, held, stations.length]);

  // вход: станции встают по ходу заказа, линия протягивается за ними
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const once = { trigger: el.querySelector('[data-stage]'), start: 'top 80%', once: true } as const;
        gsap.from('[data-st]', { opacity: 0, y: 16, duration: 0.6, ease: 'power3.out', stagger: 0.1, scrollTrigger: once });
        gsap.from('[data-rail]', { scaleX: 0, duration: 1.1, ease: 'power3.inOut', scrollTrigger: once });
        gsap.from('[data-watch]', { opacity: 0, y: -10, duration: 0.7, ease: 'power3.out', delay: 0.5, scrollTrigger: once });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  const pick = (i: number) => {
    setAt(i);
    setHeld(true);
  };

  // жетон стоит над станцией; на охране — уезжает в конец линии
  const tokenLeft = guarding ? 100 : (at / (track.length - 1)) * 100;

  return (
    <section ref={section} data-chapter="anatomy" className="relative z-10 w-full" aria-label="Как это устроено">
      <div data-recede className="flex flex-col gap-[clamp(28px,5vh,56px)] px-4 section-y sm:px-8 lg:px-[72px]">
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-end">
          <div>
            <div className="flex items-center justify-between gap-4">
              <span className="rail-label">{label}</span>
              <button
                type="button"
                onClick={() => setHeld((v) => !v)}
                aria-label={held ? 'Продолжить показ' : 'Остановить показ'}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-fg transition-colors duration-300 hover:border-accent hover:text-accent lg:hidden"
              >
                <PauseIcon held={held} />
              </button>
            </div>
            <h2 data-skew className="display m-0 mt-4 text-[clamp(30px,5vw,80px)]">
              {title} <span className="title-accent">{titleAccent}</span>
            </h2>
          </div>
          <div className="flex items-end justify-between gap-6">
            <p className="m-0 max-w-[40ch] text-[clamp(14px,1.1vw,16px)] leading-relaxed text-dim">{lead}</p>
            <button
              type="button"
              onClick={() => setHeld((v) => !v)}
              aria-label={held ? 'Продолжить показ' : 'Остановить показ'}
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-fg transition-colors duration-300 hover:border-accent hover:text-accent lg:flex"
            >
              <PauseIcon held={held} />
            </button>
          </div>
        </div>

        {/* ---------------- схема ---------------- */}
        <div
          data-stage
          className="journey relative overflow-hidden rounded-[22px] border border-line bg-elev"
          onMouseEnter={() => setHeld(true)}
        >
          <div className="journey-grid pointer-events-none absolute inset-0" aria-hidden />

          {/* охрана: полоса мониторинга над всей цепочкой */}
          <button
            type="button"
            data-watch
            onClick={() => pick(4)}
            aria-pressed={guarding}
            className="journey-watch relative mx-[clamp(16px,3vw,44px)] mt-[clamp(18px,3vw,32px)] flex w-[calc(100%-2*clamp(16px,3vw,44px))] items-center gap-4 rounded-[14px] px-4 py-3 text-left"
          >
            <span className="journey-icon h-10 w-10 shrink-0">
              <Icon id="watch" />
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] tracking-rail text-faint">{watch.n}</span>
                <span className="text-[15px] font-medium">{watch.name}</span>
                <span className="hidden text-[13px] text-dim sm:inline">· {watch.role}</span>
              </span>
              <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-rail text-faint">{watch.event}</span>
            </span>
            {/* пульс проверок бежит по всей ширине — над каждой станцией */}
            <span className="journey-pulse ml-auto hidden h-6 flex-1 md:block" aria-hidden>
              <svg viewBox="0 0 400 24" preserveAspectRatio="none" className="h-full w-full">
                <path
                  d="M0 12 H70 l6 -8 6 16 6 -8 H170 l6 -8 6 16 6 -8 H270 l6 -8 6 16 6 -8 H400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  vectorEffect="non-scaling-stroke"
                  pathLength={1}
                />
              </svg>
            </span>
          </button>

          {/* линия пути с жетоном заказа */}
          <div className="relative mx-[clamp(16px,3vw,44px)] mt-[clamp(28px,4vw,48px)] hidden lg:block">
            <div className="relative mx-[12.5%] h-10">
              <i data-rail className="absolute left-0 right-0 top-1/2 block h-px origin-left bg-line-strong" aria-hidden />
              <i
                className="absolute left-0 top-1/2 block h-px origin-left bg-accent transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ right: 0, transform: `scaleX(${tokenLeft / 100})` }}
                aria-hidden
              />
              <span
                className="journey-token absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ left: `${tokenLeft}%` }}
                aria-hidden
              >
                <b className="journey-ava">{order.who[0]}</b>
                <span className="whitespace-nowrap">
                  {order.who} · {order.id}
                </span>
                <span className="text-dim">{guarding ? 'под присмотром' : order.sum}</span>
              </span>
            </div>
          </div>

          {/* станции */}
          <ol className="relative m-0 grid list-none gap-2.5 p-[clamp(16px,3vw,44px)] pt-5 lg:grid-cols-4 lg:gap-4">
            {track.map((s, i) => {
              const on = at === i;
              const passed = !guarding && i < at;
              return (
                <li key={s.id} data-st>
                  <button
                    type="button"
                    onClick={() => pick(i)}
                    aria-pressed={on}
                    data-passed={passed || guarding || undefined}
                    className="journey-station w-full text-left"
                  >
                    {/* на узком экране станция — строка: иначе пояснения под
                        четырьмя высокими карточками уезжали за экран */}
                    <span className="flex items-center gap-4 lg:justify-between">
                      <span className="journey-icon h-11 w-11 shrink-0">
                        <Icon id={s.id} />
                      </span>
                      <span className="min-w-0 flex-1 lg:hidden">
                        <span className="block text-[17px] font-medium leading-tight">{s.name}</span>
                        <span className="block text-[12.5px] text-dim">{s.role}</span>
                      </span>
                      <span className="font-mono text-[10px] tracking-rail text-faint">{s.n}</span>
                    </span>
                    <span className="mt-5 hidden text-[clamp(18px,1.5vw,22px)] font-medium leading-tight lg:block">{s.name}</span>
                    <span className="mt-0.5 hidden text-[13px] text-dim lg:block">{s.role}</span>
                    <span className="journey-event mt-4 hidden font-mono text-[10px] uppercase leading-relaxed tracking-rail lg:block">
                      {s.event}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* что это даёт — простыми словами */}
          <div
            key={active.id}
            className="journey-detail relative grid gap-6 border-t border-line p-[clamp(16px,3vw,44px)] md:grid-cols-[1fr_1fr_minmax(0,0.8fr)]"
            aria-live="polite"
          >
            <div>
              <span className="rail-label">Клиенту</span>
              <p className="m-0 mt-2.5 text-[clamp(14px,1.1vw,16px)] leading-relaxed">{active.client}</p>
            </div>
            <div>
              <span className="rail-label">Вам</span>
              <p className="m-0 mt-2.5 text-[clamp(14px,1.1vw,16px)] leading-relaxed">{active.you}</p>
            </div>
            <div className="flex flex-col justify-between gap-4">
              <div>
                <span className="rail-label">Собираем</span>
                <Link
                  href={active.service.href}
                  className="group mt-2.5 flex items-center gap-2 text-[clamp(15px,1.2vw,18px)] font-medium text-fg transition-colors duration-300 hover:text-accent"
                >
                  {active.service.label}
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
              <span className="font-mono text-[10px] uppercase leading-relaxed tracking-rail text-faint">{active.tech}</span>
            </div>
            {/* таймер станции: видно, что она сменится сама */}
            <i
              className="absolute left-0 top-0 block h-px origin-left bg-accent"
              style={{
                width: '100%',
                transform: 'scaleX(0)',
                animation: held || !inView ? 'none' : `journey-timer ${STEP_MS}ms linear both`
              }}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PauseIcon({ held }: { held: boolean }) {
  return held ? (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <rect x="2" y="1.5" width="2.6" height="9" fill="currentColor" />
      <rect x="7.4" y="1.5" width="2.6" height="9" fill="currentColor" />
    </svg>
  );
}
