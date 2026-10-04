import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { members } from '../db/schema';
import type { Member } from '../domain/leads';
import { ensureOwner, memberByTg, type TgUser } from '../domain/team';

/**
 * Вход в мини-приложение. Паролей нет: Telegram при открытии выдаёт
 * приложению строку initData, подписанную токеном бота, — её приложение
 * прикладывает к каждому запросу. Сервис проверяет подпись, свежесть
 * и то, что человек в команде.
 *
 * Подпись: HMAC-SHA256 от полей, отсортированных по имени и склеенных
 * через перевод строки; ключ — HMAC-SHA256("WebAppData", токен бота).
 */

export type AppEnv = { Variables: { member: Member } };

/** Сколько живёт initData. Приложение, открытое дольше, просят открыть заново. */
const MAX_AGE_SEC = 24 * 60 * 60;

export function readInitData(raw: string, botToken: string, now = new Date(), maxAgeSec = MAX_AGE_SEC): TgUser | null {
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');
  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const key = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const want = createHmac('sha256', key).update(check).digest();
  if (!timingSafeEqual(Buffer.from(hash, 'hex'), want)) return null;

  const age = now.getTime() / 1000 - Number(params.get('auth_date'));
  // минута в запас — на расхождение часов
  if (!Number.isFinite(age) || age > maxAgeSec || age < -60) return null;

  try {
    const user = JSON.parse(params.get('user') ?? '') as Partial<TgUser>;
    if (typeof user.id !== 'number' || typeof user.first_name !== 'string') return null;
    return user as TgUser;
  } catch {
    return null;
  }
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Режим разработки: приложение открыто в обычном браузере, initData нет.
 * Пускаем только запрос с этой же машины и только пока сервис не виден
 * снаружи: через туннель или прокси запрос приходит с чужим Host
 * и заголовками пересылки — убрать их отправитель не может.
 */
function devAllowed(config: Config, header: (name: string) => string | undefined) {
  if (config.APP_DEV !== '1' || config.NODE_ENV === 'production' || config.PUBLIC_URL) return false;
  if (header('x-forwarded-for') || header('cf-connecting-ip') || header('forwarded')) return false;
  return LOCAL_HOST.test(header('host') ?? '');
}

export function appAuth({ db, config, now = () => new Date() }: { db: Db; config: Config; now?: () => Date }): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.req.header('authorization') ?? '';
    let member: Member | null = null;

    if (auth.startsWith('tma ')) {
      const user = config.BOT_TOKEN ? readInitData(auth.slice(4), config.BOT_TOKEN, now()) : null;
      if (!user) return c.json({ error: 'unauthorized' }, 401);
      member = (await memberByTg(db, user)) ?? (await ensureOwner(db, user, config.OWNER_TG_IDS));
      if (!member) return c.json({ error: 'forbidden' }, 403);
    } else if (devAllowed(config, (name) => c.req.header(name))) {
      [member = null] = await db
        .select()
        .from(members)
        .where(and(eq(members.role, 'owner'), eq(members.active, true)))
        .orderBy(asc(members.id))
        .limit(1);
    }

    if (!member) return c.json({ error: 'unauthorized' }, 401);
    c.set('member', member);
    await next();
  };
}
