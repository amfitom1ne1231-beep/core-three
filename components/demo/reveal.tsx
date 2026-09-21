'use client';

import { createElement, useEffect, useRef, useState } from 'react';

/**
 * Вход блока и одноразовые анимации внутри демо.
 *
 * На сайте это делает `components/Reveal.tsx` через GSAP и ScrollTrigger,
 * но тянуть их в демо незачем: демо — сайт клиента, и там нет ни Lenis,
 * ни закреплённых сцен. IntersectionObserver и переход в CSS дают тот же
 * жест и ничего не весят.
 *
 * Жест намеренно короткий: 12 пикселей и полсекунды. Всё, что едет
 * дальше, на длинной странице читается не как появление, а как
 * подлагивание.
 */

/** Сработало ли попадание в кадр. Один раз: возврат наверх ничего не переигрывает. */
export function useInView<T extends HTMLElement>(rootMargin = '-12% 0px') {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setSeen(true);
        io.disconnect();
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return [ref, seen] as const;
}

/**
 * Обёртка входа. `delay` — для соседних блоков в одном ряду, чтобы они
 * приходили друг за другом, а не хором.
 */
export default function Reveal({
  children,
  className = '',
  delay = 0,
  style,
  as: Tag = 'div'
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Свои стили ячейки — например заливка в сетке через `gap-px`. */
  style?: React.CSSProperties;
  as?: 'div' | 'section' | 'li';
}) {
  const [ref, seen] = useInView<HTMLElement>();
  // createElement, а не <Tag>: у div, section и li разные типы элемента,
  // и общий ref в JSX не сходится ни с одним из них
  return createElement(
    Tag,
    {
      ref,
      'data-demo-rise': '',
      ...(seen ? { 'data-in': '' } : {}),
      className,
      style: delay ? { ...style, transitionDelay: `${delay}ms` } : style
    },
    children
  );
}
