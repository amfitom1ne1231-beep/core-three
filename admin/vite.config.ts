import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Мини-приложение живёт по адресу /app/ сервиса бота: в сборке он отдаёт
 * `dist` сам, а в разработке Vite пересылает запросы к API на сервис.
 */
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:8787' }
  },
  build: {
    // WebView в Telegram на старых Android отстаёт от браузеров на пару лет
    target: 'es2020',
    sourcemap: false
  }
});
