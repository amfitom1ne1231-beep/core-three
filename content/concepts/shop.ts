/**
 * Содержимое демо «Моток» — магазин пряжи.
 *
 * Почему пряжа. У демо нет и не может быть фотографий: ни съёмки,
 * ни права на сток. Для магазина это приговор — витрина без товара
 * не витрина. Кроме случая, когда товар и есть цвет с фактурой:
 * моток рисуется вектором честно, а не заменяется серым прямоугольником
 * с подписью «фото товара».
 *
 * Заодно это настоящая розница со всем, что в ней болит: варианты
 * одного товара, остатки по каждому цвету, партия красителя, порог
 * бесплатной доставки, самовывоз из точки.
 */

export const SHOP = {
  name: 'Моток',
  kind: 'Пряжа и всё для вязания',
  city: 'Казань',
  address: 'Профсоюзная, 12',
  hours: 'Ежедневно 10:00–20:00',
  phone: '+7 843 000-00-00',
  /** Порог бесплатной доставки по городу — механика, ради которой докладывают в корзину. */
  freeFrom: 3000,
  cityDelivery: 300
} as const;

export type Variant = {
  id: string;
  name: string;
  hex: string;
  /** Остаток в мотках. Ноль — цвет виден, но не кладётся: так и в жизни. */
  left: number;
};

export type Product = {
  id: string;
  group: 'wool' | 'cotton' | 'fluff' | 'tools';
  name: string;
  /** Строка состава — то, по чему пряжу выбирают в первую очередь. */
  spec: string;
  /** Метраж и вес мотка: без них цена ни о чём не говорит. */
  meters?: number;
  grams?: number;
  needles?: string;
  price: number;
  /** Сколько мотков уходит на свитер 46-го размера — вопрос, который задают всегда. */
  perSweater?: number;
  /** Чем рисовать товар: моток, спицы, кольца маркеров. */
  shape?: 'ball' | 'needles' | 'rings';
  variants: Variant[];
  note?: string;
};

export const GROUPS = [
  { id: 'all', label: 'Всё' },
  { id: 'wool', label: 'Шерсть' },
  { id: 'cotton', label: 'Хлопок и лён' },
  { id: 'fluff', label: 'Пух и альпака' },
  { id: 'tools', label: 'Инструменты' }
] as const;

export const PRODUCTS: Product[] = [
  {
    id: 'merino',
    group: 'wool',
    name: 'Меринос 100',
    spec: '100% меринос, 21 мкм',
    meters: 250,
    grams: 100,
    needles: '3,5–4 мм',
    price: 690,
    perSweater: 5,
    variants: [
      { id: 'milk', name: 'Молоко', hex: '#ece5d8', left: 24 },
      { id: 'oat', name: 'Овёс', hex: '#d3c3a7', left: 11 },
      { id: 'indigo', name: 'Индиго', hex: '#33466b', left: 6 },
      { id: 'moss', name: 'Мох', hex: '#5f7a52', left: 0 },
      { id: 'carmine', name: 'Кармин', hex: '#8e2f3c', left: 9 }
    ],
    note: 'Партия одна — берите с запасом на рукава.'
  },
  {
    id: 'tweed',
    group: 'wool',
    name: 'Твид',
    spec: '80% шерсть, 20% вискоза',
    meters: 175,
    grams: 50,
    needles: '3–3,5 мм',
    price: 540,
    perSweater: 9,
    variants: [
      { id: 'graphite', name: 'Графит', hex: '#3a3d42', left: 14 },
      { id: 'heather', name: 'Вереск', hex: '#7f6a8f', left: 7 },
      { id: 'brick', name: 'Терракота', hex: '#b4593c', left: 3 }
    ]
  },
  {
    id: 'sock',
    group: 'wool',
    name: 'Носочная',
    spec: '75% шерсть, 25% нейлон',
    meters: 420,
    grams: 100,
    needles: '2,5 мм',
    price: 620,
    perSweater: 0,
    variants: [
      { id: 'sky', name: 'Небо', hex: '#87a7c4', left: 18 },
      { id: 'powder', name: 'Пудра', hex: '#d3a9a0', left: 12 },
      { id: 'graphite', name: 'Графит', hex: '#3a3d42', left: 21 }
    ],
    note: 'Пятка и мысок держатся за счёт нейлона.'
  },
  {
    id: 'cotton',
    group: 'cotton',
    name: 'Хлопок лён',
    spec: '55% хлопок, 45% лён',
    meters: 210,
    grams: 50,
    needles: '3 мм',
    price: 470,
    perSweater: 8,
    variants: [
      { id: 'milk', name: 'Молоко', hex: '#efe9df', left: 16 },
      { id: 'sky', name: 'Небо', hex: '#87a7c4', left: 4 },
      { id: 'moss', name: 'Мох', hex: '#5f7a52', left: 10 }
    ]
  },
  {
    id: 'alpaca',
    group: 'fluff',
    name: 'Альпака софт',
    spec: '70% альпака, 30% меринос',
    meters: 190,
    grams: 50,
    needles: '4–4,5 мм',
    price: 810,
    perSweater: 7,
    variants: [
      { id: 'oat', name: 'Овёс', hex: '#d8cbb6', left: 9 },
      { id: 'heather', name: 'Вереск', hex: '#7f6a8f', left: 5 },
      { id: 'indigo', name: 'Индиго', hex: '#33466b', left: 2 }
    ],
    note: 'Тянется под весом: на длинный кардиган взять спицы тоньше.'
  },
  {
    id: 'mohair',
    group: 'fluff',
    name: 'Кидмохер',
    spec: '72% кидмохер, 28% шёлк',
    meters: 250,
    grams: 25,
    needles: '3,5 мм в две нити',
    price: 590,
    perSweater: 6,
    variants: [
      { id: 'powder', name: 'Пудра', hex: '#dcb2a8', left: 13 },
      { id: 'milk', name: 'Молоко', hex: '#f0ebe2', left: 20 },
      { id: 'carmine', name: 'Кармин', hex: '#8e2f3c', left: 0 }
    ]
  },
  {
    id: 'needles',
    group: 'tools',
    name: 'Спицы круговые',
    spec: 'Сталь, леска 80 см',
    price: 890,
    shape: 'needles',
    variants: [
      { id: '3', name: '3 мм', hex: '#b9bec4', left: 8 },
      { id: '35', name: '3,5 мм', hex: '#b9bec4', left: 6 },
      { id: '4', name: '4 мм', hex: '#b9bec4', left: 11 }
    ]
  },
  {
    id: 'markers',
    group: 'tools',
    name: 'Маркеры петель',
    spec: 'Набор 20 шт',
    price: 240,
    shape: 'rings',
    variants: [{ id: 'mix', name: 'Ассорти', hex: '#c9a56b', left: 30 }]
  }
];

export const COPY = {
  nav: [
    { label: 'Каталог', href: '#catalog' },
    { label: 'Доставка', href: '#delivery' },
    { label: 'О лавке', href: '#about' }
  ],
  hero: {
    label: `${SHOP.city} · ${SHOP.address}`,
    // Unbounded — широкая гарнитура: «Пряжа, которую видно на просвет»
    // разъезжалось на четыре строки и съедало первый экран целиком.
    title: 'Видно',
    titleAccent: 'на просвет',
    lead:
      'Восемь позиций, которые держим всегда, и остаток по каждому цвету — честный. Заказ собираем в день обращения, отдаём в лавке или привозим по городу.',
    primary: 'Смотреть каталог',
    secondary: 'Как получить',
    facts: ['Остатки по цветам обновляются', 'Самовывоз за 2 часа', `Доставка от ${SHOP.freeFrom} ₽ — бесплатно`]
  },
  catalog: {
    label: 'Каталог',
    title: 'Что есть сейчас',
    lead: 'Цвет на экране — приблизительный: партия крашения у шерсти всегда своя.'
  },
  delivery: {
    label: 'Как получить',
    title: 'Доставка и самовывоз',
    items: [
      {
        title: 'Самовывоз из лавки',
        text: `${SHOP.address}, ${SHOP.hours}. Соберём за два часа, придержим три дня.`,
        price: 'бесплатно'
      },
      {
        title: 'Курьером по городу',
        text: 'Привезём на следующий день, время выбираете при оформлении.',
        price: `${SHOP.cityDelivery} ₽, от ${SHOP.freeFrom} ₽ — бесплатно`
      },
      {
        title: 'Почтой по России',
        text: 'Отправляем после оплаты, трек приходит в СМС.',
        price: 'по тарифу'
      }
    ]
  },
  about: {
    label: 'О лавке',
    title: 'Маленькая, зато своя',
    text:
      'Мы держим лавку вдвоём седьмой год. Не берём всё подряд: в каталоге остаётся то, что сами вязали и знаем, как оно ведёт себя после стирки. Если сомневаетесь в цвете — приходите смотреть вживую, отложим.',
    stats: [
      { value: '7 лет', text: 'на Профсоюзной' },
      { value: '8', text: 'позиций в постоянном наличии' },
      { value: '2 часа', text: 'на сборку самовывоза' }
    ]
  }
} as const;
