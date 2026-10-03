import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { MARK_ARMS } from '@/components/mark-geometry';

/**
 * Общее для картинок, которые рендерятся на сборке (Open Graph, иконка
 * для iOS). Генератор не читает woff2 и переменные шрифты, поэтому
 * в assets/og лежат статические woff — по одному файлу на начертание,
 * в каждом русский и латинский алфавит, цифры и пунктуация.
 *
 * Один файл на начертание принципиален: если дать латиницу и кириллицу
 * раздельно, недостающий глиф генератор берёт из первого файла, где он
 * есть, и вес при этом не учитывает — жирная строка выходит светлой.
 */

const read = (file: string) => readFile(path.join(process.cwd(), 'assets/og', file));

export async function ogFonts() {
  const files = [
    ['Onest', 300, 'Onest-300.woff'],
    ['Onest', 700, 'Onest-700.woff'],
    ['Mono', 400, 'JetBrainsMono-400.woff']
  ] as const;

  return Promise.all(
    files.map(async ([name, weight, file]) => ({
      name,
      weight,
      style: 'normal' as const,
      data: await read(file)
    }))
  );
}

/** Знак в разметке генератора: те же фасеты, что и на сайте. */
export function OgMark({ size, color, opacity = 1 }: { size: number; color: string; opacity?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity }}>
      {MARK_ARMS.flatMap((arm) =>
        arm.facets.map((f) => (
          <path key={`${arm.arm}-${f.facet}`} d={f.d} fill={color} fillOpacity={f.opacity} />
        ))
      )}
    </svg>
  );
}

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Превью внутренней страницы: тот же лист, что у главной, но с именем
 * раздела. Ссылка на «Боты», пересланная в Telegram, должна говорить
 * «Боты», а не повторять первый экран главной.
 */
export async function pageOg({ kicker, title, accent }: { kicker: string; title: string; accent?: string }) {
  // длинные имена документов в две строки по 104px не влезают
  const big = (title.length + (accent?.length ?? 0)) > 34 ? 84 : 104;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          backgroundColor: '#050608',
          backgroundImage:
            'radial-gradient(circle at 82% 30%, rgba(85,118,154,0.32), rgba(5,6,8,0) 52%), radial-gradient(circle at 8% 118%, rgba(20,57,104,0.5), rgba(5,6,8,0) 55%)',
          color: '#ffffff',
          fontFamily: 'Onest'
        }}
      >
        <div style={{ position: 'absolute', right: -64, top: 90, display: 'flex' }}>
          <OgMark size={470} color="#8fa9c6" opacity={0.2} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <OgMark size={46} color="#e8eef5" />
          <span style={{ fontFamily: 'Mono', fontSize: 20, letterSpacing: 4, textTransform: 'uppercase' }}>CoreThree</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 980 }}>
          <span
            style={{
              fontFamily: 'Mono',
              fontSize: 19,
              letterSpacing: 2.6,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
              marginBottom: 28
            }}
          >
            {kicker}
          </span>
          <span style={{ fontSize: big, fontWeight: 300, letterSpacing: -3, lineHeight: 1 }}>{title}</span>
          {accent && <span style={{ fontSize: big, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>{accent}</span>}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts() }
  );
}
