import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { webhookCallback } from 'grammy';
import { Hono } from 'hono';
import { getMimeType } from 'hono/utils/mime';
import { z } from 'zod';
import { checkLead } from '../../../lib/lead';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { createLead } from '../domain/leads';
import type { StudioBot } from '../tg/bot';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from '../../../lib/intake-sign';
import { createApi } from './api';

/**
 * HTTP сервиса: приём заявок с сайта, webhook Telegram, мини-приложение
 * (`/app/` — собранная статика, `/api/app/` — её API).
 *
 * Заявку сайт присылает подписанной (см. sign.ts) и проверенной своими
 * правилами — но сервис не верит и ему: проверка повторяется здесь теми
 * же правилами, буквально тем же кодом (lib/lead.ts сайта).
 */

const Meta = z.record(z.string().max(60), z.string().max(500)).optional();

const Intake = z.object({
  /** Форма как пришла на сайт: проверка и ловушки для ботов — здесь же, заново. */
  lead: z.unknown(),
  /** utm-метки, страница входа, откуда пришли — для метрик источников. */
  meta: Meta
});

export function createApp({ db, config, studio, now }: { db: Db; config: Config; studio: StudioBot | null; now?: () => Date }) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true }));

  app.post('/api/intake/lead', async (c) => {
    if (!config.INTAKE_SECRET) return c.json({ error: 'intake disabled' }, 503);
    const body = await c.req.text();
    if (body.length > 20_000) return c.json({ error: 'too large' }, 413);
    if (!verify(config.INTAKE_SECRET, c.req.header(TIMESTAMP_HEADER), c.req.header(SIGNATURE_HEADER), body)) {
      return c.json({ error: 'bad signature' }, 401);
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return c.json({ error: 'bad json' }, 400);
    }
    const parsed = Intake.safeParse(json);
    if (!parsed.success) return c.json({ error: 'bad request' }, 400);
    const check = checkLead(parsed.data.lead);
    if (!check.ok) return c.json({ error: 'invalid lead', fields: check.errors }, 422);

    const lead = await createLead(db, {
      source: 'site',
      ...check.lead,
      meta: parsed.data.meta ?? null,
      spam: check.bot
    });
    // карточка в группу — не повод отвечать сайту ошибкой: заявка уже в базе
    const card = studio
      ? await studio.publishLead(lead.id).catch((e) => {
          console.error('[intake] карточка', e);
          return false;
        })
      : false;
    if (config.NODE_ENV !== 'test') {
      console.info(`[intake] заявка #${lead.id}: ${card ? 'карточка в группе' : 'только в базе'}${check.bot ? ', ловушка' : ''}`);
    }
    return c.json({ id: lead.id }, 201);
  });

  app.route('/api/app', createApi({ db, config, studio, now }));

  // Мини-приложение: файлы сборки — как есть, любой другой адрес под /app/
  // отдаёт index.html — приложение одностраничное и дальше разбирается само.
  const dist = path.resolve(config.ADMIN_DIST);
  app.get('/app', (c) => c.redirect('/app/'));
  app.get('/app/*', async (c) => {
    const index = path.join(dist, 'index.html');
    // проверяется на каждый запрос: приложение можно собрать при работающем сервисе
    if (!existsSync(index)) return c.text('Мини-приложение не собрано: npm --prefix admin run build', 503);

    let rel = '';
    try {
      rel = decodeURIComponent(c.req.path.slice('/app/'.length));
    } catch {
      return c.text('bad path', 400);
    }
    const file = path.resolve(dist, rel);
    // наружу — только то, что лежит внутри dist: «..» в адресе из папки не выведет
    const inside = rel !== '' && file.startsWith(dist + path.sep);
    if (inside && (await stat(file).catch(() => null))?.isFile()) {
      return c.body(await readFile(file), 200, {
        'Content-Type': getMimeType(file) ?? 'application/octet-stream',
        // у файлов сборки в имени хэш содержимого — их можно держать в кэше вечно
        'Cache-Control': rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
      });
    }
    // старая вкладка просит файл прошлой сборки — честное 404, а не страница вместо скрипта
    if (rel.startsWith('assets/')) return c.notFound();
    c.header('Cache-Control', 'no-cache');
    return c.html(await readFile(index, 'utf8'));
  });

  if (studio && config.BOT_MODE === 'webhook' && config.WEBHOOK_SECRET) {
    app.post(`/tg/${config.WEBHOOK_SECRET}`, webhookCallback(studio.bot, 'hono', { secretToken: config.WEBHOOK_SECRET }));
  }

  return app;
}
