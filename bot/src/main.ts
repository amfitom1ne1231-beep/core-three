import { serve } from '@hono/node-server';
import { loadConfig } from './config';
import { openDb } from './db/client';
import { createApp } from './http/app';
import { startScheduler } from './jobs/scheduler';
import { createBot } from './tg/bot';

/**
 * Сервис бота: база, бот, HTTP и расписание в одном процессе.
 * Порядок запуска: база с миграциями → бот → HTTP → расписание.
 */

const config = loadConfig();
const { db, close, kind } = await openDb({ url: config.DATABASE_URL, dataDir: config.BOT_DATA_DIR });
console.info(`[db] ${kind}`);

const studio = config.BOT_TOKEN ? createBot({ db, config }) : null;
if (!studio) console.warn('[bot] BOT_TOKEN не задан — бот выключен, заявки только в базу');

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

const stopScheduler = startScheduler(db, studio, {
  work: config.work,
  takeMin: config.SLA_TAKE_MIN,
  alarmBeforeEndMin: config.SLA_ALARM_BEFORE_END_MIN
});

async function shutdown(signal: string) {
  console.info(`[main] ${signal}, останавливаюсь`);
  stopScheduler();
  if (studio && config.BOT_MODE === 'polling') await studio.bot.stop();
  server.close();
  await close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
