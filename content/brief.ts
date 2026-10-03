import type { LeadKind } from '@/lib/lead';

/**
 * Бриф: из чего складывается заявка на /contact. Первый шаг — «что
 * запускаем» — живёт и в финале каждой страницы: оттуда человек приходит
 * в бриф уже с выбранным пунктом.
 *
 * Сроки — ориентир, а не обещание, и так и подписаны на странице.
 * Цен здесь нет намеренно (бриф, раздел 2): цена называется после
 * разговора, а срок, который мы можем назвать сразу, честнее молчания.
 */

export type Need = {
  id: string;
  n: string;
  label: string;
  /** Что входит — строка в карточке брифа. */
  scope: string;
  /** Тип заявки для таблицы (поле `kind`). */
  kind: LeadKind;
  /** Ориентир в неделях, от–до. */
  weeks: [number, number];
  /**
   * Ориентир в днях — для того, что делается быстрее недели. Мониторинг
   * подключается за 2–3 дня (так написано на его странице), и «1–1 неделя»
   * в брифе спорила со страницей и с русским языком сразу.
   */
  days?: [number, number];
  /** Живая вставка направления для превью в шаге. */
  live?: 'landing' | 'shop' | 'bot' | 'webapp' | 'ops';
};

export const NEEDS: Need[] = [
  // сроки сверены с паспортами направлений: «лендинг — от 1 недели,
  // сайт с блогом — от 3», «бот-визитка — от 1 недели, с оплатой — от 3»
  { id: 'site', n: '01', label: 'Сайт или лендинг', scope: 'Структура, дизайн, адаптив, заявки в Telegram', kind: 'sites', weeks: [1, 4], live: 'landing' },
  { id: 'shop', n: '02', label: 'Интернет-магазин', scope: 'Каталог, корзина, оплата, доставка', kind: 'ecommerce', weeks: [4, 8], live: 'shop' },
  { id: 'bot', n: '03', label: 'Бот', scope: 'Запись, оплата, выгрузка в таблицу и CRM', kind: 'bots', weeks: [1, 4], live: 'bot' },
  { id: 'app', n: '04', label: 'Мини-приложение в Telegram', scope: 'Меню, корзина, бонусы внутри мессенджера', kind: 'bots', weeks: [3, 6], live: 'webapp' },
  { id: 'ops', n: '05', label: 'Мониторинг и поддержка', scope: 'Проверки, бэкапы, дежурство, отчёты', kind: 'monitoring', weeks: [0, 0], days: [2, 3], live: 'ops' },
  { id: 'unsure', n: '06', label: 'Пока не знаю', scope: 'Разберём задачу и предложим решение', kind: 'general', weeks: [0, 0] }
];

export const STAGES = [
  { id: 'idea', label: 'Есть идея', note: 'Начнём со структуры и прототипа' },
  { id: 'spec', label: 'Есть макет или ТЗ', note: 'Сразу в сборку' },
  { id: 'live', label: 'Есть сайт, нужен новый', note: 'Перенесём данные и позиции в поиске' }
] as const;

export const DEADLINES = [
  { id: 'asap', label: 'Как можно скорее' },
  { id: 'month', label: 'В течение месяца' },
  { id: 'quarter', label: '1–3 месяца' },
  { id: 'flex', label: 'Не горит' }
] as const;

/** Что подключить: чаще всего спрашивают именно это. */
export const EXTRAS = ['Онлайн-оплата', 'CRM', 'Доставка', 'Запись и бронь', 'Личный кабинет', '1С и склад', 'Рассылки'] as const;

export type Estimate = { lo: number; hi: number; unit: 'weeks' | 'days' };

/**
 * Ориентир по срокам: самое долгое из выбранного, плюс неделя на каждое
 * следующее направление (собираются параллельно, но стыкуются), плюс
 * неделя на прототип, если есть только идея.
 *
 * То, что считается в днях (мониторинг), сроку сборки ничего не
 * добавляет: подключается параллельно с запуском. Выбранное в одиночку,
 * оно и показывается в днях.
 */
export function estimate(needs: string[], stage: string | null): Estimate | null {
  const picked = NEEDS.filter((n) => needs.includes(n.id));
  const built = picked.filter((n) => n.weeks[1] > 0);
  if (built.length) {
    const extra = built.length - 1 + (stage === 'idea' ? 1 : 0);
    return {
      lo: Math.max(...built.map((n) => n.weeks[0])) + extra,
      hi: Math.max(...built.map((n) => n.weeks[1])) + extra,
      unit: 'weeks'
    };
  }
  const quick = picked.filter((n) => n.days);
  if (!quick.length) return null;
  return { lo: Math.max(...quick.map((n) => n.days![0])), hi: Math.max(...quick.map((n) => n.days![1])), unit: 'days' };
}

const plural = (n: number, [one, few, many]: [string, string, string]) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

/** «2–3 дня», «1–4 недели», «3 недели» — без «1–1 неделя». */
export function formatEstimate(e: Estimate): { value: string; unit: string } {
  const forms: [string, string, string] = e.unit === 'days' ? ['день', 'дня', 'дней'] : ['неделя', 'недели', 'недель'];
  return { value: e.lo === e.hi ? String(e.hi) : `${e.lo}–${e.hi}`, unit: plural(e.hi, forms) };
}
