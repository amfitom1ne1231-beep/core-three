import type { MetadataRoute } from 'next';
import { SITE } from '@/content/site';
import { DEFAULT_THEME, THEME_COLOR } from '@/lib/theme';

/**
 * Значок на домашнем экране и запуск во весь экран (MOBILE.md): сайт,
 * добавленный на экран телефона, открывается без строки браузера.
 *
 * Строки «Установить», работы без сети и отдельного приложения нет —
 * так решил заказчик. Поэтому здесь только имя, цвета и значки.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CoreThree — сайты, магазины и Telegram-приложения',
    short_name: SITE.name,
    description: SITE.hero.lead,
    lang: 'ru',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: THEME_COLOR[DEFAULT_THEME],
    theme_color: THEME_COLOR[DEFAULT_THEME],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
