/**
 * Снимки собранных демо для «Концептов».
 *
 * Живой кадр демо грузится только на широком экране с мышью: на планшете
 * и телефоне две-три живые страницы разом — лишний вес. Там вместо него
 * стоит снимок той же страницы в тех же координатах (1280×800), поэтому
 * на компьютере он же служит подложкой, пока грузится живой кадр, —
 * без смены картинки под рукой.
 *
 * Запуск при работающем сервере (нужен установленный Google Chrome):
 *   npm i --no-save playwright-core
 *   node brand/demo-shots.mjs [http://localhost:3000]
 *
 * Пересъёмка — после любой правки первого экрана демо. Демо — все папки
 * в app/concepts, где есть page.tsx; результат — public/demos/<демо>.webp
 * (1920×1200) и <демо>-960.webp.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const base = process.argv[2] ?? 'http://localhost:3000';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public/demos');
fs.mkdirSync(out, { recursive: true });

const slugs = fs
  .readdirSync(path.join(root, 'app/concepts'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, 'app/concepts', d.name, 'page.tsx')))
  .map((d) => d.name);

const browser = await chromium.launch({ channel: 'chrome' });
// те же координаты, что у кадра в DemoView; плотность 1,5 — запас на экраны планшетов
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });

for (const slug of slugs) {
  await page.goto(`${base}/concepts/${slug}`, { waitUntil: 'networkidle' });
  // появления на первом экране доигрывают, шрифты встают
  await page.evaluate(() => document.fonts.ready);
  // значок Next в режиме разработки — не часть страницы
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.waitForTimeout(2500);
  const png = await page.screenshot();
  await sharp(png).webp({ quality: 78 }).toFile(path.join(out, `${slug}.webp`));
  await sharp(png).resize(960).webp({ quality: 80 }).toFile(path.join(out, `${slug}-960.webp`));
  console.log(slug);
}

await browser.close();
