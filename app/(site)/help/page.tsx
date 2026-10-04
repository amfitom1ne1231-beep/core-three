import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Footer from '@/components/Footer';
import CallMe from '@/components/help/CallMe';
import Glossary from '@/components/help/Glossary';
import HelpPicker from '@/components/help/HelpPicker';
import Jump from '@/components/help/Jump';
import MessengerMark from '@/components/MessengerMark';
import RevealText from '@/components/RevealText';
import ScrollScenes from '@/components/ScrollScenes';
import { demoBySlug } from '@/content/concepts';
import { HELP } from '@/content/help';
import { SITE } from '@/content/site';
import { pageMeta } from '@/lib/meta';
import Words from '@/components/Words';
import { TOUR_HOME } from '@/lib/tour';

export const metadata: Metadata = pageMeta({ title: HELP.meta.title, description: HELP.meta.description, path: '/help' });

/** Ссылка в тексте — та же, что «Спросите напрямую» на страницах направлений. */
const textLink = 'text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-accent';
/** Маленькое действие под пунктом: моноширинная строка со стрелкой. */
const actionLink =
  '-my-2 inline-flex items-center gap-2 py-2 font-mono text-[10px] uppercase tracking-rail text-dim transition-colors duration-300 hover:text-accent';

const Arrow = () => (
  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Раздел страницы. Заголовок с подписью — как на «О нас»; внизу — строка
 * «Не нашли ответа?» со ссылкой на связь: застрять негде (HELP.md).
 *
 * Фон под разделами ровный (глава `anatomy` закрывает материал): это
 * страница для чтения, текст на подвижном серебре читался бы хуже.
 * `aria-label` — короткое имя раздела: его же показывает пульт
 * в списке мест страницы.
 */
function Part({
  id,
  label,
  title,
  accent,
  lead,
  children
}: {
  id: string;
  label: string;
  title: string;
  accent: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      tabIndex={-1}
      data-chapter="anatomy"
      aria-label={label.split(' / ').pop()}
      className="relative z-10 w-full border-t border-line outline-none"
    >
      <div className="px-4 section-y-tight sm:px-8 lg:px-[72px]">
        <span className="rail-label">{label}</span>
        <div className="mt-4 grid gap-[clamp(16px,3vh,32px)] lg:grid-cols-[1.7fr_1fr] lg:items-end">
          <h2 className="display m-0 text-[clamp(26px,4.2vw,64px)]">
            {title} <span className="title-accent">{accent}</span>
          </h2>
          {lead && (
            <p className="m-0 max-w-[42ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
              <Words text={lead} />
            </p>
          )}
        </div>

        <div className="mt-[clamp(28px,5vh,64px)]">{children}</div>

        <p className="m-0 mt-[clamp(28px,5vh,56px)] text-[14px] leading-relaxed text-dim">
          {HELP.stuck.text}{' '}
          <Jump to="write" className={textLink}>
            {HELP.stuck.link}
          </Jump>
        </p>
      </div>
    </section>
  );
}

/** Подзаголовок внутри раздела. */
const Sub = ({ children }: { children: ReactNode }) => (
  <h3 className="m-0 text-[clamp(17px,1.5vw,22px)] font-medium leading-snug">{children}</h3>
);

/**
 * Помощь.
 *
 * Для трёх «слабых пользователей» из опроса: кто не знает, что ему
 * нужно, кто не понимает сам сайт и кто не понимает слов. Первый экран —
 * не оглавление по разделам сайта, а «с чем вы пришли»; дальше разделы
 * в том же порядке. Подбор по вопросам, экскурсия, словарь в текстах
 * и форма «свяжитесь со мной» — следующие этапы (HELP.md).
 */
export default function HelpPage() {
  const { start, map, price, after, faq, words, write } = HELP;

  return (
    <>
      <main id="content" className="relative z-10 w-full">
        {/* ---------- первый экран ---------- */}
        <section data-chapter="hero" className="relative overflow-hidden" aria-label="Начало">
          <div data-hero className="px-4 pb-[clamp(40px,7vh,88px)] pt-[clamp(120px,19vh,200px)] sm:px-8 lg:px-[72px] tp:pb-10 tp:pt-[136px]">
            <span className="rail-label">{HELP.label}</span>
            <div className="mt-6 grid items-end gap-[clamp(28px,5vh,56px)] lg:grid-cols-[1.6fr_1fr] lg:gap-[clamp(40px,5vw,96px)] tp:grid-cols-1">
              <h1 className="display m-0 text-[clamp(32px,5vw,86px)] tp:text-[min(8vw,80px)]" aria-label={`${HELP.title} ${HELP.titleAccent}`}>
                <RevealText text={HELP.title} as="span" className="block" decorative />
                <RevealText text={HELP.titleAccent} as="span" className="title-accent block" delay={0.12} decorative />
              </h1>
              <p className="m-0 max-w-[44ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim tp:max-w-[50ch] tp:text-[17px]">{HELP.lead}</p>
            </div>
          </div>

          {/* с чем пришли — шесть дверей в разделы ниже */}
          <nav aria-label="С чем вы пришли">
            <ul className="m-0 grid list-none gap-px border-y border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-3">
              {HELP.topics.map((t) => (
                <li key={t.id} className="bg-bg">
                  <Jump
                    to={t.id}
                    className="group flex h-full items-start gap-4 px-4 py-[clamp(20px,3.2vh,34px)] transition-colors duration-300 hover:bg-elev sm:px-8 lg:px-[clamp(32px,3vw,56px)]"
                  >
                    <span className="mt-[0.45em] w-6 shrink-0 font-mono text-[10px] tracking-rail text-accent">{t.n}</span>
                    <span className="flex-1">
                      <span className="block text-[clamp(17px,1.5vw,21px)] font-medium leading-snug transition-colors duration-300 group-hover:text-accent">
                        {t.title}
                      </span>
                      <span className="mt-2 block text-[13.5px] leading-snug text-dim">{t.text}</span>
                    </span>
                    {/* вниз: раздел на этой же странице, а не переход */}
                    <span className="mt-[0.4em] shrink-0 rotate-90 text-faint transition-colors duration-300 group-hover:text-accent" aria-hidden>
                      <Arrow />
                    </span>
                  </Jump>
                </li>
              ))}
            </ul>
          </nav>
        </section>

        {/* ---------- 01 не знаю, с чего начать ---------- */}
        <Part id="start" label={start.label} title={start.title} accent={start.titleAccent} lead={start.lead}>
          <HelpPicker />

          <div className="mt-[clamp(48px,8vh,96px)]">
            <Sub>{start.situationsTitle}</Sub>
          </div>
          <ul className="m-0 mt-5 list-none p-0">
            {start.situations.map((s) => {
              const demo = demoBySlug(s.demo);
              return (
                <li
                  key={s.say}
                  className="grid gap-x-[clamp(40px,5vw,96px)] gap-y-4 border-t border-line py-[clamp(20px,3.2vh,36px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]"
                >
                  <p className="m-0 text-[clamp(18px,1.7vw,24px)] leading-snug">«{s.say}»</p>
                  <div>
                    <span className="rail-label">{start.helps}</span>
                    <p className="m-0 mt-2">
                      <Link href={s.href} className={`text-[clamp(16px,1.4vw,19px)] font-medium ${textLink}`}>
                        {s.help}
                      </Link>
                    </p>
                    <p className="m-0 mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-dim">{s.why}</p>
                    <div className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
                      {demo && (
                        <Link href={`/concepts/${demo.slug}`} className={actionLink}>
                          {start.demo}: «{demo.client}» <Arrow />
                        </Link>
                      )}
                      <Link href={`/contact?need=${s.need}`} className={actionLink}>
                        {start.discuss} <Arrow />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
            <li className="grid gap-x-[clamp(40px,5vw,96px)] gap-y-4 border-y border-line py-[clamp(20px,3.2vh,36px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              <p className="m-0 text-[clamp(18px,1.7vw,24px)] leading-snug">«{start.other.say}»</p>
              <div>
                <p className="m-0 max-w-[52ch] text-[14.5px] leading-relaxed text-dim">{start.other.text}</p>
                <div className="mt-4">
                  <Link href="/contact" className={actionLink}>
                    {start.other.link} <Arrow />
                  </Link>
                </div>
              </div>
            </li>
          </ul>
        </Part>

        {/* ---------- 02 что где на сайте ---------- */}
        <Part id="map" label={map.label} title={map.title} accent={map.titleAccent} lead={map.lead}>
          <div className="mb-[clamp(32px,5vh,56px)] flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-line py-[clamp(16px,2.6vh,24px)]">
            <p className="m-0 max-w-[52ch] text-[15px] leading-relaxed text-fg">{map.tour.text}</p>
            <Link href={TOUR_HOME} className={actionLink}>
              {map.tour.link} <Arrow />
            </Link>
            <p className="m-0 w-full text-[13px] leading-relaxed text-dim">{map.tour.page}</p>
          </div>
          {/* шапка таблицы — только на широком экране; на узком у каждой
              ячейки своя подпись, иначе колонки не прочесть */}
          <div className="hidden gap-x-[clamp(32px,4vw,72px)] pb-3 lg:grid lg:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.2fr)_minmax(0,1fr)]" aria-hidden>
            {map.columns.map((c) => (
              <span key={c} className="rail-label">
                {c}
              </span>
            ))}
          </div>
          <ul className="m-0 list-none p-0">
            {map.pages.map((p) => (
              <li
                key={p.href}
                className="grid gap-x-[clamp(32px,4vw,72px)] gap-y-3 border-t border-line py-[clamp(16px,2.6vh,28px)] last:border-b lg:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.2fr)_minmax(0,1fr)]"
              >
                <div>
                  {p.href === '/help' ? (
                    <span className="text-[clamp(16px,1.4vw,19px)] font-medium text-accent" aria-current="page">
                      {p.name}
                    </span>
                  ) : (
                    <Link href={p.href} className={`text-[clamp(16px,1.4vw,19px)] font-medium ${textLink}`}>
                      {p.name}
                    </Link>
                  )}
                  {'sub' in p && (
                    <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
                      {p.sub.map((s) => (
                        <li key={s.href}>
                          <Link href={s.href} className="-my-1 inline-block py-1 text-[13.5px] text-dim transition-colors duration-300 hover:text-accent">
                            {s.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="m-0 text-[14.5px] leading-relaxed text-dim">
                  <span className="rail-label mb-1 block lg:sr-only">{map.columns[1]}</span>
                  {p.what}
                </p>
                <p className="m-0 text-[14.5px] leading-relaxed text-dim">
                  <span className="rail-label mb-1 block lg:sr-only">{map.columns[2]}</span>
                  {p.why}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-[clamp(40px,7vh,80px)]">
            <Sub>{map.ui.title}</Sub>
            <ul className="m-0 mt-5 grid list-none gap-x-[clamp(32px,4vw,72px)] p-0 sm:grid-cols-2 lg:grid-cols-3">
              {map.ui.items.map((it) => (
                <li key={it.name} className="border-t border-line py-[clamp(16px,2.6vh,26px)]">
                  <span className="rail-label !text-accent">{it.name}</span>
                  <p className="m-0 mt-2.5 max-w-[42ch] text-[14.5px] leading-relaxed text-dim">{it.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </Part>

        {/* ---------- 03 цена и сроки ---------- */}
        <Part id="price" label={price.label} title={price.title} accent={price.titleAccent} lead={price.lead}>
          <div className="grid gap-[clamp(40px,6vh,64px)] lg:grid-cols-2 lg:gap-[clamp(40px,5vw,96px)]">
            <div>
              <Sub>{price.factors.title}</Sub>
              <ol className="m-0 mt-5 list-none p-0">
                {price.factors.items.map((f, i) => (
                  <li key={f.title} className="grid grid-cols-[2.75rem_1fr] items-baseline gap-x-2 border-t border-line py-[clamp(14px,2.2vh,22px)]">
                    <span className="font-mono text-[11px] tracking-rail text-accent">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h4 className="m-0 text-[16px] font-medium leading-snug">{f.title}</h4>
                      <p className="m-0 mt-1.5 max-w-[46ch] text-[14px] leading-relaxed text-dim">
                        <Words text={f.text} />
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <Sub>{price.times.title}</Sub>
              <dl className="m-0 mt-5">
                {price.times.items.map((t) => (
                  <div key={t.label} className="flex items-baseline justify-between gap-6 border-t border-line py-[clamp(14px,2.2vh,22px)] last:border-b">
                    <dt className="text-[15px] leading-snug">{t.label}</dt>
                    <dd className="m-0 shrink-0 whitespace-nowrap">
                      <span className="display text-[clamp(22px,2.2vw,32px)] leading-none">{t.value}</span>{' '}
                      <span className="text-[13px] text-dim">{t.unit}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="m-0 mt-5 max-w-[52ch] text-[14px] leading-relaxed text-dim">{price.times.note}</p>
              <div className="mt-5">
                <Link href="/contact" className={actionLink}>
                  {price.times.link} <Arrow />
                </Link>
              </div>
            </div>
          </div>
        </Part>

        {/* ---------- 04 после заявки ---------- */}
        <Part id="after" label={after.label} title={after.title} accent={after.titleAccent} lead={after.lead}>
          <ol className="m-0 grid list-none gap-[clamp(24px,4vh,40px)] p-0 md:grid-cols-3 md:gap-[clamp(20px,2.4vw,44px)]">
            {after.steps.map((s) => (
              <li key={s.n} className="border-t border-line pt-[clamp(16px,2.4vh,28px)]">
                <span className="block font-mono text-[clamp(36px,4vw,72px)] leading-[0.8] tracking-[-0.05em] text-faint" aria-hidden>
                  {s.n}
                </span>
                <h3 className="m-0 mt-[clamp(12px,2vh,22px)] text-[clamp(17px,1.5vw,22px)] font-medium leading-snug">{s.title}</h3>
                <p className="m-0 mt-2.5 max-w-[34ch] text-[14px] leading-relaxed text-dim">{s.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-[clamp(40px,7vh,80px)]">
            <Sub>{after.prepare.title}</Sub>
            <p className="m-0 mt-2 max-w-[52ch] text-[14px] leading-relaxed text-dim">{after.prepare.lead}</p>
            <ul className="m-0 mt-5 grid list-none gap-x-[clamp(32px,4vw,72px)] p-0 sm:grid-cols-2 lg:grid-cols-3">
              {after.prepare.items.map((it) => (
                <li key={it.title} className="border-t border-line py-[clamp(14px,2.2vh,22px)]">
                  <h4 className="m-0 text-[15.5px] font-medium leading-snug">{it.title}</h4>
                  <p className="m-0 mt-1.5 max-w-[42ch] text-[14px] leading-relaxed text-dim">
                    <Words text={it.text} />
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Part>

        {/* ---------- 05 частые вопросы ---------- */}
        <Part id="faq" label={faq.label} title={faq.title} accent={faq.titleAccent}>
          <div className="flex flex-col gap-[clamp(36px,6vh,64px)]">
            {[{ title: faq.general.title, href: null, items: faq.general.items }, ...faq.services].map((g) => (
              <div key={g.title} className="grid gap-x-[clamp(40px,5vw,96px)] gap-y-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.6fr)]">
                <div>
                  <Sub>{g.title}</Sub>
                  {g.href && (
                    <Link href={g.href} className={`mt-3 ${actionLink}`}>
                      О направлении <Arrow />
                    </Link>
                  )}
                </div>
                <div>
                  {g.items.map((f) => (
                    <details key={f.q} className="group border-t border-line last:border-b">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-[clamp(16px,2.4vh,24px)] text-[clamp(15.5px,1.3vw,18px)] font-medium leading-snug transition-colors duration-300 marker:content-none hover:text-accent">
                        {f.q}
                        <span
                          className="mt-1 shrink-0 font-mono text-[15px] leading-none text-accent transition-transform duration-300 group-open:rotate-45"
                          aria-hidden
                        >
                          +
                        </span>
                      </summary>
                      <p className="m-0 max-w-[58ch] pb-[clamp(16px,2.4vh,24px)] text-[14.5px] leading-relaxed text-dim">
                        {/* вопросы направлений уже объяснены на их страницах, а здесь
                            те же слова встретились выше или есть в словаре ниже */}
                        <Words text={f.a} plain={g.href !== null} />
                        {'more' in f && (
                          <>
                            {' '}
                            <Link href={f.more.href} className={textLink}>
                              {f.more.label}
                            </Link>
                          </>
                        )}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Part>

        {/* ---------- 06 словарь ---------- */}
        <Part id="words" label={words.label} title={words.title} accent={words.titleAccent} lead={words.lead}>
          <Glossary labels={{ search: words.search, placeholder: words.placeholder, empty: words.empty, ask: words.ask }} />
        </Part>

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
