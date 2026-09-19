import type { ReactNode } from 'react';
import Footer from './Footer';
import type { LegalDoc } from '@/content/legal';

/**
 * Страница документа. Читается как текст, а не как лендинг: колонка
 * в 68 знаков, оглавление слева на широких экранах, без анимаций.
 */
export default function LegalPage({ doc, extra = {} }: { doc: LegalDoc; extra?: Record<string, ReactNode> }) {
  return (
    <>
      <main id="content" className="relative z-10 w-full bg-bg">
        <div className="px-4 pb-[12vh] pt-[clamp(112px,18vh,180px)] sm:px-8 lg:px-[72px]">
          <span className="rail-label">{doc.label}</span>
          <h1 className="display m-0 mt-6 max-w-[18ch] text-[clamp(32px,5vw,76px)]">{doc.title}</h1>
          <p className="m-0 mt-6 font-mono text-[10px] uppercase tracking-rail text-faint">{doc.edition}</p>

          <div className="mt-[clamp(40px,8vh,88px)] grid gap-12 border-t border-line pt-10 lg:grid-cols-[minmax(200px,280px)_1fr] lg:gap-[clamp(48px,8vw,140px)]">
            <nav aria-label="Содержание" className="hidden lg:block">
              <ol className="sticky top-28 m-0 flex list-none flex-col gap-3 p-0">
                {doc.sections.map((s, i) => (
                  <li key={s.id} className="flex gap-3 text-[13px] leading-snug">
                    <span className="w-6 shrink-0 font-mono text-[10px] leading-[1.9] tracking-rail text-faint">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <a href={`#${s.id}`} className="text-dim transition-colors duration-300 hover:text-fg">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <article className="max-w-[68ch]">
              <p className="m-0 text-[clamp(17px,1.5vw,21px)] leading-relaxed text-fg">{doc.lead}</p>

              {doc.sections.map((s, i) => (
                <section key={s.id} id={s.id} className="mt-12 scroll-mt-28">
                  <h2 className="m-0 flex items-baseline gap-3 text-[clamp(18px,1.6vw,22px)] font-medium leading-snug">
                    <span className="font-mono text-[10px] tracking-rail text-accent">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {s.title}
                  </h2>
                  {s.blocks.map((b, j) =>
                    typeof b === 'string' ? (
                      <p key={j} className="m-0 mt-4 text-[15px] leading-[1.75] text-dim">
                        {b}
                      </p>
                    ) : (
                      <ul key={j} className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
                        {b.map((item) => (
                          <li key={item} className="flex gap-3 text-[15px] leading-[1.7] text-dim">
                            <span className="text-faint" aria-hidden>
                              —
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                  {extra[s.id]}
                </section>
              ))}
            </article>
          </div>
        </div>
      </main>
      <Footer cta={false} />
    </>
  );
}
