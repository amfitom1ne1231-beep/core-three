import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  // превью закрыто целиком — см. SITE_NOINDEX в next.config.mjs
  if (process.env.SITE_NOINDEX === '1') return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: new URL('/sitemap.xml', base).toString(),
    host: base
  };
}
