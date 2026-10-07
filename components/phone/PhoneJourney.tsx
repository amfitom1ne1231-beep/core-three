'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { onThemeChange, readTheme, type Theme } from '@/lib/theme';
import { plain } from '@/content/glossary';
import { SITE } from '@/content/site';

type Box = { x: number; y: number; w: number; h: number };
/** Ролик пролёта в памяти: пока качается — обещание, потом готовый адрес. */
type Clip = { url: string | null; ready: Promise<string | null> };
type Shots = { size: [number, number]; shots: Record<string, { focus: [number, number]; a?: { box: Box }; b?: { box: Box }; c?: { box: Box } }> };

/** Сколько стоит кадр, прежде чем камера полетит дальше. */
const DWELL = 5200;
/** Когда на кадре приходит свет, загорается станция и свет уходит дальше. */
const LIT_AT = [250, 950, DWELL - 750];
/** Ролик пролёта не начался за это время — меняем кадр без него. */
const FLY_WAIT = 1500;
/** Касание дольше этого — пауза, а не переключение. */
const HOLD = 220;

const STATIONS = SITE.journey.stations;
const IDS = STATIONS.map((s) => s.id);
const N = STATIONS.length;

/**
 * «Путь одного заказа» на телефоне — как истории (MOBILE.md).
 *
 * Кадр во весь экран, сверху полоска из пяти сегментов. Кадры идут сами;
 * между ними камера перелетает от станции к станции — это ролики из той же
 * сцены Blender, переснятой в портрете (`brand/blender/scheme.py --portrait`).
 * Касание справа — дальше, слева — назад, удержание — пауза. Внизу карточка:
 * что делает Анна, что в эту секунду получаете вы и кто это собирает.
 *
 * Шва между кадром и роликом нет по той же причине, что на ноутбуке: ролик
 * начинается с того, чем кончается кадр (свет ушёл дальше), и кончается
 * тем, с чего начинается следующий (свет пришёл). Соседние кадры загружены
 * заранее — когда ролик кончается, под ним уже лежит картинка.
 *
 * Играет, только пока сцена на экране.
 */
export default function PhoneJourney({ active }: { active: boolean }) {
  const { order, title } = SITE.journey;
  const [theme, setTheme] = useState<Theme>('dark');
  const [shots, setShots] = useState<Shots | null>(null);
  const [idx, setIdx] = useState(0);
  const [lit, setLit] = useState(0);
  const [flying, setFlying] = useState(false);
  const [held, setHeld] = useState(false);
  // первая встреча с историями: на пару секунд — как ими управлять
  const [hint, setHint] = useState(false);

  const video = useRef<HTMLVideoElement>(null);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const cams = useRef<(HTMLDivElement | null)[]>([]);
  // состояние кадра вне React: его читает цикл, шестьдесят раз в секунду
  const st = useRef({ idx: 0, elapsed: 0, floor: 0, busy: false, held: false, active: false, still: false });

  useEffect(() => {
    setTheme(readTheme());
    st.current.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    return onThemeChange(setTheme);
  }, []);

  // где на кадре лежат вставки света — из той же съёмки
  useEffect(() => {
    let off = false;
    fetch(`/scheme/${theme}/p/shots.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Shots | null) => !off && setShots(d))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [theme]);

  st.current.active = active;
  // пока висит подсказка, кадр стоит: человек читает её, а не пропускает первый кадр
  st.current.held = held || hint;

  const hintOff = useCallback(() => {
    setHint(false);
    try {
      localStorage.setItem('ct-stories-hint', '1');
    } catch {
      /* без хранилища подсказка просто покажется ещё раз */
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    try {
      if (localStorage.getItem('ct-stories-hint')) return;
    } catch {
      return;
    }
    setHint(true);
    const t = window.setTimeout(hintOff, 3200);
    return () => clearTimeout(t);
  }, [active, hintOff]);

  // Ролики пролётов лежат в памяти и играют оттуда. Просто скачать ролик
  // «в кэш браузера» мало: Chrome потом берёт его из кэша, а Safari за тем
  // же файлом идёт в сеть заново — и пролёт начинается через секунду после
  // касания, а то и не успевает начаться вовсе (на живом сайте вдали
  // от сервера: 0,7–1,3 с против 0,03 с в Chrome). Из памяти ролик стартует
  // сразу в любом браузере и качается один раз, а не два.
  const clips = useRef(new Map<string, Clip>());
  const gone = useRef(false);
  // ролик из памяти не открылся — дальше играем по адресу, как обычный файл
  const memory = useRef(true);
  const load = useCallback((src: string) => {
    let clip = clips.current.get(src);
    if (!clip) {
      const made: Clip = {
        url: null,
        ready: fetch(src)
          .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
          .then((blob) => (gone.current ? null : (made.url = URL.createObjectURL(blob))))
          .catch(() => {
            // не скачался — в следующий раз попробуем снова
            clips.current.delete(src);
            return null;
          })
      };
      clips.current.set(src, made);
      clip = made;
    }
    return clip;
  }, []);
  useEffect(() => {
    const map = clips.current;
    gone.current = false;
    return () => {
      gone.current = true;
      map.forEach((c) => c.url && URL.revokeObjectURL(c.url));
      map.clear();
    };
  }, []);

  const land = useCallback((to: number, floor: number) => {
    const s = st.current;
    s.idx = to;
    s.elapsed = floor >= 3 ? LIT_AT[1] : floor >= 1 ? LIT_AT[0] : 0;
    s.floor = floor;
    s.busy = false;
    setIdx(to);
    setLit(floor);
    // два кадра — картинка станции уже на экране под роликом
    requestAnimationFrame(() => requestAnimationFrame(() => setFlying(false)));
  }, []);

  /** Шаг вперёд или назад: пролёт, если ролик готов играть, иначе смена кадра. */
  const step = useCallback(
    (dir: 1 | -1) => {
      const s = st.current;
      if (s.busy) return;
      const from = s.idx;
      const to = (from + dir + N) % N;
      // вперёд ролик приводит к кадру, где свет только пришёл; назад — где уже ушёл дальше
      const floor = dir === 1 ? 1 : 3;
      const v = video.current;
      if (s.still || !v) {
        land(to, floor);
        return;
      }
      s.busy = true;
      // ролик начинается с этого состояния света — кадр под ним встаёт так же
      setLit(dir === 1 ? 3 : 1);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        v.onplaying = v.onended = v.onerror = null;
        land(to, floor);
      };
      const timer = window.setTimeout(() => {
        // не заиграл: без сети, режим экономии, запрет автозапуска
        if (v.paused || v.currentTime === 0) {
          v.pause();
          finish();
        }
      }, FLY_WAIT);
      const src = `/scheme/${theme}/p/fly-${IDS[from]}-${IDS[to]}.mp4`;
      let tried = '';
      const play = (url: string) => {
        tried = url;
        v.src = url;
        v.currentTime = 0;
        v.play().catch(() => fail(url));
      };
      const fail = (url: string) => {
        // отказ приходит дважды, событием и обещанием, — отвечаем на первый
        if (done || url !== tried) return;
        if (url !== src && v.error) {
          memory.current = false;
          play(src);
        } else finish();
      };
      v.onplaying = () => setFlying(true);
      v.onended = finish;
      v.onerror = () => {
        if (v.error) fail(tried);
      };
      if (memory.current) {
        const clip = load(src);
        if (clip.url) play(clip.url);
        // ещё качается: ждём его, а не тянем тот же файл второй раз;
        // не успеет за FLY_WAIT — кадр сменится без пролёта
        else
          clip.ready.then((url) => {
            if (done) return;
            if (url) play(url);
            else finish();
          });
        // следующий в ту же сторону качается, пока летит этот
        load(`/scheme/${theme}/p/fly-${IDS[to]}-${IDS[(to + dir + N) % N]}.mp4`);
      } else play(src);
    },
    [land, load, theme]
  );

  // ход времени: полоска, свет на кадре, дыхание кадра, шаг дальше
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(now - prev, 100);
      prev = now;
      const s = st.current;
      const v = video.current;
      const run = s.active && !s.held && !document.hidden;
      if (v && s.busy) {
        if (run && v.paused && v.readyState > 1 && !v.ended) v.play().catch(() => {});
        else if (!run && !v.paused) v.pause();
      }
      if (!run || s.busy) return;
      s.elapsed += dt;
      const next = Math.max(s.floor, s.elapsed >= LIT_AT[2] ? 3 : s.elapsed >= LIT_AT[1] ? 2 : s.elapsed >= LIT_AT[0] ? 1 : 0);
      setLit((cur) => (cur === next ? cur : next));
      const p = Math.min(s.elapsed / DWELL, 1);
      fills.current.forEach((el, i) => {
        if (el) el.style.transform = `scaleX(${i < s.idx ? 1 : i === s.idx ? p : 0})`;
      });
      // кадр дышит вокруг станции и возвращается ровно к началу пролёта
      const cam = cams.current[s.idx];
      if (cam && !s.still) cam.style.transform = `scale(${1 + 0.035 * Math.sin(Math.PI * p)})`;
      if (s.elapsed >= DWELL) step(1);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // Соседние ролики подгружаются, пока кадр стоит, — к пролёту они уже
  // в памяти. Сначала тот, что вперёд, — он нужен всегда; следом тот, что
  // назад: без него первый шаг назад по сети не успевал начаться и кадр
  // менялся наплывом. (`<link rel="preload" as="video">` для этого
  // не годится — Chrome его не понимает и пишет в консоль.)
  useEffect(() => {
    if (!active || st.current.still || !memory.current) return;
    let off = false;
    const clip = (to: number) => load(`/scheme/${theme}/p/fly-${IDS[idx]}-${IDS[to]}.mp4`);
    clip((idx + 1) % N).ready.then(() => {
      if (!off) clip((idx - 1 + N) % N);
    });
    return () => {
      off = true;
    };
  }, [active, idx, theme, load]);

  /* --- палец: касание — шаг, удержание — пауза; вертикальный свайп листает сцены --- */
  const press = useRef<{ x: number; t: number; timer: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    const timer = window.setTimeout(() => setHeld(true), HOLD);
    press.current = { x: e.clientX, t: e.timeStamp, timer };
  };
  const onUp = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p) return;
    press.current = null;
    clearTimeout(p.timer);
    if (held) {
      setHeld(false);
      return;
    }
    // касание по подсказке её закрывает и кадр не переключает
    if (hint) {
      hintOff();
      return;
    }
    if (e.type === 'pointercancel' || Math.abs(e.clientX - p.x) > 12) return;
    const w = (e.currentTarget as HTMLElement).clientWidth;
    step(e.clientX < w * 0.32 ? -1 : 1);
  };

  const cur = STATIONS[idx];
  const dir = `/scheme/${theme}/p`;
  const [W, H] = shots?.size ?? [1080, 2160];
  const pct = (b: Box) => ({ left: `${(b.x / W) * 100}%`, top: `${(b.y / H) * 100}%`, width: `${(b.w / W) * 100}%`, height: `${(b.h / H) * 100}%` });
  // Рядом с текущим кадром лежат соседние — уже загруженные. Пока сцена
  // не на экране, хватает одного: первый экран не тянет лишнего.
  const near = (i: number) => i === idx || (active && (i === (idx + 1) % N || i === (idx - 1 + N) % N));

  return (
    <div className="absolute inset-0 overflow-hidden bg-bg [container-type:size]">
      {/* Кадр: съёмка вдвое выше ширины, заполняет экран с обрезкой снизу или
          по бокам. Поднят на 7% своей высоты: станция встаёт над карточкой
          целиком, а пустой верх кадра уходит под строку с названием. */}
      <div
        className="absolute left-1/2 top-0 touch-pan-y"
        style={{ width: 'max(100cqw, 50cqh)', height: 'max(100cqh, 200cqw)', transform: 'translate(-50%, -7%)' }}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {STATIONS.map((s, i) => {
          if (!near(i)) return null;
          const map = shots?.shots[s.id];
          const on = i === idx;
          return (
            <div
              key={`${theme}/${s.id}`}
              ref={(el) => {
                cams.current[i] = el;
              }}
              className="absolute inset-0 will-change-transform"
              style={{
                opacity: on ? 1 : 0,
                // под роликом кадр меняется сразу, без ролика — наплывом
                transition: flying ? 'none' : 'opacity 0.45s ease',
                transformOrigin: map ? `${(map.focus[0] / W) * 100}% ${(map.focus[1] / H) * 100}%` : '50% 37%'
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- кадры уже сняты под телефон, оптимизатору тут делать нечего */}
              <img src={`${dir}/${s.id}.webp`} alt="" draggable={false} decoding="async" className="absolute inset-0 h-full w-full" />
              {(['a', 'b', 'c'] as const).map((k, n) => {
                const box = map?.[k]?.box;
                return box ? (
                  // eslint-disable-next-line @next/next/no-img-element -- вставка света ложится точно в свой участок кадра
                  <img
                    key={k}
                    src={`${dir}/${s.id}-${k}.webp`}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className="absolute transition-opacity duration-500"
                    style={{ ...pct(box), opacity: on && lit > n ? 1 : 0 }}
                  />
                ) : null;
              })}
            </div>
          );
        })}
        <video
          ref={video}
          muted
          playsInline
          preload="auto"
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: flying ? 1 : 0 }}
        />
      </div>

      {/* жесты — один раз: где касаться, чтобы идти назад и дальше, и про паузу */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 flex bg-bg/70 transition-opacity duration-300 ${hint ? 'opacity-100' : 'opacity-0'}`}
      >
        <span className="flex w-[32%] items-center justify-center border-r border-dashed border-fg/40">
          <span className="rail-label !text-fg">Назад</span>
        </span>
        <span className="relative flex flex-1 flex-col items-center justify-center gap-3">
          <span className="rail-label !text-fg">Дальше</span>
          <span className="text-[13px] text-dim">удерживайте — пауза</span>
        </span>
      </div>

      {/* низ уходит в фон: под карточкой и островом кадр не спорит с текстом */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%]"
        style={{ background: 'linear-gradient(to top, rgb(var(--bg-rgb)) 0%, rgb(var(--bg-rgb) / 0.9) 34%, rgb(var(--bg-rgb) / 0) 100%)' }}
      />

      {/* полоска кадров и подпись сцены */}
      <div className="pointer-events-none absolute inset-x-4" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 60px)' }}>
        <div className="flex gap-1.5" role="img" aria-label={`Кадр ${idx + 1} из ${N}`}>
          {STATIONS.map((s, i) => (
            <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-fg/25">
              <span
                ref={(el) => {
                  fills.current[i] = el;
                }}
                className="block h-full origin-left bg-fg"
                style={{ transform: `scaleX(${i < idx ? 1 : 0})` }}
              />
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h2 className="rail-label m-0 !text-fg">{title}</h2>
          <span className="flex items-center gap-1.5 rounded-full border border-line-strong bg-bg/50 px-2.5 py-1 text-[11px] text-fg backdrop-blur">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-bg">{order.who[0]}</span>
            {order.id} · {order.sum}
          </span>
        </div>
      </div>

      {/* шаги для клавиатуры и читалки: палец делает то же касанием по кадру */}
      <div className="sr-only">
        <button type="button" onClick={() => step(-1)}>
          Предыдущий кадр
        </button>
        <button type="button" onClick={() => step(1)}>
          Следующий кадр
        </button>
        <button type="button" aria-pressed={held} onClick={() => setHeld((v) => !v)}>
          Пауза
        </button>
      </div>

      {/* карточка кадра */}
      <div
        className="absolute inset-x-3 rounded-[22px] border border-line-strong bg-elev/80 p-4 backdrop-blur-xl"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 104px)' }}
      >
        <span className="rail-label">
          <b>{cur.n}</b> / {String(N).padStart(2, '0')} · {cur.name} · {cur.role}
        </span>
        <p key={cur.id} className="m-0 mt-2 animate-[ct-rise_0.5s_cubic-bezier(0.2,0.7,0.2,1)_both] text-[20px] leading-[1.2] text-fg">
          {cur.headline}
        </p>
        {/* на низком экране карточка короче: пояснение уступает место станции */}
        <p className="pj-you m-0 mt-2 text-[13.5px] leading-[1.5] text-dim">{plain(cur.you)}</p>
        <Link href={cur.service.href} className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] text-fg underline decoration-line-strong underline-offset-4">
          {cur.service.label}
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3.5 8h9 M9 4.5 12.5 8 9 11.5" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
