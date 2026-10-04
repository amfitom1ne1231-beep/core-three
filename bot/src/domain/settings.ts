import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { settings } from '../db/schema';

/**
 * Рабочая группа: куда бот пишет заявки. Задаётся из самой группы
 * командой /bind — внутри темы, если в группе включены темы.
 */
export type Group = { chatId: number; threadId: number | null; title: string | null };

export async function getGroup(db: Db): Promise<Group | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, 'group'));
  return (row?.value as Group | undefined) ?? null;
}

export async function setGroup(db: Db, group: Group) {
  await db
    .insert(settings)
    .values({ key: 'group', value: group })
    .onConflictDoUpdate({ target: settings.key, set: { value: group, updatedAt: new Date() } });
}

/** Простая настройка по ключу — то, что сервис помнит между запусками. */
export async function getSetting<T>(db: Db, key: string): Promise<T | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return (row?.value as T | undefined) ?? null;
}

export async function setSetting(db: Db, key: string, value: unknown) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}
