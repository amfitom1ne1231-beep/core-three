'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { inView, onThemeChange, onThemePrepare, readTheme, type Theme } from '@/lib/theme';
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
 * ушёл дальше (c). Настоящий свет с отражением в стекле, а не линия
 * поверх картинки. «Ушёл дальше» загорается в конце кадра — и пролёт
 * к следующей станции начинается с того, что этот свет уже горит.
 *
 * Между станциями камера не перещёлкивается, а плывёт над плитой:
 * на каждый перегон есть ролик пролёта (fly-<откуда>-<куда>.mp4), снятый
 * той же камерой, и такой же обратный. Ролик начинается с состояния
 * кадра, от которого уходит, и кончается состоянием кадра, к которому
 * пришёл, поэтому встаёт между двумя неподвижными кадрами без шва:
 * проявился → камера доехала → под ним уже лежит резкий кадр станции →
 * растворился. Пролёт есть к соседней станции в обе стороны; прыжок
 * через станцию, режим без движения и ролик, который не заиграл
 * вовремя, — обычная смена кадра проявлением.
 *
 * Всё, что движется, движется на слое, без перерисовки: свет в кадре —
 * прозрачность вставок, дыхание кадра — масштаб, пролёт — видео. Маски
 * с размытием внутри SVG, которыми свет бежал по пазу раньше,
 * перерисовывали весь кадр на каждом шаге анимации.
 *
 * Луч и пылинки в тёмной теме — живые, поверх рендера: запечённые,
 * они стояли бы на месте.
 */

type Box = { x: number; y: number; w: number; h: number };
type Layer = { box: Box };
type Shot = { focus: number[]; a?: Layer; b: Layer; c: Layer };
type ShotMap = { size: number[]; shots: Record<string, Shot> };
/** Как камера пришла на станцию: вперёд по ходу заказа или назад. */
type Flown = 'fwd' | 'back' | null;

const MAPS: Record<Theme, ShotMap> = { dark: darkShots, light: lightShots };
const ROOT = '/scheme';
/** Сколько прошлый кадр лежит под новым, пока тот проявляется. */
const CROSS_MS = 900;
/** Сколько ждём первого кадра ролика, прежде чем сменить кадр без пролёта. */
const FLY_WAIT_MS = 1200;
/** За сколько секунд до остановки камеры возвращаются подпись и экран. */
const EARLY_S = 0.45;

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/**
 * Вставка лежит на основе своим участком. Края участка растворены:
 * шумоподавление на краю обрезанного рендера чуть расходится с основой.
 * У края самого кадра растворять нечего — там свет уходит за экран.
 */
function place(box: Box, W: number, H: number, round: boolean): CSSProperties {
  const edge = (on: boolean, to: string) => (on ? `linear-gradient(${to}, transparent, #000 14%)` : null);
  const mask = round
    ? 'radial-gradient(closest-side, #000 62%, transparent 100%)'
    : [edge(box.x > 0, 'to right'), edge(box.x + box.w < W, 'to left'), edge(box.y > 0, 'to bottom'), edge(box.y + box.h < H, 'to top')]
        .filter(Boolean)
        .join(', ');
  return {
    left: pct(box.x, W),
    top: pct(box.y, H),
    width: pct(box.w, W),
    height: pct(box.h, H),
    WebkitMaskImage: mask || undefined,
    maskImage: mask || undefined,
    WebkitMaskComposite: 'source-in',
    maskComposite: 'intersect'
  };
}

/** Пылинки в луче: место, размер и ход — одни и те же при каждом показе. */
const DUST = Array.from({ length: 18 }, (_, i) => {
  const r = (n: number) => ((Math.sin((i + 1) * 12.9898 * n) * 43758.5453) % 1 + 1) % 1;
  return { x: 8 + r(1) * 30, y: 6 + r(2) * 56, s: 2 + r(3) * 4, dur: 9 + r(4) * 10, delay: -r(5) * 18, blur: r(6) > 0.6 };
});

export default function OrderScheme({
  id,
  ready,
  eager = false,
  onArrive,
  className = ''
}: {
  /** Станция, куда идёт показ. */
  id: string;
  ready: boolean;
  /** Человек взялся за управление: обратный пролёт и кадр тоже готовим заранее. */
  eager?: boolean;
  /** Камера на месте (или вот-вот встанет): пора показывать подпись и экран. */
  onArrive?: (id: string) => void;
  className?: string;
}) {
  // тема известна только в браузере: до неё кадр не грузим, иначе светлая
  // тема сначала скачала бы тёмный рендер
  const [theme, setTheme] = useState<Theme | null>(null);

  // на сцене: текущий кадр; прошлый — под проявлением нового; тот, куда
  // летит камера, — ждёт под роликом
  const [cur, setCur] = useState(id);
  const [prev, setPrev] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [flown, setFlown] = useState<Flown>(null);
  /** Ролик на сцене. */
  const [flying, setFlying] = useState<string | null>(null);
  /** Станция, для которой загружены ролики — вперёд и назад. */
  const [hub, setHub] = useState<string | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const stage = useRef({ cur, next });
  stage.current = { cur, next };
  const arrive = useRef(onArrive);
  arrive.current = onArrive;
  const abort = useRef<(() => void) | null>(null);

  const ids = theme ? Object.keys(MAPS[theme].shots) : [];
  const near = (s: string, by: number) => ids[(ids.indexOf(s) + by + ids.length) % ids.length];

  /**
   * Кадр станции можно показывать: его картинки загружены и разобраны,
   * и браузер успел их нарисовать.
   *
   * На это опирается всё, что уходит со сцены, — ролик пролёта и прошлый
   * кадр. Раньше они уходили по часам, и если новый кадр к этому моменту
   * не был готов (на телефоне по сети — обычное дело, да и разбор большой
   * картинки там не мгновенный), под ними оказывалась пустота: на сцене
   * на секунду-другую оставался фон страницы. Теперь уходящее держится,
   * пока под ним не встанет готовый кадр.
   */
  const shown = useCallback(async (s: string) => {
    // кадр мог ещё не попасть в разметку: даём React его поставить
    await new Promise((ok) => requestAnimationFrame(ok));
    const imgs = Array.from(root.current?.querySelectorAll<HTMLImageElement>(`.os-shot[data-shot="${s}"] img`) ?? []);
    await Promise.all(
      imgs.map((img) =>
        img.decode().catch(
          // не разобралась (сеть, формат) — ждём хотя бы конца загрузки
          () => img.complete || new Promise((ok) => ['load', 'error'].forEach((e) => img.addEventListener(e, ok, { once: true })))
        )
      )
    );
    // два кадра экрана: первый — раскладка, второй — уже с картинкой
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  }, []);

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
      setFlying(null);
      if (id !== from) {
        setPrev(from);
        setCur(id);
        setFlown(null);
      }
      arrive.current?.(id);
    };

    const clip = `${from}-${id}`;
    const v = videos.current.get(clip);
    if (!v || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cut();
      return;
    }
    const way: Flown = v.dataset.way === 'back' ? 'back' : 'fwd';

    let timer = 0;
    let frame = 0;
    let told = false;
    const tell = () => {
      if (told) return;
      told = true;
      arrive.current?.(id);
    };
    const stop = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
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
      setFlown(way);
      tell();
      // Ролик стоит на последнем кадре, пока под ним не готов кадр станции,
      // и только потом растворяется. Если за это время начался другой
      // пролёт, на сцене уже его ролик — его не трогаем.
      shown(id).then(() => setFlying((now) => (now === clip ? null : now)));
    };
    const begin = () => {
      clearTimeout(timer);
      setFlying(clip);
      // кадр дышал — чуть вырос; ролик начинается с того же масштаба
      // и за время полёта возвращается к своему
      v.style.transition = `transform ${v.duration || 2}s cubic-bezier(0.37, 0, 0.63, 1)`;
      v.style.transform = 'none';
      // подпись и экран возвращаются, пока камера ещё доезжает: остановка
      // и появление сливаются в одно движение
      const watch = () => {
        if (v.duration && v.currentTime >= v.duration - EARLY_S) tell();
        else frame = requestAnimationFrame(watch);
      };
      frame = requestAnimationFrame(watch);
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

    const cam = root.current?.querySelector('.os-shot[data-on] .os-cam');
    v.style.transition = 'none';
    v.style.transformOrigin = cam ? getComputedStyle(cam).transformOrigin : '';
    v.style.transform = cam ? getComputedStyle(cam).transform : 'none';

    setNext(id);
    v.currentTime = 0;
    v.addEventListener('playing', begin, { once: true });
    v.addEventListener('ended', land, { once: true });
    timer = window.setTimeout(fail, FLY_WAIT_MS);
    v.play().catch(fail);
  }, [id, shown]);

  useEffect(() => () => abort.current?.(), []);

  // Прошлый кадр лежит под новым, пока тот проявляется, — и пока тот
  // не готов: новый кадр, который ещё грузится, прозрачен, и без прошлого
  // под ним была бы пустота
  useEffect(() => {
    let off = false;
    Promise.all([new Promise((ok) => window.setTimeout(ok, CROSS_MS)), shown(cur)]).then(() => {
      if (!off) setPrev(null);
    });
    return () => {
      off = true;
    };
  }, [cur, shown]);

  useEffect(() => {
    setTheme(readTheme());
    return onThemeChange(setTheme);
  }, []);

  // Смена темы идёт волной по снимку страницы: кадр станции в новой теме
  // должен быть скачан и разобран до неё, иначе под фронтом окажется пустота.
  // Ждать его есть смысл, только пока сцена на экране: иначе волна стояла бы
  // полсекунды ради картинки, которую никто не видит. Качаться она начинает
  // в любом случае — к моменту, когда до сцены долистают, будет готова.
  useEffect(() => {
    if (!ready) return;
    return onThemePrepare((to) => {
      const loaded = Promise.all(
        (['', '-a', '-b', '-c'] as const)
          .filter((k) => k !== '-a' || MAPS[to].shots[cur].a)
          .map((k) => {
            const img = new Image();
            img.src = `${ROOT}/${to}/${cur}${k}.webp`;
            return img.decode().catch(() => {});
          })
      );
      return inView(root.current) ? loaded : undefined;
    });
  }, [ready, cur]);

  // Ролики следующего шага меняются не сразу: прошлый ещё растворяется
  // над кадром. Вместе с ними под сцену встаёт и следующий кадр — к началу
  // пролёта он уже загружен и разобран
  useEffect(() => {
    if (!theme || !ready || flying || next) return;
    const t = window.setTimeout(() => setHub(cur), 450);
    return () => clearTimeout(t);
  }, [theme, ready, cur, flying, next]);

  const map = theme ? MAPS[theme] : null;
  if (!map || !ready) return <div ref={root} className={`order-scheme ${className}`} />;

  const [W, H] = map.size;
  const dark = theme === 'dark';
  const src = (name: string) => `${ROOT}/${theme}/${name}`;
  // соседние кадры ждут под сценой: следующий — всегда, предыдущий — когда
  // человек взялся за управление и может шагнуть назад
  const ahead = hub === cur ? near(cur, 1) : null;
  const behind = hub === cur && eager ? near(cur, -1) : null;
  const clips = hub ? [{ name: `${hub}-${near(hub, 1)}`, way: 'fwd' }, { name: `${hub}-${near(hub, -1)}`, way: 'back' }] : [];

  return (
    <div ref={root} className={`order-scheme ${className}`} data-flying={flying ? '' : undefined} aria-hidden>
      {/* рамка рендера: покрывает сцену целиком при любом её формате */}
      <div className="os-frame">
        {ids
          .filter((s) => s === cur || s === prev || s === next || s === ahead || s === behind)
          .map((s) => {
            const shot = map.shots[s];
            const on = s === cur;
            return (
              <div
                key={s}
                // кадр, который ждёт под сценой, разбирается заранее: в момент
                // посадки браузеру остаётся только показать его
                ref={(el) => {
                  if (el && !on) el.querySelectorAll('img').forEach((img) => img.decode?.().catch(() => {}));
                }}
                className="os-shot"
                data-shot={s}
                data-on={on || undefined}
                data-out={s === prev || undefined}
                data-wait={(!on && s !== prev) || undefined}
                data-flown={(on && flown) || undefined}
              >
                {/* кадр дышит: за время показа камера чуть подходит к станции */}
                <div className="os-cam" style={{ transformOrigin: `${pct(shot.focus[0], W)} ${pct(shot.focus[1], H)}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src(`${s}.webp`)} alt="" decoding="async" draggable={false} className="absolute inset-0 h-full w-full" />
                  {(['a', 'b', 'c'] as const).map((k) => {
                    const layer = shot[k];
                    return (
                      layer && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={k}
                          src={src(`${s}-${k}.webp`)}
                          alt=""
                          decoding="async"
                          draggable={false}
                          className={`os-lit os-${k}`}
                          style={place(layer.box, W, H, k === 'b')}
                        />
                      )
                    );
                  })}
                </div>
              </div>
            );
          })}

        {/* пролёты к соседним станциям: лежат поверх кадров и видны, только пока играют */}
        {clips.map(({ name, way }) => (
          <div key={`${theme}/${name}`} className="os-fly" data-on={flying === name || undefined}>
            <video
              ref={(el) => {
                if (el) videos.current.set(name, el);
                else videos.current.delete(name);
              }}
              data-way={way}
              src={src(`fly-${name}.mp4`)}
              className="h-full w-full"
              muted
              playsInline
              // вперёд показ идёт сам — этот ролик нужен всегда; назад — только
              // тому, кто взялся за управление
              preload={way === 'fwd' || eager ? 'auto' : 'none'}
              disablePictureInPicture
              disableRemotePlayback
              tabIndex={-1}
            />
          </div>
        ))}
      </div>

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
