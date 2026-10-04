import { serve } from '@hono/node-server';
import { loadConfig } from './config';
import { openDb } from './db/client';
import { getGroup, setGroup } from './domain/settings';
import { createApp } from './http/app';
import { startScheduler } from './jobs/scheduler';
import { sheetsTick } from './sheets/sync';
import { createBot } from './tg/bot';

/**
 * Сервис бота: база, бот, HTTP и расписание в одном процессе.
 * Порядок запуска: база с миграциями → бот → HTTP → расписание.
 */

const config = loadConfig();
const { db, close, kind } = await openDb({ url: config.DATABASE_URL, dataDir: config.BOT_DATA_DIR });
console.info(`[db] ${kind}`);

// группа из окружения — пока её не задали командой /bind в самой группе
if (config.GROUP_CHAT_ID && !(await getGroup(db))) {
  await setGroup(db, { chatId: config.GROUP_CHAT_ID, threadId: config.GROUP_THREAD_ID ?? null, title: null });
  console.info('[bot] рабочая группа — из GROUP_CHAT_ID');
}

const studio = config.BOT_TOKEN ? createBot({ db, config }) : null;
if (!studio) console.warn('[bot] BOT_TOKEN не задан — бот выключен, заявки только в базу');
// имя бота нужно ссылкам на карточках раньше, чем придёт первое обновление
if (studio) await studio.bot.init();

const app = createApp({ db, config, studio });
const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => console.info(`[http] :${info.port}`));

if (studio) {
  if (config.BOT_MODE === 'webhook') {
    if (!config.PUBLIC_URL || !config.WEBHOOK_SECRET) throw new Error('Для webhook нужны PUBLIC_URL и WEBHOOK_SECRET');
    await studio.bot.api.setWebhook(`${config.PUBLIC_URL}/tg/${config.WEBHOOK_SECRET}`, {
      secret_token: config.WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query', 'my_chat_member']
    });
    console.info('[bot] webhook');
  } else {
    await studio.bot.api.deleteWebhook();
    void studio.bot.start({
      allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      onStart: (me) => console.info(`[bot] @${me.username}, polling`)
    });
  }
}

if (studio) {
  await studio.syncMenu();
  await studio.syncCards();
  console.info(config.PUBLIC_URL ? `[app] ${config.PUBLIC_URL}/app/` : '[app] публичного адреса нет — мини-приложение только в браузере');
}

const stopScheduler = startScheduler(db, studio, {
  work: config.work,
  takeMin: config.SLA_TAKE_MIN,
  alarmBeforeEndMin: config.SLA_ALARM_BEFORE_END_MIN
});

// Google-таблица — отражение базы: раз в минуту в неё уходит то, что изменилось
const sheets = config.SHEETS_URL && config.SHEETS_SECRET ? setInterval(() => void sheetsTick(db, config), 30_000) : null;
if (sheets) {
  console.info('[sheets] дублирование в таблицу включено');
  void sheetsTick(db, config);
}

async function shutdown(signal: string) {
  console.info(`[main] ${signal}, останавливаюсь`);
  stopScheduler();
  if (sheets) clearInterval(sheets);
  if (studio && config.BOT_MODE === 'polling') await studio.bot.stop();
  server.close();
  await close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
