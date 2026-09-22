import Link from 'next/link';
import Mark from './Mark';
import FinaleStage from './footer/FinaleStage';
import { Marquee, NextPage, Wordmark } from './footer/FooterExtras';
import { SITE } from '@/content/site';

/**
 * Футер — последняя сцена, а не подвал.
 *
 * Было: заголовок, абзац, форма на стекле и колонки ссылок — страница
 * заканчивалась, как заканчивается документ. Стало: финал того же класса,
 * что первый экран (чернила, знак в объёме, большая кнопка и первый шаг
 * брифа), бегущая строка направлений, «Дальше» — следующая страница,
 * а не тупик, — и гигантское имя внизу, в котором свет идёт за курсором.
 *
 * На /contact финала нет: заявка там уже на экране, и подвал начинается
 * сразу с «Дальше».
 */
export default function Footer({ cta = true }: { cta?: boolean }) {
  const { footer } = SITE;

  return (
    <footer data-chapter={cta ? 'finale' : undefined} className="relative z-10 w-full overflow-hidden text-fg">
      {cta && <FinaleStage />}

      <div className="relative" style={{ background: 'linear-gradient(180deg, rgb(var(--bg-rgb) / 0.6), var(--bg) 40%)' }}>
        <Marquee />

        <div className="px-4 sm:px-8 lg:px-[72px]">
          <NextPage />

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 border-t border-line pb-6 pt-10 lg:grid-cols-4">
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

            {footer.columns.map((col) => (
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

            <div>
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
                    className="block py-3.5 text-[13px] text-dim transition-colors duration-300 hover:text-fg sm:py-0"
                  >
                    {SITE.telegramLabel}
                  </a>
                </li>
              </ul>
              {/* юридическая строка читается, а не угадывается: 9px в
                  --fg-faint были на грани различимости */}
              <p className="mt-6 font-mono text-[10px] uppercase leading-relaxed tracking-rail text-faint">
                {SITE.legal} · {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>

        <Wordmark />
      </div>
    </footer>
  );
}
