'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import gsap from 'gsap';
import Material from '../Material';

gsap.registerPlugin(ScrollTrigger);

/** Шаг сам сменится через столько — как в схеме на главной. */
const STEP_MS = 4400;

export type IncludeItem = { title: string; text: string };

/**
 * Состав работы.
 *
 * Было шесть одинаковых карточек в сетке — та самая «документация»,
 * из-за которой середина главной когда-то проигрывала первому экрану.
 * Стало устройство: слева перечень, справа панель с материалом
 * направления, и шаги проигрываются сами, пока секция на экране.
 * Приём не новый — ровно так устроена схема анатомии, и это хорошо:
 * человек, доехавший сюда с главной, уже знает, как этим пользоваться.
 *
 * Глава `anatomy` гасит шейдер завесой в единицу, поэтому фактура здесь
 * своя, на SVG-фильтре: у каждого направления свой пресет материала —
 * четыре страницы отличаются на ощупь, а не только текстом.
 */
export default function Includes({
  items,
  material,
  group,
  slug
}: {
  items: IncludeItem[];
  material: string;
  group: string;
  slug: string;
}) {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  /** Первое прикосновение останавливает прокрутку насовсем: начали читать — не торопим. */
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 70%',
      end: 'bottom 30%',
      onToggle: (self) => setInView(self.isActive)
    });
    return () => trigger.kill();
  }, []);

  useEffect(() => {
    if (!inView || held) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // На узком экране панель стоит над списком, и сама по себе
    // раскрывающаяся строка читается сбоем, а не подсказкой: там перечень
    // листает только палец.
    if (!matchMedia('(min-width: 1024px)').matches) return;
    const id = window.setInterval(() => setActive((p) => (p + 1) % items.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [inView, held, items.length]);

  const go = (i: number) => {
    setHeld(true);
    setActive((i + items.length) % items.length);
  };

  const it = items[active];
  const nn = String(active + 1).padStart(2, '0');

  return (
    <section
      ref={section}
      data-chapter="anatomy"
      className="relative z-10 w-full border-t border-line"
      aria-label="Состав работы"
    >
      <div data-recede className="px-4 section-y sm:px-8 lg:px-[72px]">
        <span className="rail-label">Состав работы</span>
        <div className="mt-4 grid gap-[clamp(16px,3vh,32px)] lg:grid-cols-[1.7fr_1fr] lg:items-end">
          <h2 className="display m-0 text-[clamp(26px,4.2vw,64px)]">
            Что входит <span className="title-accent">в запуск</span>
          </h2>
          <p className="m-0 max-w-[40ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
            Шесть частей, из которых собирается работа. Любую можно рассмотреть отдельно.
          </p>
        </div>

        <div className="mt-[clamp(28px,5vh,60px)] grid gap-[clamp(20px,3vh,40px)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:gap-[clamp(32px,4vw,72px)]">
          {/* ---------- перечень ---------- */}
          <ol
            role="tablist"
            aria-label="Части работы"
            aria-orientation="vertical"
            className="m-0 flex list-none flex-col p-0"
            onMouseEnter={() => setHeld(true)}
            onKeyDown={(e) => {
              const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next = (active + d + items.length) % items.length;
              go(next);
              // фокус едет за выбором: иначе стрелки листают то, чего не видно
              (e.currentTarget.querySelectorAll('button')[next] as HTMLButtonElement | undefined)?.focus();
            }}
          >
            {items.map((item, i) => {
              const on = i === active;
              return (
                <li key={item.title} className="border-t border-line last:border-b">
                  <button
                    type="button"
                    role="tab"
                    id={`inc-${slug}-${i}`}
                    aria-selected={on}
                    aria-controls={`incp-${slug}`}
                    tabIndex={on ? 0 : -1}
                    onClick={() => go(i)}
                    onFocus={() => go(i)}
                    className="w-full cursor-pointer appearance-none border-0 bg-transparent px-0 py-[clamp(14px,2vh,22px)] text-left outline-none"
                  >
                    <span className="flex items-baseline gap-4">
                      <span
                        className={`font-mono text-[11px] tracking-rail transition-colors duration-300 ${
                          on ? 'text-accent' : 'text-faint'
                        }`}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={`text-[clamp(15px,1.35vw,20px)] font-medium leading-snug transition-colors duration-300 ${
                          on ? 'text-fg' : 'text-dim'
                        }`}
                      >
                        {item.title}
                      </span>
                    </span>
                    {/* На узком экране текст живёт в самой строке: панель
                        стоит выше и до неё не доскроллить, пока читаешь
                        перечень. Дублирования в разметке нет — второй
                        экземпляр в панели скрыт display:none, и читалка
                        озвучивает ровно один. */}
                    {on && (
                      <span className="mt-3 block max-w-[46ch] text-[14px] leading-relaxed text-dim lg:hidden">
                        {item.text}
                      </span>
                    )}

                    {/* полоса таймера: видно, что перечень идёт сам */}
                    <span
                      className="mt-3 block h-px w-full origin-left bg-accent"
                      style={{
                        transform: `scaleX(${on ? 1 : 0})`,
                        opacity: on ? 0.8 : 0,
                        transition: on && !held ? `transform ${STEP_MS}ms linear, opacity .3s` : 'transform .3s, opacity .3s'
                      }}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ol>

          {/* ---------- панель с материалом направления ---------- */}
          <div
            role="tabpanel"
            id={`incp-${slug}`}
            aria-labelledby={`inc-${slug}-${active}`}
            data-cursor="ring"
            data-reveal="clip"
            className="relative order-first min-h-[clamp(200px,28vh,420px)] overflow-hidden border border-line bg-elev lg:order-none lg:min-h-[clamp(280px,40vh,420px)]"
          >
            <Material preset={material} opacity={0.72} />
            {/* вуаль под текст: фактура остаётся видна по краям, читаемость держится ею */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(158deg, rgb(var(--bg-rgb) / 0.30) 0%, rgb(var(--bg-rgb) / 0.72) 42%, rgb(var(--bg-rgb) / 0.93) 78%)'
              }}
              aria-hidden
            />

            {/* номер части крупно: якорь, по которому видно движение перечня */}
            <span
              key={`n-${active}`}
              className="pointer-events-none absolute -bottom-[0.22em] right-[0.06em] font-mono text-[clamp(120px,18vw,240px)] leading-none tracking-[-0.04em] text-fg/[0.07]"
              style={{ animation: 'ct-rise .5s cubic-bezier(0.22,1,0.36,1) both' }}
              aria-hidden
            >
              {nn}
            </span>

            {/* угловые засечки — та же рамка прибора, что у схемы */}
            {[
              'left-0 top-0 border-l border-t',
              'right-0 top-0 border-r border-t',
              'left-0 bottom-0 border-l border-b',
              'right-0 bottom-0 border-r border-b'
            ].map((c) => (
              <span key={c} className={`pointer-events-none absolute h-3 w-3 border-line-strong ${c}`} aria-hidden />
            ))}

            <div className="relative flex h-full min-h-[inherit] flex-col justify-between gap-8 p-[clamp(20px,2.6vw,44px)]">
              <div className="flex items-center justify-between gap-4">
                <span className="rail-label">
                  <b>{nn}</b> / {String(items.length).padStart(2, '0')}
                </span>
                <span className="rail-label">{group}</span>
              </div>

              <div>
                <div
                  key={active}
                  className="hidden lg:block"
                  style={{ animation: 'ct-rise .45s cubic-bezier(0.22,1,0.36,1) both' }}
                >
                  <h3 className="display m-0 max-w-[16ch] text-[clamp(24px,2.8vw,42px)]">{it.title}</h3>
                  <p className="m-0 mt-5 max-w-[46ch] text-[clamp(14px,1.2vw,17px)] leading-relaxed text-dim">
                    {it.text}
                  </p>
                </div>

                {/* рельс состава: видно, сколько частей и где сейчас идём.
                    Тот же приём, что у рельса карусели на главной. */}
                <div className="mt-[clamp(18px,3vh,30px)] flex gap-1.5" aria-hidden>
                  {items.map((part, i) => (
                    <span
                      key={part.title}
                      className={`h-px flex-1 transition-colors duration-500 ${
                        i === active ? 'bg-accent' : i < active ? 'bg-line-strong' : 'bg-line'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
