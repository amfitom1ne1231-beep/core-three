import { createHash } from 'node:crypto';
import type { Db } from '../db/client';
import { getSetting, setSetting } from '../domain/settings';
import type { WorkHours } from '../domain/worktime';
import { snapshot, type Cell, type Cursor } from './rows';

/**
 * Дублирование в Google-таблицу. База бота остаётся главной: таблица —
 * её отражение для глаз, из неё ничего не читается.
 *
 * Как держится в согласии. Раз в минуту бот собирает все строки заново
 * и сравнивает с тем, что уже отправлял (помнит отпечаток каждой строки).
 * В таблицу уходит только разница. Что отправлено, запоминается после
 * ответа таблицы — не дошло, значит, уйдёт в следующий раз; а так как
 * строка находится по номеру, повтор ничего не задвоит.
 *
 * Изменения не ловятся по одному в местах, где меняются заявки и проекты:
 * таких мест много, и пропущенное осталось бы в таблице навсегда.
 */

export type Op = { sheet: string; header: string[]; rows: Cell[][]; remove?: string[] };
export type Send = (ops: Op[]) => Promise<void>;

type State = {
  /** Отпечатки отправленных строк: лист → ключ → отпечаток. */
  sent: Record<string, Record<string, string>>;
  cursor: Cursor;
};

const KEY = 'sheets';
const EMPTY: State = { sent: {}, cursor: { lead: 0, project: 0 } };

const print = (row: Cell[]) => createHash('sha1').update(JSON.stringify(row)).digest('base64url').slice(0, 12);

/** Строк в одном запросе: скрипт таблицы пишет их по одной, большой запрос упрётся в его лимит времени. */
const BATCH = 400;

export async function syncSheets(db: Db, opts: { work: WorkHours; slaMin: number; now: Date; send: Send }) {
  const state = (await getSetting<State>(db, KEY)) ?? EMPTY;
  const snap = await snapshot(db, { work: opts.work, slaMin: opts.slaMin, now: opts.now, after: state.cursor });

  const ops: Op[] = [];
  const next: State = { sent: { ...state.sent }, cursor: snap.cursor };

  for (const sheet of snap.sheets) {
    const before = state.sent[sheet.name] ?? {};
    const after: Record<string, string> = {};
    const rows: Cell[][] = [];
    for (const [key, row] of sheet.rows) {
      after[key] = print(row);
      if (before[key] !== after[key]) rows.push(row);
    }
    const remove = sheet.keep ? [] : Object.keys(before).filter((key) => !sheet.rows.has(key));
    next.sent[sheet.name] = after;
    if (rows.length || remove.length) ops.push({ sheet: sheet.name, header: sheet.header, rows, remove });
  }

  if (snap.history.rows.size) ops.push({ sheet: snap.history.name, header: snap.history.header, rows: [...snap.history.rows.values()] });
  if (!ops.length) return { rows: 0 };

  let sent = 0;
  for (const op of ops) {
    // удаления — с первой порцией строк листа
    for (let i = 0; i === 0 || i < op.rows.length; i += BATCH) {
      const rows = op.rows.slice(i, i + BATCH);
      await opts.send([{ ...op, rows, remove: i === 0 ? op.remove : [] }]);
      sent += rows.length + (i === 0 ? (op.remove?.length ?? 0) : 0);
    }
  }
  await setSetting(db, KEY, next);
  return { rows: sent };
}

/** Отправка скрипту таблицы. Он отвечает 200 и на отказ — смотреть надо в тело ответа. */
export function sender(url: string, secret: string): Send {
  return async (ops) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, ops }),
      // Apps Script отвечает переадресацией на адрес с результатом
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000)
    });
    const text = await res.text();
    let body: { ok?: boolean; error?: string } | null = null;
    try {
      body = JSON.parse(text);
    } catch {
      // не JSON — страница входа Google или ошибка развёртывания
    }
    if (!res.ok || !body?.ok) throw new Error(`таблица ответила: ${res.status} ${body?.error ?? text.slice(0, 120)}`);
  };
}

/* ---------- запуск из расписания ---------- */

const EVERY_MS = 60_000;
/** После сбоя не стучимся каждую минуту: таблица недоступна — подождём. */
const RETRY_MS = 5 * 60_000;
let nextAt = 0;
let running = false;

export async function sheetsTick(db: Db, config: { SHEETS_URL?: string; SHEETS_SECRET?: string; SLA_TAKE_MIN: number; work: WorkHours }, now = new Date()) {
  if (!config.SHEETS_URL || !config.SHEETS_SECRET || running || now.getTime() < nextAt) return;
  running = true;
  try {
    const { rows } = await syncSheets(db, { work: config.work, slaMin: config.SLA_TAKE_MIN, now, send: sender(config.SHEETS_URL, config.SHEETS_SECRET) });
    if (rows) console.info(`[sheets] в таблицу ушло строк: ${rows}`);
    nextAt = now.getTime() + EVERY_MS;
  } catch (e) {
    console.error('[sheets]', e instanceof Error ? e.message : e);
    nextAt = now.getTime() + RETRY_MS;
  } finally {
    running = false;
  }
}
