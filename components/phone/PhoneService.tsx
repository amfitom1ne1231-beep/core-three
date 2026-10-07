'use client';

import { useRef, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Stage from '@/components/service/Stage';
import Words from '@/components/Words';
import type { LiveProps } from '@/components/live/kit';
import { navigate } from '@/lib/phone';
import { scrollToEl } from '@/lib/scroll';
import { SERVICES, type ServicePage } from '@/content/services';
import { SITE } from '@/content/site';

type TabId = 'includes' | 'steps' | 'who' | 'faq' | 'probe';
/** Верхняя строка телефона: под ней встаёт переключатель. */
const BAR = 52;

const num = (i: number) => String(i + 1).padStart(2, '0');

/**
 * Экран направления на телефоне (MOBILE.md).
 *
 * Ноутбучная страница, сложенная в колонку, давала восемь-девять экранов
 * списков подряд. Здесь сверху кадр направления, а под ним переключатель:
 * «Состав», «Шаги», «Кому», «Вопросы» — на экране один раздел, остальные
 * в одном касании. У ботов есть пятый, «Проба»: разговор с ботом прямо
 * на странице.
 *
 * Тексты те же, что на ноутбуке (`content/services.ts`), — это не вторая
 * страница, а вторая раскладка.
 */
export default function PhoneService({
  page,
  live,
  task,
  probe
}: {
  page: ServicePage;
  live: ComponentType<LiveProps>;
  task?: string;
  /** Живая проба сценария — только у ботов. */
  probe?: ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('includes');
  const body = useRef<HTMLDivElement>(null);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'includes', label: 'Состав' },
    { id: 'steps', label: 'Шаги' },
    { id: 'who', label: 'Кому' },
    { id: 'faq', label: 'Вопросы' },
    ...(probe ? [{ id: 'probe' as const, label: 'Проба' }] : [])
  ];

  const pick = (id: TabId) => {
    setTab(id);
    // раздел короче прежнего — возвращаемся к его началу, а не остаёмся в пустоте
    const el = body.current;
    if (el && el.getBoundingClientRect().top < BAR) scrollToEl(el, -(BAR + 8));
  };

  const at = SERVICES.findIndex((s) => s.slug === page.slug);
  const next = SERVICES[(at + 1) % SERVICES.length];
  const go = (href: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(() => router.push(href));
  };

  const row = 'flex gap-3.5 border-t border-line py-4 first:border-t-0 first:pt-1';
  const mark = 'mt-[3px] shrink-0 font-mono text-[11px] tracking-rail text-faint';
  const head = 'block text-[16px] font-medium leading-snug text-fg';
  const text = 'mt-1 block text-[14px] leading-[1.55] text-dim';

  return (
    <div className="sm:hidden">
      {/* ---------- кадр направления ---------- */}
      <section
        data-chapter="hero"
        aria-label="Начало"
        className="px-4 pb-7"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${BAR + 22}px)` }}
      >
        <span className="rail-label">
          <b>{page.n}</b> / {page.group}
        </span>
        <h1 className="display m-0 mt-3 text-[31px]">
          {page.title} <span className="title-accent">{page.titleAccent}</span>
        </h1>
        <p className="m-0 mt-3.5 text-[15px] leading-[1.55] text-dim">
          <Words text={page.lead} />
        </p>
        <div className="mt-6">
          <Stage live={live} task={task} tour={false} />
        </div>
      </section>

      {/* ---------- разделы ---------- */}
      <section data-chapter="atlas" aria-label="О направлении" className="relative">
        <div
          role="tablist"
          aria-label="Разделы направления"
          className="phone-seg sticky z-[90] flex gap-1 overflow-x-auto border-y border-line bg-bg/85 px-3 py-2 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ top: `calc(env(safe-area-inset-top, 0px) + ${BAR}px)` }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`ps-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="ps-panel"
              onClick={() => pick(t.id)}
              className={`flex-1 whitespace-nowrap rounded-full px-3 py-2 text-[13.5px] font-medium transition-colors duration-200 ${
                tab === t.id ? 'bg-fg text-bg' : 'text-dim'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          ref={body}
          id="ps-panel"
          role="tabpanel"
          aria-labelledby={`ps-tab-${tab}`}
          // раздел не ниже экрана: переключатель не прыгает, когда вопросов меньше, чем пунктов состава
          className="min-h-[62svh] px-4 pb-2 pt-5"
        >
          <div key={tab} className="animate-[ct-rise_0.36s_cubic-bezier(0.2,0.7,0.2,1)_both]">
            {tab === 'includes' && (
              <ol className="m-0 list-none p-0">
                {page.includes.map((it, i) => (
                  <li key={it.title} className={row}>
                    <span className={mark}>{num(i)}</span>
                    <span>
                      <span className={head}>{it.title}</span>
                      <span className={text}>
                        <Words text={it.text} />
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {tab === 'steps' && (
              <ol className="m-0 list-none p-0">
                {page.steps.map((st) => (
                  <li key={st.n} className={row}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[10.5px] text-fg">{st.n}</span>
                    <span>
                      <span className={head}>{st.title}</span>
                      <span className={text}>
                        <Words text={st.text} />
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {tab === 'who' && (
              <>
                <span className="rail-label">{page.audience.label}</span>
                <h2 className="m-0 mt-2 text-[21px] font-medium leading-tight text-fg">{page.audience.title}</h2>
                <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
                  {page.audience.items.map((x) => (
                    <li key={x} className="flex gap-3 text-[14.5px] leading-[1.5] text-dim">
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                      <span>
                        <Words text={x} />
                      </span>
                    </li>
                  ))}
                </ul>
                <dl className="m-0 mt-6">
                  {page.terms.map((t) => (
                    <div key={t.label} className="flex gap-4 border-t border-line py-3.5">
                      <dt className="rail-label w-[68px] shrink-0 pt-0.5">{t.label}</dt>
                      <dd className="m-0 text-[14.5px] leading-[1.5] text-fg">
                        <Words text={t.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <ul className="m-0 mt-4 flex list-none flex-wrap gap-1.5 p-0">
                  {page.stack.map((x) => (
                    <li key={x} className="rounded-full border border-line-strong px-2.5 py-1 text-[11.5px] leading-none text-dim">
                      {x}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {tab === 'faq' && (
              <>
                {page.faq.map((f) => (
                  <details key={f.q} className="group border-t border-line first:border-t-0">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-4 text-[16px] font-medium leading-snug text-fg marker:content-none [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span className="mt-1 shrink-0 font-mono text-[15px] leading-none text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden>
                        +
                      </span>
                    </summary>
                    <p className="m-0 pb-4 text-[14.5px] leading-[1.55] text-dim">
                      <Words text={f.a} />
                    </p>
                  </details>
                ))}
                <p className="m-0 mt-5 text-[14px] leading-relaxed text-dim">
                  Не нашли своего вопроса?{' '}
                  <Link href={`/contact?type=${page.kind}`} onClick={go(`/contact?type=${page.kind}`)} className="text-fg underline decoration-line-strong underline-offset-4">
                    Спросите напрямую
                  </Link>{' '}
                  — отвечаем в течение дня.
                </p>
              </>
            )}

            {tab === 'probe' && probe}
          </div>
        </div>

        {/* ---------- дальше ---------- */}
        <div className="px-4 pt-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 124px)' }}>
          <Link
            href={`/contact?type=${page.kind}`}
            onClick={go(`/contact?type=${page.kind}`)}
            className="flex items-center justify-between gap-3 rounded-[18px] bg-fg px-4 py-4 text-[16px] font-medium text-bg transition-transform duration-200 active:scale-[0.98]"
          >
            Обсудить проект
            <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3.5 8h9 M9 4.5 12.5 8 9 11.5" />
            </svg>
          </Link>
          <Link
            href={`/${next.slug}`}
            onClick={go(`/${next.slug}`)}
            className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-line-strong bg-elev/70 px-4 py-3.5 text-fg transition-transform duration-200 active:scale-[0.98]"
          >
            <span className="flex min-w-0 flex-col">
              <span className="rail-label">Дальше</span>
              <span className="mt-1 text-[15.5px] font-medium leading-tight">{SITE.pages.find((p) => p.href === `/${next.slug}`)?.label ?? next.meta.title}</span>
            </span>
            <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m6 3.5 4.5 4.5L6 12.5" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
