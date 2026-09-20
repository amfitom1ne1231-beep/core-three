'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { BOT, CAFE, type BotStep } from '@/content/concepts/cafe';
import { TG, money } from './shared';
import type { Line } from './MiniApp';

/**
 * Переписка с ботом кофейни.
 *
 * Не запись и не видео: человек нажимает кнопки, бот отвечает, разговор
 * ветвится. Ровно такое дерево состояний мы и пишем настоящему боту —
 * из каждого шага есть выход, тупиков нет.
 *
 * Подпись под репликой («бронь легла в календарь смены») — главное, что
 * тут показывается. Гость видит переписку, владелец — что за ней стоит.
 *
 * Доступность: кнопки настоящие, лента `aria-live="polite"`, при
 * prefers-reduced-motion «печатает» пропускается и реплики приходят сразу.
 */

export type Receipt = { no: number; lines: Line[]; total: number; away: boolean };

type Msg =
  | { kind: 'bot'; text: string; note?: string }
  | { kind: 'me'; text: string }
  | { kind: 'receipt'; receipt: Receipt }
  | { kind: 'typing' };

export type ChatHandle = {
  /** Вернуть разговор к шагу, по пути показав чек из мини-приложения. */
  resume: (stepId: string, receipt?: Receipt) => void;
};

const TYPING_MS = 620;
const GAP_MS = 300;

const BotChat = forwardRef<ChatHandle, { onOpenApp: () => void }>(function BotChat({ onOpenApp }, ref) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStep] = useState<BotStep | null>(null);
  const [busy, setBusy] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const reduced = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const say = useCallback((id: string) => {
    const next = BOT.steps[id];
    if (!next) return;
    setBusy(true);
    setStep(null);

    let at = 0;
    next.bot.forEach((text, i) => {
      const last = i === next.bot.length - 1;
      if (!reduced.current) {
        timers.current.push(window.setTimeout(() => setMsgs((m) => [...m, { kind: 'typing' }]), at));
        at += TYPING_MS;
      }
      timers.current.push(
        window.setTimeout(() => {
          setMsgs((m) => [
            ...m.filter((x) => x.kind !== 'typing'),
            { kind: 'bot', text, note: last ? next.note : undefined }
          ]);
          if (last) {
            setStep(next);
            setBusy(false);
          }
        }, at)
      );
      at += GAP_MS;
    });
  }, []);

  useEffect(() => {
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    say(BOT.start);
    return clearTimers;
  }, [say]);

  // лента едет к последнему сообщению, но страницу за собой не тянет
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, step]);

  useImperativeHandle(ref, () => ({
    resume(stepId, receipt) {
      clearTimers();
      if (receipt) setMsgs((m) => [...m, { kind: 'receipt', receipt }]);
      timers.current.push(window.setTimeout(() => say(stepId), GAP_MS));
    }
  }));

  const choose = (o: { reply: string; next?: string; open?: 'app' }) => {
    if (busy) return;
    clearTimers();
    setMsgs((m) => [...m, { kind: 'me', text: o.reply }]);
    setStep(null);
    if (o.open === 'app') {
      timers.current.push(window.setTimeout(onOpenApp, 260));
      return;
    }
    if (o.next) timers.current.push(window.setTimeout(() => say(o.next!), GAP_MS));
  };

  return (
    <div className="flex h-full flex-col" style={{ background: TG.bg }}>
      {/* ---------- шапка чата ---------- */}
      <header
        className="flex shrink-0 items-center gap-2.5 border-b px-3 py-2"
        style={{ borderColor: TG.line, background: TG.head }}
      >
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-medium"
          style={{ background: TG.blue, color: TG.blueInk }}
        >
          С
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium" style={{ color: TG.fg }}>
            {CAFE.name}
          </span>
          <span className="block truncate text-[10.5px]" style={{ color: TG.faint }}>
            {BOT.handle}
          </span>
        </span>
      </header>

      {/* ---------- лента ---------- */}
      <div
        ref={feed}
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
        style={{
          // «обои» Telegram: мягкое пятно света, а не плоская заливка
          backgroundImage:
            'radial-gradient(120% 70% at 20% 0%, rgba(76,156,226,0.10), transparent 60%), radial-gradient(90% 60% at 90% 100%, rgba(79,174,108,0.07), transparent 60%)'
        }}
      >
        {/*
          Сообщения прижаты к низу, а не к верху. В Telegram пустая
          переписка начинается снизу и растёт вверх; лента, начинающаяся
          сверху, мгновенно выдаёт подделку.
        */}
        <ul className="m-0 flex min-h-full list-none flex-col justify-end gap-1.5 p-0">
          {msgs.map((m, i) => {
            if (m.kind === 'typing') {
              return (
                <li key={`t${i}`} className="max-w-[78%] self-start">
                  <span
                    className="flex items-center gap-1 rounded-[13px] rounded-bl-[4px] px-3 py-2.5"
                    style={{ background: TG.sheet }}
                  >
                    {[0, 1, 2].map((d) => (
                      <i
                        key={d}
                        className="block h-[5px] w-[5px] rounded-full motion-safe:animate-bounce"
                        style={{ background: TG.faint, animationDelay: `${d * 0.14}s`, animationDuration: '0.9s' }}
                      />
                    ))}
                  </span>
                </li>
              );
            }

            if (m.kind === 'me') {
              return (
                <li key={`m${i}`} className="max-w-[80%] self-end">
                  <span
                    className="block rounded-[13px] rounded-br-[4px] px-3 py-2 text-[13.5px] leading-snug"
                    style={{ background: TG.me, color: TG.fg }}
                  >
                    {m.text}
                  </span>
                </li>
              );
            }

            if (m.kind === 'receipt') {
              const r = m.receipt;
              return (
                <li key={`r${i}`} className="max-w-[86%] self-start">
                  <span
                    className="block rounded-[13px] rounded-bl-[4px] border p-3"
                    style={{ background: TG.sheet, borderColor: TG.line }}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] font-medium" style={{ color: TG.fg }}>
                        Заказ №{r.no}
                      </span>
                      <span className="text-[10.5px]" style={{ color: TG.green }}>
                        оплачен
                      </span>
                    </span>
                    <span className="mt-2 block border-t pt-2" style={{ borderColor: TG.line }}>
                      {r.lines.map((l) => (
                        <span key={l.key} className="flex gap-2 py-0.5 text-[11.5px]" style={{ color: TG.dim }}>
                          <span className="min-w-0 flex-1 truncate">
                            {l.name}
                            {l.qty > 1 && ` × ${l.qty}`}
                          </span>
                          <span className="shrink-0 tabular-nums">{money(l.unit * l.qty)}</span>
                        </span>
                      ))}
                    </span>
                    <span
                      className="mt-2 flex gap-2 border-t pt-2 text-[12.5px]"
                      style={{ borderColor: TG.line, color: TG.fg }}
                    >
                      <span className="flex-1">{r.away ? 'С собой' : 'В зале'}</span>
                      <span className="font-medium tabular-nums">{money(r.total)}</span>
                    </span>
                  </span>
                </li>
              );
            }

            return (
              <li key={`b${i}`} className="max-w-[86%] self-start">
                <span
                  className="block whitespace-pre-line rounded-[13px] rounded-bl-[4px] px-3 py-2 text-[13.5px] leading-snug"
                  style={{ background: TG.sheet, color: TG.fg }}
                >
                  {m.text}
                </span>
                {m.note && (
                  <span
                    className="mt-1 flex items-start gap-1.5 pl-1 text-[10.5px] leading-snug"
                    style={{ color: TG.faint }}
                  >
                    <span aria-hidden>↳</span>
                    {m.note}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ---------- кнопки ответа ---------- */}
      <div className="shrink-0 border-t p-2 lg:pb-4" style={{ borderColor: TG.line, background: TG.head }}>
        {step?.options?.length ? (
          <div className="flex flex-col gap-1.5">
            {step.options.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => choose(o)}
                className="flex items-center justify-center gap-2 rounded-[9px] border-0 px-3 py-2.5 text-[13px] font-medium"
                style={{ background: TG.raise, color: TG.blue }}
              >
                {o.open === 'app' && <span aria-hidden>▤</span>}
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="m-0 py-2.5 text-center text-[11.5px]" style={{ color: TG.faint }}>
            {busy ? 'бот печатает…' : 'разговор окончен'}
          </p>
        )}
      </div>
    </div>
  );
});

export default BotChat;
