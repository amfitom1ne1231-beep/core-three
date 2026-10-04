'use client';

import { useEffect, useRef, useState } from 'react';
import { LIVE_H, LIVE_W } from '../live/kit';
import { LIVE_BY_KEY } from '../live/map';

/**
 * Живой экран направления в итоге подбора — та же вставка, что в брифе
 * и в карусели на главной. Ширина — по месту, но не больше брифовой:
 * на узком телефоне рамка в 336 px вылезла бы за край.
 */
export default function LivePreview({ live, max = 336 }: { live: string; max?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(max);
  const Live = LIVE_BY_KEY[live];

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.min(max, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);

  if (!Live) return null;
  return (
    <div ref={box} className="w-full overflow-hidden">
      <div
        className="brief-preview relative overflow-hidden rounded-[12px] border border-line"
        style={{ width: w, height: Math.round((w / LIVE_W) * LIVE_H), ['--live-k' as string]: (w / LIVE_W).toFixed(4) }}
        aria-hidden
      >
        <Live playing />
      </div>
    </div>
  );
}
