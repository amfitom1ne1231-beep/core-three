import { MARK_ARMS } from './mark-geometry';
import { BEVEL, FACET_FILL } from './mark-palette';

/**
 * Знак в цвете — тот же, что на первом экране, но плоский: без трёх
 * слоёв на разной глубине и без наклона за курсором.
 *
 * Нужен там, где знак должен быть узнаваем с первого взгляда и мелко:
 * в пульте навигации. Монохромный `Mark` для этого не годился — пульт
 * читался абстрактной иконкой, а не логотипом студии.
 *
 * `id` обязателен: градиенты граней живут в `defs`, и два знака на
 * странице с одинаковыми идентификаторами забрали бы друг у друга
 * заливки — в SVG выигрывает первый в документе.
 */
export default function MarkColor({ id, className = '' }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="CoreThree">
      <defs>
        {MARK_ARMS.flatMap((arm) =>
          arm.facets.map((f) => {
            const [a, b] = FACET_FILL[f.facet] ?? FACET_FILL.column;
            return (
              <linearGradient key={`${arm.arm}-${f.facet}`} id={`${id}-${arm.arm}-${f.facet}`} x1="0" y1="0" x2="0.35" y2="1">
                <stop offset="0" stopColor={a} />
                <stop offset="1" stopColor={b} />
              </linearGradient>
            );
          })
        )}
      </defs>
      {MARK_ARMS.map((arm) => (
        <g key={arm.arm}>
          {/* кромка: светлый контур под гранями заполняет зазоры, как фаски логотипа */}
          <g fill="none" stroke={BEVEL} strokeWidth="1.4" strokeLinejoin="round">
            {arm.facets.map((f) => (
              <path key={f.facet} d={f.d} />
            ))}
          </g>
          {arm.facets.map((f) => (
            <path key={f.facet} d={f.d} fill={`url(#${id}-${arm.arm}-${f.facet})`} />
          ))}
        </g>
      ))}
    </svg>
  );
}
