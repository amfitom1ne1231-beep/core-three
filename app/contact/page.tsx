import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import LeadForm from '@/components/LeadForm';
import RevealText from '@/components/RevealText';
import VideoBackdrop from '@/components/VideoBackdrop';
import { SITE } from '@/content/site';

export const metadata: Metadata = {
  title: 'Обсудить проект',
  description: SITE.contact.lead,
  alternates: { canonical: '/contact' }
};

export default function ContactPage() {
  const { contact } = SITE;

  return (
    <>
      <main id="content" className="relative z-10 w-full">
        <section className="relative min-h-[100svh] overflow-hidden bg-bg">
          {/* медиа-анкор страницы: те же чернила, что в финале главной */}
          <VideoBackdrop src="/video/ink.mp4" poster="/video/ink-poster.jpg" opacity={0.5} />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgb(var(--bg-rgb) / 0.7) 0%, rgb(var(--bg-rgb) / 0.5) 40%, rgb(var(--bg-rgb) / 0.85) 82%, var(--bg) 100%)'
            }}
            aria-hidden
          />

          <div className="relative grid gap-[clamp(48px,8vh,88px)] px-4 pb-[12vh] pt-[clamp(112px,18vh,196px)] sm:px-8 lg:grid-cols-[1fr_minmax(0,1.05fr)] lg:gap-[clamp(48px,6vw,112px)] lg:px-[72px]">
            <div>
              <span className="rail-label">{contact.label}</span>
              <h1
                className="display m-0 mt-6 text-[clamp(40px,6.6vw,108px)]"
                aria-label={`${contact.title} ${contact.titleAccent}`}
              >
                <RevealText text={contact.title} as="span" className="block" decorative />
                <RevealText
                  text={contact.titleAccent}
                  as="span"
                  className="accent-serif block"
                  delay={0.12}
                  decorative
                />
              </h1>
              <p className="m-0 mt-8 max-w-[42ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">
                {contact.lead}
              </p>

              {/* что будет после заявки — честность в первом касании */}
              <ol className="m-0 mt-[clamp(40px,7vh,72px)] list-none p-0">
                {contact.steps.map((s) => (
                  <li
                    key={s.n}
                    className="grid grid-cols-[3.25rem_1fr] gap-x-2 border-t border-line py-5 last:border-b"
                  >
                    <span className="font-mono text-[11px] tracking-rail text-accent">{s.n}</span>
                    <div>
                      <h2 className="m-0 text-[clamp(16px,1.3vw,19px)] font-medium leading-snug">{s.title}</h2>
                      <p className="m-0 mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-dim">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
                <span className="rail-label">{contact.direct}</span>
                <a
                  href={`https://t.me/${SITE.telegram}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="border border-line px-[18px] py-[11px] font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
                >
                  Telegram
                </a>
                <a
                  href={`mailto:${SITE.email}`}
                  className="text-[13px] text-dim underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-fg"
                >
                  {SITE.email}
                </a>
              </div>
            </div>

            <div className="self-start border border-line bg-bg/55 p-[clamp(20px,3vw,44px)] backdrop-blur-md lg:sticky lg:top-28">
              <LeadForm />
            </div>
          </div>
        </section>
      </main>
      <Footer cta={false} />
    </>
  );
}
