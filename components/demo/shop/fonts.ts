import { Manrope, Unbounded } from 'next/font/google';

/**
 * Шрифты «Мотка». Свои, не наши и не соседние.
 *
 * У «Сороки» антиква и тёплая бумага, у «Лавки» — инженерный Plex.
 * Третье демо обязано звучать третьим голосом, иначе витрина покажет
 * не три заведения, а три раздела одного сайта.
 *
 * Unbounded — плотный геометрический дисплей с полной кириллицей:
 * так сегодня выглядят вывески небольших розничных марок. Manrope
 * на текст — спокойный гротеск с открытыми формами, который не спорит
 * с дисплеем и хорошо держит мелкие подписи остатков.
 */
export const display = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600'],
  variable: '--shop-display',
  display: 'swap'
});

export const text = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--shop-text',
  display: 'swap'
});
