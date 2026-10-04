import { z } from 'zod';

/**
 * Настройки сервиса — только из окружения. Секреты в репозиторий
 * не попадают: образец с пояснениями — `bot/.env.example`.
 *
 * Без токена бота сервис всё равно поднимается: принимает заявки,
 * пишет их в базу и считает сроки. Так его можно разрабатывать
 * и тестировать до того, как у заказчика появится бот.
 */

const hhmm = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/)
  .transform((s) => {
    const [h, m] = s.split(':').map(Number);
    return h! * 60 + m!;
  });

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(8787),

  /** Токен бота от @BotFather. Пусто — бот выключен, сервис работает. */
  BOT_TOKEN: z.string().optional(),
  /** polling — для разработки, webhook — на сервере за HTTPS. */
  BOT_MODE: z.enum(['polling', 'webhook']).default('polling'),
  /**
   * Публичный адрес сервиса по HTTPS: на него Telegram шлёт webhook,
   * по нему же открывается мини-приложение (`<адрес>/app/`). Пусто —
   * мини-приложения в Telegram нет, кнопки «Открыть» на карточках тоже.
   */
  PUBLIC_URL: z.url().optional(),
  /** Секрет в адресе и заголовке webhook: чужой запрос его не знает. */
  WEBHOOK_SECRET: z.string().min(16).optional(),

  /**
   * Telegram id владельцев через запятую: входят без приглашения, зовут
   * остальных, получают вечернюю тревогу. У студии владельцы все трое.
   */
  OWNER_TG_IDS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean).map(Number))
    .refine((ids) => ids.every((n) => Number.isInteger(n) && n > 0), 'id — целые числа через запятую'),

  /**
   * Рабочая группа по умолчанию — пока её не задали командой /bind.
   * id супергруппы начинается с -100. Тема — если в группе включены темы.
   */
  GROUP_CHAT_ID: z.coerce.number().int().optional(),
  GROUP_THREAD_ID: z.coerce.number().int().optional(),

  /** Postgres. Пусто — встроенный PGlite в BOT_DATA_DIR (разработка). */
  DATABASE_URL: z.string().optional(),
  BOT_DATA_DIR: z.string().default('.data/pglite'),

  /** Общий секрет с сайтом: им подписан каждый запрос с заявкой. */
  INTAKE_SECRET: z.string().min(16).optional(),

  /** Собранное мини-приложение (admin/dist) — сервис отдаёт его по /app/. */
  ADMIN_DIST: z.string().default('../admin/dist'),
  /**
   * Мини-приложение в браузере без Telegram: запросы с этой же машины
   * идут от имени первого владельца. Только для разработки — в production
   * и при заданном PUBLIC_URL (сервис виден снаружи) не действует.
   */
  APP_DEV: z.enum(['0', '1']).default('0'),
  /**
   * Куда ведёт «Открыть» на карточке в группе. chat — в личку бота, там
   * кнопка мини-приложения: работает с любым адресом, в том числе с
   * туннелем, который меняется при каждом запуске. direct — сразу
   * в приложение (t.me/<бот>?startapp=…): нужен постоянный адрес,
   * вписанный у @BotFather как Main Mini App.
   */
  MINI_APP_LINK: z.enum(['chat', 'direct']).default('chat'),

  /**
   * Ключ шифрования доступов: 32 байта в base64 (openssl rand -base64 32).
   * Только в окружении сервиса — в базе и бэкапах его нет. Потерять ключ —
   * потерять сохранённые доступы. Пусто — раздел доступов выключен.
   */
  SECRETS_KEY: z
    .string()
    .refine((s) => Buffer.from(s, 'base64').length === 32, '32 байта в base64: openssl rand -base64 32')
    .optional(),

  /** Адрес сайта — для ответа посторонним в боте. */
  SITE_URL: z.url().default('https://corethree.ru'),

  /** Рабочее время для сроков: напоминания ночью и в выходные не шлются. */
  WORK_TZ: z.string().default('Europe/Moscow'),
  WORK_DAYS: z
    .string()
    .default('1,2,3,4,5')
    .transform((s) => s.split(',').map(Number)),
  WORK_START: hhmm.default(10 * 60),
  WORK_END: hhmm.default(19 * 60),
  /** Через сколько рабочих минут без «Беру» напомнить группе. */
  SLA_TAKE_MIN: z.coerce.number().int().default(60),
  /** За сколько минут до конца дня проверить, всем ли ответили. */
  SLA_ALARM_BEFORE_END_MIN: z.coerce.number().int().default(60)
});

export type Config = z.infer<typeof Env> & {
  work: { tz: string; days: number[]; start: number; end: number };
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // «PUBLIC_URL=» в файле настроек — значит «не задано», а не пустая строка:
  // иначе необязательные поля валятся на проверке адреса и длины
  const set = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ''));
  const parsed = Env.safeParse(set);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Настройки сервиса неверны:\n  ${issues}`);
  }
  const c = parsed.data;
  return {
    ...c,
    work: { tz: c.WORK_TZ, days: c.WORK_DAYS, start: c.WORK_START, end: c.WORK_END }
  };
}
