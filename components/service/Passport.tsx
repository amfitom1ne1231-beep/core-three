import type { ServicePage } from '@/content/services';

/**
 * Кому это и паспорт направления.
 *
 * Слева — разговор с человеком: три узнавания себя, набранные крупно,
 * чтобы их читали, а не проматывали. Справа — сухая табличка: срок,
 * что нужно от заказчика, что будет дальше, и стек. Контраст интонаций
 * внутри одной секции работает лучше, чем два одинаково серых столбца:
 * одно обещает, второе отвечает за обещание.
 *
 * Панель — стекло: глава `concepts` держит завесу 0.36, материал под ней
 * живой, и размывать есть что.
 */
export default function Passport({ page }: { page: ServicePage }) {
  return (
    <section data-chapter="concepts" className="relative z-10 w-full border-t border-line" aria-label="Кому это">
      <div
        data-recede
        className="grid gap-[clamp(36px,6vh,72px)] px-4 section-y sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)] lg:gap-[clamp(40px,5vw,96px)] lg:px-[72px]"
      >
        <div>
          <span className="rail-label">{page.audience.label}</span>
          <h2 className="display m-0 mt-4 max-w-[14ch] text-[clamp(26px,3.6vw,52px)]">{page.audience.title}</h2>

          <ul className="m-0 mt-[clamp(24px,4vh,48px)] list-none p-0">
            {page.audience.items.map((it, i) => (
              <li
                key={it}
                className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-2 border-t border-line py-[clamp(16px,2.4vh,26px)] last:border-b"
              >
                <span className="font-mono text-[11px] tracking-rail text-faint">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[clamp(15px,1.35vw,19px)] leading-[1.5] text-dim">{it}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- паспорт ---------- */}
        <div
          data-cursor="ring"
          className="glass self-start p-[clamp(20px,2.4vw,40px)]"
        >
          <div className="flex items-center justify-between gap-4">
            <span className="rail-label">Паспорт направления</span>
            <span className="rail-label">
              <b>{page.n}</b>
            </span>
          </div>

          <dl className="m-0 mt-[clamp(20px,3vh,36px)]">
            {page.terms.map((t) => (
              <div key={t.label} className="border-t border-line py-[clamp(14px,2vh,22px)] first:border-t-0 first:pt-0">
                <dt className="rail-label">{t.label}</dt>
                <dd className="m-0 mt-2.5 text-[clamp(15px,1.3vw,18px)] leading-[1.5] text-fg">{t.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-[clamp(20px,3vh,32px)] border-t border-line pt-[clamp(16px,2.4vh,26px)]">
            <span className="rail-label">Стек</span>
            <ul className="m-0 mt-4 flex list-none flex-wrap gap-1.5 p-0">
              {page.stack.map((t) => (
                <li
                  key={t}
                  className="border border-line px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-rail text-faint"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
