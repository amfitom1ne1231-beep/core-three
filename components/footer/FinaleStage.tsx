'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MarkVideo from '../MarkVideo';
import Reveal from '../Reveal';
import VideoBackdrop from '../VideoBackdrop';
import { contactHref } from '@/lib/lead';
import { NEEDS } from '@/content/brief';
import { SITE } from '@/content/site';

/**
 * Финал — последняя сцена страницы, а не подвал.
 *
 * Раньше здесь стояли заголовок, абзац и форма на стекле, и страница
 * заканчивалась, как заканчивается документ. Теперь это сцена того же
 * класса, что первый экран: чернила во весь кадр, знак в объёме,
 * большая кнопка — и вопрос, на который отвечают одним касанием.
 *
 * Чипы «что запускаем» ведут в бриф на /contact уже с выбранным
 * пунктом: первый шаг человек делает здесь, не уходя со страницы,
 * и приходит в заявку не с пустого листа.
 */
export default function FinaleStage() {
  const pathname = usePathname() ?? '/';
  const { footer } = SITE;
  const base = contactHref(pathname);
  const withNeed = (need: string) => `${base}${base.includes('?') ? '&' : '?'}need=${need}`;

  return (
    <section id="lead" className="relative isolate min-h-[100svh] scroll-mt-0 overflow-hidden" aria-label="Следующий шаг">
      {/* чернила во весь кадр: в тёмной теме светятся сквозь материал,
          в светлой — инвертированы и ложатся тушью на бумагу */}
      <div className="finale-ink pointer-events-none absolute inset-0 -z-10">
        <VideoBackdrop src={SITE.media.ink.src} poster={SITE.media.ink.poster} crop={1.04} opacity={0.9} />
      </div>
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(180deg, rgb(var(--bg-rgb)) 0%, rgb(var(--bg-rgb) / 0) 22%, rgb(var(--bg-rgb) / 0) 70%, rgb(var(--bg-rgb)) 100%), radial-gradient(90% 70% at 30% 50%, rgb(var(--bg-rgb) / 0.55) 0%, rgb(var(--bg-rgb) / 0) 70%)'
        }}
        aria-hidden
      />

      <div className="grid min-h-[100svh] items-center gap-10 px-4 pb-[clamp(56px,10vh,120px)] pt-[clamp(96px,16vh,168px)] sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:px-[72px]">
        <Reveal start="top 80%">
          <span className="rail-label" data-rise>
            {footer.label}
          </span>
          <h2 data-rise data-skew className="display m-0 mt-6 text-[clamp(44px,7.4vw,132px)] leading-[0.95]">
            {footer.title}
            <span className="block font-bold tracking-[-0.035em]">{footer.titleAccent}</span>
          </h2>
          <p data-rise className="m-0 mt-7 max-w-[46ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">
            {footer.lead}
          </p>

          {/* первый шаг брифа — прямо здесь */}
          <div data-rise className="mt-[clamp(28px,5vh,48px)]">
            <span className="rail-label">Что запускаем?</span>
            <ul className="m-0 mt-4 flex max-w-[640px] list-none flex-wrap gap-2 p-0">
              {NEEDS.map((n) => (
                <li key={n.id}>
                  <Link href={withNeed(n.id)} className="need-chip">
                    <span className="font-mono text-[10px] text-faint">{n.n}</span>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div data-rise className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px]">
            <span className="rail-label">{SITE.contact.direct}</span>
            <a
              href={`https://t.me/${SITE.telegram}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:decoration-accent"
            >
              Telegram {SITE.telegramLabel}
            </a>
            <a
              href={`mailto:${SITE.email}`}
              className="text-dim underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-fg"
            >
              {SITE.email}
            </a>
          </div>
        </Reveal>

        {/* знак в объёме и большая кнопка на нём */}
        <div className="relative mx-auto w-full max-w-[560px]">
          <MarkVideo variant="loop" className="aspect-square w-full" />
          <Link href={base} data-magnetic className="round-cta absolute bottom-[4%] left-[-2%] sm:left-[2%]" aria-label="Обсудить проект">
            <svg viewBox="0 0 200 200" className="round-cta-ring" aria-hidden>
              <defs>
                <path id="rc-circle" d="M100 100 m-78 0 a78 78 0 1 1 156 0 a78 78 0 1 1 -156 0" />
              </defs>
              <text>
                <textPath href="#rc-circle" startOffset="0">
                  ОБСУДИТЬ ПРОЕКТ · ОТВЕТИМ ЗА ДЕНЬ · РАЗБОР — 0 ₽ ·
                </textPath>
              </text>
            </svg>
            <span className="round-cta-core" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
