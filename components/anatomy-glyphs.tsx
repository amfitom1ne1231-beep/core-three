/**
 * Глифы слоёв схемы. Рисуются в квадрате 24×24, только штрихом —
 * так они остаются чёткими при любом масштабе и наследуют цвет состояния.
 */
const GLYPHS: Record<string, React.ReactNode> = {
  // курсор: посетитель приходит
  visitor: (
    <>
      <path d="M4 3 L4 17 L8.5 13 L11.5 20 L14 19 L11 12 L17 11 Z" />
    </>
  ),
  // окно браузера: фронт
  front: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="1.5" />
      <path d="M2.5 9 H21.5" />
      <path d="M5.5 6.5 h2 M9 6.5 h2" />
    </>
  ),
  // слои данных: контент и каталог
  data: (
    <>
      <path d="M3 7 C3 5.3 7 4 12 4 C17 4 21 5.3 21 7 C21 8.7 17 10 12 10 C7 10 3 8.7 3 7 Z" />
      <path d="M3 7 V17 C3 18.7 7 20 12 20 C17 20 21 18.7 21 17 V7" />
      <path d="M3 12 C3 13.7 7 15 12 15 C17 15 21 13.7 21 12" />
    </>
  ),
  // диалог со искрой: автоматизация
  auto: (
    <>
      <path d="M3 5.5 h18 v10 h-9 l-4.5 4 v-4 H3 Z" />
      <path d="M11 8.5 l1.2 2.3 2.3 1.2 -2.3 1.2 -1.2 2.3 -1.2 -2.3 -2.3 -1.2 2.3 -1.2 Z" />
    </>
  ),
  // карта: платежи и CRM
  money: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <path d="M2.5 9.5 H21.5" />
      <path d="M6 14.5 h5" />
    </>
  ),
  // пульс: мониторинг
  ops: (
    <>
      <path d="M2 12 h4.5 l2.5 -6 3.5 12 2.5 -6 H22" />
    </>
  )
};

export default function Glyph({ id, x, y }: { id: string; x: number; y: number }) {
  const shape = GLYPHS[id];
  if (!shape) return null;
  return (
    <g className="node-glyph" transform={`translate(${x} ${y})`} aria-hidden>
      {shape}
    </g>
  );
}
