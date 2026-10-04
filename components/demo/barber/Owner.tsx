'use client';

import { COPY, GUEST, MASTERS, SERVICES, SHOP } from '@/content/concepts/barber';
import { addDays, dayLong, hhmm, type Busy } from '@/lib/barber';
import { Avatar, type Mine } from './App';
import { B } from './shared';

/**
 * Расписание салона — то, что в эту же секунду видит владелец.
 *
 * День — тот, что клиент листает в приложении: окна там — это дыры
 * в этой сетке. Запись из Telegram падает в колонку мастера латунью,
 * при переносе переезжает, при отмене остаётся пунктиром освобождённое
 * место. Журнал под сеткой — то, что владельцу приходит уведомлениями.
 */

export type LogItem = { id: number; at: string; text: string };

/** Высота получаса, пиксели. */
const ROW = 20;

const svc = (id: string) => SERVICES.find((s) => s.id === id)!;
const y = (min: number) => ((min - SHOP.open) / 30) * ROW;

export default function Owner({
  today,
  day,
  busy,
  mine,
  ghost,
  flash,
  log,
  nowMin,
  className = ''
}: {
  today: Date;
  day: number;
  /** Чужие записи дня. */
  busy: Busy[];
  /** Своя запись, если она на этом дне. */
  mine: Mine | null;
  /** Место отменённой записи на этом дне. */
  ghost: Pick<Mine, 'master' | 'start' | 'service'> | null;
  /** Счётчик: меняется — запись заново «падает» на место. */
  flash: number;
  log: LogItem[];
  nowMin: number;
  className?: string;
}) {
  const hours = Array.from({ length: (SHOP.close - SHOP.open) / 60 + 1 }, (_, i) => SHOP.open + i * 60);
  const height = y(SHOP.close);
  const showNow = day === 0 && nowMin > SHOP.open && nowMin < SHOP.close;

  return (
    <section
      aria-label="Расписание салона"
      className={`overflow-hidden rounded-[18px] border ${className}`}
      style={{ background: B.raise, borderColor: B.line }}
    >
      <header className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: B.line }}>
        <span>
          <span className="block text-[15px] font-medium">{COPY.owner.title}</span>
          <span className="block text-[12px]" style={{ color: B.faint }}>
            {COPY.owner.sub}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-[14px] first-letter:uppercase">{dayLong(addDays(today, day))}</span>
          <span className="block text-[12px]" style={{ color: B.faint }}>
            {COPY.owner.follows}
          </span>
        </span>
      </header>

      {/* ---------- мастера ---------- */}
      <div className="grid grid-cols-[44px_repeat(3,minmax(0,1fr))] gap-x-1.5 px-3 pt-3">
        <span />
        {MASTERS.map((m) => (
          <span key={m.id} className="flex min-w-0 items-center gap-2 pb-2">
            <Avatar id={m.id} size={24} />
            <span className="min-w-0 truncate text-[12.5px]">{m.name}</span>
          </span>
        ))}
      </div>

      {/* ---------- сетка дня ---------- */}
      <div className="relative mx-3 mb-3" style={{ height }}>
        {hours.map((h) => (
          <div key={h} className="absolute inset-x-0 flex items-start" style={{ top: y(h) }}>
            <span className="-mt-[7px] w-[44px] pr-2 text-right text-[10.5px] tabular-nums" style={{ color: B.faint }}>
              {h < SHOP.close ? hhmm(h) : ''}
            </span>
            <span className="h-px flex-1" style={{ background: B.line }} />
          </div>
        ))}

        <div className="absolute inset-y-0 left-[44px] right-0 grid grid-cols-3 gap-x-1.5">
          {MASTERS.map((m) => (
            <div key={m.id} className="relative">
              {busy
                .filter((b) => b.master === m.id)
                .map((b) => (
                  <div
                    key={b.id}
                    className="absolute inset-x-0 overflow-hidden rounded-[6px] px-1.5 py-1 leading-tight"
                    style={{ top: y(b.start) + 1, height: (b.min / 30) * ROW - 2, background: 'rgba(239,233,224,0.07)' }}
                  >
                    <span className="block truncate text-[11px]" style={{ color: B.dim }}>
                      {b.client}
                    </span>
                    {b.min >= 60 && (
                      <span className="block truncate text-[10px]" style={{ color: B.faint }}>
                        {svc(b.service).short}
                      </span>
                    )}
                  </div>
                ))}

              {ghost && ghost.master === m.id && (
                <div
                  key={`ghost-${ghost.start}`}
                  className="absolute inset-x-0 rounded-[6px] border border-dashed px-1.5 py-1 text-[10.5px] leading-tight motion-safe:animate-[fade_0.4s_ease]"
                  style={{
                    top: y(ghost.start) + 1,
                    height: (svc(ghost.service).min / 30) * ROW - 2,
                    borderColor: 'rgba(201,164,106,0.55)',
                    color: B.brass
                  }}
                >
                  отменена
                </div>
              )}

              {mine && mine.master === m.id && (
                // переезд — трансформом: запись едет по колонке, а не перескакивает
                <div
                  className="absolute inset-x-0 top-0 z-10 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                  style={{ transform: `translateY(${y(mine.start) + 1}px)` }}
                >
                  <div
                    key={flash}
                    className="overflow-hidden rounded-[6px] px-1.5 py-1 leading-tight shadow-[0_6px_18px_-6px_rgba(201,164,106,0.6)] motion-safe:animate-[slot-in_0.55s_cubic-bezier(0.22,1,0.36,1)]"
                    style={{ height: (svc(mine.service).min / 30) * ROW - 2, background: B.brass, color: B.brassInk }}
                  >
                    <span className="block truncate text-[11px] font-semibold">{GUEST.name} · Telegram</span>
                    {svc(mine.service).min >= 45 && (
                      <span className="block truncate text-[10px]">
                        {mine.late ? 'опоздает на 10 мин' : 'предоплата 500 ₽'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {showNow && (
          <div className="pointer-events-none absolute left-[38px] right-0 z-20 flex items-center" style={{ top: y(nowMin) }} aria-hidden>
            <span className="h-[7px] w-[7px] -translate-y-px rounded-full" style={{ background: '#e0614f' }} />
            <span className="h-px flex-1" style={{ background: '#e0614f' }} />
          </div>
        )}
      </div>

      {/* ---------- журнал: что владельцу приходит уведомлениями ---------- */}
      <div className="border-t px-5 pb-4 pt-3" style={{ borderColor: B.line }}>
        <span className="block text-[11px] uppercase tracking-[0.16em]" style={{ color: B.faint }}>
          {COPY.owner.log}
        </span>
        <ul className="m-0 mt-2 min-h-[64px] list-none space-y-1.5 p-0" aria-live="polite">
          {log.length === 0 && (
            <li className="text-[12.5px] leading-snug" style={{ color: B.faint }}>
              {COPY.owner.empty}
            </li>
          )}
          {log.slice(0, 3).map((l) => (
            <li key={l.id} className="flex gap-3 text-[12.5px] leading-snug motion-safe:animate-[feedin_0.35s_ease-out]">
              <span className="shrink-0 tabular-nums" style={{ color: B.faint }}>
                {l.at}
              </span>
              <span style={{ color: B.fg }}>{l.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
