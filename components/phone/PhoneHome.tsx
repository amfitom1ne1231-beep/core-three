'use client';

import { useEffect, useRef, useState } from 'react';
import PhoneEntries from './PhoneEntries';
import PhoneFinale from './PhoneFinale';
import PhoneJourney from './PhoneJourney';
import PhoneMark from './PhoneMark';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { revealReady } from '@/lib/boot';
import { navigate, setHomeScene } from '@/lib/phone';
import { SITE } from '@/content/site';

const SCENES = ['Знак', 'Путь одного заказа', 'Разделы', 'Связь'];

/** На какой сцене главную оставили: вернувшись с другой вкладки, человек застаёт её там же. */
let left = 0;

/**
 * Главная на телефоне: четыре сцены по экрану (MOBILE.md).
 *
 * Сцены листаются внутри своей рамки, а не прокруткой страницы. Так экран
 * всегда ровно один: Safari не сворачивает и не разворачивает свою панель
 * посреди жеста, сцена не подпрыгивает, а остров внизу стоит на месте —
 * как в приложении. При запуске с домашнего экрана рамка занимает его весь.
 *
 * Шире телефона этого блока нет (`sm:hidden`): там прежняя главная.
 * Материал под сценами тот же, общий; о том, какая сцена на экране, ему
 * сообщает обычное событие прокрутки — своей прокрутки у страницы здесь нет.
 */
export default function PhoneHome() {
  const scroller = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [scene, setScene] = useState(0);
  const [shown, setShown] = useState(false);
  // человек уже листал — приглашение «Листайте» больше не нужно
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    revealReady.then(() => setShown(true));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (left) {
      el.scrollTop = left * el.clientHeight;
      setScene(left);
      setMoved(true);
    }
    setHomeScene(left);
    let raf = 0;
    const read = () => {
      raf = 0;
      left = Math.round(el.scrollTop / Math.max(el.clientHeight, 1));
      setScene(left);
      setHomeScene(left);
      if (left > 0) setMoved(true);
      dispatchEvent(new Event('scroll'));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  /**
   * Первый заход: следующая сцена один раз выглядывает снизу и уходит.
   * Каждая сцена занимает ровно экран, под ней ничего не видно, и без этого
   * первый экран выглядит целой страницей. Палец или колесо отменяют показ.
   */
  useEffect(() => {
    const el = scroller.current;
    if (!shown || !el || left || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      if (sessionStorage.getItem('ct-peek')) return;
      sessionStorage.setItem('ct-peek', '1');
    } catch {
      return;
    }
    let raf = 0;
    const stop = () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      el.style.scrollSnapType = '';
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('wheel', stop);
    };
    const timer = window.setTimeout(() => {
      if (el.scrollTop > 0) return stop();
      // привязка сцен на время показа снята: она тянула бы экран обратно рывком
      el.style.scrollSnapType = 'none';
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min((now - t0) / 1250, 1);
        el.scrollTop = 72 * Math.sin(Math.PI * k) ** 2;
        if (k < 1) raf = requestAnimationFrame(step);
        else stop();
      };
      raf = requestAnimationFrame(step);
    }, 1700);
    el.addEventListener('pointerdown', stop, { passive: true });
    el.addEventListener('wheel', stop, { passive: true });
    return stop;
  }, [shown]);

  const pick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(() => router.push('/help#start'));
  };

  const pad = { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 68px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 108px)' };
  const rise = (delay: number) => ({
    opacity: shown ? 1 : 0,
    transform: shown ? 'none' : 'translateY(14px)',
    transition: `opacity 0.7s ease ${delay}s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`
  });

  return (
    <div
      ref={scroller}
      data-lenis-prevent
      className="phone-home fixed inset-0 z-10 snap-y snap-mandatory overflow-y-auto overscroll-none [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden"
    >
      {/* 1. знак и заголовок */}
      <section data-chapter="hero" aria-label="Начало" className="relative flex h-full snap-start snap-always flex-col px-4" style={pad}>
        {/* знак берёт всё, что осталось над текстом: текст входит на любом экране, знак подстраивается */}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <PhoneMark className="h-full max-h-[80vw]" />
        </div>
        <div>
          <h1 className="display m-0 text-[clamp(44px,14vw,60px)]" style={rise(0.05)}>
            <span className="block">{SITE.hero.title}</span>
            <span className="block font-bold tracking-[-0.035em]">{SITE.hero.titleStrong}</span>
          </h1>
          <p className="mb-0 mt-4 max-w-[36ch] text-[15px] leading-[1.55] text-dim" style={rise(0.18)}>
            {SITE.hero.lead}
          </p>
          {/* тому, кто не знает, что ему нужно, — сразу в подбор, не дожидаясь третьей сцены */}
          <p className="mb-0 mt-3 text-[14px] leading-[1.5] text-dim" style={rise(0.28)}>
            Не знаете, что вам нужно?
          </p>
          <div className="mt-1 flex items-center justify-between gap-3" style={rise(0.34)}>
            <Link href="/help#start" onClick={pick} className="text-[14px] leading-[1.5] text-fg underline decoration-line-strong underline-offset-4">
              Подберём за четыре вопроса
            </Link>
            {/* приглашение листать: видно, пока человек не листал */}
            <span className={`phone-cue flex shrink-0 items-center gap-1.5 transition-opacity duration-500 ${moved ? 'opacity-0' : 'opacity-100'}`} aria-hidden>
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 13V3 M3.5 7.5 8 3l4.5 4.5" />
              </svg>
              <span className="rail-label !text-fg">Листайте</span>
            </span>
          </div>
        </div>
      </section>

      {/* 2. путь одного заказа — истории */}
      <section data-chapter="anatomy" aria-label={SITE.journey.title} className="relative h-full snap-start snap-always">
        <PhoneJourney active={scene === 1} />
      </section>

      {/* 3. входы */}
      <section data-chapter="concepts" aria-label="Разделы" className="relative h-full snap-start snap-always">
        <PhoneEntries active={scene === 2} near={scene >= 1} />
      </section>

      {/* 4. финал: знак собирается, контакты всплывают */}
      <PhoneFinale scroller={scroller} />

      {/* где мы: четыре точки у правого края */}
      <div aria-hidden className="pointer-events-none fixed right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
        {SCENES.map((name, i) => (
          <span key={name} className={`block w-[3px] rounded-full transition-all duration-300 ${i === scene ? 'h-4 bg-fg' : 'h-[3px] bg-fg/35'}`} />
        ))}
      </div>
    </div>
  );
}
