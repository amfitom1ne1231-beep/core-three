import { NextResponse } from 'next/server';
import { checkLead } from '@/lib/lead';
import { saveLead } from '@/lib/leads-store';

/**
 * Приём заявки. Клиенту не верим: проверка повторяется здесь целиком.
 *
 * Ограничение частоты — в памяти процесса. На нескольких инстансах
 * оно не общее, но от ручного флуда и зацикленной формы защищает,
 * а для настоящей атаки есть ограничения длины в самой таблице.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  // карта не должна расти бесконечно
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const check = checkLead(body);
  if (!check.ok) {
    return NextResponse.json({ error: 'invalid', fields: check.errors }, { status: 422 });
  }
  if (check.bot) return NextResponse.json({ ok: true });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (limited(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const result = await saveLead(check.lead);
  if (result === 'saved' || result === 'dry') return NextResponse.json({ ok: true });
  return NextResponse.json({ error: 'unavailable' }, { status: 503 });
}
