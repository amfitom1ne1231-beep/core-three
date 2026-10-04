/**
 * Сервис с туннелем: мини-приложение открывается в Telegram, пока сервера
 * ещё нет. Telegram пускает мини-приложения только по HTTPS, поэтому
 * cloudflared даёт локальному сервису временный публичный адрес —
 * бесплатно и без регистрации. Адрес новый при каждом запуске; сервис
 * получает его в PUBLIC_URL и сам ставит команде кнопку «Студия».
 *
 *   npm run dev:tunnel        сервис из исходников, перезапускается на каждую правку
 *   npm run start:tunnel      снимок: собранный сервис и собранное приложение —
 *                             правки в исходниках его не трогают, пока не перезапустить.
 *                             Так бот остаётся живым для команды, пока идёт разработка
 *
 * Нужен cloudflared: brew install cloudflared.
 *
 * Сервис при этом виден из интернета. Наружу он отдаёт только то, что
 * закрыто подписью: приём заявок (HMAC сайта) и API приложения (initData
 * Telegram); вход «с этой машины без подписи» при заданном PUBLIC_URL
 * не действует.
 */
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';

const port = process.env.PORT ?? '8787';
const snapshot = process.argv.includes('--built');

function run(cmd, args) {
  const done = spawnSync(cmd, args, { stdio: 'inherit' });
  if (done.status !== 0) process.exit(done.status ?? 1);
}

if (snapshot) {
  run('npm', ['run', 'build']);
  run('npm', ['--prefix', '../admin', 'run', 'build']);
  // приложение — рядом с собранным сервисом: пересборка admin/dist снимок не заденет
  rmSync('dist/app', { recursive: true, force: true });
  cpSync('../admin/dist', 'dist/app', { recursive: true });
} else if (!existsSync(new URL('../../admin/dist/index.html', import.meta.url))) {
  console.info('[tunnel] мини-приложение не собрано — собираю');
  run('npm', ['--prefix', '../admin', 'run', 'build']);
}

const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
let service = null;
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  service?.kill('SIGTERM');
  tunnel.kill('SIGTERM');
  setTimeout(() => process.exit(code), 1500);
}

tunnel.on('error', (e) => {
  console.error(e.code === 'ENOENT' ? '[tunnel] cloudflared не найден: brew install cloudflared' : e);
  process.exit(1);
});
tunnel.on('exit', (code) => {
  if (!stopping) console.error(`[tunnel] cloudflared остановился (${code})`);
  stop(code ?? 1);
});

// адрес cloudflared пишет в свой лог: https://<слова>.trycloudflare.com
const onLog = (chunk) => {
  const url = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (!url || service) return;
  console.info(`[tunnel] ${url}`);
  // окружение сильнее файла настроек: PUBLIC_URL отсюда перекрывает пустой из .env.local
  service = snapshot
    ? spawn(process.execPath, ['--env-file=.env.local', 'dist/main.js'], { stdio: 'inherit', env: { ...process.env, PUBLIC_URL: url, ADMIN_DIST: 'dist/app' } })
    : spawn('npx', ['tsx', 'watch', '--env-file=.env.local', 'src/main.ts'], { stdio: 'inherit', env: { ...process.env, PUBLIC_URL: url } });
  service.on('exit', (code) => stop(code ?? 0));
};
tunnel.stdout.on('data', onLog);
tunnel.stderr.on('data', onLog);

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
