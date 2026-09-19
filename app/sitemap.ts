import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Только существующие страницы. Разделы волны 2 добавляются по мере сборки. */
const routes: Array<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/contact', priority: 0.8 },
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
