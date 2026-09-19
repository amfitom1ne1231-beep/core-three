import Link from 'next/link';
import Mark from './Mark';
import VideoBackdrop from './VideoBackdrop';
import { SITE } from '@/content/site';

export default function Footer() {
  const { footer } = SITE;

  return (
    <footer className="relative z-10 w-full overflow-hidden border-t border-line bg-bg text-fg">
      {/* чернила в воде: единственное место, где движение уместно рядом с текстом */}
      <VideoBackdrop src="/video/ink.mp4" poster="/video/ink-poster.jpg" opacity={0.62} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, var(--bg) 0%, rgb(5 6 8 / 0.55) 26%, rgb(5 6 8 / 0.62) 62%, rgb(5 6 8 / 0.9) 100%)'
        }}
        aria-hidden
      />

      <div className="relative px-4 py-[16vh] sm:px-8 lg:px-[72px]">
        <span className="rail-label">{footer.label}</span>

        <div className="mt-6 grid gap-[clamp(28px,5vh,60px)] lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <h2 className="display m-0 text-[clamp(32px,6.4vw,104px)]">
            {footer.title} <span className="accent-serif">{footer.titleAccent}</span>
          </h2>

          <div>
            <p className="m-0 max-w-[44ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
              {footer.lead}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="border border-fg bg-fg px-[22px] py-[13px] font-mono text-[11px] uppercase tracking-label text-bg transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-white"
              >
                Обсудить проект
              </Link>
              <a
                href={`https://t.me/${SITE.telegram}`}
                target="_blank"
                rel="noreferrer noopener"
                className="border border-line px-[22px] py-[13px] font-mono text-[11px] uppercase tracking-label text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
              >
                Написать в Telegram
              </a>
            </div>
          </div>
        </div>

        <div className="mt-[clamp(48px,10vh,120px)] grid gap-10 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2.5 text-fg transition-colors duration-300 hover:text-accent">
              <Mark className="h-8 w-8" />
              <span className="font-mono text-[11px] uppercase tracking-rail">{SITE.name}</span>
            </Link>
            {/* дескриптор со знака: та же триада, что и ядра */}
            <p className="mt-4 font-mono text-[9px] uppercase leading-relaxed tracking-rail text-faint">
              {SITE.cores.map((c) => c.name).join(' · ')}
            </p>
          </div>

          {footer.columns.map((col) => (
            <nav key={col.label}>
              <span className="rail-label">{col.label}</span>
              <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-dim transition-colors duration-300 hover:text-fg"
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
            <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
              <li>
                <a
                  href={`mailto:${SITE.email}`}
                  className="text-[13px] text-dim transition-colors duration-300 hover:text-fg"
                >
                  {SITE.email}
                </a>
              </li>
              <li>
                <a
                  href={`https://t.me/${SITE.telegram}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[13px] text-dim transition-colors duration-300 hover:text-fg"
                >
                  {SITE.telegramLabel}
                </a>
              </li>
            </ul>
            <p className="mt-6 font-mono text-[9px] uppercase leading-relaxed tracking-rail text-faint">
              {SITE.legal} · {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
