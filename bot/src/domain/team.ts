import { randomBytes } from 'node:crypto';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { invites, members } from '../db/schema';
import type { Member } from './leads';

/**
 * Команда. Вход — только по Telegram: владельцы (OWNER_TG_IDS) попадают
 * в команду первым сообщением, остальных приглашают ссылкой с кодом.
 * Доступ у всех полный — так решил заказчик: для троих роли только мешают.
 */

export type TgUser = { id: number; first_name: string; last_name?: string; username?: string };

const fullName = (u: TgUser) => [u.first_name, u.last_name].filter(Boolean).join(' ');

/** Член команды по Telegram id; заодно освежает имя и ник, если сменились. */
export async function memberByTg(db: Db, user: TgUser): Promise<Member | null> {
  const [m] = await db.select().from(members).where(and(eq(members.tgId, user.id), eq(members.active, true)));
  if (!m) return null;
  const name = fullName(user);
  const username = user.username ?? null;
  if (m.name !== name || m.username !== username) {
    const [next] = await db.update(members).set({ name, username }).where(eq(members.id, m.id)).returning();
    return next ?? m;
  }
  return m;
}

/** Владельцы входят без приглашения — их id заданы в окружении. */
export async function ensureOwner(db: Db, user: TgUser, ownerIds: number[]): Promise<Member | null> {
  if (!ownerIds.includes(user.id)) return null;
  const existing = await memberByTg(db, user);
  if (existing) return existing;
  const [m] = await db
    .insert(members)
    .values({ tgId: user.id, name: fullName(user), username: user.username ?? null, role: 'owner' })
    .onConflictDoUpdate({ target: members.tgId, set: { active: true, role: 'owner' } })
    .returning();
  return m ?? null;
}

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

export async function createInvite(db: Db, by: Member, at = new Date()) {
  const code = randomBytes(9).toString('base64url');
  await db.insert(invites).values({ code, createdBy: by.id, createdAt: at, expiresAt: new Date(at.getTime() + INVITE_TTL_MS) });
  return code;
}

/** Приглашение действует один раз и двое суток. */
export async function acceptInvite(db: Db, code: string, user: TgUser, at = new Date()) {
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(invites)
      .where(and(eq(invites.code, code), isNull(invites.usedAt), gt(invites.expiresAt, at)))
      .for('update');
    if (!inv) return null;
    const [m] = await tx
      .insert(members)
      .values({ tgId: user.id, name: fullName(user), username: user.username ?? null, role: 'member' })
      .onConflictDoUpdate({ target: members.tgId, set: { active: true } })
      .returning();
    await tx.update(invites).set({ usedBy: m!.id, usedAt: at }).where(eq(invites.code, code));
    return m!;
  });
}

export async function team(db: Db) {
  return db.select().from(members).where(eq(members.active, true)).orderBy(asc(members.id));
}

export async function removeMember(db: Db, id: number) {
  await db.update(members).set({ active: false }).where(and(eq(members.id, id), eq(members.role, 'member')));
}
