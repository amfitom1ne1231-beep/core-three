'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import gsap from 'gsap';
import Material from '../Material';
import { VIZ } from './viz';
import Words from '../Words';

gsap.registerPlugin(ScrollTrigger);

/** Шаг сам сменится через столько — как в схеме на главной. */
const STEP_MS = 4400;

export type IncludeItem = { title: string; text: string; viz?: string; vizNote?: string };

/**
 * Состав работы.
 *
 * Было шесть одинаковых карточек в сетке — та самая «документация»,
 * из-за которой середина главной когда-то проигрывала первому экрану.
 * Стало устройство: слева перечень, справа панель с фактурой
 * направления, и шаги идут сами, пока секция на экране.
 *
 * Разбор kling.ai уточнил две вещи, и обе взяты:
 *
 * 1. Описание раскрывается в самой строке, а не живёт в панели справа.
 *    Перечень получает вес, а панель остаётся чистым кадром — у них
 *    справа так же стоит одно видео без единой подписи.
 * 2. Таймер — один сплошной рельс вдоль всего перечня вместо полоски
 *    под каждой строкой. Одним элементом видно и где ты, и сколько
 *    осталось до смены; шесть отдельных полосок сообщали то же самое
 *    шестью способами.
 *
 * Глава `anatomy` гасит шейдер завесой в единицу, поэтому фактура здесь
 * своя, на SVG-фильтре: у каждого направления свой пресет материала —
 * четыре страницы отличаются на ощупь, а не только текстом.
 *
 * В кадре стояли фактура и гигантский номер части: нажимаешь «Быстрая
 * загрузка» — видишь текстуру и «02». Красиво, но о пункте ни слова.
 * Теперь в кадре схема самого пункта (`./viz`), и она живёт, пока пункт
 * открыт: главное событие идёт по кругу. Фактура осталась тихим фоном,
 * номер — только в рельсе над схемой, а название пункта из кадра ушло:
 * оно уже подсвечено в перечне рядом, и схеме досталось всё поле.
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
  /** Переход через конец списка: рельс возвращается в ноль без анимации. */
  const [wrapped, setWrapped] = useState(false);
  const prev = useRef(0);

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
    // На узком экране строка раскрывается прямо под пальцем, и смена
    // шага сама по себе двигала бы разметку под читающим.
    if (!matchMedia('(min-width: 1024px)').matches) return;
    const id = window.setInterval(() => setActive((p) => (p + 1) % items.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [inView, held, items.length]);

  /**
   * Возврат к первому шагу. Без этого рельс, дойдя до низа, полз бы
   * обратно наверх все 4.4 секунды — то есть показывал бы движение
   * назад там, где перечень идёт вперёд.
   */
  useEffect(() => {
    const back = active === 0 && prev.current === items.length - 1;
    prev.current = active;
    if (!back) return;
    setWrapped(true);
    const id = window.setTimeout(() => setWrapped(false), 40);
    return () => window.clearTimeout(id);
  }, [active, items.length]);

  const go = (i: number) => {
    setHeld(true);
    setActive(i);
  };

  const nn = String(active + 1).padStart(2, '0');
  const Viz = items[active].viz ? VIZ[items[active].viz!] : null;
  const fill = wrapped ? 0 : ((active + 1) / items.length) * 100;

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

        <div className="mt-[clamp(28px,5vh,60px)] grid gap-[clamp(20px,3vh,40px)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] lg:gap-[clamp(32px,4vw,72px)]">
          {/* ---------- перечень ---------- */}
          <div className="relative pl-5" onMouseEnter={() => setHeld(true)}>
            {/* рельс: один на весь перечень, он же таймер */}
            <span className="pointer-events-none absolute left-0 top-0 h-full w-px bg-line" aria-hidden>
              <span
                className="absolute left-0 top-0 w-full bg-accent"
                style={{
                  height: `${fill}%`,
                  transition: wrapped ? 'none' : held ? 'height .35s ease' : `height ${STEP_MS}ms linear`
                }}
              />
            </span>

            <ol className="m-0 flex list-none flex-col p-0">
              {items.map((item, i) => {
                const on = i === active;
                return (
                  <li key={item.title} className="border-t border-line last:border-b">
                    <button
                      type="button"
                      aria-expanded={on}
                      aria-controls={`inc-${slug}-${i}`}
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
                    </button>

                    {/* Раскрытие через grid-template-rows: высота текста
                        заранее неизвестна, а анимировать `height: auto`
                        нельзя. `visibility` уводит свёрнутое из дерева
                        доступности, но с задержкой — иначе текст исчезал
                        бы раньше, чем строка успевала сложиться. */}
                    <div
                      id={`inc-${slug}-${i}`}
                      className="grid transition-[grid-template-rows] duration-500 ease-out"
                      style={{ gridTemplateRows: on ? '1fr' : '0fr' }}
                    >
                      <div
                        className="overflow-hidden"
                        style={{
                          visibility: on ? 'visible' : 'hidden',
                          transition: `visibility 0s linear ${on ? '0s' : '.5s'}`
                        }}
                      >
                        <p className="m-0 max-w-[52ch] pb-[clamp(14px,2vh,22px)] pl-[calc(11px+1rem)] text-[14.5px] leading-relaxed text-dim">
                          <Words text={item.text} />
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* ---------- кадр с материалом направления ---------- */}
          <div
            aria-hidden
            data-cursor="ring"
            data-reveal="clip"
            className="relative order-first min-h-[clamp(240px,34vh,420px)] overflow-hidden border border-line bg-elev lg:order-none lg:min-h-[clamp(300px,44vh,460px)]"
            style={{ '--vz-play': inView ? 'running' : 'paused' } as CSSProperties}
          >
            <Material preset={material} opacity={Viz ? 0.36 : 0.72} />
            {/* вуаль под подписи: фактура остаётся видна по краям */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(158deg, rgb(var(--bg-rgb) / 0.22) 0%, rgb(var(--bg-rgb) / 0.55) 48%, rgb(var(--bg-rgb) / 0.82) 100%)'
              }}
            />

            {/* номер части крупно: якорь, по которому видно движение перечня.
                Только там, где схемы нет, — рядом со схемой он её перекрикивал */}
            {!Viz && (
            <span
              key={`n-${active}`}
              className="pointer-events-none absolute -bottom-[0.22em] right-[0.06em] font-mono text-[clamp(120px,18vw,240px)] leading-none tracking-[-0.04em] text-fg/[0.08]"
              style={{ animation: 'ct-rise .5s cubic-bezier(0.22,1,0.36,1) both' }}
            >
              {nn}
            </span>
            )}

            {/* угловые засечки — та же рамка прибора, что у схемы */}
            {[
              'left-0 top-0 border-l border-t',
              'right-0 top-0 border-r border-t',
              'left-0 bottom-0 border-l border-b',
              'right-0 bottom-0 border-r border-b'
            ].map((c) => (
              <span key={c} className={`pointer-events-none absolute h-3 w-3 border-line-strong ${c}`} />
            ))}

            <div className="relative flex h-full min-h-[inherit] flex-col justify-between gap-[clamp(16px,2.4vh,28px)] p-[clamp(20px,2.4vw,40px)]">
              <div className="flex items-center justify-between gap-4">
                <span className="rail-label">
                  <b>{nn}</b> / {String(items.length).padStart(2, '0')}
                </span>
                <span className="rail-label">{group}</span>
              </div>

              {/* схема пункта: перемонтирование по ключу запускает её заново */}
              {Viz ? (
                <div key={`v-${active}`} className="relative min-h-[180px] flex-1">
                  <Viz note={items[active].vizNote} />
                </div>
              ) : (
                <span
                  key={`t-${active}`}
                  className="block max-w-[18ch] text-[clamp(15px,1.5vw,21px)] font-medium leading-snug"
                  style={{ animation: 'ct-rise .45s cubic-bezier(0.22,1,0.36,1) both' }}
                >
                  {items[active].title}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
