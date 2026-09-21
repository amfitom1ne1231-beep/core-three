'use client';

import { useEffect, useRef, useState } from 'react';
import ConceptPreview from '../concept-previews';

/** В каких координатах грузится страница демо внутри кадра. */
const W = 1280;
const H = 800;

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
 * трафик или движение. Во всех остальных случаях остаётся схема —
 * та же, что в карточках витрины.
 *
 * Гистерезис на два наблюдателя: ближний включает кадр за 200 пикселей
 * до входа, дальний гасит через 400 после выхода. Один порог на оба
 * события давал бы мигание на границе.
 *
 * Пороги были 300 и 1200 — и на витрине это значило четыре живых
 * страницы разом: полоса высотой 400 при шаге 494, дальний порог не
 * успевал сработать ни разу за всю страницу. Замер на 1280×860: четыре
 * из четырёх.
 *
 * Стало 200 и 150 — по замеру два-три живых кадра, в среднем 2,5.
 * Меньше двух здесь и не получится честно: в экран помещаются полторы
 * полосы, и гасить кадр у полосы, которая видна, — значит показывать
 * схему там, где обещано демо. Дальше выигрыш даёт не порог, а шаг
 * между полосами.
 */
export default function DemoView({
  slug,
  kind,
  title,
  className = ''
}: {
  slug: string;
  /** Ниша схемы-запасного варианта. */
  kind: string;
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

    const near = new IntersectionObserver(([e]) => e.isIntersecting && setLive(true), { rootMargin: '200px' });
    const far = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) return;
        setLive(false);
        setShown(false);
      },
      { rootMargin: '150px' }
    );
    near.observe(el);
    far.observe(el);
    return () => {
      ro.disconnect();
      near.disconnect();
      far.disconnect();
    };
  }, []);

  return (
    <div ref={frame} className={`relative overflow-hidden ${className}`}>
      {/* схема: то, что видно до загрузки кадра и всегда на телефоне */}
      <svg viewBox="0 0 320 200" className="block h-full w-full text-fg" aria-hidden>
        <ConceptPreview kind={kind} />
      </svg>

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
