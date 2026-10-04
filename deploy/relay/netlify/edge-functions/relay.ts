/**
 * Ретранслятор Bot API Telegram — функция на границе сети Netlify.
 *
 * Зачем: с сервера в России до api.telegram.org не достать (Telegram
 * заблокирован), а до Netlify — можно. Сервис бота и сайт шлют запросы
 * сюда (`TELEGRAM_API_ROOT=https://<сайт>.netlify.app/<ключ>`), функция
 * пересылает их в Telegram как есть и возвращает ответ.
 *
 * Ключ в адресе (`RELAY_KEY` в настройках сайта Netlify) — чтобы
 * ретранслятором не пользовался посторонний: без ключа здесь «ничего нет».
 * Токен бота идёт в адресе запроса, как всегда у Bot API; здесь он
 * не хранится и не пишется: ни одного console.* в файле быть не должно.
 *
 * Как выкладывать — deploy/README.md, «Telegram с российского сервера».
 */

declare const Netlify: { env: { get(name: string): string | undefined } };

const TELEGRAM = 'https://api.telegram.org';

/** Только адреса Bot API: `bot<токен>/<метод>` и скачивание файла `file/bot<токен>/<путь>`. */
const BOT_API = /^(file\/)?bot\d+:[\w-]+\/.+/;

/** Что Telegram получит от исходного запроса: тип и длина тела — и всё. Кто обращался к ретранслятору, ему знать незачем. */
const PASS = ['content-type'];

export async function relay(req: Request, key: string | undefined, send: typeof fetch = fetch): Promise<Response> {
  const url = new URL(req.url);
  const [, given, ...rest] = url.pathname.split('/');
  const path = rest.join('/');
  if (!key || given !== key || !BOT_API.test(path)) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  for (const name of PASS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();

  try {
    const res = await send(`${TELEGRAM}/${path}${url.search}`, { method: req.method, headers, body, redirect: 'manual' });
    const out = new Headers();
    for (const name of ['content-type', 'retry-after']) {
      const value = res.headers.get(name);
      if (value) out.set(name, value);
    }
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    // тем же видом, что отвечает сам Bot API: библиотека бота разберёт это как обычный отказ
    return Response.json({ ok: false, error_code: 502, description: 'Bad Gateway: relay could not reach Telegram' }, { status: 502 });
  }
}

const handler = (req: Request) => relay(req, Netlify.env.get('RELAY_KEY'));
export default handler;

export const config = { path: '/*' };
