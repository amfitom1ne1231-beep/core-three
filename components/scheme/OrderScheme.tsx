'use client';

import { useEffect, useRef, useState } from 'react';
import { onThemeChange, readTheme, type Theme } from '@/lib/theme';
import darkShots from '@/public/scheme/dark/shots.json';
import lightShots from '@/public/scheme/light/shots.json';

/**
 * Кадры схемы «Путь одного заказа» из Blender (brand/blender/scheme.py).
 *
 * Общий план с пятью одинаковыми кубами не объяснял, что где происходит.
 * Теперь камера подходит к каждой станции по очереди: кадр — крупный план
 * одной станции, она стоит слева, справа остаётся место под живой экран.
 *
 * Кадр — рендер сцены, где всё погашено, и три вставки поверх, состояния
 * в них копятся: свет пришёл по пазу (a), станция загорелась (b), свет
 * ушёл дальше (c). Пазы проявляются маской, которая бежит по пазу:
 * настоящий свет с отражением в стекле, а не линия поверх картинки.
 * «Ушёл дальше» играет в конце кадра — и следующий кадр начинается
 * с того, что этот же свет пришёл.
 *
 * Между станциями камера не перещёлкивается, а плывёт над плитой:
 * на каждый перегон есть ролик пролёта (fly-<откуда>-<куда>.mp4), снятый
 * той же камерой. Он начинается с последнего состояния кадра и кончается
 * первым состоянием следующего, поэтому встаёт между двумя неподвижными
 * кадрами без шва: ролик проявился → камера доехала → под ним уже лежит
 * резкий кадр станции, ролик растворился. Пролёт есть только к следующей
 * станции по ходу заказа; шаг назад, прыжок через станцию, режим без
 * движения и ролик, который не успел загрузиться, — обычная смена кадра.
 *
 * Свет в кадре — на CSS-анимациях (globals.css, `.os-*`): пауза показа
 * замораживает их через `--os-play` вместе с полоской времени.
 *
 * Луч и пылинки в тёмной теме — живые, поверх рендера: запечённые,
 * они стояли бы на месте.
 */

type Box = { x: number; y: number; w: number; h: number };
type Pt = number[];
type Layer = { box: Box; paths?: Pt[][] };
type Shot = { focus: Pt; a?: Layer; b: Layer; c: Layer };
type ShotMap = { size: number[]; shots: Record<string, Shot> };

const MAPS: Record<Theme, ShotMap> = { dark: darkShots, light: lightShots };
const ROOT = '/scheme';
/** Сколько прошлый кадр лежит под новым, пока тот проявляется. */
const CROSS_MS = 900;
/** Сколько ждём первого кадра ролика, прежде чем сменить кадр без пролёта. */
const FLY_WAIT_MS = 1000;
/** Ширина маски бегущего света и её размытие, в пикселях кадра. */
const BAND = 210;
const SOFT = 26;

const d = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
const at = (b: Box) => ({ x: b.x, y: b.y, width: b.w, height: b.h, preserveAspectRatio: 'none' });

/** Пылинки в луче: место, размер и ход — одни и те же при каждом показе. */
const DUST = Array.from({ length: 18 }, (_, i) => {
  const r = (n: number) => ((Math.sin((i + 1) * 12.9898 * n) * 43758.5453) % 1 + 1) % 1;
  return { x: 8 + r(1) * 30, y: 6 + r(2) * 56, s: 2 + r(3) * 4, dur: 9 + r(4) * 10, delay: -r(5) * 18, blur: r(6) > 0.6 };
});

export default function OrderScheme({
  id,
  ready,
  onArrive,
  className = ''
}: {
  /** Станция, куда идёт показ. */
  id: string;
  ready: boolean;
  /** Камера на месте: кадр станции на сцене. */
  onArrive?: (id: string) => void;
  className?: string;
}) {
  // тема известна только в браузере: до неё кадр не грузим, иначе светлая
  // тема сначала скачала бы тёмный рендер
  const [theme, setTheme] = useState<Theme | null>(null);
  const [narrow, setNarrow] = useState(false);

  // на сцене до трёх кадров: текущий; прошлый — под проявлением нового;
  // следующий — ждёт под роликом пролёта, уже загруженный
  const [cur, setCur] = useState(id);
  const [prev, setPrev] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  /** Текущий кадр пришёл пролётом: свет по пазу уже пришёл в ролике. */
  const [flown, setFlown] = useState(false);
  const [flying, setFlying] = useState(false);
  /** Ролик, загруженный под следующий шаг: «откуда-куда». */
  const [clip, setClip] = useState<string | null>(null);

  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef({ cur, next });
  stage.current = { cur, next };
  const arrive = useRef(onArrive);
  arrive.current = onArrive;
  const abort = useRef<(() => void) | null>(null);

  useEffect(() => {
    const { cur: from, next: to } = stage.current;
    if (id === (to ?? from)) return;
    // показ ушёл в другую сторону посреди пролёта
    abort.current?.();

    let done = false;
    const cut = () => {
      if (done) return;
      done = true;
      setNext(null);
      setFlying(false);
      if (id !== from) {
        setPrev(from);
        setCur(id);
        setFlown(false);
      }
      arrive.current?.(id);
    };

    const v = video.current;
    if (!v || v.dataset.clip !== `${from}-${id}` || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cut();
      return;
    }

    let timer = 0;
    const stop = () => {
      clearTimeout(timer);
      v.removeEventListener('playing', begin);
      v.removeEventListener('ended', land);
      abort.current = null;
    };
    const land = () => {
      if (done) return;
      done = true;
      stop();
      setPrev(null);
      setCur(id);
      setNext(null);
      setFlown(true);
      setFlying(false);
      arrive.current?.(id);
    };
    const begin = () => {
      clearTimeout(timer);
      setFlying(true);
      // ролик мог встать (вкладка в фоне, сеть) — тогда садимся по времени
      timer = window.setTimeout(land, (v.duration || 2.5) * 1000 + 1500);
    };
    const fail = () => {
      stop();
      v.pause();
      cut();
    };
    abort.current = () => {
      done = true;
      stop();
      v.pause();
    };

    setNext(id);
    v.currentTime = 0;
    v.addEventListener('playing', begin, { once: true });
    v.addEventListener('ended', land, { once: true });
    timer = window.setTimeout(fail, FLY_WAIT_MS);
    v.play().catch(fail);
  }, [id]);

  useEffect(() => () => abort.current?.(), []);

  useEffect(() => {
    const t = window.setTimeout(() => setPrev(null), CROSS_MS);
    return () => clearTimeout(t);
  }, [cur]);

  useEffect(() => {
    setTheme(readTheme());
    return onThemeChange(setTheme);
  }, []);

  useEffect(() => {
    const mq = matchMedia('(max-width: 767px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const map = theme ? MAPS[theme] : null;
  const ids = map ? Object.keys(map.shots) : [];
  const src = (name: string) => `${ROOT}/${theme}/${name}.webp`;

  // следующий кадр и пролёт к нему качаются заранее — смена не ждёт сеть.
  // Ролик меняется не сразу: прошлый ещё растворяется над кадром
  useEffect(() => {
    if (!theme || !ready || flying || next) return;
    const all = Object.keys(MAPS[theme].shots);
    const after = all[(all.indexOf(cur) + 1) % all.length];
    for (const name of [after, `${after}-a`, `${after}-b`, `${after}-c`]) {
      if (name.endsWith('-a') && !MAPS[theme].shots[after].a) continue;
      new Image().src = `${ROOT}/${theme}/${name}.webp`;
    }
    const t = window.setTimeout(() => setClip(`${cur}-${after}`), 450);
    return () => clearTimeout(t);
  }, [theme, ready, cur, flying, next]);

  if (!map || !ready) return <div className={`order-scheme ${className}`} />;

  const [W, H] = map.size;
  const dark = theme === 'dark';

  return (
    <div className={`order-scheme ${className}`} data-flying={flying || undefined} aria-hidden>
      {ids
        .filter((s) => s === cur || s === prev || s === next)
        .map((s) => {
          const shot = map.shots[s];
          const on = s === cur;
          const lit: Array<['a' | 'b' | 'c', Layer]> = [];
          if (shot.a) lit.push(['a', shot.a]);
          lit.push(['b', shot.b], ['c', shot.c]);
          const mask = (k: string) => `os-${s}-${k}`;
          return (
            <div
              key={s}
              className="os-shot"
              data-on={on || undefined}
              data-out={s === prev || undefined}
              data-wait={s === next || undefined}
              data-flown={(on && flown) || undefined}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                // на телефоне кадр уже рендера: держим левую часть, где станция
                preserveAspectRatio={narrow ? 'xMinYMid slice' : 'xMidYMid slice'}
                className="absolute inset-0 h-full w-full"
              >
                <defs>
                  <filter id={mask('soft')} filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                    <feGaussianBlur stdDeviation={SOFT} />
                  </filter>
                  {lit.map(([k, layer]) =>
                    layer.paths ? (
                      <mask key={k} id={mask(k)} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                        <g filter={`url(#${mask('soft')})`} className={`os-${k}`}>
                          {layer.paths.map((pts, i) => (
                            <path key={i} d={d(pts)} pathLength={1} className="os-draw" fill="none" stroke="#fff" strokeWidth={BAND} />
                          ))}
                        </g>
                      </mask>
                    ) : (
                      // края вставки станции растворяются: её не видно даже там,
                      // где шумоподавление на краю кадра чуть разошлось с основой
                      <mask key={k} id={mask(k)} maskContentUnits="objectBoundingBox">
                        <rect width="1" height="1" fill={`url(#${mask('feather')})`} />
                      </mask>
                    )
                  )}
                  <radialGradient id={mask('feather')}>
                    <stop offset="0.62" stopColor="#fff" />
                    <stop offset="1" stopColor="#000" />
                  </radialGradient>
                </defs>

                <image href={src(s)} width={W} height={H} />
                {lit.map(([k, layer]) => (
                  <image key={k} href={src(`${s}-${k}`)} {...at(layer.box)} mask={`url(#${mask(k)})`} className={layer.paths ? undefined : 'os-glow'} />
                ))}

              </svg>
            </div>
          );
        })}

      {/* пролёт к следующей станции: лежит поверх кадров и виден, только пока играет */}
      {clip && (
        <video
          key={`${theme}/${clip}`}
          ref={video}
          data-clip={clip}
          data-on={flying || undefined}
          className="os-fly"
          src={`${ROOT}/${theme}/fly-${clip}.mp4`}
          style={{ objectPosition: narrow ? 'left center' : 'center' }}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
        />
      )}

      {/* луч и пылинки из «Kling» — только в тёмной теме; в пролёте гаснут:
          луч стоит на станции, а не едет с камерой */}
      {dark && (
        <div className="os-air pointer-events-none absolute inset-0 overflow-hidden">
          <div className="os-beam" />
          {DUST.map((p, i) => (
            <i
              key={i}
              className="os-dust"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.s,
                height: p.s,
                filter: p.blur ? 'blur(2px)' : undefined,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
