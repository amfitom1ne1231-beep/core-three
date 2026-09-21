import type { Metadata } from 'next';
import StatusDemo from '@/components/demo/status/StatusDemo';
import { demoMetadata } from '@/content/concepts/meta';

/**
 * У каждого демо свой роут, а не общий `[slug]`.
 *
 * Next собирает шрифты на уровне роута: пока оба демо лежали в одном
 * файле, страница статуса преднагружала Playfair и Rubik кофейни —
 * 302 КБ шрифтов вместо своих ста шестидесяти. `next/dynamic` это
 * не чинит, чанк всё равно остаётся в графе роута. Отдельные роуты —
 * чинят. Несобранные ниши при этом честно отдают 404: динамического
 * сегмента, который ловил бы их пустым шаблоном, больше нет.
 */
export const metadata: Metadata = demoMetadata('status');

export default function Page() {
  return <StatusDemo />;
}
