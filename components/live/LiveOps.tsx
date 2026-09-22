'use client';

import { useId, useRef } from 'react';
import { LiveScreen, useLoop, type LiveProps } from './kit';

const OK = '#3ddc84';
const WARN = '#f5b83d';
const ERR = '#f0605d';
const DIM = '#5e6e66';

// 48 проверок: почти все зелёные, пара старых сбоев — честная история
const BARS = Array.from({ length: 48 }, (_, i) => (i === 13 ? WARN : i === 30 ? ERR : OK));

// задержка: ровная линия с шумом и одним всплеском в момент сбоя
const LAT = Array.from({ length: 40 }, (_, i) => {
  const base = 50 + Math.sin(i * 0.7) * 6 + Math.sin(i * 1.9) * 4;
  return i === 29 ? 10 : i === 30 ? 18 : base;
});
const W = 318;
const pts = LAT.map((y, i) => [(i * W) / (LAT.length - 1), y] as const);
const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

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

const REGIONS: Array<[string, number]> = [
  ['Москва', 38],
  ['Санкт-Петербург', 44],
  ['Новосибирск', 71]
];

/**
 * Мониторинг: полосы аптайма, живая задержка, лента проверок, а справа —
 * то, о чём спрашивают после «сайт работает?»: откуда проверяем, где
 * бэкап и когда кончится сертификат. Посреди цикла падает оплата —
 * алерт приходит в Telegram, через две минуты инцидент закрыт.
 * Терминал: чёрный, моноширинный, цвета статусов.
 */
export default function LiveOps({ playing }: LiveProps) {
  const root = useRef<HTMLDivElement>(null);
  const fill = `lo-fill-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useLoop(
    root,
    playing,
    (tl) => {
      const step = 0.42;
      const rowH = 18;
      tl.from('[data-head]', { opacity: 0, duration: 0.4 }, 0)
        .from('[data-bar]', { scaleY: 0, duration: 0.3, ease: 'power2.out', stagger: 0.012 }, 0.1)
        .fromTo('[data-lat]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power1.inOut' }, 0.4)
        .from('[data-lat-fill]', { opacity: 0, duration: 0.8 }, 1.0)
        .from('[data-card]', { x: 16, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.1 }, 0.3)
        .from('[data-region]', { scaleX: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08 }, 0.6);
      // лента: каждая строка сдвигает список на одну вверх
      LOG.forEach((_, i) => {
        const at = 0.9 + i * step;
        tl.from(`[data-log="${i}"]`, { opacity: 0, x: -8, duration: 0.25 }, at);
        if (i >= 6) tl.to('[data-feed]', { y: -(i - 5) * rowH, duration: 0.3, ease: 'power2.out' }, at);
      });
      // сбой и восстановление
      const down = 0.9 + 4 * step;
      const up = 0.9 + 6 * step;
      tl.to('[data-state="ok"]', { yPercent: -100, opacity: 0, duration: 0.3 }, down)
        .fromTo('[data-state="err"]', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3 }, down)
        .to('[data-live]', { backgroundColor: ERR, duration: 0.2 }, down)
        .to('[data-bar-now]', { backgroundColor: ERR, duration: 0.2 }, down)
        .fromTo('[data-alert]', { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, down + 0.35)
        .to('[data-alert-state]', { yPercent: -50, duration: 0.3, ease: 'power2.inOut' }, up)
        .to('[data-alert-dot]', { backgroundColor: OK, duration: 0.3 }, up)
        .to('[data-state="err"]', { yPercent: -100, opacity: 0, duration: 0.3 }, up)
        .fromTo('[data-state="fixed"]', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3 }, up)
        .to('[data-live]', { backgroundColor: OK, duration: 0.2 }, up)
        .to('[data-bar-now]', { backgroundColor: WARN, duration: 0.2 }, up)
        .to('[data-alert]', { y: -10, opacity: 0, duration: 0.4 }, up + 1.3)
        .to('[data-ops]', { opacity: 0, duration: 0.45 }, 6.1)
        .set({}, {}, 6.6);
      // пульс «живой» точки идёт всё время
      tl.to('[data-pulse]', { scale: 2.6, opacity: 0, duration: 1.1, repeat: 5, ease: 'power1.out' }, 0);
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
            'linear-gradient(rgba(61,220,132,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(61,220,132,0.035) 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        }}
      >
        <div data-ops className="absolute inset-0">
          <div className="absolute left-5 top-4 w-[318px]">
            <div data-head className="flex items-center justify-between text-[9.5px]" style={{ color: DIM }}>
              <span className="flex items-center gap-2">
                <span className="relative block h-2 w-2">
                  <i data-live className="absolute inset-0 rounded-full" style={{ background: OK }} />
                  <i data-pulse className="absolute inset-0 rounded-full" style={{ background: OK }} />
                </span>
                status.lavka.ru
              </span>
              <span>
                30 дн <b className="font-medium text-[#d6e2da]">99,98%</b>
              </span>
            </div>

            {/* главное состояние: три версии одной строки */}
            <div className="relative mt-2.5 h-6 overflow-hidden font-sans text-[17px] font-medium">
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
            <div className="mt-3 flex h-6 items-end gap-[2px]">
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
            <div className="mt-1 flex justify-between text-[8px]" style={{ color: DIM }}>
              <span>48 ч назад</span>
              <span>сейчас</span>
            </div>

            {/* задержка */}
            <div className="mt-2.5 flex items-baseline justify-between text-[8.5px]" style={{ color: DIM }}>
              <span>ответ, мс</span>
              <span>
                p95 <b className="font-medium text-[#d6e2da]">64</b> · медиана <b className="font-medium text-[#d6e2da]">48</b>
              </span>
            </div>
            <svg viewBox={`0 0 ${W} 64`} className="mt-1 block h-[64px] w-full overflow-visible">
              <defs>
                <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={OK} stopOpacity="0.22" />
                  <stop offset="1" stopColor={OK} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[16, 36, 56].map((y) => (
                <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="rgba(214,226,218,0.06)" />
              ))}
              <path data-lat-fill d={`${line} L${W} 64 L0 64 Z`} fill={`url(#${fill})`} />
              <path
                data-lat
                d={line}
                pathLength={1}
                fill="none"
                stroke={OK}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeDasharray="1"
              />
              <circle cx={(29 * W) / 39} cy={10} r="3.2" fill={ERR} />
              <text x={(29 * W) / 39 + 6} y={12} fontSize="8" fill={ERR}>
                503
              </text>
            </svg>

            {/* лента проверок */}
            <div className="mt-2 h-[108px] overflow-hidden text-[10px] leading-[18px]">
              <ul data-feed className="m-0 list-none p-0">
                {LOG.map(([t, text, k], i) => (
                  <li key={i} data-log={i} className="flex gap-3 whitespace-pre">
                    <span style={{ color: DIM }}>{t}</span>
                    <span style={{ color: k === 'ok' ? '#d6e2da' : tone[k as keyof typeof tone] }}>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* справа: откуда проверяем, бэкапы, сертификат */}
          <aside className="absolute right-4 top-4 w-[178px] space-y-2 font-sans">
            <div data-card className="rounded-[10px] border border-white/[0.07] bg-white/[0.025] p-2.5">
              <p className="m-0 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
                Проверяем из
              </p>
              <ul className="m-0 mt-2 list-none space-y-1.5 p-0 text-[9.5px]">
                {REGIONS.map(([city, ms]) => (
                  <li key={city}>
                    <span className="flex justify-between">
                      <span className="text-[#b9c7bf]">{city}</span>
                      <span className="font-mono">{ms} мс</span>
                    </span>
                    <i className="mt-1 block h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
                      <i data-region className="block h-full origin-left rounded-full" style={{ width: `${ms}%`, background: ms > 60 ? WARN : OK }} />
                    </i>
                  </li>
                ))}
              </ul>
            </div>
            <div data-card className="rounded-[10px] border border-white/[0.07] bg-white/[0.025] p-2.5">
              <p className="m-0 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
                Резервные копии
              </p>
              <p className="m-0 mt-1.5 text-[11px] font-medium">Сегодня, 03:00 · 1,2 ГБ</p>
              <p className="m-0 mt-0.5 flex items-center gap-1.5 text-[9.5px] text-[#b9c7bf]">
                <i className="block h-1.5 w-1.5 rounded-full" style={{ background: OK }} /> Проверено восстановлением
              </p>
            </div>
            <div data-card className="flex items-center justify-between rounded-[10px] border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 text-[9.5px]">
              <span className="text-[#b9c7bf]">SSL-сертификат</span>
              <span className="font-mono" style={{ color: OK }}>
                ещё 114 дн
              </span>
            </div>
          </aside>

          {/* алерт в Telegram — приходит, пока инцидент открыт */}
          <div
            data-alert
            className="absolute right-4 top-[208px] w-[178px] rounded-[12px] bg-[#1c2733] p-2.5 font-sans text-white opacity-0 shadow-[0_18px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
          >
            <p className="m-0 flex items-center gap-1.5 text-[9.5px] font-semibold">
              <i data-alert-dot className="block h-2 w-2 rounded-full" style={{ background: ERR }} />
              Мониторинг · Лавка
              <span className="ml-auto font-mono text-[8px] font-normal text-white/40">12:04</span>
            </p>
            <span className="mt-1 block h-[26px] overflow-hidden text-[9.5px] leading-[13px] text-white/75">
              <span data-alert-state className="flex flex-col">
                <span className="h-[26px]">POST /checkout — 503. Открыт инцидент #12, дежурный уже смотрит.</span>
                <span className="h-[26px]">Инцидент #12 закрыт за 2 минуты. Оплата работает.</span>
              </span>
            </span>
          </div>
        </div>
      </div>
    </LiveScreen>
  );
}
