import { defineConfig } from 'drizzle-kit';

/** Генерация миграций: `npm run db:generate` после правки схемы. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle'
});
