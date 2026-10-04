'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { COPY, GUEST, MASTERS, SERVICES, SHOP, BOOK, type StepId } from '@/content/concepts/barber';
import {
  addDays,
  anyStarts,
  dayShort,
  dow,
  duration,
  freeStarts,
  hhmm,
  money,
  priceFor,
  type Busy
} from '@/lib/barber';
import { tg } from './shared';
import Razor from './Razor';

/**
 * Мини-приложение «Бритвы» внутри Telegram.
 *
 * Всё настоящее: окна считаются по расписанию салона, цена — по мастеру,
 * перенос не даёт встать поверх чужой записи. Хром — как у мини-приложений
 * в самом Telegram: «Закрыть» слева, «Назад» вместо него в глубине, одна
 * главная кнопка внизу, системные окна для номера телефона, оплаты
 * и подтверждений. Цвета — только из переменных темы Telegram.
 */

export type Mine = {
  id: 'mine';
  service: string;
  master: string;
  day: number;
  start: number;
  price: number;
  late?: boolean;
};

type Screen =
  | { name: 'home' }
  | { name: 'masters'; service: string }
  | { name: 'time'; service: string; master: string }
  | { name: 'confirm'; service: string; master: string; day: number; start: number }
  | { name: 'done' }
  | { name: 'mine' }
  | { name: 'move' };

export type Entry = 'home' | 'mine' | 'move';

const DAYS = 7;
const svc = (id: string) => SERVICES.find((s) => s.id === id)!;
const mst = (id: string) => MASTERS.find((m) => m.id === id)!;

/** Через сколько часов визит: от этого зависит, вернётся ли предоплата. */
export const hoursUntil = (m: Pick<Mine, 'day' | 'start'>, nowMin: number) => (m.day * 1440 + m.start - nowMin) / 60;

export function Avatar({ id, size = 36 }: { id: string; size?: number }) {
  const m = mst(id);
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(160deg, ${m.tone[0]}, ${m.tone[1]})`
      }}
    >
      {m.name[0]}
    </span>
  );
}

/** Заголовок группы — как в настройках Telegram: мелко, капителью, над карточкой. */
function Section({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="m-0 px-7 pb-1.5 pt-5 text-[12.5px] font-normal uppercase tracking-[0.02em]" style={{ color: tg('hint-color') }}>
      {children}
    </h3>
  );
}

export default function App({
  today,
  nowMin,
  mine,
  busyFor,
  entry,
  phoneShared,
  onSharePhone,
  onClose,
  onBooked,
  onMoved,
  onCancel,
  onStage,
  onViewDay
}: {
  today: Date;
  nowMin: number;
  mine: Mine | null;
  /** Занятость дня вместе со своей записью (id 'mine'). */
  busyFor: (day: number) => Busy[];
  entry: Entry;
  phoneShared: boolean;
  onSharePhone: () => void;
  onClose: () => void;
  onBooked: (m: Mine) => void;
  onMoved: (day: number, start: number) => void;
  onCancel: () => void;
  onStage: (s: StepId) => void;
  onViewDay: (day: number) => void;
}) {
  const [stack, setStack] = useState<Screen[]>(() =>
    entry === 'home' ? [{ name: 'home' }] : entry === 'mine' ? [{ name: 'home' }, { name: 'mine' }] : [{ name: 'home' }, { name: 'mine' }, { name: 'move' }]
  );
  const screen = stack[stack.length - 1];
  const [day, setDay] = useState<number | null>(null);
  const [pick, setPick] = useState<{ t: number; master: string } | null>(null);
  const [popup, setPopup] = useState<null | 'phone' | 'cancel' | 'already'>(null);
  const [pay, setPay] = useState<null | 'idle' | 'paying' | 'paid'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const push = (s: Screen) => setStack((st) => [...st, s]);
  const pop = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // каждый экран открывается сверху; выбор времени — заново
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
    setPick(null);
    setDay(null);
  }, [stack.length, screen.name]);

  /* ---------- окна ---------- */
  const notBefore = (d: number) => (d === 0 ? nowMin + 60 : 0);

  /** Окна дня для услуги: у мастера или у любого свободного. */
  const slotsFor = (d: number, serviceId: string, master: string, skip?: string) => {
    const busy = busyFor(d);
    const min = svc(serviceId).min;
    if (master === 'any') return [...anyStarts(BOOK, busy, min, notBefore(d), skip)].map(([t, m]) => ({ t, master: m }));
    return freeStarts(BOOK, busy, master, min, notBefore(d), skip).map((t) => ({ t, master }));
  };

  const nearest = (serviceId: string, master: string) => {
    for (let d = 0; d < DAYS; d++) {
      const s = slotsFor(d, serviceId, master);
      if (s.length) return { d, ...s[0] };
    }
    return null;
  };

  // экран времени: какие окна у выбранной пары услуга-мастер
  const timeCtx =
    screen.name === 'time'
      ? { service: screen.service, master: screen.master, skip: undefined }
      : screen.name === 'move' && mine
        ? { service: mine.service, master: mine.master, skip: 'mine' }
        : null;

  const perDay = useMemo(
    () =>
      timeCtx ? Array.from({ length: DAYS }, (_, d) => slotsFor(d, timeCtx.service, timeCtx.master, timeCtx.skip)) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересчёт по смыслу: экран, запись, «сейчас»
    [screen, mine, nowMin, today]
  );
  const firstDay = perDay.findIndex((s) => s.length > 0);
  const shownDay = day ?? (firstDay >= 0 ? firstDay : 0);

  /* ---------- шаг для подписей и день для панели салона ---------- */
  useEffect(() => {
    if (pay) return onStage('pay');
    const map: Record<Screen['name'], StepId> = {
      home: 'pick',
      masters: 'pick',
      time: 'pick',
      confirm: 'pay',
      done: 'done',
      mine: 'manage',
      move: 'manage'
    };
    onStage(map[screen.name]);
  }, [screen.name, pay, onStage]);

  useEffect(() => {
    if (screen.name === 'time' || screen.name === 'move') onViewDay(shownDay);
    else if (screen.name === 'confirm') onViewDay(screen.day);
    else if (mine && (screen.name === 'mine' || screen.name === 'done')) onViewDay(mine.day);
  }, [screen, shownDay, mine, onViewDay]);

  /* ---------- действия ---------- */
  const flash = (text: string) => {
    setToast(text);
    later(() => setToast(null), 1800);
  };

  const chooseService = (id: string) => {
    if (mine) return setPopup('already');
    push({ name: 'masters', service: id });
  };

  const startPay = () => {
    if (!phoneShared) return setPopup('phone');
    setPay('idle');
  };

  const confirmPay = () => {
    if (screen.name !== 'confirm') return;
    setPay('paying');
    const booked: Mine = {
      id: 'mine',
      service: screen.service,
      master: screen.master,
      day: screen.day,
      start: screen.start,
      price: priceFor(svc(screen.service), mst(screen.master))
    };
    later(() => {
      setPay('paid');
      onBooked(booked);
    }, 900);
    later(() => {
      setPay(null);
      setStack([{ name: 'home' }, { name: 'done' }]);
    }, 1600);
  };

  const moveTo = () => {
    if (!pick || !mine) return;
    onMoved(shownDay, pick.t);
    flash(COPY.app.moved);
    pop();
  };

  /* ---------- главная кнопка ---------- */
  const deposit = SHOP.deposit;
  const main: { label: string; onClick: () => void } | null =
    screen.name === 'time' && pick
      ? {
          label: `${COPY.app.next} · ${dayShort(addDays(today, shownDay), shownDay)}, ${hhmm(pick.t)}`,
          onClick: () =>
            push({ name: 'confirm', service: screen.service, master: pick.master, day: shownDay, start: pick.t })
        }
      : screen.name === 'confirm'
        ? { label: `${COPY.app.pay} ${money(deposit)}`, onClick: startPay }
        : screen.name === 'done'
          ? { label: COPY.app.finish, onClick: onClose }
          : screen.name === 'mine' && !mine
            ? { label: COPY.app.again, onClick: () => setStack([{ name: 'home' }]) }
            : screen.name === 'move' && pick
              ? { label: `${COPY.app.moveTo} ${dayShort(addDays(today, shownDay), shownDay)}, ${hhmm(pick.t)}`, onClick: moveTo }
              : null;

  const when = (m: Pick<Mine, 'day' | 'start'>) => `${dayShort(addDays(today, m.day), m.day)}, ${hhmm(m.start)}`;

  /* ---------- разметка ---------- */
  const row = 'flex w-full items-center gap-3 border-0 bg-transparent px-4 py-3 text-left';
  const group = 'mx-3 overflow-hidden rounded-[12px]';
  const sep = { borderTop: `1px solid ${tg('section-separator-color')}` };

  const timePicker = (
    <>
      {/* полоса дней: точка под днём — есть хоть одно окно */}
      <div className="grid grid-cols-7 gap-1 px-3 pb-1 pt-3" role="tablist" aria-label="День">
        {perDay.map((s, d) => {
          const date = addDays(today, d);
          const on = d === shownDay;
          const empty = s.length === 0;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={empty}
              onClick={() => {
                setDay(d);
                setPick(null);
              }}
              className="flex min-w-0 flex-col items-center gap-0.5 rounded-[10px] border-0 px-0 py-2 disabled:opacity-40"
              style={{
                background: on ? tg('button-color') : tg('section-bg-color'),
                color: on ? tg('button-text-color') : tg('text-color')
              }}
            >
              <span className="text-[11px]" style={{ opacity: on ? 0.85 : 0.6 }}>
                {d === 0 ? 'сег' : dow(date)}
              </span>
              <span className="text-[16px] font-medium tabular-nums">{date.getDate()}</span>
            </button>
          );
        })}
      </div>

      {perDay[shownDay]?.length ? (
        <div className="grid grid-cols-4 gap-1.5 px-3 pb-4 pt-2">
          {perDay[shownDay].map((s) => {
            const on = pick?.t === s.t;
            const any = timeCtx?.master === 'any';
            // при переносе своё же время стоит в сетке, но выбрать его нельзя
            const current = screen.name === 'move' && mine?.day === shownDay && mine.start === s.t;
            return (
              <button
                key={s.t}
                type="button"
                onClick={() => setPick(s)}
                disabled={current}
                aria-pressed={on}
                className="flex flex-col items-center rounded-[10px] border-0 px-1 py-2.5"
                style={{
                  background: on ? tg('button-color') : current ? 'transparent' : tg('section-bg-color'),
                  color: on ? tg('button-text-color') : current ? tg('hint-color') : tg('text-color'),
                  boxShadow: current ? `inset 0 0 0 1px ${tg('section-separator-color')}` : undefined
                }}
              >
                <span className="text-[14.5px] tabular-nums">{hhmm(s.t)}</span>
                {(any || current) && (
                  <span className="text-[10.5px]" style={{ opacity: 0.7 }}>
                    {current ? 'сейчас' : mst(s.master).name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="m-0 px-7 py-8 text-center text-[13.5px]" style={{ color: tg('hint-color') }}>
          {COPY.app.noSlots}
        </p>
      )}
    </>
  );

  return (
    <div className="relative flex h-full flex-col" style={{ background: tg('secondary-bg-color'), color: tg('text-color') }}>
      {/* ---------- шапка Telegram: «Закрыть» или «Назад», имя, меню ---------- */}
      <header
        className="relative z-20 flex h-[46px] shrink-0 items-center px-2"
        style={{ background: tg('header-bg-color'), borderBottom: `1px solid ${tg('section-separator-color')}` }}
      >
        <button
          type="button"
          onClick={stack.length > 1 && screen.name !== 'done' ? pop : onClose}
          className="flex h-9 min-w-[76px] items-center gap-0.5 border-0 bg-transparent px-2 text-[15px]"
          style={{ color: tg('link-color') }}
        >
          {stack.length > 1 && screen.name !== 'done' ? (
            <>
              <span aria-hidden className="-mt-0.5 text-[22px] leading-none">
                ‹
              </span>
              {COPY.app.back}
            </>
          ) : (
            COPY.app.close
          )}
        </button>
        <span className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <span className="text-[15px] font-semibold">{COPY.app.title}</span>
          <span className="text-[11.5px]" style={{ color: tg('hint-color') }}>
            {COPY.app.sub}
          </span>
        </span>
        <span aria-hidden className="flex min-w-[76px] justify-end px-3 text-[18px] tracking-[1px]" style={{ color: tg('link-color') }}>
          ⋯
        </span>
      </header>

      {/* ---------- экраны ---------- */}
      <div ref={scroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        {screen.name === 'home' && (
          <>
            {/* обложка — единственное место в фирменных цветах салона */}
            <div
              className="relative mx-3 mt-3 overflow-hidden rounded-[14px] px-4 pb-4 pt-3"
              style={{ background: 'linear-gradient(150deg, #24211d, #121110)', color: '#efe9e0' }}
            >
              <Razor className="absolute -right-4 top-2 w-[62%] opacity-90" />
              <span
                className="relative block pt-14 text-[30px] leading-none"
                style={{ fontFamily: 'var(--barber-sign), Georgia, serif' }}
              >
                {SHOP.name}
              </span>
              <span className="relative mt-1.5 block text-[12px]" style={{ color: '#b3aa9d' }}>
                {SHOP.kind} · {SHOP.address} · {hhmm(SHOP.open)}–{hhmm(SHOP.close)}
              </span>
            </div>

            {mine && (
              <>
                <Section>{COPY.app.yourVisit}</Section>
                <div className={group} style={{ background: tg('section-bg-color') }}>
                  <button type="button" className={row} onClick={() => push({ name: 'mine' })} style={{ color: tg('text-color') }}>
                    <Avatar id={mine.master} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium">{when(mine)}</span>
                      <span className="block truncate text-[13px]" style={{ color: tg('hint-color') }}>
                        {svc(mine.service).name} · {mst(mine.master).name}
                      </span>
                    </span>
                    <span aria-hidden style={{ color: tg('hint-color') }}>
                      ›
                    </span>
                  </button>
                </div>
              </>
            )}

            <Section>{COPY.app.services}</Section>
            <div className={group} style={{ background: tg('section-bg-color') }}>
              {SERVICES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={row}
                  onClick={() => chooseService(s.id)}
                  style={{ color: tg('text-color'), ...(i ? sep : {}) }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">{s.name}</span>
                    <span className="block text-[12.5px]" style={{ color: tg('hint-color') }}>
                      {duration(s.min)} · {s.note}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13.5px] tabular-nums" style={{ color: tg('hint-color') }}>
                    от {money(s.price)}
                  </span>
                </button>
              ))}
            </div>

            <div className={`${group} mt-4`} style={{ background: tg('section-bg-color') }}>
              <button type="button" className={row} onClick={() => push({ name: 'mine' })} style={{ color: tg('link-color') }}>
                <span className="flex-1 text-[15px]">{COPY.app.mine}</span>
                <span aria-hidden style={{ color: tg('hint-color') }}>
                  ›
                </span>
              </button>
            </div>
          </>
        )}

        {screen.name === 'masters' && (
          <>
            <Section>
              {svc(screen.service).name} · {duration(svc(screen.service).min)}
            </Section>
            <div className={group} style={{ background: tg('section-bg-color') }}>
              {[{ id: 'any' }, ...MASTERS].map((m, i) => {
                const near = nearest(screen.service, m.id);
                const any = m.id === 'any';
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={row}
                    disabled={!near}
                    onClick={() => push({ name: 'time', service: screen.service, master: m.id })}
                    style={{ color: tg('text-color'), ...(i ? sep : {}) }}
                  >
                    {any ? (
                      // «любой» — три мастера стопкой: выбор за салоном, а не пустой кружок
                      <span aria-hidden className="relative h-9 w-9 shrink-0">
                        {MASTERS.map((x, xi) => (
                          <span key={x.id} className="absolute rounded-full" style={{ left: xi * 6, top: xi * 6 - 2, boxShadow: `0 0 0 1.5px ${tg('section-bg-color')}` }}>
                            <Avatar id={x.id} size={22} />
                          </span>
                        ))}
                      </span>
                    ) : (
                      <Avatar id={m.id} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-[15px]">{any ? COPY.app.anyMaster : mst(m.id).name}</span>
                        <span className="shrink-0 text-[14px] tabular-nums">
                          {any ? `от ${money(svc(screen.service).price)}` : money(priceFor(svc(screen.service), mst(m.id)))}
                        </span>
                      </span>
                      <span className="block text-[12.5px]" style={{ color: tg('hint-color') }}>
                        {any
                          ? COPY.app.anyNote
                          : `${mst(m.id).role} · стаж ${mst(m.id).years} ${mst(m.id).years < 5 ? 'года' : 'лет'}`}
                      </span>
                      {near && (
                        <span className="mt-0.5 block text-[12.5px]" style={{ color: tg('accent-text-color') }}>
                          {COPY.app.nearest}: {dayShort(addDays(today, near.d), near.d)}, {hhmm(near.t)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {screen.name === 'time' && (
          <>
            <Section>
              {svc(screen.service).name} · {screen.master === 'any' ? COPY.app.anyMaster : mst(screen.master).name}
            </Section>
            {timePicker}
          </>
        )}

        {screen.name === 'move' && mine && (
          <>
            <Section>
              {COPY.app.move}: {svc(mine.service).name} · {mst(mine.master).name}
            </Section>
            <p className="m-0 px-7 text-[13px]" style={{ color: tg('hint-color') }}>
              Сейчас: {when(mine)}
            </p>
            {timePicker}
          </>
        )}

        {screen.name === 'confirm' && (
          <>
            <Section>{COPY.app.confirm}</Section>
            <div className={group} style={{ background: tg('section-bg-color') }}>
              <div className={row}>
                <Avatar id={screen.master} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium">{when(screen)}</span>
                  <span className="block text-[13px]" style={{ color: tg('hint-color') }}>
                    {svc(screen.service).name} · {duration(svc(screen.service).min)}
                  </span>
                  <span className="block text-[13px]" style={{ color: tg('hint-color') }}>
                    {mst(screen.master).name}, {mst(screen.master).role.toLowerCase()}
                  </span>
                </span>
              </div>
            </div>

            <div className={`${group} mt-3`} style={{ background: tg('section-bg-color') }}>
              {(() => {
                const price = priceFor(svc(screen.service), mst(screen.master));
                const lines: [string, string, boolean?][] = [
                  [COPY.app.total, money(price)],
                  [COPY.app.depositNow, money(deposit), true],
                  [COPY.app.rest, money(price - deposit)]
                ];
                return lines.map(([k, v, strong], i) => (
                  <div key={k} className="flex items-baseline justify-between px-4 py-2.5 text-[14.5px]" style={i ? sep : {}}>
                    <span style={{ color: strong ? tg('text-color') : tg('hint-color') }}>{k}</span>
                    <span className="tabular-nums" style={{ fontWeight: strong ? 600 : 400 }}>
                      {v}
                    </span>
                  </div>
                ));
              })()}
            </div>

            <Section>{COPY.app.contact}</Section>
            <div className={group} style={{ background: tg('section-bg-color') }}>
              {phoneShared ? (
                <div className={row}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">
                      {GUEST.name} · <span className="tabular-nums">{GUEST.phone}</span>
                    </span>
                    <span className="block text-[12.5px]" style={{ color: tg('hint-color') }}>
                      {COPY.app.shared}
                    </span>
                  </span>
                </div>
              ) : (
                <button type="button" className={row} onClick={() => setPopup('phone')} style={{ color: tg('link-color') }}>
                  <span className="flex-1 text-[15px]">{COPY.app.share}</span>
                </button>
              )}
            </div>
            <p className="m-0 px-7 pt-2.5 text-[12.5px] leading-snug" style={{ color: tg('hint-color') }}>
              {COPY.app.policy}
            </p>
          </>
        )}

        {screen.name === 'done' && mine && (
          <div className="flex flex-col items-center px-6 pt-10 text-center">
            <span
              className="flex h-[68px] w-[68px] items-center justify-center rounded-full motion-safe:animate-[pop_0.5s_cubic-bezier(0.22,1.4,0.36,1)]"
              style={{ background: tg('button-color'), color: tg('button-text-color') }}
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <h2 className="m-0 mt-5 text-[22px] font-semibold">{COPY.app.done}</h2>
            <p className="m-0 mt-2 text-[15px]">
              {when(mine)} · {mst(mine.master).name}
            </p>
            <p className="m-0 mt-0.5 text-[13.5px]" style={{ color: tg('hint-color') }}>
              {svc(mine.service).name}, {SHOP.address}
            </p>
            <p className="m-0 mt-6 max-w-[30ch] text-[13.5px] leading-snug" style={{ color: tg('hint-color') }}>
              {COPY.app.doneNote}
            </p>
          </div>
        )}

        {screen.name === 'mine' && (
          <>
            <Section>{COPY.app.upcoming}</Section>
            {mine ? (
              <div className={group} style={{ background: tg('section-bg-color') }}>
                <div className={row}>
                  <Avatar id={mine.master} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-medium">{when(mine)}</span>
                    <span className="block text-[13px]" style={{ color: tg('hint-color') }}>
                      {svc(mine.service).name} · {mst(mine.master).name}
                    </span>
                    <span className="block text-[13px]" style={{ color: tg('hint-color') }}>
                      Предоплата {money(deposit)} внесена, в салоне {money(mine.price - deposit)}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-2" style={sep}>
                  <button
                    type="button"
                    onClick={() => push({ name: 'move' })}
                    className="border-0 bg-transparent py-3 text-[15px]"
                    style={{ color: tg('link-color') }}
                  >
                    {COPY.app.move}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPopup('cancel')}
                    className="border-0 bg-transparent py-3 text-[15px]"
                    style={{ color: tg('destructive-text-color'), borderLeft: `1px solid ${tg('section-separator-color')}` }}
                  >
                    {COPY.app.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <p className="m-0 px-7 py-3 text-[14px]" style={{ color: tg('hint-color') }}>
                {COPY.app.none}
              </p>
            )}

            <Section>Бонусы</Section>
            <div className={`${group} px-4 py-3.5`} style={{ background: tg('section-bg-color') }}>
              {/* отметка за каждый визит; будущий — пунктиром, пока не состоялся */}
              <div className="flex gap-2" aria-hidden>
                {Array.from({ length: SHOP.stampEvery }, (_, i) => {
                  const done = i < GUEST.history.length;
                  const next = i === GUEST.history.length && !!mine;
                  return (
                    <span
                      key={i}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] tabular-nums"
                      style={{
                        background: done ? tg('button-color') : 'transparent',
                        color: done ? tg('button-text-color') : tg('hint-color'),
                        border: done ? 'none' : `1.5px ${next ? 'dashed' : 'solid'} ${next ? tg('button-color') : tg('section-separator-color')}`
                      }}
                    >
                      {i === SHOP.stampEvery - 1 ? '0 ₽' : i + 1}
                    </span>
                  );
                })}
              </div>
              <p className="m-0 mt-2.5 text-[13px]" style={{ color: tg('hint-color') }}>
                {COPY.app.stamps}. {GUEST.history.length} из {SHOP.stampEvery}
                {mine ? ', после ближайшего визита — ' + (GUEST.history.length + 1) : ''}.
              </p>
            </div>

            <Section>{COPY.app.history}</Section>
            <div className={group} style={{ background: tg('section-bg-color') }}>
              {GUEST.history.map((h, i) => (
                <div key={h.date} className="flex items-baseline gap-3 px-4 py-2.5" style={i ? sep : {}}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px]">{h.service}</span>
                    <span className="block text-[12.5px]" style={{ color: tg('hint-color') }}>
                      {h.date} · {h.master}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13.5px] tabular-nums" style={{ color: tg('hint-color') }}>
                    {money(h.price)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ---------- MainButton: одна, внизу, подписана тем, что будет ---------- */}
      {main && (
        <div className="relative z-10 shrink-0 px-3 pb-3 pt-2 md:pb-5" style={{ background: tg('secondary-bg-color') }}>
          <button
            type="button"
            onClick={main.onClick}
            className="w-full truncate rounded-[12px] border-0 px-4 py-3.5 text-[15px] font-semibold"
            style={{ background: tg('button-color'), color: tg('button-text-color') }}
          >
            {main.label}
          </button>
        </div>
      )}

      {/* ---------- всплывающее «готово» ---------- */}
      {toast && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-6 top-[58px] z-30 rounded-[12px] px-4 py-2.5 text-center text-[13.5px] motion-safe:animate-[sheet_0.3s_cubic-bezier(0.22,1,0.36,1)]"
          style={{ background: 'rgba(0,0,0,0.78)', color: '#fff' }}
        >
          {toast}
        </div>
      )}

      {/* ---------- системные окна Telegram ---------- */}
      {popup && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 px-8 motion-safe:animate-[fade_0.2s_ease]">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tg-popup-title"
            className="w-full max-w-[270px] overflow-hidden rounded-[14px] text-center"
            style={{ background: tg('bg-color') }}
          >
            {(() => {
              const late = mine ? hoursUntil(mine, nowMin) < SHOP.freeCancelHours : false;
              const p =
                popup === 'phone'
                  ? { title: COPY.phonePopup.title, text: COPY.phonePopup.text, ok: COPY.phonePopup.ok, no: COPY.phonePopup.no, danger: false }
                  : popup === 'cancel'
                    ? {
                        title: COPY.cancelPopup.title,
                        text: late ? COPY.cancelPopup.textLate : COPY.cancelPopup.textFree,
                        ok: COPY.cancelPopup.ok,
                        no: COPY.cancelPopup.no,
                        danger: true
                      }
                    : {
                        title: COPY.app.already,
                        text: COPY.app.alreadyText(mine ? when(mine) : ''),
                        ok: COPY.app.move,
                        no: COPY.cancelPopup.no,
                        danger: false
                      };
              const ok = () => {
                setPopup(null);
                if (popup === 'phone') {
                  onSharePhone();
                  if (screen.name === 'confirm') setPay('idle');
                } else if (popup === 'cancel') {
                  onCancel();
                } else {
                  setStack([{ name: 'home' }, { name: 'mine' }, { name: 'move' }]);
                }
              };
              return (
                <>
                  <div className="px-4 pb-3.5 pt-4">
                    <p id="tg-popup-title" className="m-0 text-[16px] font-semibold">
                      {p.title}
                    </p>
                    <p className="m-0 mt-1 text-[13px] leading-snug">{p.text}</p>
                  </div>
                  <div className="grid grid-cols-2" style={sep}>
                    <button
                      type="button"
                      onClick={() => setPopup(null)}
                      className="border-0 bg-transparent py-2.5 text-[15.5px]"
                      style={{ color: tg('link-color') }}
                    >
                      {p.no}
                    </button>
                    <button
                      type="button"
                      onClick={ok}
                      className="border-0 bg-transparent py-2.5 text-[15.5px] font-semibold"
                      style={{
                        color: p.danger ? tg('destructive-text-color') : tg('link-color'),
                        borderLeft: `1px solid ${tg('section-separator-color')}`
                      }}
                    >
                      {p.ok}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ---------- окно оплаты Telegram ---------- */}
      {pay && screen.name === 'confirm' && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/45 motion-safe:animate-[fade_0.2s_ease]">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={COPY.pay.title}
            className="rounded-t-[16px] px-4 pb-5 pt-3 motion-safe:animate-[sheet_0.32s_cubic-bezier(0.22,1,0.36,1)] md:pb-7"
            style={{ background: tg('bg-color') }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-semibold">{COPY.pay.title}</span>
              {pay === 'idle' && (
                <button
                  type="button"
                  onClick={() => setPay(null)}
                  aria-label="Закрыть оплату"
                  className="h-8 w-8 border-0 bg-transparent text-[15px]"
                  style={{ color: tg('hint-color') }}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[18px]"
                style={{ background: '#1b1a18', color: '#c9a46a', fontFamily: 'var(--barber-sign), Georgia, serif' }}
              >
                Б
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px]">{COPY.pay.item}</span>
                <span className="block truncate text-[12.5px]" style={{ color: tg('hint-color') }}>
                  {SHOP.name} · {svc(screen.service).name} · {when(screen)}
                </span>
              </span>
              <span className="text-[17px] font-semibold tabular-nums">{money(deposit)}</span>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-[12px] px-3.5 py-3" style={{ background: tg('secondary-bg-color') }}>
              <span className="text-[13px]" style={{ color: tg('hint-color') }}>
                {COPY.pay.method}
              </span>
              <span className="text-[14px] tabular-nums">
                {COPY.pay.card} {GUEST.card}
              </span>
            </div>
            <p className="m-0 mt-2.5 text-[12px] leading-snug" style={{ color: tg('hint-color') }}>
              {COPY.pay.safe}
            </p>

            <button
              type="button"
              onClick={pay === 'idle' ? confirmPay : undefined}
              aria-busy={pay === 'paying'}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] border-0 px-4 py-3.5 text-[15px] font-semibold"
              style={{ background: tg('button-color'), color: tg('button-text-color') }}
            >
              {pay === 'idle' && `${COPY.pay.button} ${money(deposit)}`}
              {pay === 'paying' && (
                <span aria-label="Платёж проходит" className="h-[18px] w-[18px] rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
              )}
              {pay === 'paid' && (
                <>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {COPY.pay.paid}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
