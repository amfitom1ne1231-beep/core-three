'use client';

import { useEffect, useRef } from 'react';
import { markSilkReady } from '@/lib/boot';
import { createSilk, type SilkParams } from '@/lib/silk';

export default function HeroSilk({ params }: { params?: Partial<SilkParams> }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const silk = createSilk(ref.current, {
      params,
      onFirstFrame: markSilkReady,
      ignoreVisibility: new URLSearchParams(location.search).has('silkdebug')
    });
    return () => silk.destroy();
    // params задаются на этапе сборки, менять их в рантайме не планируется
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 block h-full w-full bg-bg"
    />
  );
}
