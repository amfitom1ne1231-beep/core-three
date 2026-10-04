import { webhookCallback } from 'grammy';
import { Hono } from 'hono';
import { z } from 'zod';
import { checkLead } from '../../../lib/lead';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { createLead } from '../domain/leads';
import type { StudioBot } from '../tg/bot';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from '../../../lib/intake-sign';

/**
 * HTTP сервиса: приём заявок с сайта и webhook Telegram.
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

export function createApp({ db, config, studio }: { db: Db; config: Config; studio: StudioBot | null }) {
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

  if (studio && config.BOT_MODE === 'webhook' && config.WEBHOOK_SECRET) {
    app.post(`/tg/${config.WEBHOOK_SECRET}`, webhookCallback(studio.bot, 'hono', { secretToken: config.WEBHOOK_SECRET }));
  }

  return app;
}
