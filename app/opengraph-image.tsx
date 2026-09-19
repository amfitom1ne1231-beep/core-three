import { ImageResponse } from 'next/og';
import { OgMark, ogFonts } from '@/lib/og';
import { SITE } from '@/content/site';

export const alt = 'CoreThree — от идеи до запуска';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Превью ссылки в мессенджерах и соцсетях. Рендерится один раз на сборке. */
export default async function OpengraphImage() {
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
        {/* крупный знак справа — та же фактура, что у материала на первом экране */}
        <div style={{ position: 'absolute', right: -64, top: 90, display: 'flex' }}>
          <OgMark size={470} color="#8fa9c6" opacity={0.2} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <OgMark size={46} color="#e8eef5" />
            <span style={{ fontFamily: 'Mono', fontSize: 20, letterSpacing: 4, textTransform: 'uppercase' }}>
              {SITE.name}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 28, fontFamily: 'Mono', fontSize: 16, letterSpacing: 3 }}>
            {SITE.cores.map((c) => (
              <span key={c.n} style={{ color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase' }}>
                <span style={{ color: '#ffffff', marginRight: 10 }}>{c.n}</span>
                {c.name}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 132, fontWeight: 300, letterSpacing: -3, lineHeight: 0.98 }}>
            {SITE.hero.title}
          </span>
          <span style={{ fontSize: 132, fontWeight: 700, letterSpacing: -4.5, lineHeight: 0.98 }}>
            {SITE.hero.titleStrong}
          </span>
          <span
            style={{
              marginTop: 34,
              fontFamily: 'Mono',
              fontSize: 19,
              letterSpacing: 2.6,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)'
            }}
          >
            Сайты · магазины · боты · Telegram-приложения
          </span>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() }
  );
}
