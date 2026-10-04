import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Cta from '@/components/Cta';
import Footer from '@/components/Footer';
import CallMe from '@/components/help/CallMe';
import FaqPanel from '@/components/help/FaqPanel';
import Glossary from '@/components/help/Glossary';
import HelpConsole from '@/components/help/HelpConsole';
import HelpPicker from '@/components/help/HelpPicker';
import MessengerMark from '@/components/MessengerMark';
import RevealText from '@/components/RevealText';
import ScrollScenes from '@/components/ScrollScenes';
import Words from '@/components/Words';
import { HELP, type TopicId } from '@/content/help';
import { SITE } from '@/content/site';
import { pageMeta } from '@/lib/meta';
import { TOUR_HOME } from '@/lib/tour';

export const metadata: Metadata = pageMeta({ title: HELP.meta.title, description: HELP.meta.description, path: '/help' });

const textLink = 'text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-accent';
const actionLink =
  '-my-2 inline-flex items-center gap-2 py-2 font-mono text-[10px] uppercase tracking-rail text-dim transition-colors duration-300 hover:text-accent';

const Arrow = ({ className = 'h-3 w-3' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Вводка темы — с объяснениями непонятных слов. */
const Lead = ({ text }: { text: string }) => (
  <p className="m-0 max-w-[62ch] text-[clamp(14px,1.15vw,16px)] leading-relaxed text-dim">
    <Words text={text} />
  </p>
);

/** Подзаголовок внутри темы — моноширинной подписью, как в рамках приборов на сайте. */
const Sub = ({ children }: { children: ReactNode }) => <span className="rail-label block">{children}</span>;

/**
 * Сроки шкалой: у каждого направления полоса от «от» до «до» на общей
 * шкале недель — видно сразу, что дольше, а что быстрее. Мониторинг
 * считается в днях и стоит у самого нуля. Полосы вырастают, когда тема
 * открывается (`.wk-bar`, без анимации при reduced motion).
 */
function Weeks() {
  const { items, scale } = HELP.price.times;
  const cols = 'sm:grid-cols-[minmax(150px,0.8fr)_minmax(0,2fr)_92px]';
  return (
    <div>
      <div className="flex flex-col gap-3.5">
        {items.map((t, i) => {
          const lo = t.unit === 'days' ? 0 : t.lo;
          const hi = t.unit === 'days' ? t.hi / 7 : t.hi;
          return (
            <div key={t.label} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 ${cols}`}>
              <span className="text-[14px] leading-snug">{t.label}</span>
              <span className="relative order-3 col-span-2 h-2 rounded-full bg-line sm:order-none sm:col-span-1">
                <i
                  className="wk-bar absolute top-0 h-full rounded-full bg-accent"
                  style={{ left: `${(lo / scale) * 100}%`, width: `${Math.max(1.5, ((hi - lo) / scale) * 100)}%`, animationDelay: `${i * 70}ms` }}
                />
              </span>
              <span className="whitespace-nowrap text-right font-mono text-[12px] text-dim">
                {t.value} {t.word}
              </span>
            </div>
          );
        })}
      </div>
      {/* шкала недель под полосами — на узком экране полосы короткие, и подписи не помещаются */}
      <div className={`mt-2 hidden ${cols} sm:grid`} aria-hidden>
        <span />
        <span className="relative h-4">
          {Array.from({ length: scale + 1 }, (_, k) => (
            <span key={k} className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-faint" style={{ left: `${(k / scale) * 100}%` }}>
              {k}
            </span>
          ))}
        </span>
        <span className="text-right font-mono text-[10px] uppercase tracking-rail text-faint">недели</span>
      </div>
    </div>
  );
}

/**
 * Помощь — пульт: слева темы, справа одна открытая (HelpConsole).
 *
 * Для трёх «слабых пользователей» из опроса: кто не знает, что ему
 * нужно (подбор), кто не понимает сам сайт (что где, экскурсия) и кто
 * не понимает слов (словарь). Внизу — «Мы напишем сами» для всех,
 * кто не нашёл ответа.
 */
export default function HelpPage() {
  const { start, map, price, after, faq, words, write } = HELP;

  const panels: Record<TopicId, ReactNode> = {
    start: (
      <>
        <Lead text={start.lead} />
        <div className="mt-[clamp(20px,3.4vh,32px)]">
          <HelpPicker quick={start.quick} quickTitle={start.quickTitle} />
        </div>
      </>
    ),

    map: (
      <>
        <Lead text={map.lead} />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border border-line-strong bg-bg/50 p-[clamp(16px,2vw,24px)]">
          <div className="max-w-[46ch]">
            <p className="m-0 text-[15px] leading-relaxed text-fg">{map.tour.text}</p>
            <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-dim">{map.tour.page}</p>
          </div>
          <Cta href={TOUR_HOME} size="sm">
            {map.tour.link}
          </Cta>
        </div>
        <ul className="m-0 mt-6 grid list-none gap-px border border-line bg-line p-0 sm:grid-cols-2">
          {map.pages.map((p) =>
            p.sub ? (
              // у «Услуг» внутри четыре страницы: плитка — не ссылка, ссылки — строки в ней
              <li key={p.href} className="bg-elev p-[clamp(14px,1.6vw,20px)] sm:row-span-2">
                <span className="text-[16px] font-medium leading-snug">{p.name}</span>
                <span className="mt-1 block text-[13.5px] leading-snug text-dim">{p.text}</span>
                <ul className="m-0 mt-3 flex list-none flex-col p-0">
                  {p.sub.map((s) => (
                    <li key={s.href} className="border-t border-line">
                      <Link href={s.href} className="group flex items-center justify-between gap-3 py-2.5 text-[14px] text-fg transition-colors duration-300 hover:text-accent">
                        {s.label}
                        <Arrow className="h-3 w-3 text-faint transition-colors duration-300 group-hover:text-accent" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={p.href} className="bg-elev">
                <Link href={p.href} className="group flex h-full flex-col gap-1 p-[clamp(14px,1.6vw,20px)] transition-colors duration-300 hover:bg-bg/60">
                  <span className="flex items-center justify-between gap-3 text-[16px] font-medium leading-snug">
                    {p.name}
                    <Arrow className="h-3 w-3 text-faint transition-colors duration-300 group-hover:text-accent" />
                  </span>
                  <span className="text-[13.5px] leading-snug text-dim">{p.text}</span>
                </Link>
              </li>
            )
          )}
          <li className="bg-elev p-[clamp(14px,1.6vw,20px)]">
            <span className="text-[16px] font-medium leading-snug text-accent">Помощь</span>
            <span className="mt-1 block text-[13.5px] leading-snug text-dim">Вы здесь — возвращайтесь, если что-то непонятно</span>
          </li>
        </ul>
        <ul className="m-0 mt-6 grid list-none gap-x-6 gap-y-3 p-0 sm:grid-cols-2">
          {map.ui.map((it) => (
            <li key={it.name} className="flex gap-3 text-[13.5px] leading-snug text-dim">
              <span className="rail-label w-14 shrink-0 !text-accent">{it.name}</span>
              {it.text}
            </li>
          ))}
        </ul>
      </>
    ),

    price: (
      <>
        <Lead text={price.lead} />
        <div className="mt-6 border border-line-strong bg-bg/50 p-[clamp(16px,2vw,24px)]">
          <Sub>{price.times.title}</Sub>
          <div className="mt-4">
            <Weeks />
          </div>
          <p className="m-0 mt-4 max-w-[64ch] text-[13px] leading-relaxed text-dim">{price.times.note}</p>
          <div className="mt-3">
            <Link href="/contact" className={actionLink}>
              {price.times.link} <Arrow />
            </Link>
          </div>
        </div>
        <div className="mt-6">
          <Sub>{price.factors.title}</Sub>
          <ul className="m-0 mt-3 grid list-none gap-px border border-line bg-line p-0 sm:grid-cols-2">
            {price.factors.items.map((f, i) => (
              <li key={f.title} className="bg-elev p-[clamp(14px,1.6vw,20px)]">
                <span className="font-mono text-[11px] tracking-rail text-accent">{String(i + 1).padStart(2, '0')}</span>
                <span className="mt-1.5 block text-[15.5px] font-medium leading-snug">{f.title}</span>
                <span className="mt-1 block text-[13.5px] leading-snug text-dim">
                  <Words text={f.text} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </>
    ),

    after: (
      <>
        <Lead text={after.lead} />
        {/* три шага — линией, как путь заявки: точка на каждом шаге */}
        <ol className="relative m-0 mt-7 grid list-none gap-6 p-0 sm:grid-cols-3 sm:gap-6">
          <span className="absolute bottom-2 left-[7px] top-2 w-px bg-line sm:bottom-auto sm:left-0 sm:right-0 sm:top-[7px] sm:h-px sm:w-auto" aria-hidden />
          {after.steps.map((s) => (
            <li key={s.n} className="relative pl-8 sm:pl-0 sm:pt-8">
              <span className="absolute left-0 top-0.5 grid h-[15px] w-[15px] place-items-center rounded-full border border-accent bg-elev sm:top-0" aria-hidden>
                <i className="h-[5px] w-[5px] rounded-full bg-accent" />
              </span>
              <span className="font-mono text-[11px] tracking-rail text-accent">{s.n}</span>
              <h3 className="m-0 mt-1.5 text-[16px] font-medium leading-snug">{s.title}</h3>
              <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-dim">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <Sub>{after.prepare.title}</Sub>
          <p className="m-0 mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-dim">{after.prepare.lead}</p>
          <ul className="m-0 mt-3 grid list-none gap-x-6 p-0 sm:grid-cols-2">
            {after.prepare.items.map((it) => (
              <li key={it.title} className="flex gap-3 border-t border-line py-3.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-strong text-accent" aria-hidden>
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3.5 8.4 6.6 11.4 12.5 4.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  <span className="block text-[15px] font-medium leading-snug">{it.title}</span>
                  <span className="mt-1 block text-[13.5px] leading-relaxed text-dim">
                    <Words text={it.text} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </>
    ),

    faq: (
      <>
        <Lead text={faq.lead} />
        <div className="mt-6">
          <FaqPanel
            groups={[
              { id: 'general', title: faq.general.title, items: faq.general.items },
              ...faq.services.map((s) => ({ id: s.href, title: s.title, href: s.href, items: s.items, plain: true }))
            ]}
          />
        </div>
      </>
    ),

    words: (
      <>
        <Lead text={words.lead} />
        <div className="mt-6">
          <Glossary labels={{ search: words.search, placeholder: words.placeholder, empty: words.empty, ask: words.ask }} />
        </div>
      </>
    )
  };

  return (
    <>
      <main id="content" className="relative z-10 w-full">
        {/* ---------- первый экран ---------- */}
        <section data-chapter="hero" className="relative overflow-hidden" aria-label="Начало">
          <div data-hero className="px-4 pb-[clamp(36px,6vh,72px)] pt-[clamp(120px,19vh,200px)] sm:px-8 lg:px-[72px] tp:pb-10 tp:pt-[136px]">
            <span className="rail-label">{HELP.label}</span>
            <div className="mt-6 grid items-end gap-[clamp(28px,5vh,56px)] lg:grid-cols-[1.6fr_1fr] lg:gap-[clamp(40px,5vw,96px)] tp:grid-cols-1">
              <h1 className="display m-0 text-[clamp(32px,5vw,86px)] tp:text-[min(8vw,80px)]" aria-label={`${HELP.title} ${HELP.titleAccent}`}>
                <RevealText text={HELP.title} as="span" className="block" decorative />
                <RevealText text={HELP.titleAccent} as="span" className="title-accent block" delay={0.12} decorative />
              </h1>
              <p className="m-0 max-w-[44ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim tp:max-w-[50ch] tp:text-[17px]">{HELP.lead}</p>
            </div>
          </div>
        </section>

        {/* ---------- пульт: темы и одна открытая ---------- */}
        <section data-chapter="anatomy" className="relative z-10 w-full border-t border-line" aria-label="Темы помощи">
          <div className="px-4 py-[clamp(32px,6vh,72px)] sm:px-8 lg:px-[72px]">
            <HelpConsole topics={HELP.topics} panels={panels} stuck={HELP.stuck} />
          </div>
        </section>

        {/* ---------- не разобрались ---------- */}
        <section
          id="write"
          tabIndex={-1}
          data-chapter="finale"
          aria-label={write.label}
          className="relative z-10 w-full border-t border-line px-4 pb-[clamp(44px,8vh,92px)] pt-[clamp(64px,11vh,130px)] outline-none sm:px-8 lg:px-[72px]"
        >
          <span className="rail-label">{write.label}</span>
          {/* Форма — главное здесь (HELP.md, «Свяжитесь со мной»). Написать
              самому и бриф — запасные пути под ней: на телефоне «или» не
              должно стоять раньше главного */}
          <div className="mt-6 grid gap-[clamp(32px,5vh,56px)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] lg:items-end lg:gap-[clamp(40px,5vw,96px)]">
            <div>
              <h2 className="display m-0 text-[clamp(36px,5.6vw,96px)] leading-[0.96]">
                {write.title} <span className="title-accent">{write.titleAccent}</span>
              </h2>
              <p className="m-0 mt-6 max-w-[46ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">{write.lead}</p>
            </div>
            <CallMe />
            <div className="lg:col-span-2">
              <span className="rail-label block">{write.direct}</span>
              <p className="m-0 mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px]">
                <a href={`https://t.me/${SITE.telegram}`} target="_blank" rel="noreferrer noopener" className={`inline-flex items-center gap-2 ${textLink}`}>
                  <MessengerMark kind="telegram" />
                  Telegram {SITE.telegramLabel}
                </a>
                <a href={SITE.max} target="_blank" rel="noreferrer noopener" className={`inline-flex items-center gap-2 ${textLink}`}>
                  <MessengerMark kind="max" />
                  {SITE.maxLabel}
                </a>
                <a href={`mailto:${SITE.email}`} className="text-dim underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-fg">
                  {SITE.email}
                </a>
              </p>
              <div className="mt-5">
                <Link href="/contact" className={actionLink}>
                  {write.brief} <Arrow />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer cta={false} />
      <ScrollScenes />
    </>
  );
}
