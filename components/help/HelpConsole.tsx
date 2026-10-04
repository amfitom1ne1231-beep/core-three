'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Jump from './Jump';
import { scrollToEl } from '@/lib/scroll';
import type { Topic, TopicId } from '@/content/help';

/**
 * Пульт помощи: слева темы, справа одна открытая.
 *
 * Тот же язык, что «Состав работы» на страницах направлений: перечень
 * с рельсом, справа — рамка прибора с засечками по углам и подписью
 * «03 / 06». На телефоне темы встают лентой вкладок над рамкой.
 *
 * Содержимое тем собирает сервер и отдаёт сюда готовым — пульт только
 * переключает. Тема — в адресе (`/help#price`): на неё можно сослаться,
 * а `#word-…` из текстов сайта открывает словарь на нужном слове.
 */
export default function HelpConsole({
  topics,
  panels,
  stuck
}: {
  topics: readonly Topic[];
  panels: Record<TopicId, ReactNode>;
  stuck: { text: string; link: string };
}) {
  const [active, setActive] = useState<TopicId>(topics[0]!.id);
  const frame = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const at = topics.findIndex((t) => t.id === active);
  const topic = topics[at]!;

  /** Тема из адреса: `#price` — тема, `#word-…` — словарь. */
  const fromHash = useCallback(
    (scroll: boolean) => {
      const h = decodeURIComponent(location.hash.slice(1));
      const id = h.startsWith('word-') ? 'words' : topics.find((t) => t.id === h)?.id;
      if (!id) return;
      setActive(id);
      // пришли по ссылке на тему — пульт должен оказаться на экране
      if (scroll) requestAnimationFrame(() => frame.current && scrollToEl(frame.current, -96));
    },
    [topics]
  );

  useEffect(() => {
    fromHash(true);
    const on = () => fromHash(true);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, [fromHash]);

  // на телефоне темы — лентой: открытая всегда видна в ней, даже если открылась по ссылке
  useEffect(() => {
    const tab = tabs.current[at];
    const strip = tab?.parentElement;
    if (!tab || !strip || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: tab.offsetLeft - 16, behavior: 'smooth' });
  }, [at]);

  const choose = (id: TopicId, focus = false) => {
    setActive(id);
    history.replaceState(history.state, '', `#${id}`);
    if (focus) tabs.current[topics.findIndex((t) => t.id === id)]?.focus();
    // на телефоне рамка под лентой: если она ушла вверх — вернуть к началу темы
    const r = frame.current?.getBoundingClientRect();
    if (frame.current && r && r.top < 0) scrollToEl(frame.current, -96);
  };

  // стрелки по темам — как в любом переключателе вкладок
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (e.key === 'Home' || e.key === 'End' || step) {
      e.preventDefault();
      const i = e.key === 'Home' ? 0 : e.key === 'End' ? topics.length - 1 : (at + step! + topics.length) % topics.length;
      choose(topics[i]!.id, true);
    }
  };

  const nn = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="grid gap-[clamp(20px,3vh,32px)] lg:grid-cols-[minmax(240px,0.62fr)_minmax(0,1.9fr)] lg:gap-[clamp(32px,4vw,72px)]">
      {/* ---------- темы ---------- */}
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="relative lg:pl-5">
          {/* рельс: пройденная доля — до открытой темы включительно */}
          <span className="pointer-events-none absolute left-0 top-0 hidden h-full w-px bg-line lg:block" aria-hidden>
            <span
              className="absolute left-0 top-0 w-full bg-accent transition-[height] duration-500 ease-out"
              style={{ height: `${((at + 1) / topics.length) * 100}%` }}
            />
          </span>
          <div
            role="tablist"
            aria-label="Темы помощи"
            aria-orientation="vertical"
            data-tour="help-topics"
            onKeyDown={onKey}
            className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {topics.map((t, i) => {
              const on = t.id === active;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  id={`${base}-tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={`${base}-panel`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => choose(t.id)}
                  className={`group shrink-0 cursor-pointer border-0 border-b bg-transparent px-3 py-3 text-left transition-colors duration-300 lg:border-b-0 lg:border-t lg:px-0 lg:py-[clamp(12px,1.8vh,18px)] ${
                    on ? 'border-accent lg:border-line' : 'border-transparent lg:border-line'
                  }`}
                >
                  <span className="flex items-baseline gap-3 lg:gap-4">
                    <span className={`font-mono text-[11px] tracking-rail transition-colors duration-300 ${on ? 'text-accent' : 'text-faint'}`}>
                      {t.n}
                    </span>
                    <span
                      className={`whitespace-nowrap text-[15px] font-medium leading-snug transition-colors duration-300 lg:whitespace-normal lg:text-[clamp(15px,1.25vw,18px)] ${
                        on ? 'text-fg' : 'text-dim group-hover:text-fg'
                      }`}
                    >
                      {t.title}
                    </span>
                  </span>
                  <span className="mt-1 hidden pl-[calc(11px+1rem)] text-[13px] leading-snug text-faint lg:block">{t.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="m-0 mt-6 hidden text-[14px] leading-relaxed text-dim lg:block lg:pl-5">
          {stuck.text}{' '}
          <Jump to="write" className="text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-accent">
            {stuck.link}
          </Jump>
        </p>
      </div>

      {/* ---------- открытая тема: рамка прибора ---------- */}
      <div
        ref={frame}
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={`${base}-tab-${active}`}
        data-tour="help-panel"
        className="relative min-w-0 border border-line bg-elev lg:min-h-[clamp(520px,68vh,680px)]"
      >
        {['left-0 top-0 border-l border-t', 'right-0 top-0 border-r border-t', 'left-0 bottom-0 border-l border-b', 'right-0 bottom-0 border-r border-b'].map(
          (c) => (
            <span key={c} className={`pointer-events-none absolute h-3 w-3 border-line-strong ${c}`} aria-hidden />
          )
        )}
        {/* номер темы крупно — якорь, по которому видно, где ты в пульте */}
        <span
          key={`n-${active}`}
          className="pointer-events-none absolute right-[clamp(16px,2vw,32px)] top-[clamp(8px,1vw,16px)] font-mono text-[clamp(64px,8vw,128px)] leading-none tracking-[-0.04em] text-fg/[0.06]"
          style={{ animation: 'ct-rise .5s cubic-bezier(0.22,1,0.36,1) both' }}
          aria-hidden
        >
          {topic.n}
        </span>

        <div className="relative p-[clamp(20px,2.6vw,44px)]">
          <span className="rail-label">
            <b>{topic.n}</b> / {nn(topics.length)}
          </span>
          <h2 className="display m-0 mt-3 max-w-[20ch] text-[clamp(26px,3vw,46px)]">{topic.title}</h2>

          {topics.map((t) => (
            <div
              key={t.id}
              id={t.id}
              hidden={t.id !== active}
              className="help-panel mt-[clamp(14px,2vh,22px)]"
            >
              {panels[t.id]}
            </div>
          ))}
        </div>
      </div>

      <p className="m-0 text-[14px] leading-relaxed text-dim lg:hidden">
        {stuck.text}{' '}
        <Jump to="write" className="text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-accent">
          {stuck.link}
        </Jump>
      </p>
    </div>
  );
}
