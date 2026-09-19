'use client';

import { useRef } from 'react';
import { LiveScreen, useLoop, type LiveProps } from './kit';

const OK = '#3ddc84';
const WARN = '#f5b83d';
const ERR = '#f0605d';

// 60 проверок: почти все зелёные, пара старых сбоев — честная история
const BARS = Array.from({ length: 60 }, (_, i) => (i === 17 ? WARN : i === 38 ? ERR : OK));

// задержка: ровная линия с шумом и одним всплеском в момент сбоя
const LAT = Array.from({ length: 48 }, (_, i) => {
  const base = 58 + Math.sin(i * 0.7) * 6 + Math.sin(i * 1.9) * 4;
  return i === 34 ? 12 : i === 35 ? 20 : base;
});
const path = LAT.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * 512) / 47} ${y}`).join(' ');

const LOG: Array<[string, string, string]> = [
  ['12:04:31', 'GET  /              200   38 мс', 'ok'],
  ['12:04:36', 'GET  /catalog       200   52 мс', 'ok'],
  ['12:04:41', 'POST /cart          200   61 мс', 'ok'],
  ['12:04:46', 'backup db.sql.gz    ok   1,2 ГБ', 'ok'],
  ['12:04:51', 'POST /checkout      503   —', 'err'],
  ['12:04:52', 'alert → telegram    отправлено', 'warn'],
  ['12:06:58', 'POST /checkout      200   74 мс', 'ok'],
  ['12:07:03', 'incident #12        закрыт · 2 мин', 'ok'],
  ['12:07:08', 'ssl  до 14.01.2027  ok', 'ok']
];
const tone = { ok: OK, warn: WARN, err: ERR } as const;

/**
 * Мониторинг: полосы аптайма, живая задержка, лента проверок. Посреди
 * цикла падает оплата — алерт уходит в Telegram, через две минуты
 * инцидент закрыт. Стиль — терминал: чёрный, моноширинный, цвета статусов.
 */
export default function LiveOps({ playing }: LiveProps) {
  const root = useRef<HTMLDivElement>(null);

  useLoop(
    root,
    playing,
    (tl) => {
      const step = 0.42;
      const rowH = 19;
      tl.from('[data-head]', { opacity: 0, duration: 0.4 }, 0)
        .from('[data-bar]', { scaleY: 0, duration: 0.3, ease: 'power2.out', stagger: 0.012 }, 0.1)
        .fromTo('[data-lat]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power1.inOut' }, 0.4);
      // лента: каждая строка сдвигает список на одну вверх
      LOG.forEach((_, i) => {
        const at = 0.9 + i * step;
        tl.from(`[data-log="${i}"]`, { opacity: 0, x: -8, duration: 0.25 }, at);
        if (i >= 5) tl.to('[data-feed]', { y: -(i - 4) * rowH, duration: 0.3, ease: 'power2.out' }, at);
      });
      // сбой и восстановление
      const down = 0.9 + 4 * step;
      const up = 0.9 + 6 * step;
      tl.to('[data-state="ok"]', { yPercent: -100, opacity: 0, duration: 0.3 }, down)
        .fromTo('[data-state="err"]', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3 }, down)
        .to('[data-live]', { backgroundColor: ERR, duration: 0.2 }, down)
        .to('[data-bar-now]', { backgroundColor: ERR, duration: 0.2 }, down)
        .to('[data-state="err"]', { yPercent: -100, opacity: 0, duration: 0.3 }, up)
        .fromTo('[data-state="fixed"]', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3 }, up)
        .to('[data-live]', { backgroundColor: OK, duration: 0.2 }, up)
        .to('[data-bar-now]', { backgroundColor: WARN, duration: 0.2 }, up)
        .to('[data-ops]', { opacity: 0, duration: 0.45 }, 5.6)
        .set({}, {}, 6.1);
      // пульс «живой» точки идёт всё время
      tl.to('[data-pulse]', { scale: 2.6, opacity: 0, duration: 1.1, repeat: 4, ease: 'power1.out' }, 0);
    },
    0.78
  );

  return (
    <LiveScreen>
      <div
        ref={root}
        className="absolute inset-0 bg-[#060908] font-mono text-[#d6e2da]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(61,220,132,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(61,220,132,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        }}
      >
        <div data-ops className="absolute inset-0 px-6 pt-5">
          <div data-head className="flex items-center justify-between text-[10px] text-[#5e6e66]">
            <span className="flex items-center gap-2">
              <span className="relative block h-2 w-2">
                <i data-live className="absolute inset-0 rounded-full" style={{ background: OK }} />
                <i data-pulse className="absolute inset-0 rounded-full" style={{ background: OK }} />
              </span>
              status.lavka.ru
            </span>
            <span>
              аптайм 30 дн <b className="font-medium text-[#d6e2da]">99,98%</b>
            </span>
          </div>

          {/* главное состояние: три версии одной строки */}
          <div className="relative mt-3 h-7 overflow-hidden font-sans text-[19px] font-medium">
            <span data-state="ok" className="absolute inset-0">
              Все системы работают
            </span>
            <span data-state="err" className="absolute inset-0 opacity-0" style={{ color: ERR }}>
              Оплата: сбой · разбираемся
            </span>
            <span data-state="fixed" className="absolute inset-0 opacity-0" style={{ color: OK }}>
              Восстановлено за 2 минуты
            </span>
          </div>

          {/* полосы аптайма */}
          <div className="mt-4 flex h-7 items-end gap-[2.5px]">
            {BARS.map((c, i) => (
              <i
                key={i}
                data-bar
                {...(i === BARS.length - 1 ? { 'data-bar-now': '' } : {})}
                className="block h-full flex-1 origin-bottom rounded-[1.5px]"
                style={{ background: c, opacity: c === OK ? 0.72 : 1 }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[8.5px] text-[#5e6e66]">
            <span>60 проверок назад</span>
            <span>сейчас</span>
          </div>

          {/* задержка */}
          <div className="mt-3 flex items-baseline justify-between text-[9px] text-[#5e6e66]">
            <span>задержка, мс</span>
            <span>
              p95 <b className="font-medium text-[#d6e2da]">64</b>
            </span>
          </div>
          <svg viewBox="0 0 512 72" className="mt-1 block h-[72px] w-full overflow-visible">
            <path d={path} fill="none" stroke="rgba(61,220,132,0.18)" strokeWidth="6" strokeLinejoin="round" />
            <path
              data-lat
              d={path}
              pathLength={1}
              fill="none"
              stroke={OK}
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeDasharray="1"
            />
            <circle cx={(34 * 512) / 47} cy={12} r="3.5" fill={ERR} />
          </svg>

          {/* лента проверок */}
          <div className="mt-3 h-[96px] overflow-hidden text-[10.5px] leading-[19px]">
            <ul data-feed className="m-0 list-none p-0">
              {LOG.map(([t, line, k], i) => (
                <li key={i} data-log={i} className="flex gap-4 whitespace-pre">
                  <span className="text-[#5e6e66]">{t}</span>
                  <span style={{ color: k === 'ok' ? '#d6e2da' : tone[k as keyof typeof tone] }}>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </LiveScreen>
  );
}
