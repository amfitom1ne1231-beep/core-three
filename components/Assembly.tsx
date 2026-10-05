'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SITE } from '@/content/site';
import { inView as onScreen, onThemeChange, onThemePrepare, readTheme, type Theme } from '@/lib/theme';
import Words from './Words';

gsap.registerPlugin(ScrollTrigger);

const ROOT = '/assembly';
/** Грани блока по порядку направлений — те же имена, что у кадров и роликов. */
const FACES = SITE.services.map((s) => s.live);
const N = FACES.length;
/** Сколько грань стоит впереди, пока блок вращается сам. */
const AUTO_MS = 5600;
/** Сколько ждём первого кадра ролика, прежде чем сменить грань без него. */
const WAIT_MS = 900;
/** Смена граней наплывом — когда ролика нет или движение отключено. */
const CUT_MS = 450;
/** Дальше трёх граней не копим: в другую сторону ближе. */
const REACH = 3;
/** Ролик поворота: 0,9 с, 60 к/с (brand/blender/assembly.py). */
const TURN_S = 0.9;
const FPS = 60;
const FRAMES = TURN_S * FPS;
/** Докуда блок доходит, покачиваясь: первые 0,17 с поворота — градусов пять. */
const ROCK_S = 0.17;
/** Как часто блок покачивается, пока стоит без автоповорота. */
const ROCK_EVERY_MS = 12000;

const mod = (v: number) => ((v % N) + N) % N;
const pad = (i: number) => String(i + 1).padStart(2, '0');
const clip = (from: number, to: number) => `${FACES[from]}-${FACES[to]}`;

/**
 * «Шесть направлений, одна сборка» — буквально.
 *
 * Была карусель: шесть живых экранов листаются вбок. Сразу после схемы
 * с её живыми экранами страница читалась как «сначала схема с роликами,
 * потом презентация с роликами». Теперь направления — шесть граней одного
 * предмета, того же, из чего собрана схема: синий корпус, матовое стекло,
 * под стеклом светится значок. Блок крутят — рукой, стрелками, по рельсу, —
 * передняя грань горит, текст рядом говорит, что это за направление.
 * Экранов интерфейса здесь нет вовсе: они остались схеме.
 *
 * Блок снят в Blender (brand/blender/assembly.py). В покое стоит резкий
 * кадр грани; поворот к соседней — ролик той же камерой, он начинается
 * с кадра одной грани и кончается кадром другой, поэтому встаёт между
 * ними без шва, как пролёты камеры на схеме. Обратный поворот — тот же
 * ролик задом наперёд. Ролика нет или движение отключено — грани сменяют
 * друг друга наплывом.
 *
 * Сам блок вращается, пока его не тронули: первое же действие человека
 * снимает автоповорот. Края кадра растворены в странице — предмет стоит
 * на ней, а не в рамке.
 *
 * Доводка «в духе презентации» (выбор заказчика — без пересъёмки):
 * — блок не замирает: войдя в кадр, он один раз покачивается к соседней
 *   грани и обратно — так видно, что его можно повернуть, без подписи;
 *   стоя без автоповорота, покачивается изредка. Это те же ролики
 *   поворота: начало прямого и конец обратного — кадры у них общие;
 * — блок чуть уходит за курсором;
 * — на грань — одна крупная фраза, а не пять мелких строк;
 * — управление — одна полоска: точки граней, под активной идёт отсчёт,
 *   рядом пауза.
 */
export default function Assembly() {
  const root = useRef<HTMLElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const copies = useRef<HTMLDivElement[]>([]);
  const nums = useRef<HTMLSpanElement[]>([]);

  /**
   * Положение блока в покое и цель. Целые без остатка от деления: знак
   * разницы — сторона поворота, модуль — сколько граней ещё пройти.
   */
  const pos = useRef(0);
  const goal = useRef(0);
  const busy = useRef(false);
  const reduced = useRef(false);

  // на сервере темы ещё нет: кадры и ролики появляются после первого кадра
  const [theme, setTheme] = useState<Theme | null>(null);
  /** Грань, чей кадр стоит под роликом. */
  const [face, setFace] = useState(0);
  /** Направление, о котором говорит текст: меняется с началом поворота. */
  const [index, setIndex] = useState(0);
  /** Грани, чьи ролики поворота лежат наготове. */
  const [hubs, setHubs] = useState<number[]>([0]);
  const [turning, setTurning] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [cut, setCut] = useState(false);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  const [auto, setAuto] = useState(true);
  const [touched, setTouched] = useState(false);
  const [announce, setAnnounce] = useState('');

  const groupLabel = (id: string) => SITE.groups.find((g) => g.id === id)?.label ?? '';

  useEffect(() => {
    setTheme(readTheme());
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced.current) setAuto(false);
    return onThemeChange(setTheme);
  }, []);

  // Смена темы идёт волной по снимку страницы: кадр передней грани в новой
  // теме должен быть разобран до неё, иначе под волной окажется пустое место
  useEffect(
    () =>
      onThemePrepare((to) => {
        const img = new Image();
        img.src = `${ROOT}/${to}/face-${FACES[face]}.webp`;
        const loaded = img.decode().catch(() => {});
        // ждать кадр — только пока блок на экране; качаться он начинает всегда
        return onScreen(stage.current) ? loaded : undefined;
      }),
    [face]
  );

  /* ---------------- поворот ---------------- */

  const run = useCallback(() => {
    if (busy.current) return;
    const left = goal.current - pos.current;
    if (!left) {
      setMoving(false);
      return;
    }
    const dir = left > 0 ? 1 : -1;
    const from = mod(pos.current);
    const to = mod(pos.current + dir);
    busy.current = true;
    setMoving(true);
    // ролики следующего шага встают наготове, пока идёт этот
    setHubs([from, to]);

    const done = () => {
      pos.current += dir;
      busy.current = false;
      setHubs([to]);
      run();
    };
    const swap = () => {
      setCut(true);
      setFace(to);
      window.setTimeout(() => {
        setCut(false);
        done();
      }, CUT_MS);
    };

    const v = videos.current.get(clip(from, to));
    if (!v || reduced.current) {
      swap();
      return;
    }

    let wait = 0;
    let guard = 0;
    const clear = () => {
      clearTimeout(wait);
      clearTimeout(guard);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('ended', land);
    };
    function land() {
      clear();
      setFace(to);
      // ролик уходит парой кадров позже: под ним уже стоит резкий кадр грани
      window.setTimeout(() => {
        setTurning(null);
        done();
      }, 50);
    }
    function onPlaying() {
      clearTimeout(wait);
      clearTimeout(guard);
      setTurning(clip(from, to));
      // «ended» может не прийти, если ролик сняли со страницы на ходу
      guard = window.setTimeout(land, ((v!.duration || 1) / v!.playbackRate) * 1000 + 400);
    }
    v.addEventListener('playing', onPlaying);
    v.addEventListener('ended', land);
    wait = window.setTimeout(() => {
      clear();
      v.pause();
      swap();
    }, WAIT_MS);
    v.currentTime = 0;
    // длинный путь блок проходит быстрее: три грани подряд не тянутся три секунды
    v.playbackRate = Math.abs(left) > 1 ? 1.6 : 1;
    v.play().catch(() => {
      clear();
      swap();
    });
  }, []);

  /**
   * Покачивание: блок трогается к соседней грани, замедляется и возвращается.
   * Туда — начало ролика поворота, обратно — конец обратного ролика: он снят
   * из тех же кадров задом наперёд, поэтому встаёт на тот же кадр без шва.
   * Скорость ролика ведём сами — иначе блок не качается, а упирается.
   */
  const rockOff = useRef<() => void>(() => {});
  const rock = useCallback(() => {
    if (busy.current || reduced.current || goal.current !== pos.current) return;
    const a = mod(pos.current);
    const b = mod(pos.current + 1);
    const out = videos.current.get(clip(a, b));
    const back = videos.current.get(clip(b, a));
    // оба ролика должны быть разобраны: качание без возврата хуже, чем никакого
    if (!out || !back || out.readyState < 3 || back.readyState < 3) return;

    busy.current = true;
    let raf = 0;
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      clearTimeout(guard);
      out.pause();
      back.pause();
      out.playbackRate = 1;
      back.playbackRate = 1;
      setTurning(null);
      busy.current = false;
      // пока блок качался, его могли повернуть — поворот ждал своей очереди
      run();
    };
    const guard = window.setTimeout(finish, 2600);
    rockOff.current = finish;

    const home = () => {
      const k = Math.min(FRAMES - 1, Math.round(out.currentTime * FPS));
      const from = (FRAMES - 1 - k + 0.5) / FPS;
      const onSeeked = () => {
        if (over) return;
        setTurning(clip(b, a));
        back.playbackRate = 0.3;
        back.addEventListener('ended', finish, { once: true });
        back.play().catch(finish);
        const ramp = () => {
          if (over) return;
          // от вершины блок разгоняется плавно, к покою его сажает сам ролик
          back.playbackRate = Math.min(1, 0.3 + ((back.currentTime - from) / (TURN_S - from)) * 1.4);
          raf = requestAnimationFrame(ramp);
        };
        raf = requestAnimationFrame(ramp);
      };
      back.addEventListener('seeked', onSeeked, { once: true });
      back.currentTime = from;
    };
    const lean = () => {
      if (over) return;
      if (out.currentTime >= ROCK_S) {
        out.pause();
        home();
        return;
      }
      out.playbackRate = Math.max(0.25, 1 - (out.currentTime / ROCK_S) * 0.8);
      raf = requestAnimationFrame(lean);
    };
    out.currentTime = 0;
    out.playbackRate = 1;
    out
      .play()
      .then(() => {
        if (over) return;
        setTurning(clip(a, b));
        raf = requestAnimationFrame(lean);
      })
      .catch(finish);
  }, [run]);

  const say = (i: number) => {
    const s = SITE.services[i];
    setAnnounce(`Направление ${pad(i)} из ${pad(N - 1)}: ${s.title} ${s.titleAccent}`);
  };

  /** Повернуть на соседнюю грань. `user` — это сделал человек, а не таймер. */
  const turnBy = useCallback(
    (dir: 1 | -1, user = false) => {
      const next = goal.current + dir;
      if (Math.abs(next - pos.current) > REACH) return;
      goal.current = next;
      setIndex(mod(next));
      if (user) {
        setAuto(false);
        setTouched(true);
        say(mod(next));
      }
      run();
    },
    [run]
  );

  /** Повернуть к грани по номеру — коротким путём. */
  const turnTo = useCallback(
    (i: number) => {
      let delta = mod(i - goal.current);
      if (delta > N / 2) delta -= N;
      setAuto(false);
      setTouched(true);
      if (!delta) return;
      goal.current += delta;
      setIndex(i);
      say(i);
      run();
    },
    [run]
  );

  /* ---------------- смена текста ---------------- */

  const copyTl = useRef<gsap.core.Timeline | null>(null);
  const prevIndex = useRef(0);
  useEffect(() => {
    const from = prevIndex.current;
    if (from === index) return;
    prevIndex.current = index;
    let delta = mod(index - from);
    if (delta > N / 2) delta -= N;
    const dir = delta >= 0 ? 1 : -1;

    copyTl.current?.progress(1).kill();
    const out = copies.current[from];
    const inn = copies.current[index];
    const numOut = nums.current[from];
    const numIn = nums.current[index];
    if (!out || !inn || !numOut || !numIn) return;
    const fast = reduced.current ? 0 : 1;

    const tl = gsap.timeline();
    tl.to(out.querySelectorAll('[data-ln]'), {
      yPercent: -110 * dir,
      opacity: 0,
      duration: 0.34 * fast,
      ease: 'power2.in',
      stagger: 0.025 * fast
    })
      .to(numOut, { yPercent: -100 * dir, duration: 0.45 * fast, ease: 'power3.in' }, 0)
      .set(numIn, { visibility: 'visible' }, 0)
      .set(out, { autoAlpha: 0 })
      .set(inn, { autoAlpha: 1 }, 0.2 * fast)
      // текст встаёт к концу поворота: грань загорается — и её уже можно читать
      .fromTo(numIn, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.8 * fast, ease: 'expo.out' }, 0.32 * fast)
      .fromTo(
        inn.querySelectorAll('[data-ln]'),
        { yPercent: 110 * dir, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.75 * fast, ease: 'expo.out', stagger: 0.05 * fast },
        0.32 * fast
      );
    copyTl.current = tl;
  }, [index]);

  /* ---------------- покачивание: когда ---------------- */

  // Приглашение: блок вошёл в кадр и его ещё не трогали — качнулся один раз
  const invited = useRef(false);
  useEffect(() => {
    if (!inView || !near || touched || invited.current) return;
    const t = window.setTimeout(() => {
      invited.current = true;
      rock();
    }, 1400);
    return () => clearTimeout(t);
  }, [inView, near, touched, rock]);

  // В покое, без автоповорота, — изредка: предмет стоит, но не мёртвый
  useEffect(() => {
    if (auto || !inView) return;
    const t = window.setInterval(rock, ROCK_EVERY_MS);
    return () => clearInterval(t);
  }, [auto, inView, rock]);

  useEffect(() => () => rockOff.current(), []);

  /* ---------------- жесты и наблюдатели ---------------- */

  useEffect(() => {
    const sec = root.current;
    const st = stage.current;
    const sh = shell.current;
    if (!sec || !st || !sh) return;

    // ролики и кадры грузятся, когда секция на подходе, а не с первым экраном
    const soon = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          soon.disconnect();
        }
      },
      { rootMargin: '700px 0px' }
    );
    soon.observe(sec);
    const seen = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    seen.observe(st);

    /**
     * Блок берут и ведут вбок. Ролик поворота не прокручивается под пальцем —
     * он проигрывается, — поэтому жест не «тянет», а «толкает»: стоит увести
     * руку на пару десятков пикселей, и блок уже пошёл. Ведёшь дальше —
     * следующая грань встаёт в очередь.
     */
    let start: { x: number; y: number } | null = null;
    let pushed = false;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY };
      pushed = false;
    };
    const drag = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!pushed && Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
        start = null; // вертикальный жест — это скролл страницы
        return;
      }
      if (Math.abs(dx) < (pushed ? 130 : 24)) return;
      if (!pushed) {
        try {
          st.setPointerCapture(e.pointerId);
        } catch {
          /* указатель уже отпущен — ведём без захвата */
        }
        st.dataset.dragging = '';
      }
      pushed = true;
      // ведут влево — справа приходит следующая грань
      turnBy(dx < 0 ? 1 : -1, true);
      start = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      start = null;
      delete st.dataset.dragging;
    };
    st.addEventListener('pointerdown', down);
    st.addEventListener('pointermove', drag);
    st.addEventListener('pointerup', up);
    st.addEventListener('pointercancel', up);

    // горизонтальный жест тачпада — та же грань за жест
    let acc = 0;
    let locked = false;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      acc += e.deltaX;
      if (locked || Math.abs(acc) < 50) return;
      turnBy(acc > 0 ? 1 : -1, true);
      acc = 0;
      locked = true;
      setTimeout(() => (locked = false), 700);
    };
    st.addEventListener('wheel', wheel, { passive: false });

    // вход в секцию: тот же короткий жест, что у схемы и подвала
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      // блок чуть уходит за курсором — на пару пикселей, только мышью
      mm.add('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)', () => {
        const view = st.querySelector('.asm-view');
        if (!view) return;
        const x = gsap.quickTo(view, 'x', { duration: 0.9, ease: 'power3.out' });
        const y = gsap.quickTo(view, 'y', { duration: 0.9, ease: 'power3.out' });
        const follow = (e: PointerEvent) => {
          const r = st.getBoundingClientRect();
          const nx = (e.clientX - (r.left + r.width / 2)) / innerWidth;
          const ny = (e.clientY - (r.top + r.height / 2)) / innerHeight;
          x(Math.max(-1, Math.min(1, nx * 2)) * 12);
          y(Math.max(-1, Math.min(1, ny * 2)) * 7);
        };
        const rest = () => {
          x(0);
          y(0);
        };
        sec.addEventListener('pointermove', follow);
        sec.addEventListener('pointerleave', rest);
        return () => {
          sec.removeEventListener('pointermove', follow);
          sec.removeEventListener('pointerleave', rest);
        };
      });
      mm.add('(prefers-reduced-motion: no-preference)', () => {
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
      soon.disconnect();
      seen.disconnect();
      st.removeEventListener('pointerdown', down);
      st.removeEventListener('pointermove', drag);
      st.removeEventListener('pointerup', up);
      st.removeEventListener('pointercancel', up);
      st.removeEventListener('wheel', wheel);
      ctx.revert();
    };
  }, [turnBy]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      turnBy(1, true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      turnBy(-1, true);
    }
  };

  /**
   * Подпись кнопки — имя страницы, а не «Подробнее о направлении».
   * Два направления делят одну страницу («Лендинги» и «Визитки» обе
   * ведут на /sites), и с общей подписью второй переход выглядел
   * промахом: кликнул другое, попал туда же.
   */
  const pageName = (href: string) => SITE.pages.find((p) => p.href === href)?.label ?? SITE.atlas.more;

  /**
   * Ролики поворотов от граней, что наготове: к соседке справа и к соседке
   * слева. И обратный от соседки справа — им блок возвращается, покачнувшись.
   */
  const clips = [...new Set(hubs.flatMap((f) => [clip(f, mod(f + 1)), clip(f, mod(f - 1)), clip(mod(f + 1), f)]))];

  return (
    <section
      ref={root}
      /* якорь для ссылок со страниц направлений: «все направления» ведёт
         сюда, а не в форму заявки */
      id="directions"
      data-recede
      data-chapter="assembly"
      className="relative z-10 w-full scroll-mt-24 overflow-hidden border-t border-line"
      aria-roledescription="карусель"
      aria-label="Направления"
    >
      <div className="px-4 pt-[12vh] max-sm:pt-14 sm:px-8 lg:px-[72px]">
        <span className="rail-label">{SITE.atlas.label}</span>
        <div className="mt-4 grid gap-[clamp(16px,3vh,32px)] lg:grid-cols-[1.7fr_1fr] lg:items-end">
          <h2 className="display m-0 text-[clamp(28px,5.2vw,80px)]">
            {SITE.atlas.title} <span className="title-accent">{SITE.atlas.titleAccent}</span>
          </h2>
          <p className="m-0 max-w-[46ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">{SITE.atlas.lead}</p>
        </div>
      </div>

      <div
        ref={shell}
        onKeyDown={onKey}
        className="grid items-center gap-x-[clamp(24px,4vw,72px)] px-4 pb-[clamp(56px,10vh,120px)] max-sm:pb-14 sm:px-8 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)] lg:px-[72px]"
      >
        {/* ---------- текст передней грани: номер и одна крупная фраза ---------- */}
        <div className="order-3 flex flex-col lg:order-1">
          <div data-enter className="flex items-end gap-4">
            <span className="relative block h-[1em] overflow-hidden text-[clamp(56px,7.2vw,116px)] font-light leading-none tracking-[-0.04em]">
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

          <div data-enter className="mt-5 grid">
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
                {/* название направления — главное на грани: крупно, остальное ему уступает */}
                <div className="mt-3 overflow-hidden pb-2">
                  <h3 data-ln className="display m-0 text-[clamp(36px,4.5vw,72px)] leading-[1.02]">
                    {s.title} <span className="title-accent">{s.titleAccent}</span>
                  </h3>
                </div>
                <div className="mt-4 overflow-hidden">
                  <p data-ln className="m-0 max-w-[36ch] text-[clamp(15px,1.25vw,18px)] leading-relaxed text-dim">
                    <Words text={s.summary} />
                  </p>
                </div>
                <div className="-m-1 mt-7 overflow-hidden p-1">
                  <div data-ln>
                    <Link
                      data-magnetic
                      href={s.href}
                      className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-3.5 font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:border-accent hover:text-accent sm:py-2.5"
                    >
                      {pageName(s.href)}
                      <span aria-hidden>→</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- сам блок ---------- */}
        {/* верх и низ кадра пусты — блок стоит в середине; отступы подтягивают соседей к самому предмету */}
        <div className="order-1 -mb-[4%] -mt-[10%] lg:order-2 lg:mb-0 lg:-mt-[5vh]">
          <div ref={stage} data-cursor="drag" data-lenis-prevent-horizontal aria-hidden className="asm-stage">
            {/* маска — на кадре: за курсором уходит кадр вместе с ней, сцена стоит */}
            <div className="asm-view" data-cut={cut ? '' : undefined}>
              {theme &&
                FACES.map((f, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- кадры темы подставляются на клиенте, оптимизатор их не знает
                  <img
                    key={f}
                    src={near || i === 0 ? `${ROOT}/${theme}/face-${f}.webp` : undefined}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className="asm-still"
                    data-on={i === face ? '' : undefined}
                  />
                ))}
              {theme &&
                near &&
                clips.map((name) => (
                  <video
                    key={`${theme}:${name}`}
                    ref={(el) => {
                      if (el) videos.current.set(name, el);
                      else videos.current.delete(name);
                    }}
                    src={`${ROOT}/${theme}/turn-${name}.mp4`}
                    muted
                    playsInline
                    preload="auto"
                    disablePictureInPicture
                    disableRemotePlayback
                    tabIndex={-1}
                    className="asm-turn"
                    data-on={turning === name ? '' : undefined}
                  />
                ))}
            </div>
          </div>
        </div>

        {/* ---------- управление — одна полоска под блоком: шесть точек,
            под активной идёт отсчёт до следующей грани, рядом пауза ---------- */}
        <div data-enter className="order-2 mb-9 flex justify-center lg:order-3 lg:col-start-2 lg:-mt-10 lg:mb-0">
          <div className="asm-pill">
            <div className="asm-dots">
              {/* шаг точек задаёт CSS (--asm-dot): под палец он шире, чем под мышь */}
              <span className="asm-bar" style={{ transform: `translateX(calc(${index} * var(--asm-dot)))` }} aria-hidden>
                {auto ? (
                  !moving && (
                    <span
                      className="asm-timer"
                      style={{ animationDuration: `${AUTO_MS}ms`, animationPlayState: inView ? 'running' : 'paused' }}
                      onAnimationEnd={() => turnBy(1)}
                    />
                  )
                ) : (
                  <span className="asm-fill" />
                )}
              </span>
              {SITE.services.map((s, i) => (
                <button
                  key={s.n}
                  type="button"
                  className="asm-dot"
                  onClick={() => turnTo(i)}
                  aria-label={`Направление ${s.n}: ${s.title} ${s.titleAccent}`}
                  aria-current={i === index ? 'true' : undefined}
                >
                  <span className="asm-dot__mark" />
                  {/* имя направления всплывает над точкой: полоска остаётся короткой, а куда ведёт точка — видно */}
                  <span className="asm-dot__name" aria-hidden>
                    {s.title} {s.titleAccent}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="asm-play"
              onClick={() => {
                setTouched(true);
                setAuto((v) => !v);
              }}
              aria-label={auto ? 'Остановить вращение' : 'Вращать блок'}
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
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}
