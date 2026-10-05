/**
 * Материал направления: фрактальный шум, освещённый косым светом, — тот же
 * принцип, что в шейдере первого экрана.
 *
 * Здесь это готовая картинка. Раньше материал считался на странице
 * SVG-фильтром, по фактическому размеру рамки. Chrome делает это на
 * видеокарте, а Safari — на процессоре: 90–100 мс на каждый вход рамки
 * в экран, и страница услуг при прокрутке трижды замирала (замер —
 * BRIEF.md, раздел 51). Фильтр остался в `brand/materials.mjs`: там лежат
 * пресеты и оттуда картинки пересобираются.
 *
 * Картинка заполняет рамку с обрезкой, а не растягивается: рамки бывают
 * разных пропорций, и растянутая фактура на узком экране шла бы складками
 * в полтора раза площе задуманного.
 */

export const MATERIAL_NAMES = ['silk', 'folded', 'grain', 'stream', 'crystal', 'deep'] as const;
export type MaterialName = (typeof MATERIAL_NAMES)[number];

/**
 * Фактура направления: номер в атласе → пресет.
 *
 * Живёт здесь, потому что знают её двое — страница направления и полоса
 * перехода к соседям, и расходиться им незачем: если «Магазины» на своей
 * странице зернистые, то и в списке соседей они должны быть зернистыми.
 */
export const DIRECTION_MATERIAL: Record<string, MaterialName> = {
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
  preset?: MaterialName | string;
  className?: string;
  opacity?: number;
}) {
  const name = (MATERIAL_NAMES as readonly string[]).includes(preset) ? preset : 'silk';

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- картинка уже ужата под рамку, оптимизатору тут делать нечего */}
      <img
        src={`/materials/${name}.webp`}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity }}
      />
    </div>
  );
}
