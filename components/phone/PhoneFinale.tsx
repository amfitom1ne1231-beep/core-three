'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MessengerMark from '@/components/MessengerMark';
import { createMark3D, type Mark3D } from '@/lib/mark3d';
import { isPhone } from '@/lib/phone';
import { onThemeChange, readTheme, type Theme } from '@/lib/theme';
import { OPERATOR } from '@/content/legal';
import { SITE } from '@/content/site';

const capOf = (t: Theme) => (t === 'light' ? '/mark/live/matcap-light.webp' : '/mark/live/matcap.webp');
/** Плавный вход и выход: в начале и в конце хода медленнее. */
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Финал главной на телефоне: «Есть идея? Соберём её» — и знак собирается.
 *
 * Заказчик про первую версию: «очень сыро для мобильной версии — сделать
 * всплывающее про сборку и также уходящее, если человек начинает листать
 * вверх». Раньше здесь стояли заголовок и три строки контактов на пустом
 * экране.
 *
 * Теперь сцену ведёт сама прокрутка. Пока экран въезжает, три луча знака
 * слетаются издалека и встают на место, заголовок и контакты всплывают
 * следом; стоит повести палец обратно — всё расходится и уходит в том же
 * порядке. Одно число хода (`--p`, от 0 до 1) пишется в стили секции раз
 * в кадр, остальное считает CSS (`.pf-rise` в globals.css): React в этом
 * не участвует.
 */
export default function PhoneFinale({ scroller }: { scroller: React.RefObject<HTMLDivElement | null> }) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const mark = useRef<Mark3D | null>(null);
  const [live, setLive] = useState(false);

  // знак: живая модель, собирается по ходу прокрутки
  useEffect(() => {
    const el = canvas.current;
    if (!el || !isPhone() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let gone = false;
    const offTheme = onThemeChange((t) => mark.current?.setMatcap(capOf(t)));
    createMark3D(el, { matcap: capOf(readTheme()), tap: false, spread: 1, reach: 2.6, onReady: () => setLive(true) }).then((m) => {
      if (gone) m?.destroy();
      else mark.current = m;
    });
    return () => {
      gone = true;
      offTheme();
      mark.current?.destroy();
      mark.current = null;
    };
  }, []);

  // ход сцены: 0 — она ещё целиком под экраном, 1 — встала на место
  useEffect(() => {
    const box = scroller.current;
    const sec = root.current;
    if (!box || !sec) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sec.style.setProperty('--p', '1');
      return;
    }
    let raf = 0;
    const read = () => {
      raf = 0;
      const h = box.clientHeight || 1;
      const p = Math.max(0, Math.min(1, (box.scrollTop - sec.offsetTop + h) / h));
      sec.style.setProperty('--p', p.toFixed(4));
      // лучи сходятся во второй половине хода — когда сцена уже на виду
      mark.current?.setSpread(1 - ease(Math.max(0, Math.min(1, (p - 0.35) / 0.65))));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    box.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      box.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [scroller, live]);

  const rise = (a: number) => ({ '--a': a }) as React.CSSProperties;
  const pill = 'flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-line-strong bg-elev/60 px-3 text-[14px] text-fg backdrop-blur transition-transform duration-200 active:scale-95';

  return (
    <section
      ref={root}
      data-chapter="contact"
      aria-label="Связь"
      className="phone-finale relative flex h-full snap-start snap-always flex-col px-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 68px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 108px)' }}
    >
      <span className="rail-label pf-rise" style={rise(0.2)}>
        {SITE.footer.label}
      </span>

      {/* знак: занимает всё, что осталось над текстом */}
      <div className="relative min-h-0 flex-1">
        {/* по центру его ставит правило .pf-rise.absolute — вместе с масштабом всплытия */}
        <div className="pf-rise absolute left-1/2 top-1/2 aspect-square h-full max-h-[min(100%,86vw)]" style={rise(0.1)}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[-10%]"
            style={{ background: 'radial-gradient(closest-side, rgb(var(--accent-rgb) / 0.22), rgb(var(--accent-rgb) / 0.06) 55%, transparent 78%)' }}
          />
          {!live && (['dark', 'light'] as const).map((t) => (
            // eslint-disable-next-line @next/next/no-img-element -- кадр из Blender уже нужного размера; стоит, если модель не поднялась
            <img
              key={t}
              src={t === 'light' ? '/mark/live/poster-light.webp' : '/mark/live/turn-000.webp'}
              alt=""
              loading="lazy"
              draggable={false}
              className={`only-${t} absolute inset-0 h-full w-full`}
            />
          ))}
          <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full touch-pan-y" style={{ opacity: live ? 1 : 0 }} />
        </div>
      </div>

      <h2 className="display m-0 text-[clamp(36px,11vw,48px)]">
        <span className="pf-rise block" style={rise(0.38)}>
          {SITE.footer.title}
        </span>
        <span className="title-accent pf-rise block" style={rise(0.46)}>
          {SITE.footer.titleAccent}
        </span>
      </h2>
      <p className="pf-rise mb-0 mt-3 max-w-[36ch] text-[15px] leading-[1.55] text-dim" style={rise(0.54)}>
        {SITE.footer.lead}
      </p>

      {/* что будет после заявки — на экранах, где для этого есть место */}
      <ul className="pf-facts pf-rise m-0 mt-4 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0" style={rise(0.6)}>
        {SITE.contact.facts.map((f) => (
          <li key={f} className="rail-label flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-accent" />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex gap-2">
        <a href={`https://t.me/${SITE.telegram}`} target="_blank" rel="noreferrer noopener" className={`pf-rise ${pill}`} style={rise(0.64)}>
          <MessengerMark kind="telegram" size={18} />
          Telegram
        </a>
        <a href={SITE.max} target="_blank" rel="noreferrer noopener" className={`pf-rise ${pill}`} style={rise(0.7)}>
          <MessengerMark kind="max" size={18} />
          {SITE.maxLabel}
        </a>
        <a href={`mailto:${SITE.email}`} className={`pf-rise ${pill}`} style={rise(0.76)}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 6.5h16v11H4z M4.5 7l7.5 6 7.5-6" />
          </svg>
          Почта
        </a>
      </div>

      <p className="pf-rise mb-0 mt-4 font-mono text-[9px] uppercase leading-relaxed tracking-rail text-faint" style={rise(0.8)}>
        © 2026 {SITE.name} · Самозанятый {OPERATOR.name} · ИНН {OPERATOR.inn} ·{' '}
        <Link href="/privacy" className="underline underline-offset-2">
          Политика
        </Link>
      </p>
    </section>
  );
}
