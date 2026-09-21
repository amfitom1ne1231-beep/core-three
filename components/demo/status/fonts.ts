import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';

/**
 * Шрифты «Лавки». Системный стек убран: он читался как «шрифт не
 * подключили», а не как выбор.
 *
 * Plex — из инженерной семьи, той же, где живут приборные панели:
 * Grafana, Better Stack, статусы крупных сервисов. У него полная
 * кириллица и моноширинный из того же набора, поэтому цифры в таблицах
 * и подписи под ними — одного рода, а не из двух разных гарнитур.
 *
 * Onest брать нельзя: это наш голос, а демо должно быть голосом клиента.
 */
export const sans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--ops-sans',
  display: 'swap'
});

export const mono = IBM_Plex_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  variable: '--ops-mono',
  display: 'swap'
});
