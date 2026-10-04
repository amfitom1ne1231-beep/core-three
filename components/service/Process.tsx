'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Words from '../Words';

gsap.registerPlugin(ScrollTrigger);

export type Step = { n: string; title: string; text: string };

/**
 * Как идёт работа.
 *
 * Был список из четырёх строк — ровно тот же вид, что у состава работы
 * и у принципов на «О нас»: три раздела подряд одной плотности, и глаз
 * перестаёт их различать. Здесь шаги стали линией времени с крупными
 * числами: линия прочерчивается ровно по ходу скролла, и шаг загорается,
 * когда она до него доходит.
 *
 * Прогресс один на обе раскладки: на широком экране линия идёт поперёк,
 * на телефоне — сверху вниз, а считает его один ScrollTrigger и отдаёт
 * в переменную `--p`. Ориентацию выбирает CSS, не второй триггер.
 */
export default function Process({
  steps,
  label = 'Как идёт работа',
  title = 'Четыре',
  titleAccent = 'шага',
  lead = 'На каждом шаге есть что показать. Работающая ссылка вместо отчёта о процессе.',
  chapter = 'atlas'
}: {
  steps: readonly Step[];
  label?: string;
  title?: string;
  titleAccent?: string;
  lead?: string;
  chapter?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const marks = Array.from(el.querySelectorAll<HTMLElement>('[data-step]'));
    const paint = (p: number) => {
      el.style.setProperty('--p', p.toFixed(4));
      // шаг загорается, когда линия дошла до него: порог — его доля пути
      marks.forEach((m, i) => {
        const at = steps.length > 1 ? i / (steps.length - 1) : 0;
        if (p >= at - 0.001) m.setAttribute('data-on', '');
        else m.removeAttribute('data-on');
      });
    };

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(1);
      return;
    }

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 78%',
      end: 'bottom 72%',
      onUpdate: (self) => paint(self.progress),
      onRefresh: (self) => paint(self.progress)
    });
    return () => trigger.kill();
  }, [steps.length]);

  return (
    <section data-chapter={chapter} className="relative z-10 w-full border-t border-line" aria-label={label}>
      <div data-recede className="px-4 section-y sm:px-8 lg:px-[72px]">
        <div className="grid gap-[clamp(16px,3vh,32px)] lg:grid-cols-[1.7fr_1fr] lg:items-end">
          <div>
            <span className="rail-label">{label}</span>
            <h2 className="display m-0 mt-4 text-[clamp(26px,4.2vw,64px)]">
              {title} <span className="title-accent">{titleAccent}</span>
            </h2>
          </div>
          <p className="m-0 max-w-[40ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">{lead}</p>
        </div>

        <div ref={root} className="relative mt-[clamp(36px,7vh,88px)]" style={{ ['--p' as string]: 0 }}>
          {/* Рельс: серый по всей длине, акцентом — пройденное. Две полосы
              вместо одной, потому что направление роста у них разное,
              а инлайновый transform медиазапросом не переключишь. */}
          <div className="pointer-events-none absolute left-[3px] top-0 h-full w-px bg-line lg:hidden" aria-hidden>
            <span
              className="absolute inset-0 origin-top bg-accent"
              style={{ transform: 'scaleY(var(--p))' }}
            />
          </div>
          <div className="pointer-events-none absolute left-0 top-0 hidden h-px w-full bg-line lg:block" aria-hidden>
            <span
              className="absolute inset-0 origin-left bg-accent"
              style={{ transform: 'scaleX(var(--p))' }}
            />
          </div>

          <ol
            className="timeline-cols m-0 grid list-none gap-[clamp(28px,4vh,44px)] p-0 pl-8 lg:gap-[clamp(20px,2.4vw,44px)] lg:pl-0"
            style={{ ['--cols' as string]: steps.length }}
          >
            {steps.map((s) => (
              <li key={s.n} data-step className="group relative pt-0 lg:pt-[clamp(20px,3vh,40px)]">
                {/* засечка на рельсе */}
                <span
                  className="absolute -left-8 top-[0.55em] h-1.5 w-1.5 rounded-full bg-line-strong transition-colors duration-500 group-data-[on]:bg-accent lg:-top-[3px] lg:left-0 lg:translate-x-0"
                  aria-hidden
                />
                <span
                  className="block font-mono text-[clamp(44px,5.6vw,104px)] leading-[0.8] tracking-[-0.05em] text-fg/[0.18] transition-colors duration-700 group-data-[on]:text-fg/[0.4]"
                  aria-hidden
                >
                  {s.n}
                </span>
                <h3 className="m-0 mt-[clamp(14px,2vh,26px)] text-[clamp(17px,1.5vw,22px)] font-medium leading-snug">
                  {s.title}
                </h3>
                <p className="m-0 mt-3 max-w-[34ch] text-[14px] leading-relaxed text-dim">
                  <Words text={s.text} />
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
