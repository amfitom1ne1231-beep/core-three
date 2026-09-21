'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DemoFrame from '../DemoFrame';
import { useInView } from '../reveal';
import { mono as monoFont, sans as sansFont } from './fonts';
import {
  BACKUP,
  CHECKS,
  CHECK_EVERY,
  CLIENT,
  COPY,
  EXPIRY,
  EXTERNAL,
  INCIDENTS,
  OWN,
  SERVICES,
  type Health,
  type Incident
} from '@/content/concepts/status';
import { demoBySlug } from '@/content/concepts';
import {
  C,
  DAYS,
  HEALTH_COLOR,
  HEALTH_LABEL,
  KIND_LABEL,
  MONO,
  SANS,
  LAT_CAP,
  barsOf,
  daysAgoLabel,
  fmtUptime,
  latencySeries,
  minutesLabel
} from './shared';

const META = demoBySlug('status')!;

type Tone = 'ok' | 'warn' | 'err' | 'mute';
/**
 * Строка ленты разобрана на колонки, а не собрана пробелами.
 * В системном моноширинном кириллица не всегда той же ширины, что латиница,
 * и `padEnd` разъезжается ровно на запросах вроде `?q=хлеб`.
 */
type FeedItem = { id: number; time: string; path: string; code: string; took: string; tone: Tone };
type Update = { at: string; label: string; text: string };

const TONE: Record<Tone, string> = { ok: C.fg, warn: C.warn, err: C.err, mute: C.faint };

const clock = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

/** Одна проверка ленты. Во время сбоя оплата отвечает так же, как в жизни. */
function checkLine(i: number, broken: boolean): Omit<FeedItem, 'id'> {
  const c = CHECKS[i % CHECKS.length];
  if (broken && c.path.includes('checkout')) {
    return { time: clock(), path: c.path, code: '503', took: '—', tone: 'err' };
  }
  const ms = Math.round(c.ms[0] + Math.random() * (c.ms[1] - c.ms[0]));
  return { time: clock(), path: c.path, code: '200', took: `${ms} мс`, tone: 'ok' };
}

/* ================= мелкие части ================= */

function Dot({ health, pulse = false }: { health: Health; pulse?: boolean }) {
  const color = HEALTH_COLOR[health];
  return (
    <span className="relative inline-block h-2 w-2 shrink-0">
      <i className="absolute inset-0 rounded-full" style={{ background: color }} />
      {pulse && (
        <i
          className="absolute inset-0 rounded-full motion-safe:animate-ping"
          style={{ background: color, animationDuration: '2.4s' }}
        />
      )}
    </span>
  );
}

function Panel({
  title,
  note,
  children,
  className = ''
}: {
  title?: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  // вход встроен в саму панель, а не в обёртку: лишний div вокруг каждой
  // секции ломал бы сетку `lg:grid-cols-2` у бэкапов и сроков
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section
      ref={ref}
      data-demo-rise=""
      {...(seen ? { 'data-in': '' } : {})}
      className={`border ${className}`}
      style={{ borderColor: C.line, background: C.panel }}
    >
      {title && (
        <header
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-4 py-3 sm:px-5"
          style={{ borderColor: C.line }}
        >
          <h2 className="m-0 text-[13px] font-semibold tracking-tight" style={{ color: C.fg }}>
            {title}
          </h2>
          {note && (
            <span className="text-[11px]" style={{ color: C.faint }}>
              {note}
            </span>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

/** Строка системы: состояние, 90 суток истории, аптайм. */
function UptimeRow({
  id,
  name,
  note,
  health,
  today
}: {
  id: string;
  name: string;
  note: string;
  health: Health;
  /** След сегодняшнего сбоя: остаётся на полосе и после починки */
  today?: Health;
}) {
  const [barsRef, built] = useInView<HTMLDivElement>();
  const bars = useMemo(() => {
    const b = barsOf(id);
    // страница обещает, что цветная полоса всегда означает запись
    // в журнале. Сбой, устроенный прямо сейчас, — тоже запись,
    // и сегодняшняя клетка обязана его показать
    if (today) b[b.length - 1] = today;
    return b;
  }, [id, today]);

  return (
    <div className="border-b px-4 py-4 last:border-b-0 sm:px-5" style={{ borderColor: C.line }}>
      {/*
        Имя и состояние всегда в одной строке, пояснение — под ними на узком
        экране. Через flex-wrap перенос решался шириной пояснения: у одной
        системы вниз уезжал процент, у соседней — нет, и колонка состояний
        переставала быть колонкой.
      */}
      <div className="flex items-baseline gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <Dot health={health} />
          <span className="truncate text-[13.5px] font-medium" style={{ color: C.fg }}>
            {name}
          </span>
        </span>
        <span className="hidden text-[11.5px] sm:inline" style={{ color: C.faint }}>
          {note}
        </span>
        <span
          className="ml-auto shrink-0 text-[11.5px] tabular-nums"
          style={{ color: health === 'ok' ? C.dim : HEALTH_COLOR[health], fontFamily: MONO }}
        >
          {health === 'ok' ? fmtUptime(id) : HEALTH_LABEL[health]}
        </span>
      </div>
      <p className="m-0 mt-1 text-[11.5px] sm:hidden" style={{ color: C.faint }}>
        {note}
      </p>

      {/* 90 суток. На узком экране показываем последние 45: 90 полосок
          по полтора пикселя — это не история, а шум.
          Собираются слева направо при появлении в кадре: история
          прочитывается как история, а не возникает готовой таблицей. */}
      <div ref={barsRef} className="mt-3 flex h-6 items-stretch gap-px sm:gap-[2px]">
        {bars.map((b, i) => (
          <i
            key={i}
            className={`block flex-1 origin-bottom rounded-[1px] ${i < DAYS - 45 ? 'hidden sm:block' : ''}`}
            style={{
              background: HEALTH_COLOR[b],
              opacity: b === 'ok' ? 0.5 : 1,
              transform: built ? 'scaleY(1)' : 'scaleY(0.08)',
              transition: 'transform 0.42s cubic-bezier(0.22,1,0.36,1)',
              transitionDelay: `${Math.min(i, 90) * 5}ms`
            }}
            title={`${daysAgoLabel(DAYS - 1 - i)} — ${HEALTH_LABEL[b]}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px]" style={{ color: C.faint, fontFamily: MONO }}>
        <span className="sm:hidden">45 дней назад</span>
        <span className="hidden sm:inline">90 дней назад</span>
        <span>сегодня</span>
      </div>
    </div>
  );
}

function UpdateList({ updates, live = false }: { updates: Update[]; live?: boolean }) {
  return (
    <ol className="m-0 list-none p-0">
      {updates.map((u, i) => (
        <li key={`${u.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0 sm:gap-4">
          {/* линия времени: соединяет обновления, у последнего обрывается */}
          <span className="relative flex w-[7px] shrink-0 justify-center">
            <i
              className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ background: i === updates.length - 1 && live ? C.warn : C.faint }}
            />
            {i < updates.length - 1 && (
              <i className="absolute top-[14px] bottom-[-4px] w-px" style={{ background: C.line }} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 flex flex-wrap items-baseline gap-x-2.5 text-[11px]">
              <span className="tabular-nums" style={{ color: C.dim, fontFamily: MONO }}>
                {u.at}
              </span>
              <span className="font-medium uppercase tracking-[0.1em]" style={{ color: C.faint, fontSize: 10 }}>
                {u.label}
              </span>
            </p>
            <p className="m-0 mt-1 text-[13px] leading-relaxed" style={{ color: C.dim }}>
              {u.text}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function IncidentEntry({ incident }: { incident: Incident }) {
  const [open, setOpen] = useState(false);
  const color = HEALTH_COLOR[incident.kind];

  return (
    <article className="border-b px-4 py-4 last:border-b-0 sm:px-5" style={{ borderColor: C.line }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 border-0 bg-transparent p-0 text-left"
      >
        <span className="mt-[6px] block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[10px] tabular-nums" style={{ color: C.faint, fontFamily: MONO }}>
              #{incident.n}
            </span>
            <span className="text-[13.5px] font-medium" style={{ color: C.fg }}>
              {incident.title}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap items-baseline gap-x-2.5 text-[11.5px]" style={{ color: C.faint }}>
            <span style={{ color }}>{KIND_LABEL[incident.kind]}</span>
            <span>·</span>
            <span>{daysAgoLabel(incident.daysAgo)}</span>
            <span>·</span>
            <span>{minutesLabel(incident.minutes)}</span>
          </span>
          <span className="mt-2 block text-[13px] leading-relaxed" style={{ color: C.dim }}>
            {incident.summary}
          </span>
        </span>
        <span
          className="mt-1 shrink-0 text-[10px] uppercase tracking-[0.12em]"
          style={{ color: C.faint, fontFamily: MONO }}
        >
          {open ? 'Свернуть' : 'Ход событий'}
        </span>
      </button>

      {open && (
        <div className="mt-4 pl-5">
          <UpdateList updates={incident.updates} />
        </div>
      )}
    </article>
  );
}

/**
 * Счёт до значения при появлении в кадре.
 *
 * Только для трёх чисел под графиком: приборная панель, на которой
 * считается всё подряд, превращается в игровой автомат. Разряды набраны
 * `tabular-nums`, поэтому ширина не дёргается по дороге.
 */
function Metric({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!seen) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const from = performance.now();
    const dur = 900;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - from) / dur);
      // замедление к концу: число «доезжает», а не обрывается
      setShown(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

function Latency() {
  const [ref, seen] = useInView<HTMLDivElement>();
  const series = useMemo(latencySeries, []);
  const w = 720;
  const h = 96;
  const x = (i: number) => (i * w) / (DAYS - 1);
  const y = (v: number) => h - (Math.min(v, LAT_CAP) / LAT_CAP) * h;
  const d = series.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const spike = series.findIndex((v) => v > LAT_CAP);

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-24 w-full" preserveAspectRatio="none" aria-hidden>
        {[40, 80, 120].map((v) => (
          <line key={v} x1={0} x2={w} y1={y(v)} y2={y(v)} stroke={C.line} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <path
          d={`${d} L${w} ${h} L0 ${h} Z`}
          fill={C.ok}
          fillOpacity={seen ? 0.08 : 0}
          style={{ transition: 'fill-opacity 0.9s ease 0.5s' }}
        />
        {/*
          Линия прочерчивается, а не появляется готовой: девяносто дней
          читаются слева направо, и ступенька от переезда на новый сервер
          успевает попасть в глаз.
        */}
        <path
          d={d}
          pathLength={1}
          fill="none"
          stroke={C.ok}
          strokeWidth={1.4}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeDasharray={1}
          strokeDashoffset={seen ? 0 : 1}
          style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(0.33,1,0.68,1)' }}
        />
        {spike >= 0 && (
          <line
            x1={x(spike)}
            x2={x(spike)}
            y1={0}
            y2={h}
            stroke={C.warn}
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
            opacity={seen ? 1 : 0}
            style={{ transition: 'opacity 0.4s ease 1s' }}
          />
        )}
      </svg>

      {/* подписи поверх, а не внутри viewBox: preserveAspectRatio=none
          растянул бы текст вместе с координатами */}
      <span className="absolute left-0 top-0 text-[9.5px]" style={{ color: C.faint, fontFamily: MONO }}>
        {LAT_CAP} мс
      </span>
      {spike >= 0 && (
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[9.5px]"
          style={{ left: `${(spike / (DAYS - 1)) * 100}%`, color: C.warn, fontFamily: MONO }}
        >
          900 мс ↑
        </span>
      )}
    </div>
  );
}

/* ================= страница ================= */

export default function StatusDemo() {
  const [mounted, setMounted] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [since, setSince] = useState(0);
  const [health, setHealth] = useState<Record<string, Health>>({});
  // состояние уходит, когда починили; отметка на сегодняшней полосе — нет
  const [marked, setMarked] = useState<Record<string, Health>>({});
  const [live, setLive] = useState<{ updates: Update[]; resolved: boolean; startedAt: number } | null>(null);
  const [mail, setMail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [mailError, setMailError] = useState(false);

  const step = useRef(0);
  const seq = useRef(0);
  const broken = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const push = useCallback((item: Omit<FeedItem, 'id'>) => {
    setFeed((f) => [{ ...item, id: seq.current++ }, ...f].slice(0, 9));
  }, []);

  useEffect(() => setMounted(true), []);

  /**
   * Лента проверок. Десять адресов, каждый проверяется раз в 30 секунд,
   * значит строка приходит каждые три — интервал в шапке и скорость
   * ленты описывают одно и то же, а не спорят друг с другом.
   */
  useEffect(() => {
    if (!mounted) return;
    // первые строки — сразу: пустая лента на первом кадре выглядит поломкой
    setFeed(
      Array.from({ length: 9 }, (_, i) => ({
        ...checkLine(CHECKS.length - 1 - i, false),
        id: seq.current++,
        time: clock(new Date(Date.now() - i * (CHECK_EVERY * 1000) / CHECKS.length))
      }))
    );
    step.current = CHECKS.length;

    const feedTimer = setInterval(() => {
      push(checkLine(step.current++, broken.current));
    }, (CHECK_EVERY * 1000) / CHECKS.length);

    const tickTimer = setInterval(() => setSince((s) => (s + 1) % CHECK_EVERY), 1000);

    return () => {
      clearInterval(feedTimer);
      clearInterval(tickTimer);
    };
  }, [mounted, push]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const at = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  /**
   * Сценарий сбоя. Полный путь: проверка ловит отказ → алерт уходит
   * дежурному → инцидент заводится и обновляется → всё чинится
   * и попадает в журнал. Страница статуса, на которой никогда ничего
   * не происходит, не показывает главного — того, как ведут инцидент.
   */
  const fail = () => {
    clearTimers();
    broken.current = true;
    setHealth({ pay: 'down', cart: 'degraded' });
    setMarked({ pay: 'down', cart: 'degraded' });
    setLive({
      startedAt: Date.now(),
      resolved: false,
      updates: [
        {
          at: clock(),
          label: 'Обнаружено',
          text: 'Проверка оформления заказа вернула 503. Алерт ушёл дежурному в Telegram.'
        }
      ]
    });
    push({ time: clock(), path: 'POST /checkout', code: '503', took: '—', tone: 'err' });

    at(1600, () =>
      push({ time: clock(), path: 'alert → telegram', code: '', took: 'отправлено', tone: 'warn' })
    );

    at(4200, () =>
      setLive((s) =>
        s
          ? {
              ...s,
              updates: [
                ...s.updates,
                {
                  at: clock(),
                  label: 'В работе',
                  text: 'Отказ не на нашей стороне: эквайер не подтверждает платежи. Переключаем приём на резервный шлюз.'
                }
              ]
            }
          : s
      )
    );

    at(9000, () => {
      broken.current = false;
      setHealth({});
      push({ time: clock(), path: 'POST /checkout', code: '200', took: '74 мс', tone: 'ok' });
      setLive((s) =>
        s
          ? {
              ...s,
              resolved: true,
              updates: [
                ...s.updates,
                {
                  at: clock(),
                  label: 'Устранено',
                  text: `Оплата проходит через резервный шлюз. Заказы, зависшие между списанием и подтверждением, довели вручную.`
                }
              ]
            }
          : s
      );
    });

    at(10600, () => push({ time: clock(), path: 'инцидент #15', code: '', took: 'закрыт', tone: 'mute' }));
  };

  const restore = () => {
    clearTimers();
    broken.current = false;
    setHealth({});
    setMarked({});
    setLive(null);
  };

  const worst: Health = useMemo(() => {
    const vals = SERVICES.map((s) => health[s.id] ?? 'ok');
    if (vals.includes('down')) return 'down';
    if (vals.includes('degraded')) return 'degraded';
    return 'ok';
  }, [health]);

  const headline =
    worst === 'ok'
      ? live?.resolved
        ? 'Всё работает. Сбой устранён'
        : 'Все системы работают'
      : worst === 'down'
        ? 'Оплата не проходит — разбираемся'
        : 'Оформление заказа работает с перебоями';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = mail.trim();
    // демо ничего никуда не отправляет, но проверяет по-настоящему:
    // форма, принимающая «ааа», обесценивает и форму, и демо
    const valid = /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(v) || /^@[a-zA-Z0-9_]{4,}$/.test(v);
    if (!valid) {
      setMailError(true);
      return;
    }
    setMailError(false);
    setSubscribed(true);
  };

  const controls = (
    <button
      type="button"
      onClick={live ? restore : fail}
      className="border px-2.5 py-[5px] transition-colors duration-300"
      style={{
        borderColor: live ? C.warn : 'rgba(255,255,255,0.15)',
        color: live ? C.warn : 'rgba(255,255,255,0.7)'
      }}
    >
      {live ? COPY.demo.restore : COPY.demo.trigger}
    </button>
  );

  return (
    <DemoFrame meta={META} controls={controls}>
      {/* фон демо: свой, до самого края, включая перелистывание за границу */}
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: C.bg }} />

      <div
        className={`${sansFont.variable} ${monoFont.variable} min-h-screen`}
        style={{ background: C.bg, color: C.fg, fontFamily: SANS }}
      >
        {/* ---------- шапка клиента ---------- */}
        <header className="border-b" style={{ borderColor: C.line }}>
          <div className="mx-auto flex max-w-[980px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
            <span className="flex items-center gap-2.5">
              {/* монограмма вместо логотипа: страница статуса — служебная,
                  рисованный знак на ней выглядел бы чужой наклейкой */}
              <span
                aria-hidden
                className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-[13px] font-semibold"
                style={{ background: C.raise, color: C.fg }}
              >
                {CLIENT.name[0]}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-[16px] font-semibold tracking-tight">{CLIENT.name}</span>
                <span className="text-[12px]" style={{ color: C.faint }}>
                  {CLIENT.tagline}
                </span>
              </span>
            </span>
            <a
              href="#subscribe"
              className="ml-auto border px-3 py-1.5 text-[11.5px] transition-colors duration-300"
              style={{ borderColor: C.lineStrong, color: C.dim }}
            >
              Подписаться на статус
            </a>
          </div>
        </header>

        <main id="content" className="mx-auto max-w-[980px] px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
          {/* ---------- главное состояние ---------- */}
          <div
            className="border px-4 py-5 sm:px-6 sm:py-6"
            style={{
              borderColor: worst === 'ok' ? C.line : HEALTH_COLOR[worst],
              background: worst === 'ok' ? C.panel : 'rgba(240,96,93,0.06)'
            }}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Dot health={worst} pulse />
              <h1 className="m-0 text-[clamp(19px,2.6vw,26px)] font-semibold tracking-tight">{headline}</h1>
            </div>
            <p
              className="m-0 mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[12px]"
              style={{ color: C.faint, fontFamily: MONO }}
            >
              <span>
                проверка каждые {CHECK_EVERY} с ·{' '}
                {mounted ? `последняя ${since} с назад` : 'последняя только что'}
              </span>
              {/* Разделитель виден, потому что иначе два факта в одном
                  моноширинном ряду читаются как одна строка. На узком
                  экране его нет: там строка переносится, разделяет сам
                  перенос, а палка повисает в начале второй строки. */}
              <span aria-hidden className="hidden sm:inline" style={{ color: C.line }}>
                |
              </span>
              <span>аптайм 90 дней {fmtUptime('site')}</span>
            </p>
          </div>

          {/* ---------- идущий прямо сейчас инцидент ---------- */}
          {live && (
            <Panel
              className="mt-4"
              title={live.resolved ? 'Инцидент #15 — закрыт' : 'Инцидент #15 — открыт'}
              note={live.resolved ? 'обновления закончены' : 'обновляем по мере разбора'}
            >
              <div className="px-4 py-4 sm:px-5">
                <UpdateList updates={live.updates} live={!live.resolved} />
              </div>
            </Panel>
          )}

          {/* ---------- системы ---------- */}
          <div className="mt-4 grid gap-4">
            <Panel title="Системы «Лавки»" note="за них отвечаем мы">
              {OWN.map((s) => (
                <UptimeRow
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  note={s.note}
                  health={health[s.id] ?? 'ok'}
                  today={marked[s.id]}
                />
              ))}
            </Panel>

            <Panel title="Внешние сервисы" note="чужие, но без них заказ не доедет">
              {EXTERNAL.map((s) => (
                <UptimeRow
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  note={s.note}
                  health={health[s.id] ?? 'ok'}
                  today={marked[s.id]}
                />
              ))}
            </Panel>
          </div>

          {/* ---------- метод расчёта ---------- */}
          <p className="m-0 mt-3 text-[11.5px] leading-relaxed" style={{ color: C.faint }}>
            Как считаем аптайм: полный отказ — целиком, перебои — половиной времени, плановые работы,
            о которых предупредили заранее, не считаются. Жёлтая или красная полоса всегда означает
            запись в журнале ниже: скрытых сбоев на этой странице нет.
          </p>

          {/* ---------- время ответа ---------- */}
          <Panel className="mt-4" title="Время ответа" note="90 дней, p95">
            <div className="px-4 pt-4 sm:px-5">
              <Latency />
            </div>
            <div
              className="mt-3 grid gap-px border-t sm:grid-cols-3"
              style={{ borderColor: C.line, background: C.line }}
            >
              {[
                { k: 'сейчас', v: 61, suffix: ' мс', decimals: 0 },
                { k: 'p95 за сутки', v: 78, suffix: ' мс', decimals: 0 },
                { k: 'доля ошибок', v: 0.004, suffix: '%', decimals: 3 }
              ].map((m) => (
                <div key={m.k} className="px-4 py-3 sm:px-5" style={{ background: C.panel }}>
                  <p className="m-0 text-[10.5px] uppercase tracking-[0.12em]" style={{ color: C.faint, fontFamily: MONO }}>
                    {m.k}
                  </p>
                  <p className="m-0 mt-1 text-[17px]" style={{ fontFamily: MONO }}>
                    <Metric value={m.v} suffix={m.suffix} decimals={m.decimals} />
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          {/* ---------- бэкапы и сроки ---------- */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Резервные копии" note={`последняя сегодня в ${BACKUP.lastAt}`}>
              <dl className="m-0 grid gap-px p-0" style={{ background: C.line }}>
                {[
                  ['Последняя копия', `сегодня в ${BACKUP.lastAt} · ${BACKUP.size} · ${BACKUP.took}`],
                  ['Где лежит', BACKUP.places],
                  ['Глубина', BACKUP.depth],
                  ['Шифрование', BACKUP.encrypted]
                ].map(([k, v]) => (
                  <div key={k} className="px-4 py-3 sm:px-5" style={{ background: C.panel }}>
                    <dt className="text-[10.5px] uppercase tracking-[0.12em]" style={{ color: C.faint, fontFamily: MONO }}>
                      {k}
                    </dt>
                    <dd className="m-0 mt-1 text-[13px] leading-relaxed" style={{ color: C.dim }}>
                      {v}
                    </dd>
                  </div>
                ))}
                {/* главное здесь — не что копии делаются, а что их разворачивали */}
                <div className="px-4 py-3 sm:px-5" style={{ background: C.raise }}>
                  <dt className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.12em]" style={{ color: C.ok, fontFamily: MONO }}>
                    <span className="block h-1.5 w-1.5 rounded-full" style={{ background: C.ok }} />
                    Проверка восстановлением
                  </dt>
                  <dd className="m-0 mt-1 text-[13px] leading-relaxed" style={{ color: C.dim }}>
                    {daysAgoLabel(BACKUP.restoreDaysAgo)}, успешно, {BACKUP.restoreTook}. {BACKUP.restoreNote}.
                    Копия, которую ни разу не разворачивали, — не копия, а надежда.
                  </dd>
                </div>
              </dl>
            </Panel>

            <Panel title="Сроки" note="проверяем ежедневно">
              <div className="grid gap-px" style={{ background: C.line }}>
                {EXPIRY.map((e) => (
                  <div key={e.id} className="px-4 py-3 sm:px-5" style={{ background: C.panel }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium">{e.name}</span>
                      <span
                        className="shrink-0 text-[12px] tabular-nums"
                        style={{ color: e.days < 30 ? C.warn : C.dim, fontFamily: MONO }}
                      >
                        через {e.days} дн.
                      </span>
                    </div>
                    <p className="m-0 mt-1 text-[12px]" style={{ color: C.faint }}>
                      {e.note}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* ---------- живая лента ---------- */}
          <Panel className="mt-4" title="Проверки" note={`десять адресов, каждый раз в ${CHECK_EVERY} секунд`}>
            <ul
              className="m-0 h-[196px] list-none overflow-hidden p-4 text-[12px] leading-[20px] sm:px-5"
              style={{ fontFamily: MONO }}
              aria-live="off"
            >
              {feed.map((f) => (
                <li
                  key={f.id}
                  className="flex items-baseline gap-3 motion-safe:animate-[feedin_0.32s_ease-out] sm:gap-4"
                >
                  <span className="shrink-0 tabular-nums" style={{ color: C.faint }}>
                    {f.time}
                  </span>
                  <span className="min-w-0 flex-1 truncate" style={{ color: TONE[f.tone] }}>
                    {f.path}
                  </span>
                  <span className="w-8 shrink-0 text-right tabular-nums" style={{ color: TONE[f.tone] }}>
                    {f.code}
                  </span>
                  <span className="w-[52px] shrink-0 text-right tabular-nums" style={{ color: C.faint }}>
                    {f.took}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          {/* ---------- журнал ---------- */}
          <Panel className="mt-4" title="Журнал инцидентов" note="за 90 дней — всё, что было">
            {INCIDENTS.map((i) => (
              <IncidentEntry key={i.n} incident={i} />
            ))}
          </Panel>

          {/* ---------- подписка ---------- */}
          <Panel className="mt-4" title={COPY.subscribe.title}>
            <div className="px-4 py-4 sm:px-5" id="subscribe">
              <p className="m-0 max-w-[52ch] text-[13px] leading-relaxed" style={{ color: C.dim }}>
                {COPY.subscribe.text}
              </p>
              {subscribed ? (
                <p className="m-0 mt-4 text-[13px]" style={{ color: C.ok }}>
                  {COPY.subscribe.done}
                </p>
              ) : (
                <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2" noValidate>
                  <label className="sr-only" htmlFor="status-mail">
                    {COPY.subscribe.placeholder}
                  </label>
                  <input
                    id="status-mail"
                    value={mail}
                    onChange={(e) => {
                      setMail(e.target.value);
                      setMailError(false);
                    }}
                    placeholder={COPY.subscribe.placeholder}
                    aria-invalid={mailError}
                    className="min-w-0 flex-1 border bg-transparent px-3 py-2.5 text-[13px] outline-none"
                    style={{ borderColor: mailError ? C.err : C.lineStrong, color: C.fg }}
                  />
                  <button
                    type="submit"
                    className="border px-4 py-2.5 text-[13px] font-medium transition-colors duration-300"
                    style={{ borderColor: C.ok, background: C.ok, color: C.bg }}
                  >
                    {COPY.subscribe.submit}
                  </button>
                  {mailError && (
                    <p className="m-0 w-full text-[12px]" style={{ color: C.err }}>
                      {COPY.subscribe.invalid}
                    </p>
                  )}
                </form>
              )}
            </div>
          </Panel>

          {/* ---------- подпись ---------- */}
          <footer
            className="mt-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t pt-5 text-[11.5px]"
            style={{ borderColor: C.line, color: C.faint }}
          >
            <span>
              {CLIENT.name} · {CLIENT.site}
            </span>
            <span>{COPY.demo.by}</span>
          </footer>
        </main>
      </div>
    </DemoFrame>
  );
}
