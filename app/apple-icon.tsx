import { ImageResponse } from 'next/og';
import { OgMark } from '@/lib/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** iOS не берёт SVG для ярлыка на домашнем экране — нужен PNG. */
export default function AppleIcon() {
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
        <OgMark size={132} color="#d3dde8" />
      </div>
    ),
    size
  );
}
