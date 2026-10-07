'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MessengerMark from '@/components/MessengerMark';
import PhoneEntries from './PhoneEntries';
import PhoneJourney from './PhoneJourney';
import PhoneMark from './PhoneMark';
import { revealReady } from '@/lib/boot';
import { OPERATOR } from '@/content/legal';
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
  const [scene, setScene] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    revealReady.then(() => setShown(true));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (left) {
      el.scrollTop = left * el.clientHeight;
      setScene(left);
    }
    let raf = 0;
    const read = () => {
      raf = 0;
      left = Math.round(el.scrollTop / Math.max(el.clientHeight, 1));
      setScene(left);
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

  const pad = { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 68px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 108px)' };
  const rise = (delay: number) => ({
    opacity: shown ? 1 : 0,
    transform: shown ? 'none' : 'translateY(14px)',
    transition: `opacity 0.7s ease ${delay}s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`
  });
  const contact = 'flex min-h-[56px] items-center justify-between gap-4 border-b border-line py-3 text-[17px] text-fg';

  return (
    <div
      ref={scroller}
      data-lenis-prevent
      className="phone-home fixed inset-0 z-10 snap-y snap-mandatory overflow-y-auto overscroll-none [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden"
    >
      {/* 1. знак и заголовок */}
      <section data-chapter="hero" aria-label="Начало" className="relative flex h-full snap-start snap-always flex-col px-4" style={pad}>
        <PhoneMark className="mx-auto mt-1 w-[min(84vw,44svh)] shrink-0" />
        <div className="mt-auto">
          <h1 className="display m-0 text-[clamp(44px,14vw,60px)]" style={rise(0.05)}>
            <span className="block">{SITE.hero.title}</span>
            <span className="block font-bold tracking-[-0.035em]">{SITE.hero.titleStrong}</span>
          </h1>
          <p className="mb-0 mt-4 max-w-[36ch] text-[15px] leading-[1.55] text-dim" style={rise(0.18)}>
            {SITE.hero.lead}
          </p>
          <div className="scroll-cue mt-5" aria-hidden />
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

      {/* 4. финал с контактами */}
      <section data-chapter="contact" aria-label="Связь" className="relative flex h-full snap-start snap-always flex-col px-4" style={pad}>
        <span className="rail-label">{SITE.footer.label}</span>
        <h2 className="display m-0 mt-3 text-[clamp(36px,11vw,48px)]">
          <span className="block">{SITE.footer.title}</span>
          <span className="title-accent block">{SITE.footer.titleAccent}</span>
        </h2>
        <p className="mb-0 mt-4 max-w-[36ch] text-[15px] leading-[1.55] text-dim">{SITE.footer.lead}</p>

        <div className="mt-6 border-t border-line">
          <a href={`https://t.me/${SITE.telegram}`} target="_blank" rel="noreferrer noopener" className={contact}>
            <span className="flex items-center gap-3">
              <MessengerMark kind="telegram" size={20} />
              Telegram <span className="text-dim">{SITE.telegramLabel}</span>
            </span>
          </a>
          <a href={SITE.max} target="_blank" rel="noreferrer noopener" className={contact}>
            <span className="flex items-center gap-3">
              <MessengerMark kind="max" size={20} />
              {SITE.maxLabel}
            </span>
          </a>
          <a href={`mailto:${SITE.email}`} className={contact}>
            {SITE.email}
          </a>
        </div>

        <p className="mb-0 mt-auto font-mono text-[9px] uppercase leading-relaxed tracking-rail text-faint">
          © 2026 {SITE.name} · Самозанятый {OPERATOR.name} · ИНН {OPERATOR.inn} ·{' '}
          <Link href="/privacy" className="underline underline-offset-2">
            Политика
          </Link>
        </p>
      </section>

      {/* где мы: четыре точки у правого края */}
      <div aria-hidden className="pointer-events-none fixed right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
        {SCENES.map((name, i) => (
          <span key={name} className={`block w-[3px] rounded-full transition-all duration-300 ${i === scene ? 'h-4 bg-fg' : 'h-[3px] bg-fg/35'}`} />
        ))}
      </div>
    </div>
  );
}
