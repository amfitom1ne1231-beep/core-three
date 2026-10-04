import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/**
 * Графики метрик — без библиотеки: два вида, оба простые.
 *
 * Правила одни на оба: одна серия — один цвет (`--mark`, от акцента темы
 * Telegram); столбец тонкий, скруглён со стороны значения и стоит
 * на базовой линии; сетка — волосяная, сплошная; подписи — цветом текста,
 * а не данных. Значения читаются и без наведения: у списков они написаны
 * рядом, у столбцов по времени есть таблица для читалки.
 */

/* ---------- столбцы по времени ---------- */

export type Column = { key: string; value: number; label: string };

const PLOT_H = 120;
const AXIS_H = 22;
const TOP = 8;
const RIGHT = 4;
const MAX_BAR = 24;
const GAP = 2;

/** Верх шкалы — круглое число не меньше максимума: 1, 2, 4, 5, 10, 20, 40, 50… */
function niceTop(max: number) {
  if (max <= 1) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 4, 5, 10]) if (step * pow >= max) return step * pow;
  return 10 * pow;
}

/** Столбец: скруглён сверху, у базовой линии — прямой. */
function barPath(x: number, w: number, top: number, bottom: number) {
  const r = Math.min(4, w / 2, bottom - top);
  return `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${bottom}Z`;
}

/**
 * Столбцы по времени. Нажатие или наведение выбирает ближайший столбец —
 * целиться в сам столбец не нужно; стрелки делают то же с клавиатуры.
 * `summary` показывается, пока ничего не выбрано; `describe` — подпись
 * выбранного столбца.
 */
export function Columns({ data, title, summary, describe }: { data: Column[]; title: string; summary: string; describe: (c: Column) => string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const readout = useId();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // другой период — прежний выбор не к месту
  useEffect(() => setPicked(null), [data]);

  const n = data.length;
  const top = niceTop(Math.max(0, ...data.map((d) => d.value)));
  // слева — место под самую длинную подпись шкалы
  const LEFT = 12 + 7.5 * String(top).length;
  const plotW = Math.max(0, width - LEFT - RIGHT);
  const slot = n ? plotW / n : 0;
  const barW = Math.max(2, Math.min(MAX_BAR, slot - GAP));
  const y = (v: number) => TOP + PLOT_H - (v / top) * PLOT_H;
  const ticks = top % 2 === 0 ? [0, top / 2, top] : [0, top];
  // подписи оси — сколько помещается, не чаще чем раз в 64 px
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 64))));

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!slot) return;
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left - LEFT;
    setPicked(Math.max(0, Math.min(n - 1, Math.floor(x / slot))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (!n) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      setPicked((p) => Math.max(0, Math.min(n - 1, (p ?? (step > 0 ? -1 : n)) + step)));
    }
    if (e.key === 'Escape') setPicked(null);
  };

  return (
    <div className="chart">
      <p className="chart__readout" id={readout} aria-live="polite">
        {picked === null ? summary : describe(data[picked]!)}
      </p>
      <div ref={box} className="chart__plot" tabIndex={0} role="group" aria-label={`${title}. Стрелки влево и вправо — по столбцам`} aria-describedby={readout} onKeyDown={onKey} onBlur={() => setPicked(null)}>
        {width > 0 && (
          <svg width={width} height={TOP + PLOT_H + AXIS_H} role="img" aria-label={`${title}: ${summary}`} onPointerDown={pick} onPointerMove={(e) => e.pointerType === 'mouse' && pick(e)} onPointerLeave={(e) => e.pointerType === 'mouse' && setPicked(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="chart__grid" x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} />
                <text className="chart__tick" x={LEFT - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">
                  {t}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = LEFT + i * slot + (slot - barW) / 2;
              const mid = LEFT + i * slot + slot / 2;
              // подпись не должна вылезать за край: у первого столбца она начинается от него,
              // у последних — прижата к правому краю
              const half = d.label.length * 3.6;
              const anchor = i === 0 ? 'start' : mid + half > width - RIGHT ? 'end' : 'middle';
              const lx = anchor === 'start' ? LEFT : anchor === 'end' ? width - RIGHT : mid;
              return (
                <g key={d.key}>
                  {d.value > 0 && <path className="chart__bar" d={barPath(x, barW, y(d.value), y(0))} opacity={picked === null || picked === i ? 1 : 0.4} />}
                  {i % every === 0 && (
                    <text className="chart__tick" x={lx} y={TOP + PLOT_H + 15} textAnchor={anchor}>
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
            {picked !== null && <line className="chart__cursor" x1={LEFT + picked * slot + slot / 2} x2={LEFT + picked * slot + slot / 2} y1={TOP} y2={y(0)} />}
          </svg>
        )}
      </div>
      {/* те же числа — таблицей, для читалки с экрана */}
      <table className="sr">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- список с полосками ---------- */

export type BarRow = { key: string; label: string; value: number; note?: string };

/**
 * Сравнение по величине: подпись, число и полоска под ними. Длина — от
 * `max` (по умолчанию — от самой большой строки). Число написано рядом
 * с каждой полоской, поэтому список сам себе таблица.
 */
export function BarList({ rows, max }: { rows: BarRow[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.key} className="bars__row">
          <span className="bars__head">
            <span className="bars__label">{r.label}</span>
            {r.note && <span className="bars__note">{r.note}</span>}
            <span className="bars__value">{r.value}</span>
          </span>
          <span className="bars__track" aria-hidden="true">
            {r.value > 0 && <span className="bars__fill" style={{ width: `${Math.max(1.5, (r.value / top) * 100)}%` }} />}
          </span>
        </li>
      ))}
    </ul>
  );
}
