import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Сборку для проверки кладём в отдельную папку: иначе `next build`
  // затирает .next под работающим dev-сервером и тот падает с 500.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Самодостаточная сборка для Docker: server.js и только нужные модули.
  // Vercel эту настройку понимает и работает как обычно.
  output: 'standalone',
  // Корень трассировки — папка проекта, а не ближайший lockfile выше:
  // иначе в git worktree standalone-сборка собирается от чужого корня.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Превью (SITE_NOINDEX=1 задаёт netlify.toml) не должно попасть в поиск
   * раньше настоящего домена. Заголовок ставится здесь, а не в netlify.toml:
   * заголовки Netlify ложатся только на статические файлы, а страницы
   * отдаёт рантайм Next.js мимо них. На боевом хостинге переменной нет.
   */
  async headers() {
    if (process.env.SITE_NOINDEX !== '1') return [];
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
  compiler: {
    // шейдерные строки большие, но статичные — убираем только логи
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false
  }
};
export default nextConfig;
