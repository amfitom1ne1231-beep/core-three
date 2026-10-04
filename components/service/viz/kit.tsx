import type { CSSProperties, ReactNode, SVGProps } from 'react';

/**
 * Общие детали мини-схем.
 *
 * Схема — один рисунок в общей сетке 400×210: он целиком вписывается
 * в кадр любой ширины, а не висит в верхней трети, как прежние блоки
 * на процентах. Цвета — сайта: рамки и подложки в акценте, текст-
 * заполнитель в цвете текста, и одна «горячая» часть — та, про которую
 * пункт.
 *
 * Движение двух видов, оба ключевыми кадрами CSS (app/globals.css,
 * блок «мини-схемы»), без таймеров и без GSAP:
 *
 * - вход: устройство схемы рисуется один раз, когда пункт открыли
 *   (`vz-in`, `vz-fade`, `vz-gy` с задержкой из `at()`);
 * - круг: главное событие пункта повторяется, пока он открыт, —
 *   заявка летит в таблицу, посылка едет к двери, фильтр перебирает
 *   карточки (`vz-s1…5`, `vz-turn`, `vz-go` и другие).
 *
 * Ни одной цифры, которую мы не можем подтвердить: схема показывает
 * устройство, а не выдуманные показатели. При `prefers-reduced-motion`
 * круг снят, и сцена стоит в конечном виде.
 */

export type VizProps = { note?: string };

/** Задержка входа детали и, если нужно, его длительность. */
export const at = (ms: number, t?: number) =>
  ({ '--d': `${ms}ms`, ...(t ? { '--t': `${t}s` } : null) }) as CSSProperties;

/** Очередь в круге: каким по счёту шагом подсвечивается деталь. */
export const turn = (i: number) => ({ '--i': i }) as CSSProperties;

/** Путь, который проходит движущаяся деталь. */
export const move = (dx: number, dy = 0) => ({ '--dx': `${dx}px`, '--dy': `${dy}px` }) as CSSProperties;

/** Поле схемы и подпись под ним. */
export function Scene({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="vz">
      <svg className="vz-art" viewBox="0 0 400 210" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden>
        {children}
      </svg>
      {note && <span className="vz-note">{note}</span>}
    </div>
  );
}

/** Рамка-подложка: окно, карточка, пузырь. */
export function Panel({ className = '', ...rest }: SVGProps<SVGRectElement>) {
  return <rect className={`vz-panel ${className}`} {...rest} />;
}

/** Строка-заполнитель вместо выдуманного текста. */
export function Txt({
  x,
  y,
  w,
  h = 4,
  tone = 'bar',
  className = '',
  style
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  /** bar — обычная строка, hi — заголовок, on — подсвеченная, hot — акцентом, ink — поверх акцента */
  tone?: 'bar' | 'hi' | 'on' | 'hot' | 'ink';
  className?: string;
  style?: CSSProperties;
}) {
  const fill = { bar: 'vz-bar', hi: 'vz-bar-hi', on: 'vz-bar-on', hot: 'vz-hot', ink: 'vz-ink' }[tone];
  return <rect x={x} y={y} width={w} height={h} rx={1} className={`${fill} ${className}`} style={style} />;
}

/** Моноширинная подпись внутри схемы. */
export function Label({
  x,
  y,
  children,
  hot,
  anchor,
  className = '',
  style
}: {
  x: number;
  y: number;
  children: ReactNode;
  hot?: boolean;
  anchor?: 'middle' | 'end';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} className={`vz-tag ${hot ? 'vz-tag-hot' : ''} ${className}`} style={style}>
      {children}
    </text>
  );
}
