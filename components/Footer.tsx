import Link from 'next/link';
import LeadForm from './LeadForm';
import Mark from './Mark';
import Reveal from './Reveal';
import VideoFrame from './VideoFrame';
import { SITE } from '@/content/site';

/**
 * Футер. На всех страницах, кроме самой заявки, он же финальный CTA:
 * финальная глава материала — свет, с которого страница начиналась.
 * форма прямо здесь, чтобы решившемуся не нужно было никуда переходить.
 * На /contact форма уже на экране, поэтому там футер только с навигацией.
 */
export default function Footer({ cta = true }: { cta?: boolean }) {
  const { footer } = SITE;

  return (
    <footer
      data-chapter={cta ? 'finale' : undefined}
      className="relative z-10 w-full overflow-hidden border-t border-line text-fg"
    >
      {/* финал на том же материале, что и первый экран: свет возвращается.
          Внизу — подложка под навигацию, чтобы ссылки читались на ярком */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
        style={{ background: 'linear-gradient(180deg, rgb(var(--bg-rgb) / 0) 0%, rgb(var(--bg-rgb) / 0.85) 55%, var(--bg) 100%)' }}
        aria-hidden
      />

      <div className={`relative px-4 sm:px-8 lg:px-[72px] ${cta ? 'pb-12 pt-[14vh]' : 'py-12'}`}>
        {/* Финал раньше возникал целиком и сразу — последний экран был
            единственным без входа. Тот же жест, что у остальных секций. */}
        {cta && (
          <Reveal id="lead" className="scroll-mt-24" start="top 78%">
            <span className="rail-label block" data-rise>
              {footer.label}
            </span>

            <div data-rise className="mt-6 grid gap-[clamp(40px,7vh,72px)] lg:grid-cols-[1fr_minmax(0,1.05fr)] lg:gap-[clamp(48px,6vw,112px)]">
              <div>
                <h2 data-skew className="display m-0 text-[clamp(32px,5vw,86px)]">
                  {footer.title} <span className="title-accent">{footer.titleAccent}</span>
                </h2>
                <p className="m-0 mt-7 max-w-[44ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
                  {footer.lead}
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <span className="rail-label">{SITE.contact.direct}</span>
                  <a
                    data-magnetic
                    href={`https://t.me/${SITE.telegram}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="border border-line px-[18px] py-[14px] font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
                  >
                    Telegram
                  </a>
                  <a
                    href={`mailto:${SITE.email}`}
                    className="inline-block py-3 text-[13px] text-dim underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-fg"
                  >
                    {SITE.email}
                  </a>
                </div>

                {/* Живая вставка финала: капля — с неё начинается любой
                    запуск. Ширина ограничена: в одной строке с формой
                    ролик на 1280 поджимал поля до неудобного. */}
                <VideoFrame clip={SITE.media.drop} aspect="16 / 9" className="mt-12 max-w-[420px]" />
              </div>

              {/* форма на стекле: видео под ней остаётся, текст читается */}
              <div data-reveal="clip" className="self-start border border-line bg-bg/55 p-[clamp(20px,3vw,44px)] backdrop-blur-md">
                <LeadForm />
              </div>
            </div>
          </Reveal>
        )}

        <div
          className={`grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4 ${
            cta ? 'mt-[clamp(64px,12vh,140px)] border-t border-line pt-10' : ''
          }`}
        >
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
                    <Link
                      href={l.href}
                      className="block py-3.5 text-[13px] text-dim transition-colors duration-300 hover:text-fg sm:py-0"
                    >
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
                <a
                  href={`mailto:${SITE.email}`}
                  className="block py-3.5 text-[13px] text-dim transition-colors duration-300 hover:text-fg sm:py-0"
                >
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
    </footer>
  );
}
