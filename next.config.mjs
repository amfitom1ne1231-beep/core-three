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
  compiler: {
    // шейдерные строки большие, но статичные — убираем только логи
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false
  }
};
export default nextConfig;
