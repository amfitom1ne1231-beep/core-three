import { notFound } from 'next/navigation';

/**
 * Любой неизвестный адрес — в 404 группы (site), с шапкой и шрифтом сайта.
 * Без этого его ловила бы корневая 404, а всё, что она подключает,
 * предзагружается на каждой странице.
 */
export default function Missing() {
  notFound();
}
