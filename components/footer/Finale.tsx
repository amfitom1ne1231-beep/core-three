'use client';

import { usePathname } from 'next/navigation';
import Cta from '../Cta';
import { SITE } from '@/content/site';
import { contactHref } from '@/lib/lead';

/**
 * Финал страницы: одна фраза и одна кнопка.
 *
 * Был целый экран — чернила, знак в объёме, круглая кнопка с текстом по
 * кольцу и первый шаг брифа чипами, — а до и после него ещё «соседние
 * направления» и «Дальше». Три концовки подряд: заказчик назвал низ
 * перегруженным. Теперь страница заканчивается одним предложением
 * и одним действием, сразу под ними — подвал.
 */
export default function Finale() {
  const pathname = usePathname() ?? '/';
  const { footer } = SITE;
  return (
    <section
      id="lead"
      className="px-4 pb-[clamp(44px,8vh,92px)] max-sm:pb-10 pt-[clamp(72px,13vh,150px)] max-sm:pt-14 sm:px-8 lg:px-[72px]"
      aria-label={footer.label}
    >
      <span className="rail-label">{footer.label}</span>
      <div className="mt-6 grid gap-[clamp(24px,4vh,44px)] lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h2 data-skew className="display m-0 text-[clamp(40px,6.4vw,112px)] leading-[0.96]">
            {footer.title} <span className="title-accent">{footer.titleAccent}</span>
          </h2>
          <p className="m-0 mt-6 max-w-[46ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">{footer.lead}</p>
        </div>
        {/* тип проекта подставляется разделом, с которого пришли */}
        <Cta href={contactHref(pathname)} className="justify-self-start">
          {SITE.hero.primary.label}
        </Cta>
      </div>
    </section>
  );
}
