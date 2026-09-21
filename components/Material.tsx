/**
 * Генератор материала. Тот же принцип, что в шейдере первого экрана —
 * фрактальный шум, освещённый косым светом, — но средствами SVG-фильтра:
 * работает без WebGL, весит ноль килобайт и не тратит кадры.
 *
 * Фильтр растрируется по фактическому размеру элемента. Раньше полотно
 * держалось маленьким и растягивалось трансформом — выходило мягкое пятно
 * вместо фактуры. Теперь рисуем в натуральном размере рамки (это сотни
 * тысяч пикселей, недорого), а трансформ оставлен только на небольшой
 * запас под параллакс.
 */

export type MaterialPreset = {
  seed: number;
  freq: [number, number];
  octaves: number;
  surface: number;
  azimuth: number;
  elevation: number;
  diffuse: string;
  specular: string;
  exponent: number;
  scale: number;
};

/** По одному материалу на направление: разная фактура при общей природе. */
export const MATERIALS: Record<string, MaterialPreset> = {
  silk: { seed: 7, freq: [0.009, 0.019], octaves: 5, surface: 3.4, azimuth: 235, elevation: 46, diffuse: '#6f8aa8', specular: '#cfe0f2', exponent: 26, scale: 1.12 },
  folded: { seed: 23, freq: [0.014, 0.008], octaves: 4, surface: 4.6, azimuth: 205, elevation: 38, diffuse: '#5f7b98', specular: '#c3d6ea', exponent: 18, scale: 1.16 },
  grain: { seed: 41, freq: [0.032, 0.032], octaves: 5, surface: 1.9, azimuth: 255, elevation: 52, diffuse: '#77879b', specular: '#dbe6f2', exponent: 36, scale: 1.08 },
  stream: { seed: 58, freq: [0.006, 0.034], octaves: 5, surface: 3.8, azimuth: 185, elevation: 42, diffuse: '#6b87ab', specular: '#cddff3', exponent: 20, scale: 1.14 },
  crystal: { seed: 71, freq: [0.022, 0.012], octaves: 3, surface: 5.4, azimuth: 275, elevation: 58, diffuse: '#7a90ad', specular: '#e3edf8', exponent: 44, scale: 1.1 },
  deep: { seed: 89, freq: [0.008, 0.011], octaves: 5, surface: 2.8, azimuth: 220, elevation: 34, diffuse: '#556f8c', specular: '#b8cde3', exponent: 14, scale: 1.2 }
};

/**
 * Фактура направления: номер в атласе → пресет.
 *
 * Живёт здесь, рядом с самими пресетами, потому что знают её двое —
 * страница направления и полоса перехода к соседям, и расходиться им
 * незачем: если «Магазины» на своей странице зернистые, то и в списке
 * соседей они должны быть зернистыми.
 */
export const DIRECTION_MATERIAL: Record<string, keyof typeof MATERIALS> = {
  '01': 'silk',
  '02': 'folded',
  '03': 'grain',
  '04': 'stream',
  '05': 'crystal',
  '06': 'deep'
};

export default function Material({
  preset = 'silk',
  className = '',
  opacity = 0.9
}: {
  preset?: keyof typeof MATERIALS | string;
  className?: string;
  opacity?: number;
}) {
  const m = MATERIALS[preset] ?? MATERIALS.silk;
  const id = `mat-${preset}`;

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <svg
        viewBox="0 0 480 300"
        preserveAspectRatio="none"
        className="absolute left-1/2 top-1/2 h-full w-full"
        style={{
          transform: `translate(-50%, -50%) scale(${m.scale})`,
          opacity,
          filter: 'saturate(0.85)'
        }}
      >
        <defs>
          <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${m.freq[0]} ${m.freq[1]}`}
              numOctaves={m.octaves}
              seed={m.seed}
              result="noise"
            />
            {/* рассеянный свет даёт тело материала */}
            <feDiffuseLighting
              in="noise"
              lightingColor={m.diffuse}
              surfaceScale={m.surface}
              diffuseConstant={0.95}
              result="body"
            >
              <feDistantLight azimuth={m.azimuth} elevation={m.elevation} />
            </feDiffuseLighting>
            {/* блик на гребнях — то, из-за чего поверхность читается шёлком */}
            <feSpecularLighting
              in="noise"
              lightingColor={m.specular}
              surfaceScale={m.surface}
              specularConstant={0.6}
              specularExponent={m.exponent}
              result="glint"
            >
              <feDistantLight azimuth={m.azimuth - 25} elevation={m.elevation + 14} />
            </feSpecularLighting>
            <feComposite in="glint" in2="noise" operator="in" result="glintClipped" />
            <feMerge>
              <feMergeNode in="body" />
              <feMergeNode in="glintClipped" />
            </feMerge>
            {/* гашение в тёмное: материал должен жить на чёрном, а не светиться */}
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.78" intercept="-0.03" />
              <feFuncG type="linear" slope="0.80" intercept="-0.03" />
              <feFuncB type="linear" slope="0.88" intercept="-0.02" />
            </feComponentTransfer>
          </filter>
        </defs>
        <rect width="480" height="300" filter={`url(#${id})`} />
      </svg>
    </div>
  );
}
