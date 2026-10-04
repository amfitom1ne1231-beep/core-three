import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

/**
 * База: настоящий Postgres на сервере, встроенный PGlite в разработке
 * и тестах. Схема и миграции одни — PGlite и есть Postgres, собранный
 * в WebAssembly, а не его имитация.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type DbHandle = { db: Db; close: () => Promise<void>; kind: 'postgres' | 'pglite' };

const MIGRATIONS = process.env.BOT_MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'drizzle');

export async function openDb(opts: { url?: string; dataDir?: string }): Promise<DbHandle> {
  if (opts.url) {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const pool = new Pool({ connectionString: opts.url, max: 5 });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return { db: db as unknown as Db, close: () => pool.end(), kind: 'postgres' };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  // в памяти — для тестов; иначе файлы на диске, база переживает перезапуск
  const dir = opts.dataDir ?? 'memory://';
  if (!dir.startsWith('memory://')) mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as Db, close: () => client.close(), kind: 'pglite' };
}
