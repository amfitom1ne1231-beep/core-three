'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LIVE_H, LIVE_W, type LiveProps } from './live/kit';
import LiveBlog from './live/LiveBlog';
import LiveBot from './live/LiveBot';
import LiveLanding from './live/LiveLanding';
import LiveOps from './live/LiveOps';
import LiveShop from './live/LiveShop';
import LiveWebApp from './live/LiveWebApp';
import { SITE } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

const LIVE: Record<string, ComponentType<LiveProps>> = {
  landing: LiveLanding,
  blog: LiveBlog,
  shop: LiveShop,
  bot: LiveBot,
  webapp: LiveWebApp,
  ops: LiveOps
};

const N = SITE.services.length;
/** Секунд на направление при автопрокрутке: переход, затухание и цикл вставки ~6 с. */
const AUTOPLAY = 7.5;
const ASPECT = LIVE_W / LIVE_H;

const mod = (v: number) => ((v % N) + N) % N;
const pad = (i: number) => String(i + 1).padStart(2, '0');

type Frame = { x: number; s: number; cl: number; cr: number; o: number; dim: number };

/**
 * Состояния кадра по смещению от активного: −1 ушёл, 0 активный, 1…3 очередь.
 * Промежуточные положения — линейная смесь соседних, поэтому один и тот же
 * код рисует и перетаскивание пальцем, и анимированный переход.
 */
function frames(A: number, g: number): Record<number, Frame> {
  const ps = 0.52; // масштаб карточки в очереди
  const pc = 0.2; // обрезка карточки с каждого бока: широкий кадр → вертикальная карточка
  const pw = A * ps * (1 - 2 * pc); // видимая ширина карточки
  const peekX = (k: number) => A + g + k * (pw + g) - pc * A * ps;
  return {
    [-1]: { x: -0.16 * A, s: 0.88, cl: 0, cr: 1, o: 0.5, dim: 0.7 },
    0: { x: 0, s: 1, cl: 0, cr: 0, o: 1, dim: 0 },
    1: { x: peekX(0), s: ps, cl: pc, cr: pc, o: 1, dim: 0.45 },
    2: { x: peekX(1), s: ps, cl: pc, cr: pc, o: 1, dim: 0.62 },
    3: { x: peekX(2), s: ps, cl: pc, cr: pc, o: 0, dim: 0.8 }
  };
}

function frameAt(table: Record<number, Frame>, d: number): Frame | null {
  if (d < -1 || d > 3) return null;
  const k = Math.min(Math.floor(d), 2);
  const t = d - k;
  const a = table[k];
  const b = table[k + 1];
  const mix = (x: number, y: number) => x + (y - x) * t;
  return { x: mix(a.x, b.x), s: mix(a.s, b.s), cl: mix(a.cl, b.cl), cr: mix(a.cr, b.cr), o: mix(a.o, b.o), dim: mix(a.dim, b.dim) };
}

/**
 * Атлас направлений — сцена-карусель.
 *
 * Кадры листаются вбок, и переход — не сдвиг ленты, а превращение:
 * уходящий кадр сжимается и схлопывается влево, следующий выходит из узкой
 * вертикальной карточки справа и раскрывается в широкий кадр. Внутри кадра
 * вставка приближается и едет с параллаксом. Приём собран из двух ходов
 * Spyker — раскрытия медиа из рамки и масштаба на уходе.
 *
 * У каждого направления своя живая вставка в своём стиле: шесть кадров
 * не сливаются в один тон. Играет только активная.
 *
 * Управление: перетаскивание мышью и пальцем, горизонтальный жест тачпада,
 * стрелки клавиатуры, кнопки, рельс и автопрокрутка с паузой.
 *
 * Автопрокрутка идёт и под курсором: мышь почти всегда лежит на карусели,
 * пока её смотрят, и пауза по наведению выглядела как «переходов нет».
 * Встаёт она по кнопке, при фокусе с клавиатуры, при перетаскивании,
 * вне экрана и на скрытой вкладке; при prefers-reduced-motion не
 * включается вовсе.
 */
export default function Atlas() {
  const root = useRef<HTMLElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const slides = useRef<HTMLDivElement[]>([]);
  const inners = useRef<HTMLDivElement[]>([]);
  const dims = useRef<HTMLDivElement[]>([]);
  const copies = useRef<HTMLDivElement[]>([]);
  const nums = useRef<HTMLSpanElement[]>([]);
  const fills = useRef<HTMLSpanElement[]>([]);

  const pos = useRef({ p: 0 });
  const target = useRef(0);
  const geom = useRef({ A: 600, H: 400, g: 28, table: frames(600, 28) });
  const move = useRef<gsap.core.Tween | null>(null);
  const timer = useRef<gsap.core.Tween | null>(null);
  const hold = useRef({ focus: false, drag: false, hidden: false, view: false, reduced: false });

  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [auto, setAuto] = useState(true);
  const [announce, setAnnounce] = useState('');
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const indexRef = useRef(0);

  const groupLabel = (id: string) => SITE.groups.find((g) => g.id === id)?.label ?? '';

  /* ---------------- отрисовка по положению ---------------- */

  const render = useCallback(() => {
    const { A, table } = geom.current;
    const p = pos.current.p;
    slides.current.forEach((el, i) => {
      let d = mod(i - p);
      if (d > N / 2) d -= N;
      const f = frameAt(table, d);
      if (!f || f.o <= 0.001) {
        el.style.visibility = 'hidden';
        return;
      }
      el.style.visibility = 'visible';
      el.style.opacity = f.o.toFixed(3);
      el.style.zIndex = String(10 - Math.round(Math.abs(d) * 2));
      el.style.transform = `translate3d(${f.x.toFixed(2)}px,0,0) scale(${f.s.toFixed(4)})`;
      // скругление делим на масштаб, чтобы на глаз оно было одинаковым
      el.style.clipPath = `inset(0% ${(f.cr * 100).toFixed(2)}% 0% ${(f.cl * 100).toFixed(2)}% round ${(12 / f.s).toFixed(1)}px)`;
      const dim = dims.current[i];
      if (dim) dim.style.opacity = f.dim.toFixed(3);
      const inner = inners.current[i];
      if (inner) {
        const a = Math.min(Math.abs(d), 1);
        inner.style.transform = `translate3d(${(d * 0.06 * A).toFixed(2)}px,0,0) scale(${(1 + 0.14 * a).toFixed(4)})`;
      }
    });
    const near = mod(Math.round(p));
    if (near !== indexRef.current) {
      indexRef.current = near;
      setIndex(near);
    }
  }, []);

  /* ---------------- автопрокрутка ---------------- */

  const canPlay = () => {
    const h = hold.current;
    return autoRef.current && h.view && !h.focus && !h.drag && !h.hidden && !h.reduced;
  };

  const syncTimer = useCallback(() => {
    const t = timer.current;
    if (!t) return;
    if (canPlay()) t.play();
    else t.pause();
  }, []);

  const goTo = useCallback(
    (to: number, user = false) => {
      target.current = to;
      move.current?.kill();
      const reduced = hold.current.reduced;
      move.current = gsap.to(pos.current, {
        p: to,
        duration: reduced ? 0 : 1.15,
        ease: 'power3.inOut',
        onUpdate: render
      });
      if (reduced) render();
      if (user) {
        const s = SITE.services[mod(to)];
        setAnnounce(`Направление ${pad(mod(to))} из ${pad(N - 1)}: ${s.title} ${s.titleAccent}`);
      }
    },
    [render]
  );

  const step = useCallback((dir: 1 | -1, user = false) => goTo(target.current + dir, user), [goTo]);

  const goToIndex = useCallback(
    (i: number) => {
      const from = target.current;
      let delta = mod(i - from);
      if (delta > N / 2) delta -= N;
      if (delta !== 0) goTo(from + delta, true);
    },
    [goTo]
  );

  // таймер привязан к активному сегменту рельса: заполнение и есть обратный отсчёт
  useEffect(() => {
    fills.current.forEach((f, i) => {
      if (i !== index) gsap.set(f, { scaleX: 0 });
    });
    timer.current?.kill();
    const fill = fills.current[index];
    if (!fill) return;
    timer.current = gsap.fromTo(
      fill,
      { scaleX: 0 },
      { scaleX: 1, duration: AUTOPLAY, ease: 'none', paused: true, onComplete: () => step(1) }
    );
    syncTimer();
  }, [index, step, syncTimer]);

  useEffect(() => {
    syncTimer();
  }, [auto, syncTimer]);

  /* ---------------- смена текста ---------------- */

  const copyTl = useRef<gsap.core.Timeline | null>(null);
  const prevIndex = useRef(0);
  useEffect(() => {
    const from = prevIndex.current;
    if (from === index) return;
    prevIndex.current = index;
    // направление движения — откуда пришли
    let delta = mod(index - from);
    if (delta > N / 2) delta -= N;
    const dir = delta >= 0 ? 1 : -1;

    copyTl.current?.progress(1).kill();
    const out = copies.current[from];
    const inn = copies.current[index];
    const numOut = nums.current[from];
    const numIn = nums.current[index];
    if (!out || !inn || !numOut || !numIn) return;
    const fast = hold.current.reduced ? 0 : 1;

    const tl = gsap.timeline();
    tl.to(out.querySelectorAll('[data-ln]'), {
      yPercent: -110 * dir,
      opacity: 0,
      duration: 0.4 * fast,
      ease: 'power2.in',
      stagger: 0.03 * fast
    })
      .to(numOut, { yPercent: -100 * dir, duration: 0.55 * fast, ease: 'power3.in' }, 0)
      .set(numIn, { visibility: 'visible' }, 0)
      .set(out, { autoAlpha: 0 })
      .set(inn, { autoAlpha: 1 }, 0.2 * fast)
      .fromTo(numIn, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.9 * fast, ease: 'expo.out' }, 0.35 * fast)
      .fromTo(
        inn.querySelectorAll('[data-ln]'),
        { yPercent: 110 * dir, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.85 * fast, ease: 'expo.out', stagger: 0.06 * fast },
        0.35 * fast
      );
    copyTl.current = tl;
  }, [index]);

  /* ---------------- геометрия, жесты, наблюдатели ---------------- */

  useEffect(() => {
    const sec = root.current;
    const st = stage.current;
    const sh = shell.current;
    if (!sec || !st || !sh) return;
    hold.current.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (hold.current.reduced) setAuto(false);

    const measure = () => {
      const lg = matchMedia('(min-width: 1024px)').matches;
      const w = st.clientWidth;
      let A = w * (lg ? 0.76 : 0.8);
      let H = A / ASPECT;
      const maxH = innerHeight * (lg ? 0.58 : 0.46);
      if (H > maxH) {
        H = maxH;
        A = H * ASPECT;
      }
      const g = lg ? 28 : 14;
      geom.current = { A, H, g, table: frames(A, g) };
      sec.style.setProperty('--A', `${A.toFixed(1)}px`);
      sec.style.setProperty('--H', `${H.toFixed(1)}px`);
      sec.style.setProperty('--live-k', (A / LIVE_W).toFixed(4));
      render();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(st);

    // только на экране: и таймер, и вставки
    const io = new IntersectionObserver(
      ([e]) => {
        hold.current.view = e.isIntersecting;
        setInView(e.isIntersecting);
        syncTimer();
      },
      { threshold: 0.3 }
    );
    io.observe(sh);

    const onVis = () => {
      hold.current.hidden = document.hidden;
      syncTimer();
    };
    document.addEventListener('visibilitychange', onVis);

    // фокус с клавиатуры держит слайд; клик мышью фокус тоже ставит,
    // поэтому учитываем только :focus-visible
    const fin = (e: FocusEvent) => {
      if ((e.target as HTMLElement).matches?.(':focus-visible')) {
        hold.current.focus = true;
        syncTimer();
      }
    };
    const fout = (e: FocusEvent) => {
      if (sh.contains(e.relatedTarget as Node)) return;
      hold.current.focus = false;
      syncTimer();
    };
    sh.addEventListener('focusin', fin);
    sh.addEventListener('focusout', fout);

    // перетаскивание: палец и мышь двигают положение напрямую
    let start: { x: number; y: number; p: number } | null = null;
    let dragging = false;
    let last = { x: 0, t: 0, v: 0 };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, p: pos.current.p };
      dragging = false;
      last = { x: e.clientX, t: performance.now(), v: 0 };
    };
    const moveH = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          dragging = true;
          hold.current.drag = true;
          try {
            st.setPointerCapture(e.pointerId);
          } catch {
            /* указатель уже отпущен — тянем без захвата */
          }
          move.current?.kill();
          syncTimer();
          st.dataset.dragging = '';
        } else if (Math.abs(dy) > 8) {
          start = null; // вертикальный жест — это скролл страницы
          return;
        } else return;
      }
      const { A, g } = geom.current;
      pos.current.p = start.p - dx / (A + g);
      render();
      const now = performance.now();
      const dt = now - last.t;
      if (dt > 0) last = { x: e.clientX, t: now, v: (e.clientX - last.x) / dt };
    };
    const up = () => {
      if (dragging && start) {
        const { A, g } = geom.current;
        // бросок: скорость добавляет до одного кадра сверху
        const fling = gsap.utils.clamp(-1, 1, (-last.v * 220) / (A + g));
        const to = Math.round(pos.current.p + fling);
        goTo(gsap.utils.clamp(Math.round(start.p) - 2, Math.round(start.p) + 2, to), true);
        // клик после перетаскивания не должен открывать карточку
        st.dataset.justDragged = '';
        setTimeout(() => delete st.dataset.justDragged, 50);
      }
      start = null;
      dragging = false;
      hold.current.drag = false;
      delete st.dataset.dragging;
      syncTimer();
    };
    st.addEventListener('pointerdown', down);
    st.addEventListener('pointermove', moveH);
    st.addEventListener('pointerup', up);
    st.addEventListener('pointercancel', up);

    // горизонтальный жест тачпада листает по одному кадру
    let acc = 0;
    let locked = false;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      acc += e.deltaX;
      if (locked || Math.abs(acc) < 50) return;
      step(acc > 0 ? 1 : -1, true);
      acc = 0;
      locked = true;
      setTimeout(() => (locked = false), 700);
    };
    st.addEventListener('wheel', wheel, { passive: false });

    // вход в секцию по-спайкеровски: сцена раскрывается из рамки
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          st,
          { clipPath: 'inset(10% 6% 10% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            ease: 'none',
            scrollTrigger: { trigger: sh, start: 'top 90%', end: 'top 40%', scrub: 0.6 }
          }
        );
        // Сдвиг 26px за 0.9s поверх инерции Lenis читался подлагиванием:
        // глаз уже довёл страницу, а блок всё ещё догоняет. Тот же жест,
        // что у схемы, витрины и футера, — 14px за 0.55s.
        gsap.from(sh.querySelectorAll('[data-enter]'), {
          y: 14,
          opacity: 0,
          duration: 0.55,
          ease: 'power2.out',
          stagger: 0.07,
          clearProps: 'transform',
          scrollTrigger: { trigger: sh, start: 'top 80%', once: true }
        });
      });
    }, sec);

    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      sh.removeEventListener('focusin', fin);
      sh.removeEventListener('focusout', fout);
      st.removeEventListener('pointerdown', down);
      st.removeEventListener('pointermove', moveH);
      st.removeEventListener('pointerup', up);
      st.removeEventListener('pointercancel', up);
      st.removeEventListener('wheel', wheel);
      move.current?.kill();
      timer.current?.kill();
      ctx.revert();
    };
  }, [goTo, render, step, syncTimer]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1, true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1, true);
    }
  };

  /**
   * Подпись кнопки — имя страницы, а не «Подробнее о направлении».
   * Два направления делят одну страницу («Лендинги» и «Визитки» обе
   * ведут на /sites), и с общей подписью второй переход выглядел
   * промахом: кликнул другое, попал туда же.
   */
  const pageName = (href: string) =>
    SITE.pages.find((p) => p.href === href)?.label ?? SITE.atlas.more;

  const btn =
    'flex h-11 w-11 items-center justify-center rounded-full border border-line text-fg transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg';

  return (
    <section
      ref={root}
      /* якорь для ссылок со страниц направлений: «все направления» ведёт
         в карусель, а не в форму заявки */
      id="directions"
      data-recede
      data-chapter="atlas"
      className="relative z-10 w-full scroll-mt-24 overflow-hidden border-t border-line"
      // значения до первого замера, чтобы сцена не схлопнулась при загрузке
      style={{ '--A': '600px', '--H': '408px', '--live-k': 600 / LIVE_W } as React.CSSProperties}
      aria-roledescription="карусель"
      aria-label="Направления"
    >
      <div className="px-4 pt-[12vh] sm:px-8 lg:px-[72px]">
        <span className="rail-label">{SITE.atlas.label}</span>
        <div className="mt-4 grid gap-[clamp(16px,3vh,32px)] lg:grid-cols-[1.7fr_1fr] lg:items-end">
          <h2 data-skew className="display m-0 text-[clamp(28px,5.2vw,80px)]">
            {SITE.atlas.title} <span className="title-accent">{SITE.atlas.titleAccent}</span>
          </h2>
          <p className="m-0 max-w-[46ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">{SITE.atlas.lead}</p>
        </div>
      </div>

      <div
        ref={shell}
        onKeyDown={onKey}
        className="mt-[clamp(32px,6vh,72px)] grid gap-8 pb-[12vh] lg:grid-cols-[minmax(300px,0.7fr)_minmax(0,1.7fr)] lg:gap-[clamp(32px,4vw,64px)] lg:pl-[72px]"
      >
        {/* текст активного направления */}
        <div
          className="order-2 flex flex-col px-4 sm:px-8 lg:order-1 lg:min-h-[var(--H)] lg:justify-between lg:gap-6 lg:px-0"
        >
          <div data-enter className="flex items-end gap-4">
            <span className="relative block h-[1em] overflow-hidden text-[clamp(64px,8.4vw,132px)] font-light leading-none tracking-[-0.04em]">
              <span className="invisible">00</span>
              {SITE.services.map((s, i) => (
                <span
                  key={s.n}
                  ref={(el) => {
                    if (el) nums.current[i] = el;
                  }}
                  className="absolute left-0 top-0"
                  style={i === 0 ? undefined : { visibility: 'hidden' }}
                  aria-hidden
                >
                  {s.n}
                </span>
              ))}
            </span>
            <span className="mb-2 font-mono text-[11px] tracking-rail text-faint">/ {pad(N - 1)}</span>
          </div>

          <div data-enter className="mt-6 grid lg:mt-0">
            {SITE.services.map((s, i) => (
              <div
                key={s.n}
                ref={(el) => {
                  if (el) copies.current[i] = el;
                }}
                role="group"
                aria-roledescription="слайд"
                aria-label={`${pad(i)} из ${pad(N - 1)}`}
                aria-hidden={i !== index}
                inert={i !== index}
                className="[grid-area:1/1]"
                style={i === 0 ? undefined : { visibility: 'hidden', opacity: 0 }}
              >
                <div className="overflow-hidden">
                  <span data-ln className="rail-label block">
                    {groupLabel(s.group)}
                  </span>
                </div>
                <div className="mt-3 overflow-hidden pb-1">
                  <h3 data-ln className="display m-0 text-[clamp(30px,3.3vw,52px)]">
                    {s.title} <span className="title-accent">{s.titleAccent}</span>
                  </h3>
                </div>
                <div className="mt-3 overflow-hidden">
                  <p data-ln className="m-0 max-w-[40ch] text-[clamp(13px,1.05vw,15.5px)] leading-relaxed text-dim">
                    {s.summary}
                  </p>
                </div>
                <div className="mt-5 overflow-hidden">
                  <ul data-ln className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                    {s.stack.map((tech) => (
                      <li
                        key={tech}
                        className="border border-line px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-rail text-faint"
                      >
                        {tech}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6 overflow-hidden p-1 -m-1">
                  <div data-ln>
                    <Link
                      data-magnetic
                      href={s.href}
                      className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-3.5 font-mono text-[10px] uppercase tracking-rail text-fg sm:py-2.5 transition-colors duration-300 hover:border-accent hover:text-accent"
                    >
                      {pageName(s.href)}
                      <span aria-hidden>→</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* управление: кнопки и рельс-таймер */}
          <div data-enter className="mt-8 lg:mt-0">
            <div className="flex items-center gap-2.5">
              <button type="button" className={btn} onClick={() => step(-1, true)} aria-label="Предыдущее направление">
                <span aria-hidden>←</span>
              </button>
              <button type="button" className={btn} onClick={() => step(1, true)} aria-label="Следующее направление">
                <span aria-hidden>→</span>
              </button>
              <button
                type="button"
                className={`${btn} ml-1`}
                onClick={() => setAuto((v) => !v)}
                aria-label={auto ? 'Остановить автопрокрутку' : 'Включить автопрокрутку'}
              >
                {auto ? (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                    <rect x="2" y="1.5" width="2.6" height="9" fill="currentColor" />
                    <rect x="7.4" y="1.5" width="2.6" height="9" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                    <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
            <div className="mt-5 flex gap-1.5">
              {SITE.services.map((s, i) => (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => goToIndex(i)}
                  aria-label={`Направление ${s.n}: ${s.title} ${s.titleAccent}`}
                  aria-current={i === index ? 'true' : undefined}
                  /* py-3 на телефоне: кнопка рельса была 52×35, а палец
                     требует 44 по короткой стороне. Полоска и номер внутри
                     не двигаются — растёт только область нажатия */
                  className="group flex flex-1 flex-col gap-2 py-3 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg sm:py-1.5"
                >
                  <span
                    className={`font-mono text-[9px] tracking-rail transition-colors duration-300 ${
                      i === index ? 'text-fg' : 'text-faint group-hover:text-dim'
                    }`}
                  >
                    {s.n}
                  </span>
                  <span className="relative block h-px w-full bg-line">
                    <span
                      ref={(el) => {
                        if (el) fills.current[i] = el;
                      }}
                      className="absolute inset-0 origin-left scale-x-0 bg-accent"
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* сцена: кадры живут вне потока, двигает их render() */}
        <div className="order-1 pl-4 sm:pl-8 lg:order-2 lg:pl-0">
          <div
            ref={stage}
            data-cursor="drag"
            data-lenis-prevent-horizontal
            aria-hidden
            className="relative h-[var(--H)] cursor-grab touch-pan-y select-none data-[dragging]:cursor-grabbing"
          >
            {SITE.services.map((s, i) => {
              const Live = LIVE[s.live];
              return (
                <div
                  key={s.n}
                  ref={(el) => {
                    if (el) slides.current[i] = el;
                  }}
                  onClick={() => {
                    if (stage.current?.dataset.justDragged !== undefined) return;
                    if (i !== indexRef.current) goToIndex(i);
                  }}
                  className="absolute left-0 top-0 h-[var(--H)] w-[var(--A)] origin-bottom-left overflow-hidden bg-elev will-change-transform"
                  // до первого замера виден только активный кадр — без стопки из трёх
                  style={{ visibility: i === 0 ? 'visible' : 'hidden' }}
                >
                  <div
                    ref={(el) => {
                      if (el) inners.current[i] = el;
                    }}
                    className="absolute inset-0 origin-center"
                  >
                    <Live playing={inView && index === i} />
                  </div>
                  <div
                    ref={(el) => {
                      if (el) dims.current[i] = el;
                    }}
                    className="pointer-events-none absolute inset-0 bg-bg"
                    style={{ opacity: 0 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}
