import type { Update, UserFromGetMe } from 'grammy/types';
import { loadConfig, type Config } from '../src/config';
import { openDb } from '../src/db/client';
import { createBot } from '../src/tg/bot';

/** Postgres в памяти с применёнными миграциями — настоящая база, не имитация. */
export const memoryDb = () => openDb({ dataDir: 'memory://' });

export type TgUserLike = { id: number; is_bot: boolean; first_name: string; username?: string };

export const OWNER: TgUserLike = { id: 1001, is_bot: false, first_name: 'Лев', username: 'lev' };
export const ILYA: TgUserLike = { id: 1002, is_bot: false, first_name: 'Илья', username: 'ilya' };
export const STRANGER: TgUserLike = { id: 9999, is_bot: false, first_name: 'Гость' };
export const GROUP = { id: -1001234567890, type: 'supergroup' as const, title: 'CoreThree · работа' };

export function testConfig(over: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    BOT_TOKEN: '123:test',
    OWNER_TG_IDS: String(OWNER.id),
    INTAKE_SECRET: 'test-intake-secret-0123456789',
    SITE_URL: 'https://corethree.ru',
    ...over
  });
}

const BOT_INFO: UserFromGetMe = {
  id: 42,
  is_bot: true,
  first_name: 'CoreThree',
  username: 'corethree_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false
} as UserFromGetMe;

export type Call = { method: string; payload: Record<string, unknown> };

/** Бот с подменённым API: все вызовы Telegram записываются, ответы — правдоподобные. */
export async function testBot(over: Record<string, string> = {}, now?: () => Date) {
  const h = await memoryDb();
  const config = testConfig(over);
  const studio = createBot({ db: h.db, config, botInfo: BOT_INFO, now });
  const calls: Call[] = [];
  let mid = 100;
  studio.bot.api.config.use(async (_prev, method, payload) => {
    const p = (payload ?? {}) as Record<string, unknown>;
    calls.push({ method, payload: p });
    let result: unknown = true;
    if (method === 'sendMessage' || method === 'editMessageText') {
      result = {
        message_id: method === 'sendMessage' ? ++mid : (p.message_id as number),
        date: 0,
        chat: { id: p.chat_id, type: Number(p.chat_id) < 0 ? 'supergroup' : 'private' },
        text: p.text
      };
    }
    return { ok: true, result } as never;
  });
  let uid = 1;
  const send = (update: Omit<Update, 'update_id'>) => studio.bot.handleUpdate({ update_id: uid++, ...update } as Update);
  return { ...h, config, studio, calls, send };
}

export function command(from: TgUserLike, text: string, chat: { id: number; type: string; title?: string } = { id: from.id, type: 'private' }) {
  const cmd = text.split(' ')[0]!;
  return {
    message: {
      message_id: Math.floor(Math.random() * 1e6),
      date: 0,
      chat,
      from,
      text,
      entities: [{ type: 'bot_command', offset: 0, length: cmd.length }]
    }
  } as unknown as Omit<Update, 'update_id'>;
}

export function press(from: TgUserLike, data: string, messageId = 101, chat = GROUP) {
  return {
    callback_query: {
      id: String(Math.random()),
      from,
      chat_instance: 'x',
      data,
      message: { message_id: messageId, date: 0, chat, text: 'card' }
    }
  } as unknown as Omit<Update, 'update_id'>;
}

export function replyTo(from: TgUserLike, replyToId: number, text: string, chat = GROUP) {
  return {
    message: {
      message_id: Math.floor(Math.random() * 1e6),
      date: 0,
      chat,
      from,
      text,
      reply_to_message: { message_id: replyToId, date: 0, chat, text: 'prompt' }
    }
  } as unknown as Omit<Update, 'update_id'>;
}

/** Форма сайта так, как её шлёт браузер: согласие, время заполнения, пустая ловушка. */
export const siteForm = (over: Record<string, unknown> = {}) => ({
  name: 'Анна',
  contact: '@anna_writes',
  task: 'Что: Сайт или лендинг\nСрок: В течение месяца\n\nНужен лендинг под курс акварели',
  kind: 'sites',
  page: '/sites',
  consent: true,
  elapsed: 15000,
  website: '',
  ...over
});
