import { Golos_Text, Prata } from 'next/font/google';

/**
 * Шрифты «Бритвы». Свои, не наши.
 *
 * Prata — на вывеску: дидона с полной кириллицей, интонация старой
 * цирюльни. Golos — на подписи сцены: гротеск, рисованный под кириллицу,
 * спокойный рядом с системным шрифтом Telegram в телефоне. Onest брать
 * нельзя — это наш голос, а демо говорит голосом салона.
 */
export const sign = Prata({
  weight: '400',
  subsets: ['latin', 'cyrillic'],
  variable: '--barber-sign',
  display: 'swap'
});

export const text = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  variable: '--barber-text',
  display: 'swap'
});
