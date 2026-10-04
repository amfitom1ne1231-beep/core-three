import { estimate, NEEDS, STAGES, type Estimate } from './brief.ts';

/**
 * Подбор решения: четыре вопроса без единого термина — и совет, что
 * запускать. Стоит в двух местах: в «Помощи» (/help, раздел «С чего
 * начать») и в брифе под пунктом «Нужна помощь?», где по итогу сам
 * отмечает пункты брифа (HELP.md, этап 2).
 *
 * Решения заказчика (04.10.2026): вопросов четыре — срок спрашивает бриф,
 * а на ориентир по неделям он не влияет; ответ один, и сразу дальше;
 * в итоге одно главное решение и второе, только если на него указывают
 * сами ответы. Вопросы и развилки — черновик, заказчик правит на живом.
 *
 * Логика здесь, без интерфейса, чтобы её можно было проверить тестами
 * на всех сочетаниях ответов (test/picker.test.mjs).
 */

export type Biz = 'goods' | 'services' | 'teach' | 'other';
export type Goal = 'found' | 'pay' | 'book' | 'repeat' | 'stable';
export type Where = 'telegram' | 'search' | 'referral' | 'nowhere';
export type Have = 'nothing' | 'social' | 'site' | 'mockup';
export type Answers = { biz: Biz; goal: Goal; where: Where; have: Have };
export type QuestionId = keyof Answers;

/** Пункты брифа, которые подбор умеет советовать (`NEEDS` без «Нужна помощь?»). */
export type NeedId = 'site' | 'shop' | 'bot' | 'app' | 'ops';

export type Question = { id: QuestionId; title: string; options: readonly { id: string; label: string }[] };

export const QUESTIONS: readonly Question[] = [
  {
    id: 'biz',
    title: 'Чем вы занимаетесь?',
    options: [
      { id: 'goods', label: 'Продаю товары' },
      { id: 'services', label: 'Оказываю услуги' },
      { id: 'teach', label: 'Учу, веду курсы или мероприятия' },
      { id: 'other', label: 'Другое' }
    ]
  },
  {
    id: 'goal',
    title: 'Что должно получиться?',
    options: [
      { id: 'found', label: 'Чтобы меня находили и писали' },
      { id: 'pay', label: 'Чтобы покупали и платили онлайн' },
      { id: 'book', label: 'Чтобы записывались без звонков' },
      { id: 'repeat', label: 'Чтобы не отвечать на одно и то же' },
      { id: 'stable', label: 'Чтобы то, что есть, не падало' }
    ]
  },
  {
    id: 'where',
    title: 'Где сейчас ваши клиенты?',
    options: [
      { id: 'telegram', label: 'Пишут в Telegram' },
      { id: 'search', label: 'Ищут в поиске' },
      { id: 'referral', label: 'Приходят по совету' },
      { id: 'nowhere', label: 'Пока нигде' }
    ]
  },
  {
    id: 'have',
    title: 'Что у вас уже есть?',
    options: [
      { id: 'nothing', label: 'Ничего' },
      { id: 'social', label: 'Страница в соцсетях' },
      { id: 'site', label: 'Сайт' },
      { id: 'mockup', label: 'Макет или описание задачи' }
    ]
  }
];

export type Advice = {
  main: NeedId;
  /** Второе решение — только если на него указывают сами ответы. */
  second?: NeedId;
  /** Ответ на «Где вы сейчас?» брифа; у мониторинга этапа нет. */
  stage: 'idea' | 'spec' | 'live' | null;
  /** Что отметить в «Что подключить?» брифа. */
  extras: string[];
  /** Демо из «Концептов», где это видно вживую. */
  demo: string;
  /** Почему именно так — словами из ответов человека. */
  why: string;
  secondWhy?: string;
  eta: Estimate | null;
};

const BIZ: Record<Biz, string> = {
  goods: 'Вы продаёте товары',
  services: 'Вы оказываете услуги',
  teach: 'Вы учите или проводите мероприятия',
  other: 'Вам'
};

const GOAL: Record<Goal, string> = {
  found: 'нужно, чтобы вас находили и писали',
  pay: 'нужно, чтобы покупали и платили онлайн',
  book: 'нужно, чтобы записывались без звонков',
  repeat: 'надоело отвечать на одно и то же',
  stable: 'важно, чтобы то, что есть, не падало'
};

/** С чего начинать, если стеречь пока нечего: то же, что совет «нашли и написали». */
function build(a: Answers): NeedId {
  if (a.where === 'telegram') return 'bot';
  return a.biz === 'goods' ? 'shop' : 'site';
}

function mainOf(a: Answers): NeedId {
  switch (a.goal) {
    case 'found':
      return 'site';
    case 'pay':
      // курс продаётся одной страницей с оплатой, услуга — записью с предоплатой
      if (a.biz === 'teach') return 'site';
      if (a.biz === 'services') return 'bot';
      return a.where === 'telegram' ? 'app' : 'shop';
    case 'book':
      return a.biz === 'teach' ? 'site' : 'bot';
    case 'repeat':
      return 'bot';
    case 'stable':
      // «чтобы не падало», а падать пока нечему — сначала собрать
      return a.have === 'nothing' || a.have === 'social' ? build(a) : 'ops';
  }
}

const WHY: Record<NeedId, (a: Answers) => string> = {
  site: (a) =>
    a.biz === 'teach' && a.goal === 'pay'
      ? 'Лендинг курса: программа, стоимость и запись с оплатой на одной странице.'
      : a.goal === 'book'
        ? 'Лендинг с программой, расписанием и записью — без переписки и звонков.'
        : 'Сайт с первого экрана объясняет, что вы предлагаете, и собирает заявки — они приходят вам в Telegram.',
  shop: () => 'Каталог, корзина, оплата и доставка: покупатель оформляет заказ сам, вам приходит готовый.',
  app: () => 'Клиенты уже в Telegram — каталог с корзиной и оплатой откроется прямо там, устанавливать ничего не нужно.',
  bot: (a) =>
    a.goal === 'pay'
      ? 'Бот записывает и берёт предоплату прямо в переписке, без звонков и администратора.'
      : a.goal === 'book'
        ? 'Бот показывает свободное время, записывает и напоминает накануне — без звонков.'
        : a.goal === 'repeat'
          ? 'Бот сам отвечает на частые вопросы — цены, часы работы, как добраться, — а где нужен человек, передаёт разговор вам.'
          : 'Бот отвечает там, где клиенты уже пишут: в Telegram, в любое время.',
  ops: () => 'Проверяем каждые пять минут, делаем копии данных и следим за сроками домена. О сбое узнаём раньше вас.'
};

function secondOf(a: Answers, main: NeedId): { need: NeedId; why: string } | undefined {
  if (a.goal === 'stable' && main !== 'ops') {
    return { need: 'ops', why: 'А когда запустится — мониторинг, чтобы не падало.' };
  }
  if ((main === 'bot' || main === 'app') && a.where === 'search') {
    return { need: 'site', why: 'Клиенты ищут вас в поиске, а бота поиск не находит — нужна страница, которая приведёт их к нему.' };
  }
  if ((main === 'site' || main === 'shop') && a.where === 'telegram') {
    return { need: 'bot', why: 'Клиенты пишут в Telegram — бот ответит им там, где они уже есть.' };
  }
  return undefined;
}

function stageOf(a: Answers, needs: NeedId[]): Advice['stage'] {
  if (needs.length === 1 && needs[0] === 'ops') return null;
  if (a.have === 'mockup') return 'spec';
  // «есть сайт, нужен новый» бывает только у сайта и магазина (как в брифе)
  if (a.have === 'site' && needs.some((n) => n === 'site' || n === 'shop')) return 'live';
  return 'idea';
}

const DEMO: Record<NeedId, (a: Answers) => string> = {
  site: () => 'course',
  shop: () => 'shop',
  app: () => 'cafe',
  bot: (a) => (a.goal === 'repeat' && a.biz === 'goods' ? 'cafe' : 'barber'),
  ops: () => 'status'
};

export function advise(a: Answers): Advice {
  const main = mainOf(a);
  const second = secondOf(a, main);
  const needs = second ? [main, second.need] : [main];
  const stage = stageOf(a, needs);
  const extras = [
    ...(a.goal === 'pay' ? ['Онлайн-оплата'] : []),
    ...(a.goal === 'book' || (a.goal === 'pay' && a.biz === 'services') ? ['Запись и бронь'] : [])
  ];
  const lead = a.biz === 'other' ? `Вам ${GOAL[a.goal]}.` : `${BIZ[a.biz]}, и вам ${GOAL[a.goal]}.`;
  return {
    main,
    second: second?.need,
    stage,
    extras,
    demo: DEMO[main](a),
    why: `${lead} ${WHY[main](a)}`,
    secondWhy: second?.why,
    eta: estimate(needs, stage)
  };
}

/** Имя пункта — как в брифе, чтобы совет и бриф говорили одними словами. */
export const needLabel = (id: NeedId) => NEEDS.find((n) => n.id === id)!.label;
export const stageNote = (id: Advice['stage']) => (id ? STAGES.find((s) => s.id === id)?.note : undefined);

/** Заявка с уже отмеченным: что, этап, что подключить. */
export function adviceHref(a: Advice): string {
  const q = new URLSearchParams({ need: [a.main, a.second].filter(Boolean).join(',') });
  if (a.stage) q.set('stage', a.stage);
  if (a.extras.length) q.set('extras', a.extras.join(','));
  return `/contact?${q}`;
}
