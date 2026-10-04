'use client';

import { useEffect, useRef } from 'react';
import { COPY, SHOP } from '@/content/concepts/barber';
import { tg } from './shared';

/**
 * Переписка с ботом «Бритвы».
 *
 * Бот здесь — не собеседник, а почтальон: открывает мини-приложение,
 * приносит подтверждение, напоминание и ответы на кнопки под своими
 * сообщениями. Кнопки — inline-клавиатура, как у настоящего бота: нажатие
 * не пишет в чат от имени человека, бот просто отвечает.
 *
 * «Печатает…» стоит в шапке, как в самом Telegram, а не точками в ленте.
 */

export type Act = 'open' | 'move' | 'cancel' | 'yes' | 'no' | 'route' | 'late';
export type Key = { label: string; act: Act };
export type Msg = { id: number; text: string; at: string; keys?: Key[][] };

export default function Chat({
  msgs,
  typing,
  onKey,
  onMenu
}: {
  msgs: Msg[];
  typing: boolean;
  onKey: (act: Act) => void;
  onMenu: () => void;
}) {
  const feed = useRef<HTMLDivElement>(null);

  // лента всегда у последнего сообщения: так переписка и читается
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--chat-bg)', color: tg('text-color') }}>
      {/* ---------- шапка чата ---------- */}
      <header
        className="flex h-[52px] shrink-0 items-center gap-2.5 px-2"
        style={{ background: tg('header-bg-color'), borderBottom: `1px solid ${tg('section-separator-color')}` }}
      >
        <span aria-hidden className="px-1.5 text-[24px] leading-none" style={{ color: tg('link-color') }}>
          ‹
        </span>
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px]"
          style={{ background: '#1b1a18', color: '#c9a46a', fontFamily: 'var(--barber-sign), Georgia, serif' }}
        >
          Б
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[15px] font-semibold">{SHOP.name}</span>
          <span className="block text-[12.5px]" style={{ color: typing ? tg('link-color') : tg('hint-color') }} aria-live="polite">
            {typing ? 'печатает…' : COPY.chat.status}
          </span>
        </span>
      </header>

      {/* ---------- лента: пустая переписка растёт снизу вверх ---------- */}
      <div ref={feed} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-2">
        <div className="flex min-h-full flex-col justify-end gap-1.5" role="log" aria-live="polite" aria-label="Переписка с ботом">
          <span
            className="mx-auto my-2 rounded-full px-2.5 py-0.5 text-[12px] text-white"
            style={{ background: 'var(--chat-chip)' }}
          >
            Сегодня
          </span>

          {msgs.map((m) => (
            <div key={m.id} className="max-w-[86%] motion-safe:animate-[feedin_0.25s_ease-out]">
              <div
                className="rounded-[16px] rounded-bl-[6px] px-3 pb-1.5 pt-2 text-[14.5px] leading-[1.38]"
                style={{ background: 'var(--chat-in)' }}
              >
                {m.text}
                <span className="float-right ml-2 mt-1.5 text-[11px] tabular-nums" style={{ color: 'var(--chat-in-meta)' }}>
                  {m.at}
                </span>
              </div>

              {m.keys && (
                <div className="mt-1 flex flex-col gap-1">
                  {m.keys.map((rowKeys, ri) => (
                    <div key={ri} className="flex gap-1">
                      {rowKeys.map((k) => (
                        <button
                          key={k.act}
                          type="button"
                          onClick={() => onKey(k.act)}
                          className="relative flex-1 rounded-[10px] border-0 px-2 py-2 text-[13.5px] font-medium backdrop-blur-sm"
                          style={{ background: 'var(--chat-key)', color: tg('link-color') }}
                        >
                          {k.label}
                          {k.act === 'open' && (
                            // кнопка мини-приложения: в Telegram у неё значок окна в углу
                            <svg viewBox="0 0 10 10" className="absolute right-1.5 top-1.5 h-[8px] w-[8px]" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                              <path d="M3.5 1.5h5v5M8.5 1.5 3 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---------- строка ввода: кнопка меню бота открывает приложение ---------- */}
      <div
        className="flex shrink-0 items-center gap-2 px-2 pb-2 pt-2 md:pb-4"
        style={{ background: tg('header-bg-color'), borderTop: `1px solid ${tg('section-separator-color')}` }}
      >
        <button
          type="button"
          onClick={onMenu}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border-0 px-3 text-[14px] font-medium"
          style={{ background: tg('button-color'), color: tg('button-text-color') }}
        >
          <svg viewBox="0 0 14 12" className="h-3 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M1 1.5h12M1 6h12M1 10.5h12" />
          </svg>
          {COPY.chat.menu}
        </button>
        <span
          className="flex h-9 min-w-0 flex-1 items-center rounded-full px-3.5 text-[14.5px]"
          style={{ background: tg('secondary-bg-color'), color: tg('hint-color') }}
          aria-hidden
        >
          {COPY.chat.input}
        </span>
      </div>
    </div>
  );
}
