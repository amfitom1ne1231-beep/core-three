'use client';

import { useEffect, useRef, useState } from 'react';
import { createMark3D, type Mark3D } from '@/lib/mark3d';
import { SITE } from '@/content/site';
import DockProbe from './DockProbe';

type Mode = 'live' | 'shot';

/** Кадров в обороте поворотного стола — как в brand/mark-live.mjs. */
const TURN_N = 48;
const frameSrc = (k: number) => `/mark/live/turn-${String(k).padStart(3, '0')}.webp`;

/**
 * Два знака на одном месте и в одном размере: живой и снятый.
 * Переключатель сверху меняет их мгновенно — так разницу видно лучше,
 * чем когда они стоят рядом и вдвое мельче.
 */
export default function MarkProbe() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shot = useRef<HTMLImageElement>(null);
  const [mode, setMode] = useState<Mode>('live');
  const [fps, setFps] = useState<number | null>(null);
  const [live, setLive] = useState<'wait' | 'on' | 'off'>('wait');
  const [loaded, setLoaded] = useState(0);

  // живой знак
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let mark: Mark3D | null = null;
    let gone = false;
    createMark3D(el, { onReady: () => setLive('on'), onFps: (v) => setFps(Math.round(v)) }).then((m) => {
      if (gone) m?.destroy();
      else if (m) mark = m;
      else setLive('off');
    });
    return () => {
      gone = true;
      mark?.destroy();
    };
  }, []);

  // снятый знак: кадры подгружаются, когда его выбрали
  useEffect(() => {
    if (mode !== 'shot' || loaded) return;
    let done = 0;
    for (let k = 0; k < TURN_N; k++) {
      const img = new Image();
      img.onload = img.onerror = () => setLoaded(++done);
      img.src = frameSrc(k);
    }
  }, [mode, loaded]);

  // снятый знак под пальцем: один оборот — ширина полутора рамок
  useEffect(() => {
    const el = shot.current;
    if (!el || mode !== 'shot') return;
    let turn = 0;
    let v = 0;
    let held = false;
    let last: { x: number; t: number } | null = null;
    let raf = 0;
    let prev = performance.now();
    const show = () => {
      const k = ((Math.round((turn / (2 * Math.PI)) * TURN_N) % TURN_N) + TURN_N) % TURN_N;
      const src = frameSrc(k);
      if (!el.src.endsWith(src)) el.src = src;
    };
    const down = (e: PointerEvent) => {
      held = true;
      v = 0;
      last = { x: e.clientX, t: e.timeStamp };
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!held || !last) return;
      const d = ((e.clientX - last.x) * 3.2) / Math.max(el.clientWidth, 1);
      turn += d;
      v = d / (Math.max(e.timeStamp - last.t, 1) / 1000);
      last = { x: e.clientX, t: e.timeStamp };
      show();
    };
    const up = () => {
      held = false;
      last = null;
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      if (held || Math.abs(v) < 0.01) return;
      turn += v * dt;
      v *= Math.exp(-dt * 2.6);
      show();
    };
    raf = requestAnimationFrame(tick);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [mode]);

  const tabs: [Mode, string][] = [
    ['live', 'Живой'],
    ['shot', 'Снятый']
  ];

  return (
    <main id="content" className="relative z-10 mx-auto w-full max-w-[560px] overflow-x-clip px-4 pb-[140px]">
      <section className="flex min-h-[100svh] flex-col pb-[110px] pt-[92px]">
      <div className="flex items-center justify-between gap-4">
        <span className="rail-label">
          {mode === 'live'
            ? live === 'off'
              ? 'Живой не запустился'
              : `Живой · 60 КБ · ${fps === null ? '—' : fps} к/с`
            : `Снятый · кадров ${Math.min(loaded, TURN_N)} из ${TURN_N}`}
        </span>
        <div role="tablist" aria-label="Какой знак показать" className="flex rounded-full border border-line-strong p-1">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-label transition-colors duration-200 ${
                mode === id ? 'bg-fg text-bg' : 'text-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-[1.55] text-dim">
        {mode === 'live'
          ? 'Ведите пальцем — знак крутится в любую сторону и сам встаёт на место. Коснитесь — лучи расходятся.'
          : 'Ведите пальцем вбок — это кадры из Blender, поворот только по одной оси.'}
      </p>

      {/* на низком экране знак уступает место заголовку: сторона — не больше 38% высоты */}
      <div className="relative mx-auto mt-3 aspect-square w-[min(100%,38svh)] max-w-[520px] select-none">
        {/* свечение за знаком — готовым градиентом, без размытия на странице */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[-12%]"
          style={{ background: 'radial-gradient(closest-side, rgb(var(--accent-rgb) / 0.22), rgb(var(--accent-rgb) / 0.06) 55%, transparent 78%)' }}
        />
        <canvas
          ref={canvas}
          aria-label="Знак CoreThree, живая модель"
          className="absolute inset-0 h-full w-full touch-none"
          style={{ visibility: mode === 'live' ? 'visible' : 'hidden' }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- кадры поворотного стола меняются под пальцем, оптимизатору тут делать нечего */}
        <img
          ref={shot}
          src={frameSrc(0)}
          alt="Знак CoreThree, съёмка из Blender"
          draggable={false}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ visibility: mode === 'shot' ? 'visible' : 'hidden' }}
        />
      </div>

      <h1 className="display m-0 mt-1 text-[48px]" aria-label={`${SITE.hero.title} ${SITE.hero.titleStrong}`}>
        <span className="block">{SITE.hero.title}</span>
        <span className="block font-bold tracking-[-0.035em]">{SITE.hero.titleStrong}</span>
      </h1>

      </section>

      {/* второй экран — чтобы было что прокрутить: панель внизу сжимается и всплывает */}
      <section className="flex min-h-[100svh] flex-col justify-center border-t border-line py-16">
        <span className="rail-label">Проба нижней панели</span>
        <h2 className="display m-0 mt-5 text-[30px]">
          Низ не сливается <span className="title-accent">с панелью браузера</span>
        </h2>
        <ol className="m-0 mt-8 list-none space-y-5 p-0 text-[15px] leading-[1.6] text-dim">
          <li>
            <b className="font-medium text-fg">Листайте вниз.</b> Панель сжимается до круглой кнопки заявки — вместе с панелью Safari.
          </li>
          <li>
            <b className="font-medium text-fg">Листайте вверх.</b> Панель всплывает обратно: четыре вкладки и кнопка в центре.
          </li>
          <li>
            <b className="font-medium text-fg">Посмотрите на зазор.</b> Панель стоит островом, а не второй полосой вплотную к браузеру.
          </li>
        </ol>
        <p className="mt-8 text-[13px] leading-[1.6] text-faint">Вкладки здесь не переключают экраны — это проба вида и движения. Кнопка в центре ведёт на заявку.</p>
      </section>
      <DockProbe />
    </main>
  );
}
