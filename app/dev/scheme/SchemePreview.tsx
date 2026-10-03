'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import OrderScheme, { type OrderSchemeHandle } from '@/components/scheme/OrderScheme';
import { SITE } from '@/content/site';

/** Схема и то, что вокруг неё будет на главной: строка станций и панель. */
export default function SchemePreview() {
  const scheme = useRef<OrderSchemeHandle>(null);
  const [active, setActive] = useState<string | null>(null);
  const stations = SITE.journey.stations;
  const st = stations.find((s) => s.id === active) ?? stations[0];
  return (
    <>
      <OrderScheme ref={scheme} onActive={setActive} className="mt-8" />
      <div className="px-4 sm:px-8 lg:px-[72px]">
        <div className="mt-6 flex flex-wrap gap-2">
          {stations.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scheme.current?.select(s.id)}
              aria-pressed={active === s.id}
              className="need-chip"
            >
              <span className="font-mono text-[10px] text-faint">{s.n}</span>
              {s.name}
            </button>
          ))}
        </div>
        <div className="mt-8 grid gap-8 border-t border-line pt-8 sm:grid-cols-3">
          <div>
            <span className="rail-label">Клиенту</span>
            <p className="m-0 mt-3 text-[15px] leading-relaxed">{st.client}</p>
          </div>
          <div>
            <span className="rail-label">Вам</span>
            <p className="m-0 mt-3 text-[15px] leading-relaxed">{st.you}</p>
          </div>
          <div>
            <span className="rail-label">Собираем</span>
            <Link href={st.service.href} className="mt-3 block text-[17px]">
              {st.service.label} →
            </Link>
            <p className="m-0 mt-4 font-mono text-[10px] uppercase tracking-rail text-faint">{st.tech}</p>
          </div>
        </div>
      </div>
    </>
  );
}
