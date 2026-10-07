import { ImageResponse } from 'next/og';
import { OgMark } from '@/lib/og';

/**
 * Значки для манифеста (app/manifest.ts): Android берёт PNG 192 и 512.
 * Рисуются тем же знаком и на том же фоне, что значок для iOS
 * (app/apple-icon.tsx), — на сборке, файлами.
 */
const ICONS: Record<string, { size: number; mark: number }> = {
  'icon-192.png': { size: 192, mark: 140 },
  'icon-512.png': { size: 512, mark: 374 },
  // «маскируемый» значок система обрезает кругом или каплей: знак держится в средних 60%
  'maskable-512.png': { size: 512, mark: 286 }
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const icon = ICONS[(await params).name];
  if (!icon) return new Response(null, { status: 404 });
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0b0f14'
        }}
      >
        <OgMark size={icon.mark} color="#d3dde8" />
      </div>
    ),
    { width: icon.size, height: icon.size }
  );
}
