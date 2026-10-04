import { serve } from '@hono/node-server';
import { loadConfig } from './config';
import { openDb } from './db/client';
import { getGroup, setGroup } from './domain/settings';
import { createApp } from './http/app';
import { startScheduler } from './jobs/scheduler';
import { sheetsTick } from './sheets/sync';
import { createBot, type StudioBot } from './tg/bot';

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
if (studio && config.BOT_MODE === 'webhook' && (!config.PUBLIC_URL || !config.WEBHOOK_SECRET)) {
  throw new Error('Для webhook нужны PUBLIC_URL и WEBHOOK_SECRET');
}

// HTTP — раньше Telegram: заявки с сайта принимаются, даже если до Telegram
// сейчас не достать. Раньше сервис сначала ждал ответа Telegram и без него
// не открывал порт вовсе — сайт в это время терял заявки.
const app = createApp({ db, config, studio });
const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => console.info(`[http] :${info.port}`));

/**
 * Подключение к Telegram: имя бота (нужно ссылкам на карточках), webhook
 * или опрос, меню и карточки. Не удалось — сервис работает дальше и
 * пробует снова: в России Telegram заблокирован, и связь с ним — через
 * ретранслятор (TELEGRAM_API_ROOT), который тоже может пропадать.
 */
async function connectTelegram(studio: StudioBot) {
  // Свой срок на первые запросы: без него недоступный Telegram держит попытку
  // восемь минут. Тип сигнала у grammY — из его собственной прослойки, обычный подходит.
  const soon = () => AbortSignal.timeout(20_000) as unknown as Parameters<StudioBot['bot']['init']>[0];
  await studio.bot.init(soon());
  if (config.BOT_MODE === 'webhook') {
    await studio.bot.api.setWebhook(
      `${config.PUBLIC_URL}/tg/${config.WEBHOOK_SECRET}`,
      { secret_token: config.WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query', 'my_chat_member'] },
      soon()
    );
    console.info(`[bot] @${studio.bot.botInfo.username}, webhook`);
  } else {
    await studio.bot.api.deleteWebhook(undefined, soon());
    void studio.bot.start({
      allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      onStart: (me) => console.info(`[bot] @${me.username}, polling`)
    });
  }
  await studio.syncMenu();
  await studio.syncCards();
  console.info(config.PUBLIC_URL ? `[app] ${config.PUBLIC_URL}/app/` : '[app] публичного адреса нет — мини-приложение только в браузере');
}

let reconnect: ReturnType<typeof setTimeout> | undefined;
if (studio) {
  let delay = 5_000;
  const attempt = () =>
    void connectTelegram(studio).catch((e) => {
      console.error(`[bot] Telegram недоступен, повтор через ${delay / 1000} с:`, e instanceof Error ? e.message : e);
      reconnect = setTimeout(attempt, delay);
      delay = Math.min(delay * 2, 5 * 60_000);
    });
  attempt();
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
  clearTimeout(reconnect);
  if (studio && config.BOT_MODE === 'polling') await studio.bot.stop();
  server.close();
  await close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
