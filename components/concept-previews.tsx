/**
 * Превью концептов. Живых демо пока нет (волна 3), но пустая витрина
 * убивает доверие сильнее, чем честная схема.
 *
 * Раньше каркасы были сплошь монохромные, и рядом с живыми вставками
 * атласа читались не как концепт, а как недогрузившаяся страница:
 * серые прямоугольники на сером — это ровно то, как выглядит skeleton.
 * Поэтому у каждого превью палитра той же ниши, что и у вставки
 * в атласе, и один узнаваемый элемент: кнопка записи, цена с корзиной,
 * подтверждение брони, красный сбой в ленте аптайма.
 *
 * Система координат 320×200, и карточка в сетке выходит ровно 313px —
 * то есть единица viewBox это пиксель. Поэтому подписей мало и все
 * от 9 единиц: при 6 они складывались в нечитаемую грязь, а нечитаемый
 * текст возвращает ровно то ощущение скелета, от которого уходим.
 */

/** Ниши берут цвет у своей вставки в атласе — витрина и карусель не спорят. */
const NICHE = {
  landing: { key: '#6e9bcc', dim: '#8fb3dc' },
  shop: { key: '#c9a27e', deep: '#14110e' },
  bot: { key: '#6aa8de', deep: '#17212b', screen: '#0e1621', ink: '#e9eef3' },
  ops: { ok: '#3ddc84', bad: '#f0605d' }
} as const;

const box = (x: number, y: number, w: number, h: number, o: number, key?: string | number) => (
  <rect key={key} x={x} y={y} width={w} height={h} fill="currentColor" fillOpacity={o} />
);

/** Плашка своего цвета — кнопка, чип, пузырь. */
const tint = (x: number, y: number, w: number, h: number, fill: string, r = 0, key?: string | number) => (
  <rect key={key} x={x} y={y} width={w} height={h} rx={r} fill={fill} />
);

/**
 * Подпись. Моноширинный, верхний регистр, кегль не ниже 9.
 * Ширина считается точно: у JetBrains Mono ширина знака 0.6em,
 * с трекингом 0.08em выходит 0.68em — по этому и подобраны рамки.
 */
const label = (
  x: number,
  y: number,
  text: string,
  fill: string,
  size = 9,
  anchor: 'start' | 'middle' = 'start'
) => (
  <text
    x={x}
    y={y}
    fill={fill}
    fontSize={size}
    textAnchor={anchor}
    style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace', letterSpacing: '0.08em' }}
  >
    {text}
  </text>
);

const PREVIEWS: Record<string, React.ReactNode> = {
  // лендинг курса: оффер, кнопка записи, цена
  landing: (
    <>
      {box(0, 0, 320, 14, 0.14)}
      {box(10, 5, 28, 4, 0.5)}
      {[0, 1, 2].map((i) => box(240 + i * 26, 5, 18, 4, 0.28, i))}
      {label(20, 36, '6 НЕДЕЛЬ', NICHE.landing.dim)}
      {box(20, 46, 172, 16, 0.62)}
      {box(20, 68, 118, 16, 0.62)}
      {box(20, 96, 196, 4, 0.18)}
      {box(20, 105, 160, 4, 0.18)}
      {/* узнаваемый элемент ниши: кнопка записи и цена рядом */}
      {tint(20, 120, 76, 24, NICHE.landing.key, 12)}
      {label(58, 135, 'ЗАПИСАТЬСЯ', '#05080d', 9, 'middle')}
      {label(108, 135, 'ОТ 4 900 ₽', NICHE.landing.dim)}
      {[0, 1, 2].map((i) => box(20 + i * 100, 162, 84, 26, 0.08, i))}
      {tint(20, 162, 3, 26, NICHE.landing.key, 0, 'bar')}
    </>
  ),

  // магазин: витрина, выбранный товар с ценой и кнопкой, корзина со счётчиком
  shop: (
    <>
      {box(0, 0, 320, 14, 0.14)}
      {box(10, 5, 24, 4, 0.5)}
      {/* корзина со счётчиком — сразу видно, что магазин рабочий */}
      {tint(284, 2, 26, 11, NICHE.shop.key, 5.5)}
      {label(297, 11, '2', NICHE.shop.deep, 9, 'middle')}
      {[0, 1, 2, 3].map((i) => box(20 + i * 72, 34, 60, 46, 0.1, `t${i}`))}
      {[0, 1, 2, 3].map((i) => box(20 + i * 72, 86, 38, 4, 0.26, `n${i}`))}
      {[0, 1, 2, 3].map((i) => (i === 1 ? null : box(20 + i * 72, 96, 22, 4, 0.44, `p${i}`)))}
      {/* одна карточка «выбрана»: рамка цветом, цена и кнопка */}
      <rect x="92" y="34" width="60" height="46" fill="none" stroke={NICHE.shop.key} strokeOpacity={0.75} />
      {label(92, 100, '1 490 ₽', NICHE.shop.key)}
      {tint(92, 108, 68, 18, NICHE.shop.key, 9, 'buy')}
      {label(126, 121, 'В КОРЗИНУ', NICHE.shop.deep, 9, 'middle')}
      {[0, 1, 2, 3].map((i) => box(20 + i * 72, 140, 60, 44, 0.08, `t2${i}`))}
    </>
  ),

  // кафе: бронь в переписке и подтверждение
  bot: (
    <>
      {tint(90, 8, 140, 184, NICHE.bot.screen, 12, 'phone')}
      <rect x="90" y="8" width="140" height="184" rx="12" fill="none" stroke="currentColor" strokeOpacity={0.22} />
      {tint(90, 8, 140, 22, NICHE.bot.deep, 0, 'bar')}
      {label(102, 23, 'БОТ КАФЕ', NICHE.bot.key)}
      {/* исходящее: выбор времени */}
      {tint(112, 42, 106, 22, NICHE.bot.key, 9, 'out1')}
      {label(165, 57, 'СТОЛ НА 19:00', NICHE.bot.screen, 9, 'middle')}
      {/* подтверждение с галочкой — узнаваемый элемент ниши */}
      {tint(102, 74, 106, 22, '#22303c', 9, 'in2')}
      {label(110, 89, 'ЗАБРОНИРОВАН', NICHE.bot.ink)}
      <path
        d="M196 84 l3.5 3.5 l7 -7"
        fill="none"
        stroke={NICHE.bot.key}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* меню внутри переписки */}
      {[0, 1, 2].map((i) => (
        <rect
          key={`m${i}`}
          x={102}
          y={110 + i * 26}
          width={116}
          height={19}
          rx={9.5}
          fill="none"
          stroke={NICHE.bot.key}
          strokeOpacity={0.45}
        />
      ))}
      {label(112, 123, 'МЕНЮ', NICHE.bot.key)}
      {label(112, 149, 'ЗАКАЗ С СОБОЙ', NICHE.bot.key)}
      {label(112, 175, 'КАК ДОЕХАТЬ', NICHE.bot.key)}
    </>
  ),

  // мониторинг: аптайм, один сбой, время отклика
  status: (
    <>
      {box(0, 0, 320, 14, 0.14)}
      {box(10, 5, 34, 4, 0.5)}
      <circle cx="292" cy="8" r="3.5" fill={NICHE.ops.ok} />
      {label(20, 36, 'АПТАЙМ 30 ДНЕЙ', 'currentColor')}
      {label(20, 60, '99,98%', NICHE.ops.ok, 20)}
      {/* лента проверок: зелёная, один красный сбой — то, что продаёт мониторинг */}
      {Array.from({ length: 34 }).map((_, i) =>
        tint(20 + i * 8.4, 74, 5, 22, i === 21 ? NICHE.ops.bad : NICHE.ops.ok, 1, i)
      )}
      {label(20, 112, 'СБОЙ · 2 МИН', NICHE.ops.bad)}
      <path
        d="M20 176 L48 164 L76 170 L104 150 L132 158 L160 138 L188 146 L216 128 L244 136 L272 120 L300 126"
        fill="none"
        stroke={NICHE.ops.ok}
        strokeOpacity={0.75}
        strokeWidth="1.5"
      />
      <circle cx="216" cy="128" r="2.6" fill={NICHE.ops.ok} />
      {box(20, 186, 280, 1, 0.14)}
    </>
  )
};

export default function ConceptPreview({ kind }: { kind: string }) {
  return <>{PREVIEWS[kind] ?? null}</>;
}
