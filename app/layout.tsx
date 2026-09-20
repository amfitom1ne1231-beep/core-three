import type { Metadata, Viewport } from 'next';
import { Onest, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import CookieConsent from '@/components/CookieConsent';
import Cursor from '@/components/Cursor';
import Header from '@/components/Header';
import NavPod from '@/components/NavPod';
import Preloader from '@/components/Preloader';
import SmoothScroll from '@/components/SmoothScroll';
import { SITE } from '@/content/site';
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

// Курсивная антиква — только на акцентные слова в заголовках.
// Один файл, кириллица, вес 500: типографический контраст без раздувания.
const serif = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  weight: ['500'],
  style: ['italic'],
  variable: '--font-serif',
  display: 'swap'
});

// Playfair оставлен статическим намеренно: одно начертание одного веса
// легче, чем переменный файл с осью 400–900, из которой нужен только 500.
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
  themeColor: '#050608',
  colorScheme: 'dark'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="dark" className={`${onest.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#content">
          К содержанию
        </a>
        <SmoothScroll />
        <Preloader />
        <Header />
        <NavPod />
        {children}
        <CookieConsent />
        <Cursor />
        <div className="grain" aria-hidden />
      </body>
    </html>
  );
}
