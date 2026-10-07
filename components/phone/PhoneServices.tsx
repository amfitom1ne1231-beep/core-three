'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Words from '@/components/Words';
import { clip } from '@/lib/clips';
import { isPhone, navigate } from '@/lib/phone';
import { onThemeChange, readTheme, type Theme } from '@/lib/theme';
import { SITE } from '@/content/site';

const SERVICES = SITE.services;
/** Грани блока по порядку направлений — те же имена, что у кадров и роликов. */
const FACES = SERVICES.map((s) => s.live);
const N = FACES.length;
/** Сколько грань стоит впереди, пока блок вращается сам. */
const AUTO_MS = 5200;
/** Ролик поворота не начался за это время — грань меняется наплывом. */
const TURN_WAIT = 500;
/** Сдвиг пальца короче этого — не жест. */
const SWIPE = 36;

const mod = (v: number) => ((v % N) + N) % N;
const turnSrc = (theme: Theme, from: number, to: number) => `/assembly/${theme}/turn-${FACES[from]}-${FACES[to]}.mp4`;
const groupOf = (id: string) => SITE.groups.find((g) => g.id === id)?.label ?? '';
const pageOf = (href: string) => SITE.pages.find((p) => p.href === href)?.label ?? 'Подробнее';

/**
 * «Услуги» на телефоне — экран-обзор (MOBILE.md): сверху шестигранник
 * из Blender, тот же, что в блоке направлений на ноутбуке, под ним
 * карточка направления. Блок крутят свайпом вбок или стрелками; карточка
 * при касании вырастает в экран направления.
 *
 * Повороты — готовые ролики между соседними гранями (`brand/blender/
 * assembly.py`): ролик начинается кадром одной грани и кончается кадром
 * другой, поэтому встаёт между ними без шва. Ролики играют из памяти
 * (`lib/clips`): соседние подгружаются, пока грань стоит, следующий
 * по ходу — пока крутится текущий. Карточка меняется сразу, не дожидаясь
 * конца поворота: палец получает ответ в то же мгновение.
 *
 * Блок вращается сам, пока его не тронули, — как на ноутбуке.
 */
export default function PhoneServices() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>('dark');
  // at — что в карточке; face — какая грань стоит под роликом
  const [at, setAt] = useState(0);
  const [face, setFace] = useState(0);
  const [turning, setTurning] = useState(false);
  const [auto, setAuto] = useState(true);
  const [phone, setPhone] = useState(false);

  const film = useRef<HTMLVideoElement>(null);
  const card = useRef<HTMLElement>(null);
  const st = useRef({ at: 0, busy: false, queued: 0 as 0 | 1 | -1, still: false });

  useEffect(() => {
    setTheme(readTheme());
    setPhone(isPhone());
    st.current.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    return onThemeChange(setTheme);
  }, []);

  const turn = useCallback(
    (dir: 1 | -1, byHand = true) => {
      const s = st.current;
      if (byHand) setAuto(false);
      if (s.busy) {
        // второй свайп во время поворота не теряется — играет следом
        s.queued = dir;
        return;
      }
      const from = s.at;
      const to = mod(from + dir);
      s.at = to;
      setAt(to);
      const v = film.current;
      const land = () => {
        setFace(to);
        // два кадра — грань уже нарисована под роликом
        requestAnimationFrame(() => requestAnimationFrame(() => setTurning(false)));
        s.busy = false;
        const next = s.queued;
        s.queued = 0;
        if (next) turnRef.current(next);
      };
      if (s.still || !v) {
        land();
        return;
      }
      s.busy = true;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        v.onplaying = v.onended = v.onerror = null;
        land();
      };
      const timer = window.setTimeout(() => {
        // не заиграл: без сети, режим экономии, запрет автозапуска
        if (v.paused || v.currentTime === 0) {
          v.pause();
          finish();
        }
      }, TURN_WAIT);
      v.onplaying = () => setTurning(true);
      v.onended = finish;
      v.onerror = finish;
      const play = (url: string) => {
        v.src = url;
        v.currentTime = 0;
        v.play().catch(finish);
      };
      const reel = clip(turnSrc(theme, from, to));
      if (reel.url) play(reel.url);
      else
        reel.ready.then((url) => {
          if (done) return;
          if (url) play(url);
          else finish();
        });
      // следующий в ту же сторону качается, пока крутится этот
      clip(turnSrc(theme, to, mod(to + dir)));
    },
    [theme]
  );
  const turnRef = useRef(turn);
  turnRef.current = turn;

  // соседние повороты — в память, пока грань стоит: сначала вперёд, потом назад
  useEffect(() => {
    if (!phone || st.current.still) return;
    let off = false;
    clip(turnSrc(theme, at, mod(at + 1))).ready.then(() => {
      if (!off) clip(turnSrc(theme, at, mod(at - 1)));
    });
    return () => {
      off = true;
    };
  }, [phone, at, theme]);

  // сам блок вращается, пока его не тронули
  useEffect(() => {
    if (!phone || !auto || st.current.still) return;
    const t = window.setInterval(() => {
      if (!document.hidden) turnRef.current(1, false);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [phone, auto]);

  /* --- палец: свайп вбок крутит блок, вертикальный листает страницу --- */
  const press = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    press.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p || e.type === 'pointercancel') return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    swiped.current = e.timeStamp;
    turn(dx < 0 ? 1 : -1);
  };

  const s = SERVICES[at];
  const open = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // касание, которым закончился свайп, карточку не открывает
    if (e.timeStamp - swiped.current < 350) {
      e.preventDefault();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(() => router.push(s.href), 'grow', card.current);
  };

  const near = (i: number) => i === face || i === mod(face + 1) || i === mod(face - 1);
  const round = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-bg/40 text-fg backdrop-blur transition-transform duration-200 active:scale-90';
  const chevron = (d: string) => (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );

  return (
    <section
      data-chapter="assembly"
      aria-label="Направления"
      className="phone-services flex min-h-[100svh] touch-pan-y flex-col sm:hidden"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 52px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 104px)' }}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <h1 className="sr-only">Услуги: шесть направлений</h1>

      {/* Блок. Кадр съёмки — квадрат со своим фоном: края растворяются
          в странице. Сам предмет в кадре выше середины (под ним отражение
          и луч), поэтому по центру встаёт точка на 42% высоты кадра. */}
      <div aria-hidden className="relative min-h-[190px] flex-1">
        {/* Размер — от высоты свободного места, но не шире экрана. Единицы
            контейнера здесь не годятся: у растянутой строки флекса Chrome
            считает высоту контейнера нулём. */}
        <div
          className="absolute left-1/2 top-1/2 aspect-square max-h-[100vw] -translate-x-1/2 -translate-y-[42%]"
          style={{
            height: '128%',
            maskImage: 'radial-gradient(ellipse 50% 50% at 50% 44%, #000 56%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 44%, #000 56%, transparent 100%)'
          }}
        >
          {phone &&
            FACES.map((f, i) =>
              near(i) ? (
                // eslint-disable-next-line @next/next/no-img-element -- грань уже снята квадратом, оптимизатору тут делать нечего
                <img
                  key={`${theme}/${f}`}
                  src={`/assembly/${theme}/face-${f}.webp`}
                  alt=""
                  draggable={false}
                  decoding="async"
                  className="absolute inset-0 h-full w-full"
                  // под роликом грань меняется сразу, без ролика — наплывом
                  style={{ opacity: i === face ? 1 : 0, transition: turning ? 'none' : 'opacity 0.35s ease' }}
                />
              ) : null
            )}
          <video ref={film} muted playsInline preload="auto" className="absolute inset-0 h-full w-full" style={{ opacity: turning ? 1 : 0 }} />
        </div>
      </div>

      {/* полоска граней: где мы среди шести, и стрелки — тем, кто не свайпает */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4">
        <button type="button" onClick={() => turn(-1)} aria-label="Предыдущее направление" className={round}>
          {chevron('M10 3.5 5.5 8 10 12.5')}
        </button>
        <ol className="m-0 flex list-none items-center gap-1.5 p-0" aria-label={`Направление ${at + 1} из ${N}`}>
          {SERVICES.map((x, i) => (
            <li key={x.n} className={`h-[3px] rounded-full transition-[width,background-color] duration-300 ${i === at ? 'w-7 bg-fg' : 'w-3 bg-fg/25'}`} />
          ))}
        </ol>
        <button type="button" onClick={() => turn(1)} aria-label="Следующее направление" className={round}>
          {chevron('M6 3.5 10.5 8 6 12.5')}
        </button>
      </div>

      {/* карточка направления: вырастает в его экран */}
      <article
        ref={card}
        aria-live={auto ? 'off' : 'polite'}
        className="relative z-10 mx-4 mt-3 rounded-[22px] border border-line-strong bg-elev/85 p-4 backdrop-blur-xl"
      >
        <span className="rail-label">
          <b>{s.n}</b> / {groupOf(s.group)}
        </span>
        <div key={s.n} className="animate-[ct-rise_0.42s_cubic-bezier(0.2,0.7,0.2,1)_both]">
          <h2 className="display m-0 mt-2.5 text-[27px]">
            {s.title} <span className="title-accent">{s.titleAccent}</span>
          </h2>
          <p className="m-0 mt-2.5 text-[14.5px] leading-[1.5] text-dim">
            <Words text={s.summary} plain />
          </p>
          {/* на невысоком экране место нужнее блоку: стек есть на экране направления */}
          <ul className="ps-stack m-0 mt-3.5 flex list-none flex-wrap gap-1.5 p-0">
            {s.stack.map((x) => (
              <li key={x} className="rounded-full border border-line-strong px-2.5 py-1 text-[11.5px] leading-none text-dim">
                {x}
              </li>
            ))}
          </ul>
        </div>
        <Link
          href={s.href}
          onClick={open}
          className="mt-4 flex items-center justify-between gap-3 rounded-[16px] bg-fg px-4 py-3.5 text-[15px] font-medium text-bg transition-transform duration-200 active:scale-[0.98]"
        >
          {pageOf(s.href)}
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3.5 8h9 M9 4.5 12.5 8 9 11.5" />
          </svg>
        </Link>
      </article>
    </section>
  );
}
