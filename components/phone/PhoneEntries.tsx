'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { navigate } from '@/lib/phone';
import { onThemeChange, readTheme, type Theme } from '@/lib/theme';
import { DEMOS } from '@/content/concepts';
import { SITE } from '@/content/site';

const FACES = SITE.services.map((s) => s.live);
/** Пауза между поворотами шестигранника и между экранами демо. */
const TURN_EVERY = 2600;
const DEMO_EVERY = 2400;

const arrow = (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-bg/50 text-fg backdrop-blur">
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 8h9 M9 4.5 12.5 8 9 11.5" />
    </svg>
  </span>
);

/**
 * Входы — третья сцена главной на телефоне (MOBILE.md). Направления и демо
 * целиком живут в своих вкладках; здесь они стоят живыми плитками, и плитка
 * при нажатии вырастает в свой экран.
 *
 * «Услуги» — тот же шестигранник из Blender, что на ноутбуке: поворачивается
 * готовыми роликами. «Демо» — телефонные экраны собранных демо по очереди.
 * «С чего начать» ведёт в подбор из четырёх вопросов.
 *
 * Плитки живут, только пока сцена на экране, а их картинки грузятся,
 * когда до сцены остался один свайп (`near`): первый экран их не тянет.
 */
export default function PhoneEntries({ active, near }: { active: boolean; near: boolean }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>('dark');
  const [face, setFace] = useState(0);
  const [turning, setTurning] = useState(false);
  const [demo, setDemo] = useState(0);
  const film = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setTheme(readTheme());
    return onThemeChange(setTheme);
  }, []);

  // шестигранник: ролик поворота → следующая грань
  useEffect(() => {
    const v = film.current;
    if (!active || !v || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    let cur = face;
    const turn = () => {
      const next = (cur + 1) % FACES.length;
      const land = () => {
        cur = next;
        setFace(next);
        // два кадра — грань уже нарисована под роликом
        requestAnimationFrame(() => requestAnimationFrame(() => setTurning(false)));
        timer = window.setTimeout(turn, TURN_EVERY);
      };
      v.onplaying = () => setTurning(true);
      v.onended = land;
      v.onerror = land;
      v.src = `/assembly/${theme}/turn-${FACES[cur]}-${FACES[next]}.mp4`;
      v.play().catch(land);
    };
    timer = window.setTimeout(turn, TURN_EVERY);
    return () => {
      clearTimeout(timer);
      v.onplaying = v.onended = v.onerror = null;
      v.pause();
      setTurning(false);
    };
    // грань меняет сам цикл; заново он собирается только со сценой и темой
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, theme]);

  // демо: экраны по очереди
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setDemo((d) => (d + 1) % DEMOS.length), DEMO_EVERY);
    return () => clearInterval(t);
  }, [active]);

  const grow = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(() => router.push(href), 'grow', e.currentTarget);
  };

  // под пальцем плитка чуть поддаётся — как кнопка в приложении
  // под пальцем плитка чуть поддаётся — как кнопка в приложении
  const tile = 'relative min-h-0 overflow-hidden rounded-[22px] border border-line-strong bg-elev/70 text-fg transition-transform duration-200 active:scale-[0.975]';
  /** Подпись плитки: лежит внизу поверх картинки, под ней картинка уходит в фон плитки. */
  const caption = (title: string, text: string) => (
    <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-4 pb-4 pt-12" style={{ background: 'linear-gradient(to top, var(--bg-elev) 46%, rgb(var(--bg-rgb) / 0) 100%)' }}>
      <span className="flex min-w-0 flex-col">
        <span className="text-[18px] font-medium leading-tight">{title}</span>
        <span className="mt-1 text-[12.5px] leading-snug text-dim">{text}</span>
      </span>
      {arrow}
    </span>
  );

  return (
    <div
      className="flex h-full flex-col px-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 68px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 108px)' }}
    >
      <span className="rail-label">Дальше</span>
      <h2 className="display m-0 mt-3 text-[30px]">
        Смотрите <span className="title-accent">сами</span>
      </h2>

      <div className="mt-5 grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)_auto] gap-3">
        {/* у «Услуг» появится свой экран-обзор; пока плитка ведёт на первое направление */}
        <Link href="/sites" onClick={grow('/sites')} className={tile}>
          {/* Шестигранник стоит по центру свободной части плитки. Сам предмет
              в кадре съёмки выше середины (под ним отражение и луч), поэтому
              по центру встаёт не середина кадра, а точка на 42% его высоты. */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[76px] top-0">
            <span
              className="absolute left-0 top-1/2 block aspect-square w-full -translate-y-[42%]"
              // кадр съёмки — квадрат со своим фоном: его верх и низ растворяются, края в плитке не видно
              style={{ maskImage: 'linear-gradient(to bottom, transparent 2%, #000 24%, #000 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 2%, #000 24%, #000 80%, transparent 100%)' }}
            >
              {near && (
                // eslint-disable-next-line @next/next/no-img-element -- грань шестигранника уже снята квадратом, оптимизатору тут делать нечего
                <img src={`/assembly/${theme}/face-${FACES[face]}.webp`} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
              )}
              <video ref={film} muted playsInline preload="none" className="absolute inset-0 h-full w-full" style={{ opacity: turning ? 1 : 0 }} />
            </span>
          </span>
          {caption('Услуги', 'Шесть направлений')}
        </Link>

        <Link href="/concepts" onClick={grow('/concepts')} className={tile}>
          {/* Экран демо — целиком, в своих пропорциях, в рамке телефона: по ширине
              он входит всегда, а низ на невысокой плитке уходит под подпись. */}
          <span aria-hidden className="pointer-events-none absolute inset-x-3 top-3 block aspect-[390/700] overflow-hidden rounded-[14px] border border-line-strong bg-bg">
            {near &&
              DEMOS.map((d, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- снимок телефонного экрана демо, уже нужного размера
                <img
                  key={d.slug}
                  src={`/demos/${d.slug}-phone.webp`}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 h-full w-full transition-opacity duration-700"
                  style={{ opacity: i === demo ? 1 : 0 }}
                />
              ))}
          </span>
          {caption('Демо', 'Пять работающих')}
        </Link>

        <Link href="/help#start" onClick={grow('/help#start')} className={`${tile} col-span-2 flex items-center justify-between gap-4 p-4`}>
          <span>
            <span className="block text-[18px] font-medium leading-tight">С чего начать</span>
            <span className="mt-1 block text-[12.5px] leading-snug text-dim">Четыре вопроса — и подскажем, что вам подойдёт</span>
          </span>
          {arrow}
        </Link>
      </div>
    </div>
  );
}
