import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import { SITE } from '@/content/site';
import { SEEN_BOOT } from '@/lib/boot';
import { THEME_BOOT } from '@/lib/theme';
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
  // Обе темы объявлены: браузер красит строку по системной настройке ещё
  // до выполнения скриптов, а дальше цвет ведёт сам переключатель.
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050608' },
    { media: '(prefers-color-scheme: light)', color: '#f4f5f7' }
  ],
  colorScheme: 'dark light'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme и data-seen выставляют загрузочные скрипты до первой
    // отрисовки; suppressHydrationWarning — потому что разметка сервера
    // про тему и про уже виденный прелоадер не знает и знать не может
    <html lang="ru" suppressHydrationWarning className={mono.variable}>
      <head>
        {/*
          Тема применяется до первого кадра. Без этого страница успевает
          мигнуть тёмной у того, кто выбрал светлую, — и наоборот: скрипт
          в <head> выполняется раньше, чем браузер что-либо рисует.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: SEEN_BOOT }} />
        {/* Без JS прелоадер некому снять, и сайт оставался чёрным экраном
            с «000 / 100». Разметка под ним целиком серверная — её и показываем. */}
        <noscript dangerouslySetInnerHTML={{ __html: '<style>[data-preloader]{display:none!important}</style>' }} />
      </head>
      <body>
        <SmoothScroll />
        {/* шапка, пульт, курсор и шрифт сайта — в оболочке группы (site);
            у демо концептов своя группа и своё всё */}
        {children}
      </body>
    </html>
  );
}
