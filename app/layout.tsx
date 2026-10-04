import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import SourceMemo from '@/components/SourceMemo';
import { SITE } from '@/content/site';
import { SEEN_BOOT } from '@/lib/boot';
import { DEFAULT_THEME, THEME_BOOT } from '@/lib/theme';
import './globals.css';

// Шрифт сайта (Onest) — в components/siteFont.ts, его берёт только оболочка
// страниц сайта. Моноширинный остаётся здесь: на нём держится и наша
// полоса над демо концептов.
const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mono',
  display: 'swap'
});

const url = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: {
    default: 'CoreThree — сайты, магазины и Telegram-приложения',
    template: '%s — CoreThree'
  },
  description: SITE.hero.lead,
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: SITE.name,
    title: 'CoreThree — от идеи до запуска',
    description: SITE.hero.lead
  },
  twitter: { card: 'summary_large_image' },
  // Канонический адрес здесь не задаётся: из корня он наследовался всем,
  // у кого нет своего, и 404 объявляла себя главной. Каждая страница
  // называет свой адрес сама (lib/meta.ts).
  //
  // Превью закрыто от поиска и метатегом — на случай, если заголовок
  // срежет прокси. Явное «index, follow» не пишем: это поведение по
  // умолчанию, а на 404 оно спорило с noindex, который ставит сам Next.
  robots: process.env.SITE_NOINDEX === '1' ? { index: false, follow: false } : undefined
};

export const viewport: Viewport = {
  // Сайт по умолчанию светлый при любой системной настройке — и строка
  // браузера светлая с первого кадра. Тёмную возвращает загрузочный скрипт
  // тому, кто выбрал её сам; дальше цвет ведёт переключатель.
  themeColor: '#f4f5f7',
  colorScheme: 'light dark'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Сервер отдаёт страницу в теме по умолчанию — светлой: она верна
    // и без скриптов. Выбранную тёмную и data-seen выставляют загрузочные
    // скрипты до первой отрисовки; suppressHydrationWarning — потому что
    // про выбор человека и про уже виденный прелоадер сервер не знает
    <html lang="ru" data-theme={DEFAULT_THEME} suppressHydrationWarning className={mono.variable}>
      <head>
        {/*
          Тема применяется до первого кадра. Без этого страница успевает
          мигнуть светлой у того, кто выбрал тёмную: скрипт в <head>
          выполняется раньше, чем браузер что-либо рисует.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: SEEN_BOOT }} />
        {/* Без JS прелоадер некому снять, и сайт оставался чёрным экраном
            с «000 / 100». Разметка под ним целиком серверная — её и показываем. */}
        <noscript dangerouslySetInnerHTML={{ __html: '<style>[data-preloader]{display:none!important}</style>' }} />
      </head>
      <body>
        <SmoothScroll />
        <SourceMemo />
        {/* шапка, пульт, курсор и шрифт сайта — в оболочке группы (site);
            у демо концептов своя группа и своё всё */}
        {children}
      </body>
    </html>
  );
}
