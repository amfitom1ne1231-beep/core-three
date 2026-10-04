'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { onest, SITE_FONT } from '../siteFont';
import { revealReady } from '@/lib/boot';
import { scrollToY } from '@/lib/scroll';
import { TOUR_EVENT } from '@/lib/tour';
import { tourFor, type TourStep } from '@/content/tour';

type Step = { title: string; text: string; sel: string; top?: boolean };

/** Поле вокруг цели и отступ окна от краёв экрана. */
const PAD = 8;
const EDGE = 8;

/**
 * Шаги, у которых нашлась цель. Видимость здесь — только «не скрыто
 * display»: пульт на верху страницы прозрачен, но появится, когда до
 * него дойдёт очередь. Если не появится — шаг пропустится на месте.
 */
function resolve(steps: TourStep[]): Step[] {
  const out: Step[] = [];
  for (const s of steps) {
    for (const t of s.targets) {
      const el = document.querySelector(t.sel);
      if (el && (typeof el.checkVisibility !== 'function' || el.checkVisibility())) {
        out.push({ title: s.title, text: t.text ?? s.text, sel: t.sel, top: s.top });
        break;
      }
    }
  }
  return out;
}

const shown = (el: Element) =>
  typeof el.checkVisibility !== 'function' || el.checkVisibility({ opacityProperty: true, visibilityProperty: true });

/**
 * Экскурсия (HELP.md, этап 5): сайт затемняется, «окно» стоит на одном
 * элементе, рядом подпись простыми словами; «Назад · 3 из 7 · Дальше»,
 * стрелки и Esc с клавиатуры.
 *
 * Затемнение — тень вокруг самого окна, поэтому окно переезжает от шага
 * к шагу одним движением, без склейки. Пока страница едет к следующей
 * цели, окно следует за ней, а подпись ждёт: сцены главной двигаются
 * от прокрутки, и подпись появляется, когда цель встала на место.
 *
 * Страница под экскурсией не нажимается, но прокручивается — окно
 * остаётся на своём элементе. Переход на другую страницу экскурсию
 * заканчивает.
 */
export default function Tour() {
  const pathname = usePathname() ?? '/';
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [at, setAt] = useState(0);
  const [settled, setSettled] = useState(false);
  const win = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const dir = useRef(1);
  const back = useRef<Element | null>(null);
  const reduced = useRef(false);

  const start = useCallback(() => {
    const def = tourFor(location.pathname);
    const list = def ? resolve(def) : [];
    if (!list.length) return;
    back.current = document.activeElement;
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    dir.current = 1;
    setAt(0);
    setSettled(false);
    setSteps(list);
  }, []);

  const stop = useCallback(() => {
    setSteps(null);
    setSettled(false);
    const el = back.current as HTMLElement | null;
    if (el?.isConnected) el.focus({ preventScroll: true });
  }, []);

  const go = useCallback(
    (d: 1 | -1) => {
      if (!steps) return;
      const n = at + d;
      if (n >= steps.length) return stop();
      if (n < 0) return;
      dir.current = d;
      setSettled(false);
      setAt(n);
    },
    [steps, at, stop]
  );

  // запуск по событию: пульт, меню, «Помощь», предложение
  useEffect(() => {
    const on = () => void revealReady.then(start);
    addEventListener(TOUR_EVENT, on);
    return () => removeEventListener(TOUR_EVENT, on);
  }, [start]);

  // другая страница — экскурсия кончилась; `?tour` в адресе — начать
  useEffect(() => {
    setSteps(null);
    const q = new URLSearchParams(location.search);
    if (!q.has('tour')) return;
    q.delete('tour');
    history.replaceState(history.state, '', `${location.pathname}${q.size ? `?${q}` : ''}${location.hash}`);
    let timer = 0;
    void revealReady.then(() => {
      // первый экран главной проявляется после прелоадера — даём ему встать
      timer = window.setTimeout(start, 600);
    });
    return () => clearTimeout(timer);
  }, [pathname, start]);

  // экскурсия идёт — помечаем документ: предложение и прочее не лезут поверх
  useEffect(() => {
    if (!steps) return;
    document.documentElement.dataset.tour = 'on';
    return () => {
      delete document.documentElement.dataset.tour;
    };
  }, [steps]);

  // шаг: доехать до цели и дождаться, пока она встанет
  useEffect(() => {
    if (!steps) return;
    const step = steps[at]!;
    const el = document.querySelector(step.sel);
    const skip = () => {
      const n = at + dir.current;
      if (n >= 0 && n < steps.length) setAt(n);
      else if (dir.current < 0 && at + 1 < steps.length) setAt(at + 1);
      else stop();
    };
    if (!el) return skip();

    if (step.top) scrollToY(0);
    else {
      const r = el.getBoundingClientRect();
      const fits = r.top >= 88 && r.bottom <= innerHeight - 24;
      if (!fits) {
        // небольшое — в верхнюю половину экрана, большое — верхом под шапку
        const y = r.height < innerHeight * 0.5 ? scrollY + r.top + r.height / 2 - innerHeight * 0.4 : scrollY + r.top - 96;
        scrollToY(Math.max(0, y));
      }
    }

    let raf = 0;
    let last = '';
    let calm = 0;
    const t0 = performance.now();
    const wait = () => {
      const target = document.querySelector(step.sel);
      const r = target?.getBoundingClientRect();
      const key = r ? `${Math.round(r.left)}:${Math.round(r.top)}:${Math.round(r.width)}:${Math.round(r.height)}` : '';
      calm = key && key === last ? calm + 1 : 0;
      last = key;
      const ok = target && shown(target) && r && r.width > 0;
      if (ok && calm >= 10) return setSettled(true);
      if (performance.now() - t0 > 2500) return ok ? setSettled(true) : skip();
      raf = requestAnimationFrame(wait);
    };
    raf = requestAnimationFrame(wait);
    return () => cancelAnimationFrame(raf);
  }, [steps, at, stop]);

  // окно и подпись едут за целью каждый кадр, пока экскурсия открыта
  useLayoutEffect(() => {
    if (!steps) return;
    const step = steps[at]!;
    let raf = 0;
    const place = () => {
      const target = document.querySelector(step.sel);
      const w = win.current;
      const c = card.current;
      if (target && w && c) {
        const r = target.getBoundingClientRect();
        const top = Math.max(EDGE, r.top - PAD);
        const bottom = Math.min(innerHeight - EDGE, r.bottom + PAD);
        const left = Math.max(EDGE, r.left - PAD);
        const right = Math.min(innerWidth - EDGE, r.right + PAD);
        const off = bottom - top < 8 || right - left < 8;
        w.style.opacity = off ? '0' : '1';
        if (!off) {
          w.style.left = `${left}px`;
          w.style.top = `${top}px`;
          w.style.width = `${right - left}px`;
          w.style.height = `${bottom - top}px`;
        }
        // подпись: под окном, над ним, а если не помещается — внизу экрана
        const ch = c.offsetHeight;
        const cw = c.offsetWidth;
        const y = bottom + 12 + ch <= innerHeight - 12 ? bottom + 12 : top - 12 - ch >= 12 ? top - 12 - ch : innerHeight - ch - 12;
        c.style.top = `${Math.round(y)}px`;
        c.style.left = `${Math.round(Math.min(Math.max(12, left), innerWidth - cw - 12))}px`;
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [steps, at]);

  // подпись встала — фокус на «Дальше»: Enter ведёт по экскурсии
  useEffect(() => {
    if (settled) nextBtn.current?.focus({ preventScroll: true });
  }, [settled, at]);

  // клавиатура: стрелки и Esc — раньше, чем их увидят сцены страницы
  useEffect(() => {
    if (!steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Tab' && card.current) {
        // фокус по кругу внутри подписи
        const items = [...card.current.querySelectorAll<HTMLElement>('button')];
        const i = items.indexOf(document.activeElement as HTMLElement);
        const n = items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length];
        n?.focus();
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, [steps, go, stop]);

  if (!steps) return null;
  const step = steps[at]!;
  const last = at === steps.length - 1;

  return createPortal(
    <div className={`${onest.variable} tour`} style={{ fontFamily: SITE_FONT }} data-reduced={reduced.current || undefined}>
      {/* страница под экскурсией не нажимается — только прокручивается */}
      <div className="tour-block" aria-hidden />
      <div ref={win} className="tour-window" aria-hidden />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label="Экскурсия по сайту"
        className="tour-card"
        data-settled={settled || undefined}
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="rail-label">Что где</span>
          <span className="font-mono text-[10px] tracking-rail text-faint">
            {at + 1} из {steps.length}
          </span>
        </div>
        <div aria-live="polite">
          <p className="m-0 mt-3 text-[17px] font-medium leading-snug text-fg">{step.title}</p>
          <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-dim">{step.text}</p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {at > 0 && (
            <button type="button" onClick={() => go(-1)} className="brief-chip !py-2 !text-[13px]">
              Назад
            </button>
          )}
          <button
            ref={nextBtn}
            type="button"
            onClick={() => go(1)}
            className="brief-chip !border-fg !bg-fg !py-2 !text-[13px] !text-bg"
          >
            {last ? 'Готово' : 'Дальше'}
          </button>
          <button
            type="button"
            onClick={stop}
            className="ml-auto -my-2 border-0 bg-transparent py-2 font-mono text-[10px] uppercase tracking-rail text-dim transition-colors duration-300 hover:text-accent"
          >
            Закончить
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
