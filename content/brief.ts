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
  /** Живая вставка направления для превью в шаге. */
  live?: 'landing' | 'shop' | 'bot' | 'webapp' | 'ops';
};

export const NEEDS: Need[] = [
  { id: 'site', n: '01', label: 'Сайт или лендинг', scope: 'Структура, дизайн, адаптив, заявки в Telegram', kind: 'sites', weeks: [2, 4], live: 'landing' },
  { id: 'shop', n: '02', label: 'Интернет-магазин', scope: 'Каталог, корзина, оплата, доставка', kind: 'ecommerce', weeks: [4, 8], live: 'shop' },
  { id: 'bot', n: '03', label: 'Бот', scope: 'Запись, оплата, выгрузка в таблицу и CRM', kind: 'bots', weeks: [2, 4], live: 'bot' },
  { id: 'app', n: '04', label: 'Мини-приложение в Telegram', scope: 'Меню, корзина, бонусы внутри мессенджера', kind: 'bots', weeks: [3, 6], live: 'webapp' },
  { id: 'ops', n: '05', label: 'Мониторинг и поддержка', scope: 'Проверки, бэкапы, дежурство, отчёты', kind: 'monitoring', weeks: [1, 1], live: 'ops' },
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

/**
 * Ориентир по срокам: самое долгое из выбранного, плюс неделя на каждое
 * следующее направление (собираются параллельно, но стыкуются), плюс
 * неделя на прототип, если есть только идея.
 */
export function estimate(needs: string[], stage: string | null): [number, number] | null {
  const picked = NEEDS.filter((n) => needs.includes(n.id) && n.weeks[1] > 0);
  if (!picked.length) return null;
  const lo = Math.max(...picked.map((n) => n.weeks[0])) + (picked.length - 1);
  const hi = Math.max(...picked.map((n) => n.weeks[1])) + (picked.length - 1);
  const extra = stage === 'idea' ? 1 : 0;
  return [lo + extra, hi + extra];
}
