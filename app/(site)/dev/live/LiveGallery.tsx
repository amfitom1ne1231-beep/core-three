'use client';

import { useState } from 'react';
import { LIVE_BY_KEY } from '@/components/live/map';
import { LIVE_H, LIVE_W } from '@/components/live/kit';

export default function LiveGallery() {
  const [only, setOnly] = useState<string | null>(null);
  // законченный кадр: то, что видит соседняя карточка карусели
  const [still, setStill] = useState(false);
  const keys = Object.keys(LIVE_BY_KEY).filter((k) => !only || k === only);
  return (
    <main className="min-h-screen bg-bg p-8 pt-24">
      <div className="mb-6 flex gap-3 font-mono text-[11px]">
        {[null, ...Object.keys(LIVE_BY_KEY)].map((k) => (
          <button key={k ?? 'all'} type="button" onClick={() => setOnly(k)} className="border border-line px-3 py-1.5 text-dim">
            {k ?? 'все'}
          </button>
        ))}
        <button type="button" onClick={() => setStill((v) => !v)} className="border border-line px-3 py-1.5 text-dim">
          {still ? 'играть' : 'законченный кадр'}
        </button>
      </div>
      <div className="flex flex-wrap gap-8">
        {keys.map((k) => {
          const Live = LIVE_BY_KEY[k];
          return (
            <figure key={k} className="m-0" data-live-key={k}>
              <div className="relative overflow-hidden rounded-[10px] border border-line" style={{ width: LIVE_W, height: LIVE_H }}>
                <Live playing={!still} />
              </div>
              <figcaption className="mt-2 font-mono text-[10px] text-faint">{k}</figcaption>
            </figure>
          );
        })}
      </div>
    </main>
  );
}
