import type { CSSProperties, ReactNode } from 'react';

/**
 * Общие детали мини-схем.
 *
 * Схемы рисуются тем же языком, что и остальной прибор: тонкий штрих,
 * моноширинная подпись в девять пунктов, один акцент. Ни одной цифры,
 * которую мы не можем подтвердить: схема показывает устройство, а не
 * выдуманные показатели — на сайте про честность метрики из воздуха
 * выглядели бы ровно тем, чем являются.
 *
 * Движение — ключевыми кадрами CSS, без таймеров и без GSAP: схема
 * живёт, только пока её пункт открыт, а перемонтирование по `key`
 * в `Includes` запускает её заново. При `prefers-reduced-motion`
 * глобальное правило обнуляет длительности, и сцена просто стоит
 * в конечном виде.
 */

/** Появление детали: сдвиг и проявление, с задержкой по порядку. */
export const rise = (delay: number): CSSProperties => ({
  animation: `ct-rise .5s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`
});

/** Проявление без сдвига — для заливок и штрихов. */
export const fade = (delay: number, dur = 0.5): CSSProperties => ({
  animation: `ct-veil ${dur}s ease ${delay}ms both`
});

/** Рост полосы: ширина идёт от нуля к своей доле. */
export const grow = (delay: number, dur = 0.9): CSSProperties => ({
  animation: `ct-grow ${dur}s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`
});

/** Рамка-подложка одной детали схемы. */
export function Box({
  children,
  className = '',
  style
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`border border-line-strong bg-bg/55 backdrop-blur-[2px] ${className}`} style={style}>
      {children}
    </div>
  );
}

/** Строка-заполнитель вместо выдуманного текста. */
export function Bar({ w = '100%', h = 5, tone = 0.24, style }: { w?: string | number; h?: number; tone?: number; style?: CSSProperties }) {
  return (
    <span
      className="block rounded-[1px]"
      style={{ width: w, height: h, background: `rgb(var(--fg-rgb) / ${tone})`, ...style }}
      aria-hidden
    />
  );
}

/** Моноширинная подпись схемы. */
export function Tag({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={`font-mono text-[9px] uppercase tracking-rail text-faint ${className}`} style={style}>
      {children}
    </span>
  );
}

/** Общее поле схемы: одна сетка координат на все сцены. */
export function Scene({ children }: { children: ReactNode }) {
  return <div className="relative h-full w-full select-none">{children}</div>;
}
