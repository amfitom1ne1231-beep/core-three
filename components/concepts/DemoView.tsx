'use client';

import { useEffect, useRef, useState } from 'react';

/** В каких координатах грузится страница демо внутри кадра. */
const W = 1280;
const H = 800;
/** Сколько страница должна простоять, чтобы живой кадр начал грузиться. */
const SETTLE_MS = 220;

/**
 * Живой кадр демо.
 *
 * Внутри рамки идёт сама страница демо: тот же адрес, тот же код,
 * живые проверки и живая переписка. Нарисованная нами картинка
 * продукта всегда выглядит лучше продукта — ровно поэтому ей и не
 * верят.
 *
 * Кадр грузится не всем и не сразу: только на широком экране с мышью,
 * только когда подошёл к экрану, и только если человек не просил беречь
 * трафик или движение. Во всех остальных случаях остаётся снимок той же
 * страницы в тех же координатах (`brand/demo-shots.mjs`). Раньше здесь
 * стояла схема из карточек витрины — и на планшете страница «Демо вместо
 * презентаций» показывала серые полоски вместо демо. На компьютере снимок
 * — подложка, пока грузится живой кадр: картинка под рукой не меняется.
 *
 * Гистерезис на два наблюдателя: ближний включает кадр за 150 пикселей
 * до входа, дальний гасит через 300 после выхода. Порядок здесь
 * обязателен: дальний порог всегда больше ближнего, иначе в полосе
 * между ними один наблюдатель включает кадр, а второй тут же гасит,
 * и iframe пересобирается на каждой прокрутке мимо.
 *
 * Пороги были 300 и 1200 — и на витрине это значило четыре живых
 * страницы разом: полоса высотой 400 при шаге 494, дальний порог не
 * успевал сработать ни разу за всю страницу. Замер на 1280×860: четыре
 * из четырёх.
 *
 * Стало 150 и 300 — по замеру два-три живых кадра, в среднем 2,5.
 * Меньше двух здесь и не получится честно: в экран помещаются полторы
 * полосы, и гасить кадр у полосы, которая видна, — значит показывать
 * снимок там, где обещано живое демо. Дальше выигрыш даёт не порог, а шаг
 * между полосами.
 *
 * Кадр поднимается, когда прокрутка остановилась, а не на ходу. Живой
 * кадр — целая страница: её разбор и запуск идут в том же потоке, что
 * и прокрутка. В Safari каждая полоса, подъезжая к экрану, давала две
 * паузы по 50–85 мс — двенадцать запинок за один проход витрины (замер —
 * BRIEF.md, раздел 51). Пока страница едет, в рамке стоит снимок той же
 * страницы; остановились посмотреть — через долю секунды он оживает.
 * Мимо чего пролистали, то не грузится вовсе.
 */
export default function DemoView({
  slug,
  title,
  className = ''
}: {
  slug: string;
  title: string;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [shown, setShown] = useState(false);
  const [k, setK] = useState(0);

  // смена демо в переключателе: кадр гасим до загрузки нового
  useEffect(() => setShown(false), [slug]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;

    const measure = () => setK(el.clientWidth / W);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    const heavyOk =
      matchMedia('(min-width: 1024px)').matches &&
      matchMedia('(pointer: fine)').matches &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches &&
      // «экономия трафика» в браузере — просьба не грузить лишнее
      !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

    if (!heavyOk) return () => ro.disconnect();

    let wanted = false;
    let timer = 0;
    // каждое событие прокрутки откладывает подъём: кадр оживает в тишине
    const arm = () => {
      window.clearTimeout(timer);
      if (wanted) timer = window.setTimeout(() => setLive(true), SETTLE_MS);
    };
    const near = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        wanted = true;
        arm();
      },
      { rootMargin: '150px' }
    );
    const far = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) return;
        wanted = false;
        window.clearTimeout(timer);
        setLive(false);
        setShown(false);
      },
      { rootMargin: '300px' }
    );
    near.observe(el);
    far.observe(el);
    addEventListener('scroll', arm, { passive: true });
    return () => {
      window.clearTimeout(timer);
      removeEventListener('scroll', arm);
      ro.disconnect();
      near.disconnect();
      far.disconnect();
    };
  }, []);

  return (
    <div ref={frame} className={`relative overflow-hidden ${className}`}>
      {/* снимок: то, что видно до загрузки кадра и всегда на планшете и телефоне */}
      {/* eslint-disable-next-line @next/next/no-img-element -- снимки уже ужаты под кадр, у каждого две ширины */}
      <img
        src={`/demos/${slug}.webp`}
        srcSet={`/demos/${slug}-960.webp 960w, /demos/${slug}.webp 1920w`}
        sizes="(min-width: 1024px) 55vw, 100vw"
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="block h-full w-full object-cover object-top"
      />

      {live && (
        <iframe
          key={slug}
          src={`/concepts/${slug}`}
          title={title}
          aria-hidden
          tabIndex={-1}
          scrolling="no"
          loading="lazy"
          onLoad={() => setShown(true)}
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-700"
          style={{ width: W, height: H, transform: `scale(${k || 0.5})`, opacity: shown ? 1 : 0 }}
        />
      )}
    </div>
  );
}
