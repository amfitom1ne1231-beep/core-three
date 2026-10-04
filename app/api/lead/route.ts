import { NextResponse } from 'next/server';
import { checkLead } from '@/lib/lead';
import { forwardLead } from '@/lib/intake';
import { notifyLead } from '@/lib/notify';
import { cleanSource } from '@/lib/source';

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
 * Во сколько раз шире лимиты у безымянного ведра. Туда попадают все,
 * чей адрес узнать нельзя, — то есть на хостинге без доверенного
 * заголовка все посетители разом. С обычными лимитами один человек
 * тридцатью запросами закрывал форму для всех на десять минут.
 */
const SHARED = 10;

/**
 * Заголовок с адресом, который ставит хостинг превью. Имя вписывается
 * на сборке (next.config.mjs), а не читается из запроса: иначе на любом
 * другом хостинге клиент прислал бы этот заголовок сам и выбрал себе
 * адрес — ровно та дыра, которую закрывали с x-forwarded-for.
 */
const HOST_IP_HEADER = process.env.LEAD_IP_HEADER ?? '';

let warned = false;

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

  if (HOST_IP_HEADER) {
    const host = req.headers.get(HOST_IP_HEADER);
    if (host) return host.trim();
  }

  if (process.env.TRUST_PROXY === '1') {
    const real = req.headers.get('x-real-ip');
    if (real) return real.trim();

    const chain = req.headers.get('x-forwarded-for');
    if (chain) {
      const parts = chain.split(',');
      return parts[parts.length - 1]!.trim();
    }
  }
  if (!warned && process.env.NODE_ENV === 'production') {
    warned = true;
    console.warn('[lead] адрес отправителя неизвестен: все заявки в одном ведре. За прокси задайте TRUST_PROXY=1');
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
  const k = ip === 'unknown' ? SHARED : 1;
  // считается любое обращение, включая мусорное: иначе поток заведомо
  // битых тел не ограничен ничем
  if (limited(`hit:${ip}`, MAX_HITS * k)) {
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

  if (limited(`lead:${ip}`, MAX_LEADS * k)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // Заявка — в сервис бота: он хранит её в базе в РФ и ставит карточку
  // в рабочую группу. Форма уходит как пришла, ловушку для ботов сервис
  // проверяет сам и такую заявку не выбрасывает, а помечает. Источник
  // (метки из ссылки, страница входа) едет отдельно и вычищен: клиенту
  // не верим и тут.
  const { meta: rawMeta, ...form } = body as Record<string, unknown>;
  const meta = cleanSource(rawMeta);
  const forwarded = await forwardLead(form, meta);
  if (forwarded === 'sent' || forwarded === 'dry') return NextResponse.json({ ok: true });

  // Сервис недоступен — запасной путь: прямо в группу, как раньше.
  // Заявка, которая дошла хотя бы так, не потеряна.
  const notified = await notifyLead(check.lead, check.bot ? 'spam' : 'new', meta);
  // сработавшей ловушке отвечаем «успех» в любом случае: бот ничего не узнаёт
  if (notified === 'sent' || check.bot) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: 'unavailable' }, { status: 503 });
}
