import type { MetadataRoute } from 'next';
import { DEMOS } from '@/content/concepts';
import { SERVICES } from '@/content/services';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Только существующие страницы. Разделы волны 2 добавляются по мере сборки. */
const routes: Array<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/services', priority: 0.9 },
  // направления берутся из того же списка, что и сами страницы:
  // добавили направление — оно в карте сайта, забыть нечего
  ...SERVICES.map((s) => ({ path: `/${s.slug}`, priority: 0.9 })),
  { path: '/contact', priority: 0.8 },
  { path: '/concepts', priority: 0.7 },
  // собранные демо: список тот же, что раскладывает роут, — несобранного
  // в карте сайта не появится
  ...DEMOS.map((d) => ({ path: `/concepts/${d.slug}`, priority: 0.6 })),
  { path: '/about', priority: 0.6 },
  { path: '/help', priority: 0.6 },
  { path: '/privacy', priority: 0.2 },
  { path: '/consent', priority: 0.1 }
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((r) => ({
    url: new URL(r.path, base).toString(),
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: r.priority
  }));
}
