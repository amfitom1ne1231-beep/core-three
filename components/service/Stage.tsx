'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import gsap from 'gsap';
import { isRevealed, revealReady } from '@/lib/boot';
import { LIVE_W, LIVE_H, type LiveProps } from '../live/kit';

/**
 * Кадр направления на первом экране.
 *
 * Раньше живая вставка стояла в маленькой рамке справа от текста и
 * читалась иллюстрацией к абзацу. Здесь она сцена: кадр уходит за правый
 * край экрана, над ним рельс прибора с номером направления и отметкой,
 * что кадр живой. Тот же приём, что у сцены-карусели на главной, —
 * человек узнаёт кадр, который уже видел, и попадает в продолжение,
 * а не на новую страницу с картинкой.
 *
 * Своего материала под кадром нет намеренно: на первом экране работает
 * шейдер (глава `hero`, завеса ноль), и вторая фактура поверх него
 * превращается в шум. Материал направления появляется ниже — в главе
 * состава, где завеса гасит шейдер целиком.
 *
 * Под кадром — задача, которую он решает. Приём тот же, что под
 * каруселью на главной: у kling.ai под роликом лежит промпт, и ролик
 * читается доказательством, а не заставкой. Строка берётся из того же
 * места, что и в карусели, — по живой вставке, которая стоит в кадре.
 * Один текст на оба экрана: человек, пришедший с главной, узнаёт кадр
 * вместе с его задачей, а не читает про него второе объяснение.
 */
export default function Stage({ live: Live, task }: { live: ComponentType<LiveProps>; task?: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  // вставка нарисована в макетных координатах LIVE_W×LIVE_H, рамка
  // масштабирует её целиком — поэтому внутри можно думать в пикселях
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
    const io = new IntersectionObserver(([e]) => setPlaying(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  /**
   * Вход кадра: раскрывается от правого края, как сцена в карусели.
   *
   * Ждёт снятия прелоадера: иначе раскрытие проигрывается под заглушкой
   * и человек видит уже готовый кадр — то есть не видит ничего.
   */
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ctx: gsap.Context | null = null;
    const run = () => {
      ctx = gsap.context(() => {
        gsap.fromTo(
          el,
          { clipPath: 'inset(0% 0% 0% 72%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out', delay: 0.2 }
        );
      }, el);
    };

    if (isRevealed()) run();
    else revealReady.then(run);

    return () => ctx?.revert();
  }, []);

  return (
    <div className="relative">
      {/* Отметка живого кадра. Номер направления не дублируется: он уже
          стоит кикером над заголовком, а два одинаковых рельса рядом
          читаются как сбой вёрстки, а не как система. */}
      <div className="mb-3 flex items-center gap-2 pr-4 sm:pr-8 lg:pr-0">
        <i className="relative flex h-1.5 w-1.5">
          <i className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
          <i className="relative h-1.5 w-1.5 rounded-full bg-accent" />
        </i>
        <span className="rail-label">Живой кадр</span>
      </div>

      {/* Рамка не уходит за край экрана, хотя приём напрашивался: вставка —
          законченная композиция 560×380, и срез двенадцати процентов
          съедает её правую колонку с цифрами. Кадр держит размер
          и целостность, сцену делают масштаб, вход и рельс над ним. */}
      {/* Кадр скрыт от читалок целиком: это снимок продукта, а не текст
          страницы. Внутри вставки живут свои заголовки — h4 в лендинге, —
          и без этого они попадали в оглавление документа и ломали его
          порядок (Lighthouse: heading-order на `/sites`). Тот же приём
          уже стоит в карусели атласа и в панели пульта. */}
      <div
        ref={frame}
        data-cursor="ring"
        aria-hidden
        className="relative overflow-hidden rounded-[10px] border border-line bg-elev"
      >
        <div ref={stage} data-parallax-media className="relative w-full">
          <Live playing={playing} />
        </div>

        {/* кромка изнутри: та же глубина, что у узлов схемы */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--fg-rgb) / 0.05)' }}
          aria-hidden
        />
      </div>

      {/* Номер направления здесь не повторяется, хотя в карусели он в этой
          карточке есть: на странице он уже стоит кикером над заголовком
          и гигантской цифрой за сценой — третий раз подряд то же число
          читается сбоем вёрстки, а не системой. */}
      {task && (
        <div className="glass mt-3 rounded-[12px] px-4 py-3">
          <span className="rail-label block">Задача в кадре</span>
          <span className="mt-1.5 block max-w-[46ch] text-[13.5px] leading-snug text-fg">{task}</span>
        </div>
      )}
    </div>
  );
}
