import { MARK_ARMS } from './mark-geometry';

/**
 * Знак CoreThree. Геометрия снята с логотипа brand/Логотип.jpg гранью
 * к грани и генерируется brand/trace/build.js — правки геометрии только там.
 *
 * Три элемента = три ядра. Объём в монохроме передаётся прозрачностью
 * граней (синие — плотнее, серебро — легче), поэтому знак живёт на любом
 * фоне и наследует currentColor.
 */
export default function Mark({
  className,
  flat = false,
  label = 'CoreThree'
}: {
  className?: string;
  /** Без полутонов и зазоров — для размеров меньше 20px. */
  flat?: boolean;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
      role="img"
      aria-label={label}
    >
      {MARK_ARMS.map((arm) => (
        <g key={arm.arm} data-arm={arm.arm} data-core={arm.core}>
          {arm.facets.map((f) => (
            <path key={f.facet} data-facet={f.facet} d={f.d} fillOpacity={flat ? 1 : f.opacity} />
          ))}
        </g>
      ))}
    </svg>
  );
}
