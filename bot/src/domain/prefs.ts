import { z } from 'zod';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { getSetting, setSetting } from './settings';
import type { Sla } from './sla';

/**
 * Настройки, которые команда меняет сама, из приложения: рабочее время,
 * срок реакции на заявку, сводки. Раньше они жили только в окружении
 * сервиса — поменять час напоминания значило идти на сервер.
 *
 * Окружение остаётся значениями по умолчанию: пока в приложении ничего
 * не трогали, сервис ведёт себя как раньше. Часовой пояс отсюда не
 * меняется — он один на всю студию (решение заказчика: по Москве).
 */

/**
 * Поля по отдельности — для частичной правки из приложения. Связи между
 * ними (день не короче часа, проверка не раньше начала дня) проверяет
 * `PrefsSchema` уже на собранном целом: у схемы с такими проверками
 * нельзя взять «любую часть полей».
 */
export const PrefsShape = z.object({
  /** Начало и конец рабочего дня — минуты от полуночи. */
  workStart: z.number().int().min(0).max(23 * 60),
  workEnd: z.number().int().min(60).max(24 * 60),
  /** Рабочие дни: 0 — воскресенье, 1 — понедельник … 6 — суббота. */
  workDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  /** Через сколько рабочих минут без «Беру» звать всех. */
  takeMin: z.number().int().min(5).max(8 * 60),
  /** За сколько минут до конца дня проверять, всем ли ответили. */
  alarmBeforeEndMin: z.number().int().min(0).max(8 * 60),
  morningDigest: z.boolean(),
  weeklyDigest: z.boolean()
});

export const PrefsSchema = PrefsShape
  .refine((p) => p.workEnd - p.workStart >= 60, { message: 'рабочий день короче часа', path: ['workEnd'] })
  .refine((p) => p.alarmBeforeEndMin < p.workEnd - p.workStart, { message: 'проверка раньше начала дня', path: ['alarmBeforeEndMin'] });

export type Prefs = z.infer<typeof PrefsSchema>;

const KEY = 'prefs';

export function defaultPrefs(config: Config): Prefs {
  return {
    workStart: config.work.start,
    workEnd: config.work.end,
    workDays: [...config.work.days].sort((a, b) => a - b),
    takeMin: config.SLA_TAKE_MIN,
    alarmBeforeEndMin: config.SLA_ALARM_BEFORE_END_MIN,
    morningDigest: true,
    weeklyDigest: true
  };
}

/** Сохранённое поверх умолчаний. Испорченная запись не роняет сервис — берутся умолчания. */
export async function loadPrefs(db: Db, config: Config): Promise<Prefs> {
  const base = defaultPrefs(config);
  const stored = await getSetting<Partial<Prefs>>(db, KEY);
  if (!stored) return base;
  const merged = PrefsSchema.safeParse({ ...base, ...stored });
  return merged.success ? { ...merged.data, workDays: [...new Set(merged.data.workDays)].sort((a, b) => a - b) } : base;
}

/** Правка части настроек. Возвращает итог или ошибки по полям. */
export async function savePrefs(db: Db, config: Config, patch: Partial<Prefs>) {
  const next = PrefsSchema.safeParse({ ...(await loadPrefs(db, config)), ...patch });
  if (!next.success) return { ok: false as const, fields: Object.fromEntries(next.error.issues.map((i) => [String(i.path[0] ?? ''), i.message])) };
  const prefs = { ...next.data, workDays: [...new Set(next.data.workDays)].sort((a, b) => a - b) };
  await setSetting(db, KEY, prefs);
  return { ok: true as const, prefs };
}

/** Те же настройки в том виде, в каком их ждут сроки и сводки. */
export function slaOf(config: Config, prefs: Prefs): Sla {
  return {
    work: { tz: config.work.tz, days: prefs.workDays, start: prefs.workStart, end: prefs.workEnd },
    takeMin: prefs.takeMin,
    alarmBeforeEndMin: prefs.alarmBeforeEndMin
  };
}
