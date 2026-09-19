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
/** Принятых заявок с одного адреса за окно. */
const MAX_LEADS = 5;
/** Обращений любого вида — чтобы мусором нельзя было забить процесс. */
const MAX_HITS = 30;

const hits = new Map<string, number[]>();

/**
 * Адрес отправителя.
 *
 * `x-forwarded-for` дописывается слева каждым, кто пересылает запрос, и
 * самое левое значение ставит сам клиент. Брать его для лимита
 * бессмысленно: достаточно менять заголовок в каждом запросе, чтобы
 * лимита не существовало вовсе — раньше так и было.
 *
 * Vercel кладёт настоящий адрес в собственный заголовок и переписывает
 * его на входе, поэтому ему верим всегда. Цепочке `x-forwarded-for`
 * верим только когда точно знаем, что перед нами стоит прокси
 * (`TRUST_PROXY=1` — это про переезд на VPS, где заголовок ставит nginx):
 * тогда берём правое значение, дописанное ближайшим к нам прокси.
 *
 * Без прокси заголовка нет вовсе, а если он пришёл — его сочинил клиент.
 * В этом случае все безымянные складываются в одно ведро: пусть лимит
 * будет грубее, чем даст себя обойти одной строчкой в запросе.
 */
function clientIp(req: Request): string {
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0]!.trim();

  if (process.env.TRUST_PROXY === '1') {
    const real = req.headers.get('x-real-ip');
    if (real) return real.trim();

    const chain = req.headers.get('x-forwarded-for');
    if (chain) {
      const parts = chain.split(',');
      return parts[parts.length - 1]!.trim();
    }
  }
  return 'unknown';
}

function limited(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  // Просроченные записи выносим по одной. Раньше карта при переполнении
  // очищалась целиком — то есть лимит снимался со всех сразу, и обнулить
  // его можно было, забив карту подставными адресами.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
      if (hits.size <= 4000) break;
    }
  }
  return recent.length > max;
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  // считается любое обращение, включая мусорное: иначе поток заведомо
  // битых тел не ограничен ничем
  if (limited(`hit:${ip}`, MAX_HITS)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const check = checkLead(body);
  if (!check.ok) {
    // ошибка в полях — обычное дело у живого человека, отдельный счётчик
    // принятых заявок не трогаем
    return NextResponse.json({ error: 'invalid', fields: check.errors }, { status: 422 });
  }

  if (limited(`lead:${ip}`, MAX_LEADS)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // Ловушка сработала: кладём со статусом «спам», а не выбрасываем —
  // она ошибается на живых людях, и такую заявку надо иметь возможность
  // найти. Отправителю отвечаем как при успехе.
  if (check.bot) {
    await saveLead(check.lead, 'spam');
    return NextResponse.json({ ok: true });
  }

  const result = await saveLead(check.lead);
  if (result === 'saved' || result === 'dry') return NextResponse.json({ ok: true });
  return NextResponse.json({ error: 'unavailable' }, { status: 503 });
}
