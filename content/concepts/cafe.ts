/**
 * Содержимое демо «Кафе: бот и меню».
 *
 * Клиент вымышленный: «Сорока», кофейня с завтраками. Продукт здесь —
 * не сайт, а то, что живёт в Telegram: бот для брони и мини-приложение
 * с меню. Сайт вокруг них нужен, чтобы человеку было куда прийти
 * из поиска, и чтобы оттуда открывался тот же бот.
 *
 * Меню настоящего заведения сложнее выдуманного: заказ кофе — это
 * на восемьдесят процентов модификаторы. Поэтому размер, молоко, сироп
 * и зёрна вынесены в общие группы, а не вписаны в названия позиций:
 * у настоящего кафе они меняются одним местом для всего меню.
 */

export type Choice = { id: string; label: string; add?: number };
export type Group = {
  id: string;
  label: string;
  /** Обязательная группа: без выбора в корзину не положить. */
  required?: boolean;
  /** Можно выбрать несколько (добавки к завтракам). */
  multi?: boolean;
  choices: Choice[];
};

export type Dish = {
  id: string;
  name: string;
  note: string;
  price: number;
  /** id групп модификаторов из GROUPS */
  groups?: string[];
  tag?: string;
};

export type Section = { id: string; label: string; note?: string; dishes: Dish[] };

export const CAFE = {
  name: 'Сорока',
  kind: 'кофе и завтраки',
  domain: 'soroka.cafe',
  tg: '@soroka_cafe',
  address: 'Покровка, 27',
  city: 'Москва',
  hours: [
    { days: 'пн — пт', time: '8:00 — 22:00' },
    { days: 'сб — вс', time: '9:00 — 23:00' }
  ],
  phone: '+7 495 000-00-00'
};

/** Общие группы модификаторов: меняются одним местом для всего меню. */
export const GROUPS: Record<string, Group> = {
  size: {
    id: 'size',
    label: 'Объём',
    required: true,
    choices: [
      { id: 's', label: '200 мл' },
      { id: 'm', label: '300 мл', add: 40 },
      { id: 'l', label: '400 мл', add: 70 }
    ]
  },
  milk: {
    id: 'milk',
    label: 'Молоко',
    required: true,
    choices: [
      { id: 'cow', label: 'Коровье' },
      { id: 'oat', label: 'Овсяное', add: 60 },
      { id: 'free', label: 'Безлактозное', add: 60 },
      { id: 'almond', label: 'Миндальное', add: 70 }
    ]
  },
  syrup: {
    id: 'syrup',
    label: 'Сироп',
    required: true,
    choices: [
      { id: 'none', label: 'Без сиропа' },
      { id: 'caramel', label: 'Солёная карамель', add: 50 },
      { id: 'vanilla', label: 'Ваниль', add: 50 },
      { id: 'hazel', label: 'Фундук', add: 50 }
    ]
  },
  beans: {
    id: 'beans',
    label: 'Зерно',
    required: true,
    choices: [
      { id: 'eth', label: 'Эфиопия Гуджи · ягодный' },
      { id: 'bra', label: 'Бразилия Можиана · ореховый' }
    ]
  },
  extras: {
    id: 'extras',
    label: 'Добавить',
    multi: true,
    choices: [
      { id: 'sour', label: 'Сметана', add: 60 },
      { id: 'jam', label: 'Варенье из ревеня', add: 60 },
      { id: 'egg', label: 'Яйцо пашот', add: 90 },
      { id: 'bacon', label: 'Бекон', add: 120 }
    ]
  }
};

export const MENU: Section[] = [
  {
    id: 'coffee',
    label: 'Кофе',
    note: 'Обжариваем сами по вторникам',
    dishes: [
      { id: 'espresso', name: 'Эспрессо', note: 'Двойной, 18 г', price: 160, groups: ['beans'] },
      { id: 'americano', name: 'Американо', note: 'С водой или молоком отдельно', price: 190, groups: ['size', 'beans'] },
      {
        id: 'cappuccino',
        name: 'Капучино',
        note: 'Плотная пена, без сахара',
        price: 240,
        groups: ['size', 'milk', 'syrup', 'beans'],
        tag: 'Берут чаще всего'
      },
      { id: 'flat', name: 'Флэт-уайт', note: 'Два эспрессо, тонкая пена', price: 260, groups: ['milk', 'beans'] },
      { id: 'latte', name: 'Латте', note: 'Мягкий, для долгого утра', price: 250, groups: ['size', 'milk', 'syrup'] },
      { id: 'raf', name: 'Раф на банане', note: 'Сливки, банан, щепотка соли', price: 290, groups: ['size'] },
      { id: 'filter', name: 'Фильтр V60', note: 'Заваривается семь минут', price: 220, groups: ['beans'] }
    ]
  },
  {
    id: 'breakfast',
    label: 'Завтраки',
    note: 'До 12:00, по выходным до 14:00',
    dishes: [
      {
        id: 'syrniki',
        name: 'Сырники',
        note: 'Четыре штуки, сметана в комплекте',
        price: 390,
        groups: ['extras'],
        tag: 'Берут чаще всего'
      },
      { id: 'omlet', name: 'Омлет с томатами и фетой', note: 'Три яйца, хлеб на закваске', price: 420, groups: ['extras'] },
      { id: 'porridge', name: 'Каша дня', note: 'Сегодня — овсяная с грушей', price: 260 },
      { id: 'toast', name: 'Тост с авокадо', note: 'Закваска, авокадо, семечки', price: 440, groups: ['extras'] }
    ]
  },
  {
    id: 'bakery',
    label: 'Выпечка',
    note: 'Печём к семи утра',
    dishes: [
      { id: 'croissant', name: 'Круассан', note: 'Классический, слоёный', price: 180 },
      { id: 'cinnamon', name: 'Улитка с корицей', note: 'С кардамоном', price: 210 },
      { id: 'banana', name: 'Банановый хлеб', note: 'С грецким орехом', price: 190 }
    ]
  },
  {
    id: 'other',
    label: 'Ещё',
    dishes: [
      { id: 'matcha', name: 'Матча', note: 'Церемониальная, на овсяном', price: 290, groups: ['size'] },
      { id: 'cocoa', name: 'Какао', note: 'Тёмный шоколад 54%', price: 240, groups: ['size', 'milk'] },
      { id: 'lemonade', name: 'Лимонад малина-базилик', note: 'Готовим сами', price: 220 }
    ]
  }
];

export const dishById = (id: string) => MENU.flatMap((s) => s.dishes).find((d) => d.id === id);

/* ======================= сценарий бота ======================= */

export type BotStep = {
  id: string;
  bot: string[];
  /** Что произошло на стороне заведения — подпись под репликой. */
  note?: string;
  options?: { label: string; reply: string; next?: string; open?: 'app' }[];
};

export const BOT = {
  handle: 'бот кофейни · отвечает сразу',
  start: 'hello',
  steps: {
    hello: {
      id: 'hello',
      bot: ['Доброе утро! Это «Сорока» на Покровке.', 'Забронирую стол, покажу меню или соберу заказ с собой.'],
      options: [
        { label: 'Забронировать стол', reply: 'Забронировать стол', next: 'guests' },
        { label: 'Меню и заказ', reply: 'Меню и заказ', open: 'app' as const },
        { label: 'Как вас найти', reply: 'Как вас найти', next: 'where' }
      ]
    },

    /* --- бронь --- */
    guests: {
      id: 'guests',
      bot: ['Сколько вас будет?'],
      options: [
        { label: 'Двое', reply: 'Двое', next: 'day' },
        { label: 'Трое-четверо', reply: 'Трое-четверо', next: 'day' },
        { label: 'Больше четырёх', reply: 'Больше четырёх', next: 'big' }
      ]
    },
    day: {
      id: 'day',
      bot: ['На какой день?'],
      options: [
        { label: 'Сегодня', reply: 'Сегодня', next: 'time' },
        { label: 'Завтра', reply: 'Завтра', next: 'time' },
        { label: 'Выбрать дату', reply: 'Выбрать дату', next: 'time' }
      ]
    },
    time: {
      id: 'time',
      bot: ['Свободно вот это. Столы у окна заканчиваются первыми.'],
      options: [
        { label: '09:30 · у окна', reply: '09:30, у окна', next: 'booked' },
        { label: '12:00 · в зале', reply: '12:00, в зале', next: 'booked' },
        { label: '19:00 · у окна', reply: '19:00, у окна', next: 'booked' }
      ]
    },
    big: {
      id: 'big',
      bot: [
        'Для компании больше четырёх держим длинный стол у окна — его согласует управляющая.',
        'Оставьте телефон, перезвонит в течение десяти минут.'
      ],
      note: 'Заявка ушла в рабочий чат смены',
      options: [
        { label: 'Оставить телефон', reply: 'Оставить телефон', next: 'called' },
        { label: 'Вернуться в начало', reply: 'В начало', next: 'hello' }
      ]
    },
    called: {
      id: 'called',
      bot: ['Передали. Наберём с номера кофейни.'],
      note: 'Контакт в CRM, задача с напоминанием поставлена',
      options: [
        { label: 'Посмотреть меню', reply: 'Меню', open: 'app' as const },
        { label: 'Спасибо', reply: 'Спасибо', next: 'bye' }
      ]
    },
    booked: {
      id: 'booked',
      bot: ['Стол ваш. Напоминание придёт за два часа.', 'Если планы поменяются — напишите сюда, отменю за секунду.'],
      note: 'Бронь в таблице и в календаре смены, стол помечен занятым',
      options: [
        { label: 'Заказать заранее', reply: 'Заказать заранее', open: 'app' as const },
        { label: 'Спасибо', reply: 'Спасибо', next: 'bye' }
      ]
    },

    /* --- адрес --- */
    where: {
      id: 'where',
      bot: [
        'Покровка, 27. Вход со двора, синяя дверь под аркой.',
        'Пн–пт с 8:00, сб–вс с 9:00. Завтраки до 12:00, по выходным до 14:00.'
      ],
      options: [
        { label: 'Забронировать стол', reply: 'Забронировать стол', next: 'guests' },
        { label: 'Меню и заказ', reply: 'Меню и заказ', open: 'app' as const }
      ]
    },

    /* --- возврат из мини-приложения --- */
    ordered: {
      id: 'ordered',
      bot: ['Заказ принят, уже на баре.', 'Чек и номер заказа — выше. Придёт уведомление, когда всё будет готово.'],
      note: 'Заказ на экране бариста, оплата проведена, чек отправлен',
      options: [
        { label: 'Забронировать стол', reply: 'Забронировать стол', next: 'guests' },
        { label: 'Спасибо', reply: 'Спасибо', next: 'bye' }
      ]
    },

    bye: {
      id: 'bye',
      bot: ['Ждём. Если что — просто напишите сюда, читаем всё.'],
      options: [{ label: 'В начало', reply: 'В начало', next: 'hello' }]
    }
  } as Record<string, BotStep>
};

/* ======================= тексты сайта ======================= */

export const COPY = {
  nav: [
    { label: 'Меню', href: '#menu' },
    { label: 'В Telegram', href: '#telegram' },
    { label: 'Адрес', href: '#where' }
  ],
  hero: {
    title: 'Кофе, который',
    titleAccent: 'помнит вас',
    lead:
      'Кофейня на Покровке. Обжариваем сами, завтраки готовим до двух часов дня, а стол бронируем в переписке — за двадцать секунд, без звонков.',
    primary: 'Открыть в Telegram',
    secondary: 'Посмотреть меню',
    meta: ['Покровка, 27 · вход со двора', 'Сегодня до 22:00']
  },
  telegram: {
    label: 'Всё в Telegram',
    title: 'Бронь и заказ —',
    titleAccent: 'в одной переписке',
    lead: 'Приложение ставить не нужно: меню открывается внутри Telegram, оплата проходит там же.',
    hint: 'Телефон рабочий — нажимайте',
    points: [
      {
        n: '01',
        title: 'Стол за двадцать секунд',
        text: 'Бот спрашивает, сколько вас и когда. Бронь сразу попадает в календарь смены — администратору ничего не надо переписывать.'
      },
      {
        n: '02',
        title: 'Меню с модификаторами',
        text: 'Объём, молоко, сироп, зерно. Цена пересчитывается на месте, и на бар заказ приходит собранным, а не «капучино, уточните».'
      },
      {
        n: '03',
        title: 'Оплата не выходя из чата',
        text: 'Счёт приходит в ту же переписку. После оплаты заказ появляется на экране бариста, а гостю — время готовности.'
      }
    ]
  },
  menu: {
    label: 'Меню',
    title: 'Что у нас есть',
    lead: 'Цены здесь и в Telegram берутся из одной таблицы: меняем в одном месте — обновляется везде. Объём, молоко, сироп, зерно и добавки выбираются при заказе в приложении.'
  },
  where: {
    label: 'Адрес',
    title: 'Найти нас',
    lead: 'Вход со двора, синяя дверь под аркой. Внутри четырнадцать мест и длинный стол у окна.',
    note: 'Длинный стол на компанию бронирует управляющая — напишите в бот, перезвонит.'
  },
  footer: {
    by: 'Сайт, бот и мини-приложение — CoreThree'
  },
  app: {
    title: 'Меню',
    cart: 'Корзина',
    empty: 'Пока пусто. Загляните в кофе.',
    add: 'В корзину',
    toCart: 'Перейти к заказу',
    checkout: 'Оформить',
    pay: 'Оплатить',
    where: 'Куда',
    hereLabel: 'В зале',
    hereNote: 'Принесём за стол',
    awayLabel: 'С собой',
    awayNote: 'Заберёте на баре',
    when: 'Когда',
    soon: 'Как можно скорее',
    comment: 'Комментарий бариста',
    commentHint: 'Например: без сахара, стакан с собой',
    total: 'Итого',
    doneTitle: 'Заказ принят',
    doneText: 'Номер заказа',
    doneWhen: 'Будет готов через',
    back: 'Вернуться в чат'
  }
};
