import type { Metadata } from 'next';
import { SITE } from '@/content/site';

/**
 * Метаданные страницы одним вызовом.
 *
 * Next сливает метаданные неглубоко: стоит странице задать свой
 * `openGraph`, и родительский уходит целиком — вместе с картинкой,
 * именем сайта и локалью. Так десять страниц из пятнадцати пересылались
 * в мессенджерах без картинки. Здесь общая часть собирается заново
 * для каждой страницы.
 *
 * Картинки здесь нет намеренно: у каждой страницы рядом лежит свой
 * `opengraph-image` с именем раздела, а явная картинка в метаданных
 * перебила бы его. Новой странице — новый файл рядом (lib/og.tsx).
 */
export function pageMeta({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: 'ru_RU',
      siteName: SITE.name,
      title: `${title} — ${SITE.name}`,
      description,
      url: path
    },
    // картинку twitter берёт из openGraph сам — в том числе из файла страницы
    twitter: { card: 'summary_large_image', title: `${title} — ${SITE.name}`, description }
  };
}
