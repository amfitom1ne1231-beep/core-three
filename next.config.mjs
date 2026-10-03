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
  env: {
    // Адрес посетителя для лимита заявок на Netlify. Сборка Netlify всегда
    // выставляет NETLIFY=true; переменные из netlify.toml до серверной
    // функции в рантайме не доходят, поэтому имя заголовка вписывается
    // здесь, на сборке. На Vercel свой заголовок, на VPS — TRUST_PROXY.
    LEAD_IP_HEADER: process.env.NETLIFY === 'true' ? 'x-nf-client-connection-ip' : ''
  },
  /**
   * Превью (SITE_NOINDEX=1 задаёт netlify.toml) не должно попасть в поиск
   * раньше настоящего домена. Заголовок ставится здесь, а не в netlify.toml:
   * заголовки Netlify ложатся только на статические файлы, а страницы
   * отдаёт рантайм Next.js мимо них. На боевом хостинге переменной нет.
   */
  async headers() {
    /**
     * Базовые заголовки безопасности. Полный CSP со списком источников
     * скриптов здесь нарочно не задан: инлайновые скрипты Next и Метрика
     * потребовали бы nonce или 'unsafe-inline', и выигрыш был бы мнимым.
     * Зато запрещено то, что не нужно сайту никогда: встраивать его
     * в чужие фреймы (демо витрина встраивает только сама), подменять
     * базовый адрес, грузить плагины и отправлять формы на сторону.
     */
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'"
      }
    ];
    if (process.env.SITE_NOINDEX === '1') security.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
    return [{ source: '/:path*', headers: security }];
  },
  compiler: {
    // шейдерные строки большие, но статичные — убираем только логи
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false
  }
};
export default nextConfig;
