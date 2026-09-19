'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TG_DEMO, type TgStep } from '@/content/tg-demo';

/**
 * Эмулятор Telegram-чата.
 *
 * В отличие от вставки в атласе, которая играет сама, здесь нажимает
 * человек: бот отвечает на выбор и разговор ветвится. Никакого бэкенда,
 * сценарий целиком в `content/tg-demo.ts` — ровно такое же дерево
 * состояний мы пишем для настоящего бота.
 *
 * Доступность: кнопки настоящие, лента сообщений — `aria-live="polite"`,
 * чтобы читалка проговаривала ответ бота; при `prefers-reduced-motion`
 * «печатает» не показывается и реплики приходят сразу.
 */

type Msg =
  | { kind: 'bot'; text: string; note?: string }
  | { kind: 'me'; text: string }
  | { kind: 'typing' };

const TYPING_MS = 700;
const GAP_MS = 320;

export default function TelegramDemo() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStep] = useState<TgStep | null>(null);
  const [busy, setBusy] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const reduced = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  /** Реплики бота приходят по очереди, между ними — «печатает». */
  const say = useCallback((id: string) => {
    const next = TG_DEMO.steps[id];
    if (!next) return;
    setBusy(true);
    setStep(null);

    let at = 0;
    next.bot.forEach((text, i) => {
      const last = i === next.bot.length - 1;
      if (!reduced.current) {
        timers.current.push(
          window.setTimeout(() => setMsgs((m) => [...m, { kind: 'typing' }]), at)
        );
        at += TYPING_MS;
      }
      timers.current.push(
        window.setTimeout(() => {
          setMsgs((m) => [
            // «печатает» заменяется самой репликой
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

  const start = useCallback(() => {
    clearTimers();
    setMsgs([]);
    setStep(null);
    say(TG_DEMO.start);
  }, [say]);

  useEffect(() => {
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    start();
    return clearTimers;
  }, [start]);

  // лента прокручивается к последнему сообщению, но не тянет за собой страницу
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const choose = (o: { reply: string; next: string }) => {
    if (busy) return;
    clearTimers();
    setMsgs((m) => [...m, { kind: 'me', text: o.reply }]);
    setStep(null);
    timers.current.push(window.setTimeout(() => say(o.next), GAP_MS));
  };

  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[14px] border border-line bg-[#0e1621]">
      {/* шапка чата */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#17212b] px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#6aa8de] font-mono text-[13px] text-[#0e1621]">
          К
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-[#e9eef3]">{TG_DEMO.chat.name}</span>
          <span className="block truncate text-[11px] text-[#6c7883]">{TG_DEMO.chat.handle}</span>
        </span>
      </div>

      {/* лента */}
      <div
        ref={feed}
        aria-live="polite"
        className="flex h-[clamp(300px,42vh,420px)] flex-col gap-2 overflow-y-auto px-3 py-4"
      >
        {msgs.map((m, i) =>
          m.kind === 'typing' ? (
            <span
              key="typing"
              className="flex w-fit gap-1 rounded-2xl rounded-bl-md bg-[#22303c] px-4 py-3"
              aria-label="Бот печатает"
            >
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-[#6c7883] motion-safe:animate-[ct-blink_1.2s_ease-in-out_infinite]"
                  style={{ animationDelay: `${d * 0.16}s` }}
                />
              ))}
            </span>
          ) : m.kind === 'me' ? (
            <span
              key={i}
              className="w-fit max-w-[82%] self-end whitespace-pre-line rounded-2xl rounded-br-md bg-[#6aa8de] px-3.5 py-2 text-[13.5px] leading-snug text-[#0e1621]"
            >
              {m.text}
            </span>
          ) : (
            <span key={i} className="w-fit max-w-[88%]">
              <span className="block whitespace-pre-line rounded-2xl rounded-bl-md bg-[#22303c] px-3.5 py-2 text-[13.5px] leading-snug text-[#e9eef3]">
                {m.text}
              </span>
              {/* что в этот момент произошло на стороне бизнеса — этого
                  в настоящем чате не видно, но продаёт именно оно */}
              {m.note && (
                <span className="mt-1.5 flex items-center gap-2 pl-1 font-mono text-[9px] uppercase tracking-rail text-[#6aa8de]">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[#6aa8de]" aria-hidden />
                  {m.note}
                </span>
              )}
            </span>
          )
        )}
      </div>

      {/* кнопки ответа */}
      <div className="flex flex-wrap gap-2 border-t border-white/10 bg-[#17212b] p-3">
        {step?.options?.length ? (
          step.options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => choose(o)}
              className="rounded-full border border-[#6aa8de]/45 px-3.5 py-2 text-[12.5px] text-[#6aa8de] transition-colors duration-200 hover:bg-[#6aa8de]/12 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#6aa8de]"
            >
              {o.label}
            </button>
          ))
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="rounded-full border border-[#6c7883]/50 px-3.5 py-2 text-[12.5px] text-[#9fb0c0] transition-colors duration-200 hover:text-[#e9eef3] disabled:opacity-40 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#6aa8de]"
          >
            {TG_DEMO.restart}
          </button>
        )}
      </div>
    </div>
  );
}
