/**
 * Живой знак для телефона — всё, что ему нужно, из Blender.
 *
 * На телефоне знак рисуется на странице настоящей моделью: его крутят
 * пальцем (MOBILE.md). Чтобы живой выглядел как снятый, от съёмки берётся
 * не картинка, а свет: шар под теми же лампами в синем и серебряном
 * металле. Страница красит грань знака цветом той точки шара, где нормаль
 * такая же («мат-кап»), — отражения ламп получаются настоящие, а считать
 * их телефону не нужно.
 *
 * Геометрия и лампы — в brand/blender/mark3d.py, здесь только запуск
 * и упаковка:
 *   public/mark/live/mesh.bin     сетка трёх лучей (формат — в mark3d.py)
 *   public/mark/live/matcap.webp  два шара рядом: синий | серебро
 *   public/mark/live/turn-NNN.webp  знак на поворотном столе — запасной
 *                                 «снятый» вид для слабых телефонов
 *
 * Запуск (нужен Blender):
 *   node brand/mark-live.mjs [mesh] [matcap] [turn]
 * Без аргументов — всё по очереди. Поворотный стол — самая долгая часть:
 * 48 кадров, несколько минут.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const BLENDER = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const script = path.join(root, 'brand/blender/mark3d.py');
const out = path.join(root, 'public/mark/live');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mark-live-'));
fs.mkdirSync(out, { recursive: true });

const want = process.argv.slice(2);
const on = (name) => want.length === 0 || want.includes(name);
const blender = (...args) => execFileSync(BLENDER, ['-b', '-P', script, '--', ...args], { stdio: ['ignore', 'ignore', 'inherit'] });

/** Шар мат-капа: сторона в пикселях. Больше не нужно — отражения мягкие. */
const BALL = 256;
/** Поворотный стол: число кадров и сторона кадра на странице. */
const TURN_N = 48;
const TURN_SIZE = 560;

if (on('mesh')) {
  blender('--mesh', path.join(out, 'mesh.bin'));
  console.log(`mesh.bin — ${(fs.statSync(path.join(out, 'mesh.bin')).size / 1024).toFixed(1)} КБ`);
}

if (on('matcap')) {
  // прозрачный фон шара заливается его же краем: при выборке у самого
  // силуэта сглаживание иначе подмешивало бы чёрное
  blender('--matcap', path.join(tmp, 'ball-'), '--size', String(BALL), '--samples', '160');
  const balls = await Promise.all(
    ['blue', 'silver'].map(async (name) => {
      const src = sharp(path.join(tmp, `ball-${name}.png`));
      const edge = await src.clone().resize(BALL + 12, BALL + 12).blur(6).resize(BALL, BALL).removeAlpha().toBuffer();
      return sharp(edge).composite([{ input: await src.toBuffer() }]).removeAlpha().toBuffer();
    })
  );
  await sharp({ create: { width: BALL * 2, height: BALL, channels: 3, background: '#000' } })
    .composite(balls.map((input, i) => ({ input, left: i * BALL, top: 0 })))
    .webp({ quality: 92 })
    .toFile(path.join(out, 'matcap.webp'));
  console.log(`matcap.webp — ${(fs.statSync(path.join(out, 'matcap.webp')).size / 1024).toFixed(1)} КБ`);
}

if (on('turn')) {
  blender('--turn', path.join(tmp, 'turn-'), '--turn-n', String(TURN_N), '--size', String(TURN_SIZE * 2), '--samples', '40');
  let total = 0;
  for (let k = 0; k < TURN_N; k++) {
    const name = `turn-${String(k).padStart(3, '0')}`;
    const file = path.join(out, `${name}.webp`);
    await sharp(path.join(tmp, `${name}.png`)).resize(TURN_SIZE, TURN_SIZE).webp({ quality: 78, alphaQuality: 80 }).toFile(file);
    total += fs.statSync(file).size;
  }
  console.log(`turn-000…${String(TURN_N - 1).padStart(3, '0')}.webp — ${(total / 1024).toFixed(0)} КБ на ${TURN_N} кадров`);
}

fs.rmSync(tmp, { recursive: true, force: true });
