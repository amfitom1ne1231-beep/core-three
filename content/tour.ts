import { ABOUT } from './about.ts';

/**
 * Экскурсия по сайту (HELP.md, этап 5): сайт затемняется, «окно» остаётся
 * на одном элементе, рядом подпись простыми словами.
 *
 * У каждой страницы своя короткая — «что на этой странице»; экскурсия
 * главной — она же обзор всего сайта: меню, свет, заявка, путь заказа,
 * направления, концепты, связь, «Помощь».
 *
 * Шаг ищет цель по списку селекторов и берёт первую, что видна: на
 * телефоне ссылок шапки нет — там окно встаёт на кнопку меню, и подпись
 * у варианта может быть своя. Не нашлось ничего — шаг пропускается,
 * поэтому, например, шаг «слова с пунктиром» есть только там, где они есть.
 *
 * Цели — метки `data-tour` и подписи разделов (`aria-label`), а не
 * классы оформления: классы меняются при каждой доводке вёрстки.
 */

export type Target = { sel: string; text?: string };
export type TourStep = {
  title: string;
  text: string;
  targets: Target[];
  /** Цель в шапке: страница сначала уезжает наверх, иначе шапка спрятана. */
  top?: boolean;
};

const section = (label: string) => `main section[aria-label="${label}"]`;
const MENU = '[data-tour="menu"]';

const HOME: TourStep[] = [
  {
    title: 'Меню',
    text: 'Все разделы сайта: услуги, концепты, о нас и помощь.',
    targets: [{ sel: 'header nav[aria-label="Разделы"]' }, { sel: MENU, text: 'За этой кнопкой — все разделы сайта и кнопка заявки.' }],
    top: true
  },
  {
    title: 'Свет',
    text: 'Круглая кнопка меняет оформление сайта: светлое или тёмное. Выбор запомнится.',
    targets: [{ sel: 'header button[aria-label^="Свет"]' }],
    top: true
  },
  {
    title: 'Заявка',
    text: '«Обсудить проект» есть на каждой странице: пять вопросов кликами — и ответим в течение дня.',
    targets: [{ sel: 'header a.cta' }],
    top: true
  },
  {
    title: 'Как это устроено',
    text: 'Путь одного заказа — от поиска до денег на счёте. Нажмите на шаг: покажем, что видит клиент и что в эту секунду получаете вы.',
    // окно — на линии шагов: весь блок больше экрана, и окно на нём ничего бы не выделило
    targets: [{ sel: `${section('Как это устроено')} .route` }, { sel: section('Как это устроено') }]
  },
  {
    title: 'Что мы делаем',
    text: 'Шесть направлений, у каждого свой кадр. Эти точки переключают направление, кнопка под описанием ведёт на его страницу.',
    targets: [{ sel: '#directions .asm-pill' }, { sel: '#directions' }]
  },
  {
    title: 'Пульт',
    text: 'Когда листаете вниз, знак студии переезжает сюда. Нажмите — откроются разделы, места на странице и кнопка «наверх».',
    targets: [{ sel: '[data-tour="pod"]' }]
  },
  {
    title: 'Связь',
    text: 'Почта, Telegram и Max — если удобнее написать самим.',
    targets: [{ sel: '[data-tour="contacts"]' }]
  },
  {
    title: 'Концепты',
    text: 'Рабочие примеры по нишам: их можно пройти как клиент — от первого экрана до заказа.',
    targets: [{ sel: 'header nav a[href="/concepts"]' }],
    top: true
  },
  {
    title: 'Помощь',
    text: 'Сюда можно вернуться в любой момент: подбор решения, словарь и «мы напишем сами».',
    targets: [{ sel: 'header nav a[href="/help"]' }, { sel: MENU, text: '«Помощь» — в меню: подбор решения, словарь и «мы напишем сами».' }],
    top: true
  }
];

const TERM: TourStep = {
  title: 'Слова с пунктиром',
  text: 'Если слово непонятно — нажмите на него, объясним в двух строках.',
  targets: [{ sel: 'main .term' }]
};

const SERVICE: TourStep[] = [
  {
    title: 'О направлении',
    text: 'Коротко: что это и кому подходит. «Обсудить проект» откроет заявку уже с этим направлением.',
    targets: [{ sel: `${section('Начало')} [data-hero]` }]
  },
  {
    title: 'Живой кадр',
    text: 'Так это может выглядеть у вас. Под кадром — задача, которую он решает.',
    targets: [{ sel: '[data-tour="stage"]' }]
  },
  TERM,
  {
    title: 'Что входит',
    text: 'Пункты листаются сами. Нажмите на любой — откроется подробнее.',
    targets: [{ sel: '[data-tour="includes"] ol' }, { sel: '[data-tour="includes"]' }]
  },
  {
    title: 'Как идёт работа',
    text: 'Четыре шага от разговора до запуска. На каждом есть что показать.',
    targets: [{ sel: '[data-tour="process"]' }]
  },
  {
    title: 'Сроки',
    text: 'Сколько займёт, что понадобится от вас и что будет дальше. Рядом — кому это подходит.',
    targets: [{ sel: '[data-tour="passport"] dl' }, { sel: '[data-tour="passport"]' }]
  },
  {
    title: 'Вопросы',
    text: 'Частые вопросы. Не нашли свой — «Спросите напрямую», ответим в течение дня.',
    targets: [{ sel: '[data-tour="faq"]' }]
  }
];

const ABOUT_TOUR: TourStep[] = [
  {
    title: 'Коротко',
    text: 'Четыре ответа, за которыми обычно пишут: что делаем, как быстро отвечаем и запускаем.',
    targets: [{ sel: '[data-tour="numbers"]' }]
  },
  TERM,
  {
    title: ABOUT.start.label,
    text: 'Что принести к началу работы. Ничего из этого не обязательно готовым.',
    targets: [{ sel: `${section(ABOUT.start.label)} ol` }, { sel: section(ABOUT.start.label) }]
  },
  {
    title: ABOUT.principles.label,
    text: 'Правила, от которых мы не отступаем: смета до старта, доступы ваши, ответ в течение дня.',
    targets: [{ sel: `${section(ABOUT.principles.label)} ol` }, { sel: section(ABOUT.principles.label) }]
  },
  {
    title: ABOUT.limits.label,
    text: 'За что мы не берёмся — честнее сказать сразу.',
    targets: [{ sel: `${section(ABOUT.limits.label)} ul` }, { sel: section(ABOUT.limits.label) }]
  }
];

const CONCEPTS: TourStep[] = [
  {
    title: 'Ниши',
    text: 'Для каких дел собраны примеры. Ниша не обязана совпасть — достаточно, чтобы был похож путь клиента.',
    targets: [{ sel: `${section('Начало')} [data-hero] ul` }]
  },
  {
    title: 'Демо',
    text: 'Каждое демо работает целиком: откройте и пройдите как клиент — до заказа или записи.',
    targets: [{ sel: `${section('Собранные демо')} [data-recede] > :first-child` }]
  },
  {
    title: 'Как этим пользоваться',
    text: 'Выбираете близкое, проходите насквозь и говорите, что поменять, — это и есть бриф.',
    targets: [{ sel: '[data-tour="process"]' }]
  },
  {
    title: 'Не нашли своё',
    text: 'Опишите задачу — соберём демо под вашу нишу и покажем до начала работы.',
    targets: [{ sel: section('Не нашли своё') }]
  }
];

const CONTACT: TourStep[] = [
  {
    title: 'С чего начать',
    text: 'Отметьте, что запускаем, — можно несколько. Не знаете — «Нужна помощь?» подберёт за четыре вопроса.',
    targets: [{ sel: '#brief-need' }]
  },
  {
    title: 'Бриф',
    text: 'Здесь на глазах собирается бриф и ориентир по сроку.',
    targets: [{ sel: '#brief-live' }]
  },
  {
    title: 'Куда ответить',
    text: 'В конце — имя и контакт: телефон, Telegram или почта. Остальное можно пропустить.',
    targets: [{ sel: 'form fieldset:last-of-type' }]
  },
  {
    title: 'Что дальше',
    text: 'Три шага после заявки — и ни одного без вашего согласия.',
    targets: [{ sel: '[data-tour="process"]' }]
  }
];

const HELP_TOUR: TourStep[] = [
  {
    title: 'Темы',
    text: 'Шесть тем: с чего начать, что где на сайте, цена и сроки, после заявки, вопросы и словарь. Выберите, с чем пришли.',
    targets: [{ sel: '[data-tour="help-topics"]' }]
  },
  {
    title: 'Ответ',
    text: 'Здесь открывается тема. Первая — подбор: четыре вопроса, и подскажем, что подойдёт.',
    targets: [{ sel: '[data-tour="help-panel"]' }]
  },
  {
    title: 'Мы напишем сами',
    text: 'Не разобрались — оставьте имя и телефон, напишем в мессенджер.',
    targets: [{ sel: '#write form' }, { sel: '#write' }]
  }
];

const SERVICE_PATHS = ['/sites', '/ecommerce', '/bots', '/monitoring'];

/** Экскурсия страницы; у документов, 404 и демо её нет. */
export function tourFor(pathname: string): TourStep[] | null {
  if (pathname === '/') return HOME;
  if (SERVICE_PATHS.includes(pathname)) return SERVICE;
  if (pathname === '/about') return ABOUT_TOUR;
  if (pathname === '/concepts') return CONCEPTS;
  if (pathname === '/contact') return CONTACT;
  if (pathname === '/help') return HELP_TOUR;
  return null;
}
