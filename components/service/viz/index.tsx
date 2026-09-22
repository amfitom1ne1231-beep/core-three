import type { ComponentType } from 'react';
import { Bar, Box, Scene, Tag, fade, grow, rise } from './kit';

/**
 * Мини-схемы для состава работы.
 *
 * В кадре справа от перечня стояла фактура материала и гигантская
 * цифра: нажимаешь «Быстрая загрузка» — видишь текстуру и «02».
 * Красиво, но о самом пункте это не говорило ничего.
 *
 * Схем двенадцать на двадцать четыре пункта четырёх направлений:
 * «оплата в переписке» и «сценарий разговора» — один и тот же разговор,
 * «выгрузка к вам» и «формы заявок» — одна и та же таблица строк.
 * Пункт называет схему полем `viz` в `content/services.ts`; не назвал —
 * остаётся прежний кадр, и ничего не ломается.
 *
 * Ни одной цифры, которую нельзя подтвердить: схема показывает
 * устройство, а не показатели. Выдуманные «0,9 с» и «+40% конверсии»
 * на сайте про честность были бы ровно тем, чем являются.
 */

/**
 * Подпись под схемой. Схем меньше, чем пунктов, и одна схема служит
 * нескольким: разговор — и сценарию бота, и уведомлениям команде. Своя
 * подпись у пункта (`vizNote` в `content/services.ts`) говорит, про что
 * именно эта схема; без неё остаётся общая.
 */
export type VizProps = { note?: string };

/* ---------------- 01. структура страницы ---------------- */
const Blocks = ({ note }: VizProps) => (
  <Scene>
    <Box className="absolute inset-x-[8%] inset-y-[6%] flex flex-col gap-[7%] p-[6%]">
      <div className="flex items-center justify-between" style={rise(60)}>
        <Bar w="18%" h={6} tone={0.4} />
        <div className="flex gap-1.5">
          <Bar w={16} h={4} /> <Bar w={16} h={4} /> <Bar w={16} h={4} />
        </div>
      </div>
      <div className="flex flex-col gap-2" style={rise(180)}>
        <Bar w="72%" h={11} tone={0.5} />
        <Bar w="52%" h={11} tone={0.5} />
      </div>
      <div className="flex flex-col gap-1.5" style={rise(300)}>
        <Bar w="86%" /> <Bar w="78%" /> <Bar w="64%" />
      </div>
      <div className="mt-auto flex items-center gap-2" style={rise(420)}>
        <span className="block h-6 w-24 border" style={{ borderColor: 'var(--accent)', background: 'var(--accent)', opacity: 0.85 }} />
        <span className="block h-6 w-20 border border-line-strong" />
      </div>
    </Box>
    <Tag className="absolute bottom-[2%] left-[8%]">{note ?? 'порядок чтения'}</Tag>
  </Scene>
);

/* ---------------- 02. скорость загрузки ---------------- */
const Speed = ({ note }: VizProps) => (
  <Scene>
    <div className="absolute inset-x-[8%] top-[34%]">
      <div className="relative h-[10px] w-full border border-line-strong">
        <span className="absolute left-0 top-0 h-full origin-left" style={{ width: '46%', background: 'var(--accent)', ...grow(120) }} />
        <span className="absolute left-0 top-0 h-full origin-left" style={{ width: '100%', background: 'rgb(var(--fg-rgb) / 0.12)', ...grow(120, 1.4) }} />
      </div>
      <span className="absolute -top-[14px] h-[38px] w-px" style={{ left: '46%', background: 'var(--accent)', ...fade(700) }} />
      <Tag className="absolute top-[30px] -translate-x-1/2 text-fg" style={{ left: '46%', ...fade(820) }}>
        первый экран
      </Tag>
      <Tag className="absolute top-[30px] right-0" style={fade(980)}>{note ?? 'остальное догружается'}</Tag>
    </div>
  </Scene>
);

/* ---------------- 03. ссылка в поиске и мессенджере ---------------- */
const LinkCard = ({ note }: VizProps) => (
  <Scene>
    <Box className="absolute inset-x-[12%] top-[14%] overflow-hidden" style={rise(60)}>
      <div className="h-[86px] w-full" style={{ background: 'rgb(var(--fg-rgb) / 0.08)', ...fade(220) }} />
      <div className="flex flex-col gap-2 p-4">
        <Bar w="64%" h={8} tone={0.5} style={rise(340)} />
        <Bar w="88%" style={rise(430)} />
        <Bar w="72%" style={rise(500)} />
      </div>
    </Box>
    <Tag className="absolute bottom-[10%] left-[12%]" style={fade(640)}>{note ?? 'заголовок · описание · адрес'}</Tag>
  </Scene>
);

/* ---------------- 04. строки падают в таблицу ---------------- */
const Rows = ({ note }: VizProps) => (
  <Scene>
    <Box className="absolute inset-x-[8%] top-[16%] p-4">
      <div className="flex items-center justify-between pb-2" style={fade(60)}>
        <Tag>имя</Tag><Tag>контакт</Tag><Tag>задача</Tag>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-t border-line py-2.5"
          style={rise(220 + i * 160)}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: i === 2 ? 'var(--accent)' : 'rgb(var(--fg-rgb) / 0.25)' }}
          />
          <Bar w="26%" tone={i === 2 ? 0.5 : 0.22} />
          <Bar w="30%" tone={i === 2 ? 0.5 : 0.22} />
          <Bar w="22%" tone={i === 2 ? 0.5 : 0.22} />
        </div>
      ))}
    </Box>
    <Tag className="absolute bottom-[8%] left-[8%] text-fg" style={fade(760)}>{note ?? 'новая строка'}</Tag>
  </Scene>
);

/* ---------------- 05. цифры и воронка ---------------- */
const Chart = ({ note }: VizProps) => (
  <Scene>
    <div className="absolute inset-x-[10%] bottom-[24%] flex h-[46%] items-end gap-[3.5%]">
      {[34, 52, 44, 68, 58, 88].map((h, i) => (
        <span
          key={i}
          className="flex-1 origin-bottom"
          style={{
            height: `${h}%`,
            background: i === 5 ? 'var(--accent)' : 'rgb(var(--fg-rgb) / 0.18)',
            animation: `ct-rise .6s cubic-bezier(0.22,1,0.36,1) ${80 + i * 90}ms both`
          }}
        />
      ))}
    </div>
    <span className="absolute inset-x-[10%] bottom-[24%] h-px bg-line-strong" style={fade(60)} />
    <Tag className="absolute bottom-[14%] left-[10%]" style={fade(700)}>{note ?? 'цель · заявка отправлена'}</Tag>
  </Scene>
);

/* ---------------- 06. разговор ---------------- */
const Chat = ({ note }: VizProps) => (
  <Scene>
    <div className="absolute inset-x-[10%] top-[14%] flex flex-col gap-3">
      <Box className="max-w-[76%] rounded-[10px] rounded-tl-[2px] p-3" style={rise(80)}>
        <Bar w="90%" /> <Bar w="64%" style={{ marginTop: 6 }} />
      </Box>
      <div className="self-end rounded-[10px] rounded-tr-[2px] px-3 py-2.5" style={{ background: 'var(--accent)', ...rise(340) }}>
        <Bar w={56} tone={0.9} style={{ background: 'rgb(255 255 255 / .85)' }} />
      </div>
      <div className="flex gap-2" style={fade(560)}>
        <span className="rounded-full border border-line-strong px-3 py-1.5"><Bar w={34} /></span>
        <span className="rounded-full border border-line-strong px-3 py-1.5"><Bar w={26} /></span>
      </div>
    </div>
    <Tag className="absolute bottom-[8%] left-[10%]" style={fade(700)}>{note ?? 'сценарий с кнопками'}</Tag>
  </Scene>
);

/* ---------------- 07. каталог ---------------- */
const Grid = ({ note }: VizProps) => (
  <Scene>
    <div className="absolute inset-x-[8%] top-[12%] flex gap-2" style={fade(60)}>
      <span className="rounded-full border px-3 py-1" style={{ borderColor: 'var(--accent)' }}><Bar w={22} tone={0.55} /></span>
      <span className="rounded-full border border-line-strong px-3 py-1"><Bar w={18} /></span>
      <span className="rounded-full border border-line-strong px-3 py-1"><Bar w={26} /></span>
    </div>
    <div className="absolute inset-x-[8%] top-[30%] grid grid-cols-3 gap-2.5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Box key={i} className={`h-[62px] p-2 ${i === 1 ? 'border-accent' : ''}`} style={rise(160 + i * 70)}>
          <span className="block h-[26px] w-full" style={{ background: 'rgb(var(--fg-rgb) / 0.1)' }} />
          <Bar w="70%" style={{ marginTop: 8 }} />
        </Box>
      ))}
    </div>
    <Tag className="absolute bottom-[8%] left-[8%]" style={fade(700)}>{note ?? 'фильтр · карточка'}</Tag>
  </Scene>
);

/* ---------------- 08. корзина ---------------- */
const Cart = ({ note }: VizProps) => (
  <Scene>
    <Box className="absolute inset-x-[12%] top-[14%] p-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2.5" style={rise(80 + i * 150)}>
          <span className="h-8 w-8 shrink-0" style={{ background: 'rgb(var(--fg-rgb) / 0.1)' }} />
          <Bar w="42%" />
          <Bar w="16%" tone={0.35} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between border-t border-line pt-3" style={rise(400)}>
        <Tag>итого</Tag>
        <Bar w={54} h={8} tone={0.55} />
      </div>
      <span className="mt-3 block h-8 w-full" style={{ background: 'var(--accent)', opacity: 0.85, ...rise(540) }} />
    </Box>
    <Tag className="absolute bottom-[8%] left-[12%]" style={fade(680)}>{note ?? 'путь до оформленного заказа'}</Tag>
  </Scene>
);

/* ---------------- 09. оплата ---------------- */
const Pay = ({ note }: VizProps) => (
  <Scene>
    <Box className="absolute left-[12%] top-[22%] h-[104px] w-[168px] p-3" style={rise(80)}>
      <span className="block h-4 w-full" style={{ background: 'rgb(var(--fg-rgb) / 0.14)', ...fade(240) }} />
      <div className="mt-6 flex gap-1.5" style={fade(360)}>
        {[0, 1, 2, 3].map((i) => <Bar key={i} w={18} h={4} />)}
      </div>
    </Box>
    <div className="absolute right-[14%] top-[30%] flex flex-col items-center gap-3">
      <svg viewBox="0 0 36 36" className="h-11 w-11" fill="none" aria-hidden>
        <circle cx="18" cy="18" r="16" stroke="var(--accent)" strokeWidth="1.2" style={fade(560)} />
        <path
          d="M11 18.6 16 23.5 25.5 13"
          stroke="var(--accent)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="26"
          style={{ animation: 'ct-draw .55s cubic-bezier(0.22,1,0.36,1) 700ms both' }}
        />
      </svg>
      <Tag className="text-fg" style={fade(900)}>{note ?? 'чек'}</Tag>
    </div>
  </Scene>
);

/* ---------------- 10. доставка и самовывоз ---------------- */
const Route = ({ note }: VizProps) => (
  <Scene>
    <div className="absolute inset-x-[12%] top-[40%]">
      <span className="block h-px w-full" style={{ background: 'rgb(var(--fg-rgb) / 0.2)', ...fade(60) }} />
      <span className="absolute left-0 top-0 block h-px origin-left" style={{ width: '100%', background: 'var(--accent)', ...grow(240, 1.2) }} />
      <span className="absolute left-0 top-[-4px] h-2 w-2 rounded-full" style={{ background: 'var(--accent)', ...fade(200) }} />
      <span className="absolute right-0 top-[-5px] h-2.5 w-2.5 rotate-45 border" style={{ borderColor: 'var(--accent)', ...fade(1200) }} />
      <Tag className="absolute left-0 top-4">склад</Tag>
      <Tag className="absolute right-0 top-4 text-fg">{note ?? 'курьер или пункт'}</Tag>
    </div>
  </Scene>
);

/* ---------------- 11. проверки и бэкапы ---------------- */
const Pulse = ({ note }: VizProps) => (
  <Scene>
    <div className="absolute inset-x-[8%] top-[34%] flex h-[70px] items-end gap-[6px]">
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="flex-1 origin-bottom"
          style={{
            height: i === 12 ? '100%' : `${38 + ((i * 37) % 26)}%`,
            background: i === 12 ? 'var(--accent)' : 'rgb(var(--fg-rgb) / 0.2)',
            animation: `ct-rise .4s cubic-bezier(0.22,1,0.36,1) ${60 + i * 45}ms both`
          }}
        />
      ))}
    </div>
    <span className="absolute inset-x-[8%] top-[calc(34%+70px)] h-px bg-line" style={fade(60)} />
    <div className="absolute inset-x-[8%] top-[calc(34%+88px)] flex justify-between">
      <Tag style={fade(900)}>проверка прошла</Tag>
      <Tag className="text-fg" style={fade(980)}>{note ?? 'здесь заметили'}</Tag>
    </div>
  </Scene>
);

/* ---------------- 12. сроки и запись ---------------- */
const Calendar = ({ note }: VizProps) => (
  <Scene>
    <div className="absolute inset-x-[16%] top-[20%] grid grid-cols-7 gap-1.5">
      {Array.from({ length: 21 }, (_, i) => (
        <span
          key={i}
          className="aspect-square border"
          style={{
            borderColor: i === 11 ? 'var(--accent)' : 'rgb(var(--fg-rgb) / 0.14)',
            background: i === 11 ? 'rgb(var(--accent-rgb, 110 155 204) / 0.18)' : 'transparent',
            animation: `ct-veil .4s ease ${40 + i * 22}ms both`
          }}
        />
      ))}
    </div>
    <Tag className="absolute bottom-[14%] left-[16%] text-fg" style={fade(700)}>{note ?? 'занятый слот'}</Tag>
  </Scene>
);

export const VIZ: Record<string, ComponentType<VizProps>> = {
  blocks: Blocks,
  speed: Speed,
  link: LinkCard,
  rows: Rows,
  chart: Chart,
  chat: Chat,
  grid: Grid,
  cart: Cart,
  pay: Pay,
  route: Route,
  pulse: Pulse,
  calendar: Calendar
};
