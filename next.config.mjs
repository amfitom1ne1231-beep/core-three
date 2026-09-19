/** @type {import('next').NextConfig} */
const nextConfig = {
  // Сборку для проверки кладём в отдельную папку: иначе `next build`
  // затирает .next под работающим dev-сервером и тот падает с 500.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    // шейдерные строки большие, но статичные — убираем только логи
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false
  }
};
export default nextConfig;
