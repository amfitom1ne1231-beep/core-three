/**
 * Опасная бритва — рисунок для обложки мини-приложения. Латунная линия
 * по графиту: вывеска старой цирюльни, а не значок из набора.
 */
export default function Razor({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 90" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="razor-blade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe9e0" stopOpacity="0.22" />
          <stop offset="1" stopColor="#efe9e0" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <g stroke="#c9a46a" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
        {/* лезвие: обух сверху, режущая кромка снизу, носок скруглён */}
        <path d="M24 38 L118 33 Q127 33 127 41 L127 47 Q127 55 118 55 L40 53 Q22 52 22 44 Q22 39 24 38 Z" fill="url(#razor-blade)" />
        <path d="M30 50 L118 51.5" strokeOpacity="0.55" />
        <path d="M120 36.5 L126 36.5" strokeOpacity="0.6" />
        {/* хвостовик и ось */}
        <path d="M127 42 L138 41.5" />
        <circle cx="141" cy="41.5" r="3.2" />
        {/* ручка-накладка: длинная, чуть вверх, с заклёпкой на конце */}
        <path d="M144 38.5 L214 27 Q223 25.8 223.5 31.5 Q224 36.5 216 38 L145 45 Z" fill="#c9a46a" fillOpacity="0.12" />
        <path d="M150 41 L214 31.6" strokeOpacity="0.45" />
        <circle cx="216" cy="32" r="1.8" />
      </g>
    </svg>
  );
}
