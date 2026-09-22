import type { Metadata, Viewport } from 'next';
import { Onest, JetBrains_Mono } from 'next/font/google';
import CookieConsent from '@/components/CookieConsent';
import PageTransition from '@/components/PageTransition';
import SiteChrome from '@/components/SiteChrome';
import SmoothScroll from '@/components/SmoothScroll';
import { SITE } from '@/content/site';
import { THEME_BOOT } from '@/lib/theme';
import './globals.css';

// Onest переменный — так он и был записан в брифе. Без `weight` next/font
// берёт один файл на подмножество вместо четырёх статических начертаний:
// четырнадцать woff2 на странице превращаются в шесть, и прелоадер,
// который ждёт document.fonts.ready, снимается раньше.
const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-onest',
  display: 'swap'
});

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
  alternates: { canonical: '/' },
  robots: { index: true, follow: true }
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
    // data-theme выставляет загрузочный скрипт до первой отрисовки;
    // suppressHydrationWarning — потому что разметка сервера про тему
    // не знает и знать не может
    <html lang="ru" suppressHydrationWarning className={`${onest.variable} ${mono.variable}`}>
      <head>
        {/*
          Тема применяется до первого кадра. Без этого страница успевает
          мигнуть тёмной у того, кто выбрал светлую, — и наоборот: скрипт
          в <head> выполняется раньше, чем браузер что-либо рисует.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <a className="skip-link" href="#content">
          К содержанию
        </a>
        <SmoothScroll />
        {/* шапка, пульт, курсор и зерно — только вне демо концептов */}
        <SiteChrome />
        {children}
        {/* переход живёт вне хромы: он же уводит в демо и возвращает из них */}
        <PageTransition />
        <CookieConsent />
      </body>
    </html>
  );
}
