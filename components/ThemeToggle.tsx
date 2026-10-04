'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import gsap from 'gsap';
import { onThemeChange, readTheme, switchTheme, type Theme } from '@/lib/theme';

/**
 * Выключатель света.
 *
 * Тема на этом сайте — не «чёрная или белая», а свет в студии: включён
 * или выключен. Два слова «Тёмная / Светлая» объясняли это слишком
 * в лоб. Теперь это лампа на шнурке: потянул — щёлкнуло, и свет
 * разошёлся по странице от самой лампы (`switchTheme` в lib/theme.ts).
 *
 * В шапке лампа висит на шнурке от верхнего края экрана (`cord`): её
 * можно тянуть пальцем или мышью, по клику и с клавиатуры она дёргается
 * сама. Там, где висеть не на чём — в пульте и в меню, — остаётся одна
 * лампа без шнурка.
 *
 * Не иконка солнца с луной: метафора из чужого набора выглядела бы
 * вставкой. Лампа нарисована тем же волосяным штрихом, что и всё
 * остальное; горит — в светлой теме, погашена — в тёмной.
 */

/** На сколько лампа уходит вниз, прежде чем упрётся. */
const PULL_MAX = 44;
/** Дальше этого — щелчок: свет переключается. */
const PULL_FIRE = 14;

export default function ThemeToggle({ className = '', cord = false }: { className?: string; cord?: boolean }) {
  // на сервере темы ещё нет: до первого кадра рисуем нейтрально,
  // иначе разметка разойдётся с тем, что выставил загрузочный скрипт
  const [theme, setLocal] = useState<Theme | null>(null);
  const hang = useRef<HTMLSpanElement>(null);
  const bulb = useRef<SVGSVGElement>(null);
  const drag = useRef<{ y: number; pull: number; moved: boolean } | null>(null);
  const pulled = useRef(false);

  useEffect(() => {
    setLocal(readTheme());
    return onThemeChange(setLocal);
  }, []);

  /** Свет расходится из самой лампы — оттуда, где она сейчас висит. */
  const flip = () => {
    const r = bulb.current?.getBoundingClientRect();
    switchTheme(readTheme() === 'light' ? 'dark' : 'light', r && { x: r.left + r.width / 2, y: r.top + r.height * 0.62 });
  };

  const release = (fire: boolean) => {
    if (fire) flip();
    if (hang.current) gsap.to(hang.current, { '--pull': '0px', duration: 0.95, ease: 'elastic.out(1, 0.3)', overwrite: true });
  };

  /** Клик и клавиатура: лампа сама ныряет и отпускается. */
  const tug = () => {
    if (!hang.current || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      flip();
      return;
    }
    gsap.to(hang.current, { '--pull': '15px', duration: 0.13, ease: 'power2.out', overwrite: true, onComplete: () => release(true) });
  };

  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (!cord) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, pull: 0, moved: false };
    if (hang.current) gsap.killTweensOf(hang.current);
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 4) d.moved = true;
    // шнурок тянется с сопротивлением и упирается
    d.pull = dy > 0 ? PULL_MAX * (1 - Math.exp(-dy / 55)) : 0;
    hang.current?.style.setProperty('--pull', `${d.pull.toFixed(1)}px`);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    // потянули — решает натяжение; следующий за этим click уже не нужен
    pulled.current = true;
    release(d.pull > PULL_FIRE);
  };

  const lit = theme === 'light';

  return (
    <button
      type="button"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={() => {
        if (pulled.current) pulled.current = false;
        else tug();
      }}
      aria-pressed={lit}
      aria-label={lit ? 'Свет включён. Выключить — тёмная тема' : 'Свет выключен. Включить — светлая тема'}
      className={`lamp pointer-events-auto ${cord ? 'lamp-corded' : ''} ${className}`}
    >
      <span ref={hang} className="lamp-hang">
        {cord && <span className="lamp-cord" aria-hidden />}
        <svg ref={bulb} viewBox="0 0 18 26" className="lamp-bulb" aria-hidden>
          {/* цоколь */}
          <path d="M6.2 1h5.6v4.2H6.2z" className="lamp-cap" />
          {/* колба */}
          <path d="M9 5.2c-4 0-7 3.1-7 7 0 3.9 3 7 7 7s7-3.1 7-7c0-3.9-3-7-7-7Z" className="lamp-glass" />
          {/* нить */}
          <path d="M6.2 12.6c.9-1.5 1.9-1.5 2.8 0s1.9 1.5 2.8 0" className="lamp-wire" />
        </svg>
      </span>
    </button>
  );
}
