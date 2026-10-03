'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import OrderScheme from '@/components/scheme/OrderScheme';
import OrderScreens from '@/components/scheme/OrderScreens';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

/** Сколько держится кадр, пока путь проигрывается сам. */
const STEP_MS = 6000;

/**
 * Путь одного заказа — схема-презентация: пять станций и пролёты между ними.
 *
 * Прежняя схема показывала всё сразу — пять станций на одном плане —
 * и на вопрос «что тут происходит и куда оно идёт» не отвечала. Теперь
 * на каждый вопрос свой слой:
 *
 *  - «куда» — линия пути над кадром: поиск → сайт → каталог → бот →
 *    оплата → деньги, слева направо, со стрелками и жетоном заказа;
 *    мониторинг — скоба под всей цепочкой. Она же переключает кадры;
 *  - «что» — кадр: крупный план станции из Blender и живой экран
 *    того, что в эту секунду видит клиентка, одной фразой подписано;
 *  - «зачем» — строка под кадром: что это даёт вам и какое наше
 *    направление это собирает.
 *
 * Кадры сменяются сами, пока схема на экране; пауза и стрелки —
 * в шапке. Между станциями камера плывёт над плитой (OrderScheme):
 * `at` — куда идёт показ, по нему сразу едет жетон на линии пути;
 * `shown` — где камера уже стоит, по нему живут подпись, экран и строка
 * под кадром. Пока они расходятся, кадр чистый и часы показа стоят.
 *
 * Под курсором показ не замирает: кадр занимает пол-экрана, курсор
 * почти всегда над ним, и схема стояла бы на первом шаге. Часы показа —
 * CSS-анимация полоски времени: её конец и есть уход камеры к следующей
 * станции, а пауза замораживает вместе с ней свет в кадре (`--os-play`).
 */
export default function Journey() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState(0);
  const [held, setHeld] = useState(false);
  const [inView, setInView] = useState(false);
  // кадры грузятся, когда схема подошла к экрану, а не вместе со страницей
  const [near, setNear] = useState(false);

  const { label, title, titleAccent, lead, order, route, stations } = SITE.journey;
  const track = stations.slice(0, 4);
  const watch = stations[4];
  const active = stations[shown];
  const guarding = at === 4;
  const flying = at !== shown;
  const running = inView && !held && !flying;
  const arrive = useCallback((id: string) => setShown(stations.findIndex((s) => s.id === id)), [stations]);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    // показ идёт, пока на экране сам кадр, а не только заголовок секции:
    // иначе первый шаг отыграл бы, пока до него ещё листают
    const show = ScrollTrigger.create({
      trigger: stage.current,
      start: 'top 80%',
      end: 'bottom 20%',
      onToggle: (self) => setInView(self.isActive)
    });
    const load = ScrollTrigger.create({ trigger: el, start: 'top bottom+=900', once: true, onEnter: () => setNear(true) });
    return () => {
      show.kill();
      load.kill();
    };
  }, []);

  const step = useCallback((by: number) => setAt((v) => (v + by + stations.length) % stations.length), [stations.length]);

  // стрелки листают кадры, пока фокус на линии пути или на управлении
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
  };

  // доля линии, пройденная заказом: узлов шесть — поиск, четыре станции, деньги
  const passed = guarding ? 1 : (at + 1) / 5;

  const round =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-fg transition-colors duration-300 hover:border-accent hover:text-accent';

  return (
    <section ref={section} data-chapter="anatomy" className="relative z-10 w-full" aria-label="Как это устроено">
      <div data-recede className="flex flex-col gap-[clamp(22px,3.6vh,40px)] px-4 section-y sm:px-8 lg:px-[72px]">
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,460px)] lg:items-end">
          <div>
            <span className="rail-label">{label}</span>
            <h2 data-skew className="display m-0 mt-4 text-[clamp(30px,5vw,80px)]">
              {title} <span className="title-accent">{titleAccent}</span>
            </h2>
          </div>
          <div className="flex items-end justify-between gap-6">
            <p className="m-0 max-w-[40ch] text-[clamp(14px,1.1vw,16px)] leading-relaxed text-dim">{lead}</p>
            <div className="flex gap-2" onKeyDown={onKey}>
              <button type="button" onClick={() => step(-1)} aria-label="Предыдущий кадр" className={`${round} max-sm:hidden`}>
                <Arrow back />
              </button>
              <button type="button" onClick={() => setHeld((v) => !v)} aria-label={held ? 'Продолжить показ' : 'Остановить показ'} className={round}>
                <PauseIcon held={held} />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Следующий кадр" className={`${round} max-sm:hidden`}>
                <Arrow />
              </button>
            </div>
          </div>
        </div>

        {/* ---------------- линия пути ---------------- */}
        <div className="route" role="group" aria-label="Путь заказа: шаги" onKeyDown={onKey}>
          <span className="route-token" style={{ '--at': passed } as CSSProperties} aria-hidden>
            <b className="route-ava">{order.who[0]}</b>
            <span className="max-sm:hidden">{order.who} ·</span> {order.id}
            <span className="text-dim max-sm:hidden">{guarding ? 'под присмотром' : order.sum}</span>
          </span>

          <div className="route-rail" aria-hidden>
            <i className="route-fill" style={{ transform: `scaleX(${passed})` }} />
            {[0, 1, 2, 3, 4].map((i) => (
              <svg key={i} viewBox="0 0 8 10" className="route-arrow" data-passed={i / 5 < passed || undefined} style={{ left: `${(i + 0.5) * 20}%` }}>
                <path d="M1.5 1 6 5 1.5 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ))}
          </div>

          <ol className="m-0 grid list-none grid-cols-6 p-0">
            <li className="route-end" data-passed>
              <i className="route-dot" aria-hidden />
              <span>{route.from}</span>
            </li>
            {track.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setAt(i)}
                  aria-pressed={at === i}
                  data-passed={guarding || i < at || undefined}
                  className="route-node"
                >
                  <i className="route-dot" aria-hidden />
                  <span className="route-name">
                    <b className="max-sm:hidden">{s.n}</b>
                    <span className="sm:hidden">{s.short}</span>
                    <span className="max-sm:hidden">{s.name}</span>
                  </span>
                </button>
              </li>
            ))}
            <li className="route-end" data-passed={guarding || undefined}>
              <i className="route-dot" aria-hidden />
              <span>
                {route.to}
                <span className="max-sm:hidden"> {route.toTail}</span>
              </span>
            </li>
          </ol>

          {/* мониторинг — не станция на пути, а скоба под всей цепочкой */}
          <button type="button" onClick={() => setAt(4)} aria-pressed={guarding} className="route-guard">
            <span>
              <b>{watch.n}</b> {watch.name} <span className="text-dim">— {route.guard}</span>
            </span>
          </button>
        </div>

        {/* ---------------- кадр ---------------- */}
        <div
          ref={stage}
          className="journey-stage"
          data-flying={flying || undefined}
          style={
            {
              '--os-step': `${STEP_MS}ms`,
              // часы показа стоят на паузе и за экраном; свет в кадре — только за экраном:
              // на паузе кадр, открытый вручную, всё равно должен загореться
              '--os-play': running ? 'running' : 'paused',
              '--os-live': inView ? 'running' : 'paused'
            } as CSSProperties
          }
        >
          <OrderScheme id={stations[at].id} ready={near} onArrive={arrive} className="journey-shot" />
          <div className="journey-scrim" aria-hidden />

          <span className="journey-kicker rail-label">
            Кадр <b>{active.n}</b> / {watch.n}
          </span>

          {/* пока показ идёт сам, читалке каждые семь секунд его не объявляем */}
          <div key={active.id} className="journey-caption" aria-live={running ? 'off' : 'polite'}>
            <span className="rail-label">
              <b>{active.name}</b> · {active.role}
            </span>
            <p className="display m-0 mt-3 text-[clamp(24px,2.7vw,40px)] leading-[1.04]">{active.headline}</p>
            {/* экран в кадре — картинка; читалке тот же шаг словами */}
            <p className="sr-only">{active.client}</p>
          </div>

          <figure className="journey-screen m-0">
            {/* экран меняется в начале пролёта, пока его не видно, а играет с прилёта */}
            <OrderScreens id={stations[at].id} playing={inView && !flying} />
            <figcaption className="rail-label mt-3 text-center">{active.screen}</figcaption>
          </figure>

          {/* часы показа: полоска дошла до края — камера уходит к следующей станции */}
          {!flying && <i key={shown} className="journey-timer" onAnimationEnd={() => step(1)} aria-hidden />}
        </div>

        {/* ---------------- что это даёт ---------------- */}
        <div key={active.id} className="journey-detail grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-[clamp(32px,6vw,96px)]">
          <div>
            <span className="rail-label">Вам</span>
            <p className="m-0 mt-2.5 max-w-[52ch] text-[clamp(15px,1.25vw,18px)] leading-relaxed">{active.you}</p>
          </div>
          <div>
            <span className="rail-label">Собираем</span>
            <Link
              href={active.service.href}
              className="group mt-2.5 flex w-fit items-center gap-2 text-[clamp(15px,1.25vw,18px)] font-medium text-fg transition-colors duration-300 hover:text-accent"
            >
              {active.service.label}
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <span className="mt-3 block font-mono text-[10px] uppercase leading-relaxed tracking-rail text-faint">{active.tech}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 ${back ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
