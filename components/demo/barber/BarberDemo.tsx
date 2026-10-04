'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DemoFrame from '../DemoFrame';
import { sign, text } from './fonts';
import { B, type TgTheme } from './shared';
import Phone, { type PhoneHandle } from './Phone';
import Owner, { type LogItem } from './Owner';
import type { Mine } from './App';
import { BOOK, COPY, GUEST, MASTERS, SERVICES, STEPS, type StepId } from '@/content/concepts/barber';
import { addDays, dayShort, hhmm, seedDay, type Busy } from '@/lib/barber';
import { demoBySlug } from '@/content/concepts';

const META = demoBySlug('barber')!;

const svc = (id: string) => SERVICES.find((s) => s.id === id)!;
const mst = (id: string) => MASTERS.find((m) => m.id === id)!;
const clock = () => {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Демо «Бритва»: мини-приложение барбершопа в Telegram и расписание
 * салона рядом.
 *
 * Сайта вокруг нет: продаётся не витрина, а стык — клиент записался
 * в телефоне, и в ту же секунду запись встала в колонку мастера.
 * Поэтому запись живёт здесь, над обоими: телефон её создаёт, переносит
 * и отменяет, панель — показывает. Подписи слева загораются по шагу
 * и говорят, что за экраном стоит.
 *
 * Даты настоящие — от сегодняшнего дня, поэтому всё, что от них зависит,
 * считается после монтирования: на сервере дня браузера нет.
 */
export default function BarberDemo() {
  const [theme, setTheme] = useState<TgTheme>('dark');
  const [today, setToday] = useState<Date | null>(null);
  const [nowMin, setNowMin] = useState(0);
  const [mine, setMine] = useState<Mine | null>(null);
  const [ghost, setGhost] = useState<(Pick<Mine, 'master' | 'start' | 'service' | 'day'>) | null>(null);
  const [viewDay, setViewDay] = useState(0);
  const [stage, setStage] = useState<StepId>('open');
  const [log, setLog] = useState<LogItem[]>([]);
  const [flash, setFlash] = useState(0);
  const [tab, setTab] = useState<'client' | 'owner'>('client');
  const phone = useRef<PhoneHandle>(null);
  const logSeq = useRef(0);

  useEffect(() => {
    // тема Telegram у человека обычно та же, что в системе
    setTheme(matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const tick = () => {
      const d = new Date();
      setToday(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  // день выращивается из даты один раз: и приложение, и панель берут его отсюда
  const seeds = useMemo(() => {
    const cache = new Map<number, Busy[]>();
    return (day: number) => {
      if (!today) return [];
      if (!cache.has(day)) cache.set(day, seedDay(BOOK, addDays(today, day)));
      return cache.get(day)!;
    };
  }, [today]);

  const busyFor = useCallback(
    (day: number): Busy[] => {
      const b = seeds(day);
      if (!mine || mine.day !== day) return b;
      return [
        ...b,
        { id: 'mine', master: mine.master, start: mine.start, min: svc(mine.service).min, service: mine.service, client: GUEST.name }
      ];
    },
    [seeds, mine]
  );

  const addLog = (t: string) => setLog((l) => [{ id: ++logSeq.current, at: clock(), text: t }, ...l]);
  const brief = (m: Pick<Mine, 'service' | 'master' | 'day' | 'start'>) =>
    today ? `${svc(m.service).short.toLowerCase()} у ${mst(m.master).gen}, ${dayShort(addDays(today, m.day), m.day)}, ${hhmm(m.start)}` : '';

  const onBook = (m: Mine) => {
    setMine(m);
    setGhost(null);
    setViewDay(m.day);
    setFlash((f) => f + 1);
    addLog(COPY.owner.newBooking(GUEST.name, brief(m)));
  };

  const onMove = (day: number, start: number) => {
    if (!mine) return;
    const next = { ...mine, day, start, late: false };
    setMine(next);
    setViewDay(day);
    if (day !== mine.day) setFlash((f) => f + 1);
    addLog(COPY.owner.moved(GUEST.name, brief(next)));
  };

  const onCancel = (refund: boolean) => {
    if (!mine) return;
    setGhost({ master: mine.master, start: mine.start, service: mine.service, day: mine.day });
    setViewDay(mine.day);
    setMine(null);
    addLog(COPY.owner.cancelled(GUEST.name, refund));
  };

  const onLate = () => {
    if (!mine) return;
    setMine({ ...mine, late: true });
    setViewDay(mine.day);
    addLog(COPY.owner.late(GUEST.name));
  };

  const active = Math.max(0, STEPS.findIndex((s) => s.id === stage));
  const step = STEPS[active];

  const control = 'border px-2.5 py-[5px] transition-colors duration-300 hover:border-white/40 hover:text-white';
  const controls = (
    <>
      {mine && (
        <button type="button" onClick={() => phone.current?.remind()} className={control} style={{ borderColor: B.brass, color: B.brass }}>
          {COPY.demo.remind}
        </button>
      )}
      <button
        type="button"
        onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        className={`${control} hidden sm:block`}
        style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
        aria-label="Переключить тему Telegram в телефоне"
      >
        {theme === 'dark' ? COPY.demo.themeDark : COPY.demo.themeLight}
      </button>
    </>
  );

  return (
    <DemoFrame meta={META} controls={controls}>
      {/* фон демо: свой, до самого края, включая перелистывание за границу */}
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: B.bg }} />

      <div
        className={`${sign.variable} ${text.variable} min-h-screen`}
        style={{ background: B.bg, color: B.fg, fontFamily: 'var(--barber-text), system-ui, sans-serif' }}
      >
        <main id="content" className="mx-auto max-w-[1240px] px-4 pb-16 pt-7 sm:px-6 md:pt-9 xl:px-8">
          {/* ---------- заголовок сцены: короткий, чтобы сцена встала в экран целиком ---------- */}
          <header>
            <span className="block text-[11px] uppercase tracking-[0.2em]" style={{ color: B.brass }}>
              {COPY.page.kicker}
            </span>
            <h1
              className="m-0 mt-3 text-[clamp(28px,3.4vw,42px)] font-normal leading-[1.08]"
              style={{ fontFamily: 'var(--barber-sign), Georgia, serif' }}
            >
              {COPY.page.title} <br className="lg:hidden" />
              <span style={{ color: B.brass }}>{COPY.page.titleAccent}</span>
            </h1>
            <p className="m-0 mt-3 hidden max-w-[86ch] text-[15px] leading-relaxed md:block" style={{ color: B.dim }}>
              {COPY.page.lead}
            </p>
            <p className="m-0 mt-3 text-[14px] leading-relaxed md:hidden" style={{ color: B.dim }}>
              {COPY.page.leadPhone}
            </p>
          </header>

          {/* ---------- телефон: клиент и салон — вкладками ---------- */}
          <div className="mt-5 grid grid-cols-2 rounded-full border p-1 md:hidden" style={{ borderColor: B.line }} role="tablist">
            {(['client', 'owner'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className="rounded-full border-0 py-2 text-[14px] transition-colors duration-300"
                style={{ background: tab === t ? B.brass : 'transparent', color: tab === t ? B.brassInk : B.dim }}
              >
                {t === 'client' ? COPY.page.client : COPY.page.owner}
              </button>
            ))}
          </div>

          {/* текущий шаг — одной строкой там, где колонки подписей нет */}
          <p className="m-0 mt-4 text-[13.5px] leading-snug md:mt-8 xl:hidden" aria-live="polite">
            <span className="tabular-nums" style={{ color: B.brass }}>
              0{active + 1}
            </span>
            <span className="mx-2" style={{ color: B.faint }}>
              /
            </span>
            <span className="font-medium">{step.title}.</span>{' '}
            {/* на телефоне — только название шага: приложение не должно уезжать под сгиб */}
            <span className="hidden md:inline" style={{ color: B.dim }}>
              {step.text}
            </span>
          </p>

          <div className="mt-5 grid items-start gap-6 md:grid-cols-[352px_minmax(0,1fr)] md:gap-8 xl:mt-8 xl:grid-cols-[250px_352px_minmax(0,1fr)] xl:gap-10">
            {/* ---------- подписи к шагам ---------- */}
            <ol className="m-0 hidden list-none space-y-4 p-0 pt-1 xl:block">
              {STEPS.map((s, i) => (
                <li
                  key={s.id}
                  className="transition-opacity duration-500"
                  style={{ opacity: i === active ? 1 : 0.38 }}
                  aria-current={i === active ? 'step' : undefined}
                >
                  <span className="block text-[12px] tabular-nums" style={{ color: B.brass }}>
                    0{i + 1}
                  </span>
                  <span className="mt-1 block text-[15.5px] font-medium leading-snug">{s.title}</span>
                  <span className="mt-1 block text-[13px] leading-[1.5]" style={{ color: B.dim }}>
                    {s.text}
                  </span>
                </li>
              ))}
            </ol>

            <Phone
              ref={phone}
              className={tab === 'owner' ? 'hidden md:block' : ''}
              screenClass="h-[clamp(520px,calc(100svh-var(--demo-bar)-230px),720px)] md:h-[600px]"
              theme={theme}
              today={today ?? new Date(2026, 0, 1)}
              nowMin={nowMin}
              mine={mine}
              busyFor={busyFor}
              onBook={onBook}
              onMove={onMove}
              onCancel={onCancel}
              onLate={onLate}
              onStage={setStage}
              onViewDay={setViewDay}
            />

            {today ? (
              <Owner
                className={tab === 'client' ? 'hidden md:block' : ''}
                today={today}
                day={viewDay}
                busy={seeds(viewDay)}
                mine={mine && mine.day === viewDay ? mine : null}
                ghost={ghost && ghost.day === viewDay ? ghost : null}
                flash={flash}
                log={log}
                nowMin={nowMin}
              />
            ) : (
              <div className={`min-h-[650px] rounded-[18px] border ${tab === 'client' ? 'hidden md:block' : ''}`} style={{ background: B.raise, borderColor: B.line }} />
            )}
          </div>

          {/* ---------- из чего собрано ---------- */}
          <p className="m-0 mt-12 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]" style={{ color: B.faint }}>
            {COPY.page.stack.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </p>
        </main>
      </div>
    </DemoFrame>
  );
}
