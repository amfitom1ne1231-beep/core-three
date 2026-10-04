'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { COPY, MASTERS, SERVICES, SHOP, type StepId } from '@/content/concepts/barber';
import { addDays, dayLong, hhmm, money, type Busy } from '@/lib/barber';
import PhoneFrame from '../PhoneFrame';
import App, { hoursUntil, type Entry, type Mine } from './App';
import Chat, { type Act, type Msg } from './Chat';
import { B, SYSTEM, themeVars, tg, type TgTheme } from './shared';

/**
 * Телефон с Telegram: переписка с ботом и мини-приложение поверх неё.
 *
 * Здесь сходятся оба конца: что клиент сделал в приложении, бот
 * подтверждает в чате, а что нажал под сообщением бота — открывает
 * приложение на нужном экране. Сама запись живёт выше, в демо целиком:
 * её же показывает панель салона.
 */

export type PhoneHandle = { remind: () => void };

const TYPING_MS = 650;
const clock = () => {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const Phone = forwardRef<
  PhoneHandle,
  {
    theme: TgTheme;
    today: Date;
    nowMin: number;
    mine: Mine | null;
    busyFor: (day: number) => Busy[];
    onBook: (m: Mine) => void;
    onMove: (day: number, start: number) => void;
    onCancel: (refund: boolean) => void;
    onLate: () => void;
    onStage: (s: StepId) => void;
    onViewDay: (day: number) => void;
    screenClass: string;
    className?: string;
  }
>(function Phone(
  { theme, today, nowMin, mine, busyFor, onBook, onMove, onCancel, onLate, onStage, onViewDay, screenClass, className },
  ref
) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [app, setApp] = useState<Entry | null>(null);
  const [phoneShared, setPhoneShared] = useState(false);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);
  const reduced = useRef(false);
  // замыкания бота читают запись отсюда: между нажатием и ответом она могла измениться
  const mineRef = useRef(mine);
  mineRef.current = mine;

  useEffect(() => {
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  /** Бот пишет: «печатает…» в шапке, потом сообщение. */
  const say = useCallback((text: string, keys?: Msg['keys'], delay = 0) => {
    const post = () => {
      setTyping(false);
      setMsgs((m) => [...m, { id: ++seq.current, text, at: clock(), keys }]);
    };
    if (reduced.current) return post();
    timers.current.push(window.setTimeout(() => setTyping(true), delay));
    timers.current.push(window.setTimeout(post, delay + TYPING_MS));
  }, []);

  // приветствие: первое, что видно, — бот и кнопка записи
  useEffect(() => {
    setMsgs([
      { id: ++seq.current, text: COPY.chat.hello[0], at: clock() },
      { id: ++seq.current, text: COPY.chat.hello[1], at: clock(), keys: [[{ label: COPY.chat.open, act: 'open' }]] }
    ]);
  }, []);

  const what = (m: Pick<Mine, 'service' | 'master' | 'day' | 'start'>) => {
    const s = SERVICES.find((x) => x.id === m.service)!;
    const master = MASTERS.find((x) => x.id === m.master)!;
    return `${s.name.toLowerCase()} у ${master.gen}, ${dayLong(addDays(today, m.day))}, ${hhmm(m.start)}`;
  };

  const manageKeys: Msg['keys'] = [
    [
      { label: COPY.bot.buttons.move, act: 'move' },
      { label: COPY.bot.buttons.cancel, act: 'cancel' }
    ],
    [{ label: COPY.bot.buttons.route, act: 'route' }]
  ];

  const open = (entry: Entry) => setApp(entry);
  const close = () => {
    setApp(null);
    onStage(mineRef.current ? 'done' : 'open');
  };

  const cancel = () => {
    const m = mineRef.current;
    if (!m) return;
    const refund = hoursUntil(m, nowMin) >= SHOP.freeCancelHours;
    onCancel(refund);
    say(refund ? COPY.bot.cancelledRefund : COPY.bot.cancelled, [[{ label: COPY.chat.open, act: 'open' }]], 300);
  };

  const onKey = (act: Act) => {
    const m = mineRef.current;
    if (act === 'open') return open('home');
    if (act === 'route') return say(COPY.bot.route);
    if (!m) return say(COPY.app.none, [[{ label: COPY.chat.open, act: 'open' }]]);
    if (act === 'move') return open('move');
    if (act === 'cancel') {
      const late = hoursUntil(m, nowMin) < SHOP.freeCancelHours;
      return say(late ? COPY.bot.askCancelLate : COPY.bot.askCancel, [
        [
          { label: COPY.bot.buttons.yes, act: 'yes' },
          { label: COPY.bot.buttons.no, act: 'no' }
        ]
      ]);
    }
    if (act === 'yes') return cancel();
    if (act === 'no') return say(COPY.bot.kept);
    if (act === 'late') {
      onLate();
      return say(COPY.bot.late);
    }
  };

  useImperativeHandle(ref, () => ({
    remind: () => {
      const m = mineRef.current;
      if (!m) return;
      say(COPY.bot.remind(what(m)), [
        [{ label: COPY.bot.buttons.late, act: 'late' }],
        [{ label: COPY.bot.buttons.route, act: 'route' }]
      ]);
    }
  }));

  return (
    <PhoneFrame
      className={className}
      style={themeVars(theme)}
      bar={{ bg: tg('header-bg-color'), fg: tg('text-color') }}
      edge={B.lineStrong}
      from="md"
      frameClass="md:shadow-[0_50px_90px_-30px_rgba(0,0,0,0.85)]"
      screenClass={screenClass}
    >
      <div className="absolute inset-0" style={{ fontFamily: SYSTEM }}>
        {/* чат остаётся смонтированным под приложением: переписка не начинается заново */}
        <div className="absolute inset-0" style={{ visibility: app ? 'hidden' : 'visible' }} aria-hidden={!!app}>
          <Chat msgs={msgs} typing={typing} onKey={onKey} onMenu={() => open('home')} />
        </div>

        {app && (
          <div className="absolute inset-0 z-10 motion-safe:animate-[sheet_0.32s_cubic-bezier(0.22,1,0.36,1)]">
            <App
              key={app}
              today={today}
              nowMin={nowMin}
              mine={mine}
              busyFor={busyFor}
              entry={app}
              phoneShared={phoneShared}
              onSharePhone={() => setPhoneShared(true)}
              onClose={close}
              onBooked={(m) => {
                onBook(m);
                const rest = money(m.price - SHOP.deposit);
                say(COPY.bot.booked(what(m), rest), manageKeys, 400);
              }}
              onMoved={(day, start) => {
                const m = mineRef.current;
                onMove(day, start);
                if (m) say(COPY.bot.moved(what({ ...m, day, start })), manageKeys, 400);
              }}
              onCancel={cancel}
              onStage={onStage}
              onViewDay={onViewDay}
            />
          </div>
        )}
      </div>
    </PhoneFrame>
  );
});

export default Phone;
