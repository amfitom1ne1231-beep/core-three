/**
 * Записи работы демо для телефона (MOBILE.md): в карточке «Демо» стоит
 * не снимок, а то, как демо нажимается, — короткий ролик, снятый с самого
 * демо на телефонном экране.
 *
 * Скрипт открывает каждое демо в Chrome (390×700, двойная плотность),
 * проходит свой маленький сценарий — прокрутка, одно-два касания —
 * и записывает экран. Кадры идут из самого браузера (screencast), ролик
 * собирает ffmpeg: 30 к/с, H.264, без звука, с наплывом на стыке петли.
 * Касание в записи отмечено кружком: в ролике видно, куда нажали.
 *
 * Запуск при работающем сервере (нужны Google Chrome и ffmpeg):
 *   npm i --no-save playwright-core
 *   node brand/demo-reels.mjs [http://localhost:3000] [демо]
 *
 * Результат — public/demos/<демо>-phone.mp4. Первый кадр совпадает
 * со снимком <демо>-phone.webp (brand/demo-shots.mjs): тот стоит в карточке,
 * пока ролик не начался. Пересъёмка — после правки первого экрана демо
 * или того, что в сценарии нажимается.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:3000';
const only = process.argv[3];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public/demos');

const W = 390;
const H = 700;
const FPS = 30;

/**
 * Сценарии. Шаги: `wait` — стоим; `scroll` — плавно едем к отметке (px
 * от верха страницы) за `ms`; `tap` — касание кнопки или ссылки, чей
 * текст начинается с этой строки (`hidden` — кнопка стоит в служебной
 * полосе, которой в записи нет: нажимаем без касания).
 */
const SCENES = {
  course: [{ wait: 900 }, { scroll: 330, ms: 1500 }, { wait: 500 }, { tap: 'Записаться', nth: 1 }, { wait: 2400 }],
  shop: [{ wait: 900 }, { scroll: 1040, ms: 2200 }, { wait: 400 }, { tap: 'Меринос 100' }, { wait: 2600 }],
  cafe: [{ wait: 800 }, { scroll: 640, ms: 1700 }, { wait: 400 }, { tap: 'Забронировать стол' }, { wait: 2800 }],
  barber: [{ wait: 800 }, { scroll: 330, ms: 1300 }, { wait: 400 }, { tap: 'Записаться' }, { wait: 2600 }],
  status: [{ wait: 900 }, { tap: 'Устроить сбой', hidden: true }, { wait: 1800 }, { scroll: 420, ms: 1800 }, { wait: 2000 }]
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-reels-'));
const browser = await chromium.launch({ channel: 'chrome' });

for (const [slug, steps] of Object.entries(SCENES)) {
  if (only && only !== slug) continue;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${base}/concepts/${slug}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // служебная полоса «Демо · К витрине» и плашка cookie — не часть сайта клиента
  await page.addStyleTag({
    content:
      'nextjs-portal, div.fixed.top-0[class*="demo-bar"], [data-cookie-consent] { display: none !important; } :root { --demo-bar: 0px !important; } html { scroll-behavior: auto !important; }'
  });
  await sleep(2200);

  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ data: f.data, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });

  for (const step of steps) {
    if (step.wait) await sleep(step.wait);
    if (step.scroll !== undefined) {
      await page.evaluate(
        ({ to, ms }) =>
          new Promise((done) => {
            const from = scrollY;
            const t0 = performance.now();
            const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
            const tick = (now) => {
              const k = Math.min((now - t0) / ms, 1);
              scrollTo(0, from + (to - from) * ease(k));
              if (k < 1) requestAnimationFrame(tick);
              else done();
            };
            requestAnimationFrame(tick);
          }),
        { to: step.scroll, ms: step.ms ?? 1200 }
      );
    }
    if (step.tap) {
      const at = await page.evaluate(
        ({ text, nth, hidden }) => {
          const all = [...document.querySelectorAll('button, a, [role=button]')].filter((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith(text));
          const seen = all.filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight;
          });
          const el = hidden ? all[0] : seen[nth ?? 0] ?? seen[0];
          if (!el) return null;
          if (hidden) {
            el.click();
            return 'hidden';
          }
          const r = el.getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          // отметка касания — чтобы в записи было видно, куда нажали
          const dot = document.createElement('i');
          dot.style.cssText = `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.34);box-shadow:0 0 0 1.5px rgba(0,0,0,.28);pointer-events:none;z-index:99999;transform:scale(.6);opacity:0;transition:transform .22s ease,opacity .22s ease`;
          document.body.appendChild(dot);
          requestAnimationFrame(() => {
            dot.style.transform = 'scale(1)';
            dot.style.opacity = '1';
          });
          setTimeout(() => {
            dot.style.opacity = '0';
            setTimeout(() => dot.remove(), 260);
          }, 520);
          return { x, y };
        },
        { text: step.tap, nth: step.nth, hidden: step.hidden ?? false }
      );
      if (!at) console.warn(`  ${slug}: не нашлось, что нажать — «${step.tap}»`);
      else if (at !== 'hidden') {
        await sleep(320);
        await page.touchscreen.tap(at.x, at.y);
      }
    }
  }
  await sleep(300);
  await cdp.send('Page.stopScreencast');
  const ended = Date.now() / 1000;
  await page.close();

  // кадры приходят, только когда экран меняется: каждому — своё время на экране
  const dir = path.join(tmp, slug);
  fs.mkdirSync(dir);
  const list = [];
  frames.forEach((f, i) => {
    const name = `f${String(i).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(f.data, 'base64'));
    // последний кадр стоит до конца сценария: после касания экран успевают рассмотреть
    const next = frames[i + 1]?.t ?? Math.max(ended, f.t + 0.4);
    list.push(`file '${name}'`, `duration ${Math.max(next - f.t, 1 / 120).toFixed(4)}`);
  });
  list.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n'));
  const length = frames.length ? Math.max(ended, frames[frames.length - 1].t + 0.4) - frames[0].t : 0;

  const file = path.join(out, `${slug}-phone.mp4`);
  execFileSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'list.txt',
      // наплыв в начале и в конце — стык петли без рывка
      '-vf', `fps=${FPS},scale=${W * 2}:${H * 2}:flags=lanczos,fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(length - 0.35, 0).toFixed(2)}:d=0.35,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-profile:v', 'high', '-movflags', '+faststart', '-an', file
    ],
    { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] }
  );
  console.log(`${slug}: ${frames.length} кадров, ${length.toFixed(1)} с, ${(fs.statSync(file).size / 1024).toFixed(0)} КБ`);
}

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
