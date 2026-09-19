import { readFile } from 'node:fs/promises';
import path from 'node:path';
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
