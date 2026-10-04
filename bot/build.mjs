/**
 * Сборка сервиса в один файл. Зависимости остаются внешними (ставятся
 * в образ из package.json), а общий код сайта — `lib/lead.ts` —
 * вшивается: сервис проверяет заявку теми же правилами, что и форма.
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  external: Object.keys(pkg.dependencies ?? {}),
  logLevel: 'info'
});
