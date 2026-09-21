import { C } from './shared';

/**
 * Работы учеников.
 *
 * Рисунок — единственный товар, который демо может показать честно:
 * это не фотография работы, это работа. Штрих намеренно неровный
 * по толщине и нигде не замкнут идеально — линия, проведённая рукой
 * на третьей неделе, так и выглядит, а безупречная кривая Безье
 * выдала бы иллюстрацию из набора.
 */
export type SketchShape = 'ball' | 'cup' | 'pear' | 'vase' | 'profile';

export default function Sketch({ shape, className }: { shape: SketchShape; className?: string }) {
  const line = {
    fill: 'none',
    stroke: C.ink,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };
  const soft = { ...line, strokeWidth: 1, opacity: 0.5 };

  return (
    <svg viewBox="0 0 100 120" className={className} aria-hidden>
      {shape === 'ball' && (
        <g>
          <circle cx="50" cy="52" r="28" {...line} />
          {/* штриховка по форме: тень слева снизу, рефлекс у самого края */}
          {Array.from({ length: 9 }).map((_, i) => (
            <path
              key={i}
              d={`M${28 + i * 2.4} ${64 + i * 1.6} C ${36 + i * 2} ${74 + i * 1.2}, ${48 + i * 1.6} ${78 + i * 0.8}, ${56 + i * 1.4} ${74 + i * 0.6}`}
              {...soft}
              opacity={0.55 - i * 0.04}
            />
          ))}
          <path d="M22 88 C 40 96, 66 96, 84 86" {...soft} />
          <path d="M34 34 C 40 28, 50 26, 58 30" {...soft} />
        </g>
      )}

      {shape === 'cup' && (
        <g>
          <path d="M30 46 C 30 78, 38 92, 50 92 C 62 92, 70 78, 70 46" {...line} />
          <path d="M30 46 C 30 38, 70 38, 70 46" {...line} />
          <path d="M34 47 C 36 42, 64 42, 66 47" {...soft} />
          <path d="M70 54 C 84 53, 86 74, 70 76" {...line} />
          <path d="M18 98 C 30 104, 70 104, 82 98" {...line} />
          <path d="M18 98 C 24 92, 76 92, 82 98" {...soft} />
          {Array.from({ length: 5 }).map((_, i) => (
            <path key={i} d={`M${36 + i * 2} ${62 + i * 3} C ${40 + i * 2} ${74 + i * 2}, ${46 + i * 2} ${80 + i}, ${52 + i * 2} ${80 + i}`} {...soft} opacity={0.4} />
          ))}
        </g>
      )}

      {shape === 'pear' && (
        <g>
          <path
            d="M50 36 C 57 36, 60 44, 57 52 C 68 60, 71 80, 59 90 C 50 97, 40 93, 36 84 C 30 70, 40 58, 45 53 C 41 44, 44 36, 50 36 Z"
            {...line}
          />
          <path d="M50 36 C 50 28, 54 23, 59 21" {...line} />
          <path d="M59 24 C 66 22, 70 26, 68 30 C 66 33, 61 32, 59 28" {...soft} />
          {Array.from({ length: 6 }).map((_, i) => (
            <path key={i} d={`M${39 + i * 1.8} ${68 + i * 2.6} C ${44 + i * 1.6} ${80 + i * 1.8}, ${50 + i * 1.4} ${86 + i}, ${56 + i * 1.2} ${84 + i}`} {...soft} opacity={0.45} />
          ))}
          <path d="M24 100 C 40 106, 64 106, 78 99" {...soft} />
        </g>
      )}

      {shape === 'vase' && (
        <g>
          <path d="M40 62 C 34 78, 37 100, 50 100 C 63 100, 66 78, 60 62 C 58 57, 58 53, 56 51 L 44 51 C 42 53, 42 57, 40 62 Z" {...line} />
          <path d="M44 51 C 48 53, 52 53, 56 51" {...soft} />
          {/* ветка: три листа и сухой стебель */}
          <path d="M50 51 C 50 34, 46 24, 38 16" {...line} />
          <path d="M48 40 C 40 38, 34 32, 33 26 C 39 27, 45 32, 48 40 Z" {...line} />
          <path d="M50 32 C 58 31, 63 26, 64 20 C 58 21, 52 25, 50 32 Z" {...line} />
          <path d="M45 26 C 40 22, 38 16, 39 11" {...soft} />
          <path d="M22 106 C 38 111, 64 111, 80 105" {...soft} />
        </g>
      )}

      {shape === 'profile' && (
        <g>
          <path
            d="M38 100 C 34 82, 33 66, 36 54 C 40 39, 51 30, 62 33 C 71 36, 75 45, 70 53 C 68 57, 64 58, 66 62 C 68 66, 62 68, 62 73 C 62 79, 56 78, 54 81 C 52 86, 57 92, 53 100"
            {...line}
          />
          <path d="M57 47 C 61 46, 64 48, 64 51" {...soft} />
          <path d="M52 62 C 56 63, 59 63, 62 62" {...soft} />
          <path d="M45 34 C 52 24, 66 24, 72 34 C 76 41, 74 50, 72 54" {...soft} />
          {Array.from({ length: 5 }).map((_, i) => (
            <path key={i} d={`M${40 + i * 1.6} ${70 + i * 4} C ${44 + i * 1.4} ${82 + i * 3}, ${47 + i} ${90 + i * 2}, ${50 + i} ${96 + i}`} {...soft} opacity={0.35} />
          ))}
        </g>
      )}
    </svg>
  );
}
