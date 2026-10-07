import Link from 'next/link';
import Mark from './Mark';
import DirectionLinks from './footer/DirectionLinks';
import Finale from './footer/Finale';
import { OPERATOR } from '@/content/legal';
import { SITE } from '@/content/site';
import MessengerMark from '@/components/MessengerMark';

/**
 * Конец страницы: финал в одну фразу и подвал.
 *
 * Было три концовки подряд — «соседние направления», финал во весь экран
 * (чернила, знак в объёме, круглая кнопка, чипы брифа) и «Дальше», —
 * и заказчик назвал низ перегруженным. Стало одно: фраза, кнопка и сразу
 * подвал. Бегущая строка и гигантское имя сняты ещё раньше.
 *
 * На /contact и в документах финала нет: там заявка уже на экране
 * или звать некуда.
 */
export default function Footer({ cta = true }: { cta?: boolean }) {
  const { footer } = SITE;
  const [directions, ...rest] = footer.columns;

  return (
    // на телефоне внизу стоит остров — под него оставлено место
    <footer data-chapter={cta ? 'finale' : undefined} className="relative z-10 w-full text-fg max-sm:pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
      <div className="border-t border-line" style={{ background: 'linear-gradient(180deg, rgb(var(--bg-rgb) / 0.72), var(--bg) 60%)' }}>
        {cta && <Finale />}

        <div className="px-4 sm:px-8 lg:px-[72px]">
          <div className={`grid grid-cols-2 gap-x-6 gap-y-10 pb-12 pt-10 lg:grid-cols-4 ${cta ? 'border-t border-line' : ''}`}>
            <div className="col-span-2 lg:col-span-1">
              <Link href="/" className="-my-2 flex items-center gap-2.5 py-2 text-fg transition-colors duration-300 hover:text-accent">
                <Mark className="h-8 w-8" />
                <span className="font-mono text-[11px] uppercase tracking-rail">{SITE.name}</span>
              </Link>
              {/* дескриптор со знака: та же триада, что и ядра */}
              <p className="mt-4 font-mono text-[9px] uppercase leading-relaxed tracking-rail text-faint">
                {SITE.cores.map((c) => c.name).join(' · ')}
              </p>
            </div>

            <DirectionLinks label={directions.label} links={directions.links} />

            {rest.map((col) => (
              <nav key={col.label} aria-label={col.label}>
                <span className="rail-label">{col.label}</span>
                <ul className="m-0 mt-4 flex list-none flex-col gap-0.5 p-0 sm:gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="block py-3.5 text-[13px] text-dim transition-colors duration-300 hover:text-fg sm:py-0">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <div data-tour="contacts">
              <span className="rail-label">Связь</span>
              <ul className="m-0 mt-4 flex list-none flex-col gap-0.5 p-0 sm:gap-2.5">
                <li>
                  <a href={`mailto:${SITE.email}`} className="block py-3.5 text-[13px] text-dim transition-colors duration-300 hover:text-fg sm:py-0">
                    {SITE.email}
                  </a>
                </li>
                <li>
                  <a
                    href={`https://t.me/${SITE.telegram}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-2 py-3.5 text-[13px] text-dim transition-colors duration-300 hover:text-fg sm:py-0"
                  >
                    <MessengerMark kind="telegram" size={14} />
                    Telegram {SITE.telegramLabel}
                  </a>
                </li>
                <li>
                  <a
                    href={SITE.max}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-2 py-3.5 text-[13px] text-dim transition-colors duration-300 hover:text-fg sm:py-0"
                  >
                    <MessengerMark kind="max" size={14} />
                    {SITE.maxLabel}
                  </a>
                </li>
              </ul>
              {/* Кто исполнитель и оператор данных — видно на каждой странице,
                  а не только в политике. Строка читается, а не угадывается:
                  9px в --fg-faint были на грани различимости */}
              <p className="mt-6 font-mono text-[10px] uppercase leading-relaxed tracking-rail text-faint">
                © {new Date().getFullYear()} {SITE.name}
                <br />
                Самозанятый {OPERATOR.name}
                <br />
                ИНН {OPERATOR.inn}
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
