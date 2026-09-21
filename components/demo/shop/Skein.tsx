import { edgeOf, shade, strandOf } from './shared';

/**
 * Товар.
 *
 * Фотографий у демо нет и быть не может, а магазин без товара на витрине
 * — не магазин. У пряжи есть редкое свойство: её можно нарисовать
 * честно, потому что покупают в ней цвет и фактуру, а не ракурс.
 *
 * Моток рисуется из самого цвета: нить темнее пряжи у светлой и светлее
 * у тёмной, иначе «Графит» превращается в чёрный круг без фактуры.
 * У светлых цветов появляется кромка — без неё «Молоко» пропадает
 * на белой карточке.
 */
export default function Skein({
  hex,
  shape = 'ball',
  className,
  title
}: {
  hex: string;
  shape?: 'ball' | 'needles' | 'rings';
  className?: string;
  title?: string;
}) {
  const strand = strandOf(hex);
  const edge = edgeOf(hex);

  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={title ?? 'Товар'}>
      {shape === 'ball' && (
        <>
          <defs>
            {/* один и тот же круг на все мотки: геометрия общая,
                поэтому совпадающий id безвреден */}
            <clipPath id="skein-clip">
              <circle cx="60" cy="60" r="44" />
            </clipPath>
          </defs>
          <circle cx="60" cy="60" r="44" fill={hex} stroke={edge} strokeWidth="1" />
          <g clipPath="url(#skein-clip)">
            {/* намотка: три направления, как у настоящего клубка */}
            {[
              { r: -26, ry: 17, o: 0.5 },
              { r: -26, ry: 34, o: 0.3 },
              { r: 34, ry: 15, o: 0.45 },
              { r: 34, ry: 31, o: 0.26 },
              { r: 84, ry: 20, o: 0.22 }
            ].map((e, i) => (
              <ellipse
                key={i}
                cx="60"
                cy="60"
                rx="44"
                ry={e.ry}
                fill="none"
                stroke={strand}
                strokeOpacity={e.o}
                strokeWidth="2.4"
                transform={`rotate(${e.r} 60 60)`}
              />
            ))}
            {/* блик сверху слева: объём без градиента */}
            <ellipse cx="45" cy="41" rx="19" ry="11" fill="#fff" opacity="0.16" transform="rotate(-26 45 41)" />
          </g>
          {/* свободный конец нити — по нему моток и узнаётся */}
          <path
            d="M102 47 C 114 52 116 70 106 80 C 99 87 90 88 84 96"
            fill="none"
            stroke={hex}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M102 47 C 114 52 116 70 106 80 C 99 87 90 88 84 96"
            fill="none"
            stroke={strand}
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </>
      )}

      {shape === 'needles' && (
        <g>
          {[-1, 1].map((d) => (
            <g key={d} transform={`rotate(${d * 17} 60 60)`}>
              <rect x={d < 0 ? 40 : 74} y="16" width="6" height="74" rx="3" fill={hex} />
              <path
                d={d < 0 ? 'M40 16 L43 5 L46 16 Z' : 'M74 16 L77 5 L80 16 Z'}
                fill={shade(hex, 0.8)}
              />
              <circle cx={d < 0 ? 43 : 77} cy="96" r="7" fill={shade(hex, 0.86)} />
            </g>
          ))}
          {/* леска между спицами */}
          <path d="M34 104 C 52 118 70 118 88 104" fill="none" stroke={shade(hex, 0.7)} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )}

      {shape === 'rings' && (
        <g>
          {[
            { x: 44, y: 46, r: 15 },
            { x: 76, y: 52, r: 12 },
            { x: 56, y: 80, r: 13 },
            { x: 84, y: 82, r: 9 }
          ].map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={c.r}
              fill="none"
              stroke={i % 2 ? shade(hex, 0.78) : hex}
              strokeWidth="5"
            />
          ))}
        </g>
      )}
    </svg>
  );
}
