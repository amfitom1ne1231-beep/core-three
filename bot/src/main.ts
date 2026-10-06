import { serve } from '@hono/node-server';
import { loadConfig } from './config';
import { openDb } from './db/client';
import { loadPrefs, slaOf } from './domain/prefs';
import { getGroup, setGroup } from './domain/settings';
import { createApp } from './http/app';
import { startScheduler } from './jobs/scheduler';
import { sheetsTick } from './sheets/sync';
import { createBot, type StudioBot } from './tg/bot';
import { errorLine } from '../../lib/redact';

/**
 * Сервис бота: база, бот, HTTP и расписание в одном процессе.
 * Порядок запуска: база с миграциями → бот → HTTP → расписание.
 */

// Необработанная ошибка не должна попасть в лог целиком: Node печатает её
// со всеми вложенными, а в сетевой ошибке Telegram — адрес с токеном бота.
// Отклонённое обещание сервис переживает — заявки важнее; исключение — нет.
process.on('unhandledRejection', (e) => console.error('[main] необработанная ошибка:', errorLine(e)));
process.on('uncaughtException', (e) => {
  console.error('[main] необработанная ошибка:', errorLine(e));
  process.exit(1);
});

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
  // описание и общее меню команд — мелочь: не вышло сейчас, выйдет при следующем запуске
  await studio.syncProfile().catch((e) => console.error('[bot] профиль:', errorLine(e)));
  console.info(config.PUBLIC_URL ? `[app] ${config.PUBLIC_URL}/app/` : '[app] публичного адреса нет — мини-приложение только в браузере');
}

let reconnect: ReturnType<typeof setTimeout> | undefined;
if (studio) {
  let delay = 5_000;
  const attempt = () =>
    void connectTelegram(studio).catch((e) => {
      // причина бывает и не в связи: например, webhook на адрес, которого ещё нет
      console.error(`[bot] подключение к Telegram не удалось, повтор через ${delay / 1000} с:`, errorLine(e));
      reconnect = setTimeout(attempt, delay);
      delay = Math.min(delay * 2, 5 * 60_000);
    });
  attempt();
}

// Рабочие часы, срок реакции и сводки команда меняет из приложения —
// расписание перечитывает их на каждом заходе, перезапуск не нужен.
const stopScheduler = startScheduler(db, studio, async () => {
  const prefs = await loadPrefs(db, config);
  return { ...slaOf(config, prefs), morningDigest: prefs.morningDigest, weeklyDigest: prefs.weeklyDigest };
});

// Google-таблица — отражение базы: раз в минуту в неё уходит то, что изменилось
const toSheets = async () => {
  const sla = slaOf(config, await loadPrefs(db, config));
  await sheetsTick(db, { ...config, SLA_TAKE_MIN: sla.takeMin, work: sla.work });
};
const sheets = config.SHEETS_URL && config.SHEETS_SECRET ? setInterval(() => void toSheets(), 30_000) : null;
if (sheets) {
  console.info('[sheets] дублирование в таблицу включено');
  void toSheets();
}

async function shutdown(signal: string) {
  console.info(`[main] ${signal}, останавливаюсь`);
  stopScheduler();
  if (sheets) clearInterval(sheets);
  clearTimeout(reconnect);
  // При остановке grammY делает последний запрос к Telegram. Не прошёл —
  // не повод падать: раньше эта ошибка уходила в лог целиком, с токеном.
  if (studio && config.BOT_MODE === 'polling') {
    await Promise.race([studio.bot.stop(), new Promise((resolve) => setTimeout(resolve, 3000))]).catch((e) =>
      console.error('[bot] остановка:', errorLine(e))
    );
  }
  server.close();
  await close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
