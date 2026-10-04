'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

type Mode = 'gone' | 'dot' | 'hover' | 'ring' | 'ring-hover' | 'field' | 'drag';

/**
 * Курсор-инверсия и магнитные кнопки.
 *
 * Точка рисуется в режиме difference и инвертирует всё под собой, над
 * кнопками разрастается в круг. Над материалом первого экрана difference
 * дал бы кислотные разводы на синем, поэтому там (data-cursor="ring")
 * остаётся тонкое кольцо без смешения — след курсора уже рисует сам шейдер.
 *
 * Над блоком направлений (data-cursor="drag") кольцо раздувается и подписывает
 * жест: «Крутить».
 *
 * Над полями ввода собственный курсор прячется: нужна обычная каретка.
 * Включается только для мыши и без prefers-reduced-motion.
 */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches);
  }, []);

  useEffect(() => {
    const d = dot.current;
    const r = ring.current;
    if (!on || !d || !r) return;

    const root = document.documentElement;
    root.classList.add('has-cursor');
    gsap.set([d, r], { xPercent: -50, yPercent: -50 });

    /**
     * Точка идёт почти вплотную, кольцо догоняет с инерцией.
     *
     * У кольца было 0.4 с на `power3` — оно отставало настолько, что
     * читалось не инерцией, а задержкой отклика: курсор уже на кнопке,
     * а кольцо ещё в пути. 0.24 с и `power2` оставляют шлейф, но кольцо
     * успевает прийти раньше, чем палец решит нажать.
     */
    const dx = gsap.quickTo(d, 'x', { duration: 0.07, ease: 'power3' });
    const dy = gsap.quickTo(d, 'y', { duration: 0.07, ease: 'power3' });
    const rx = gsap.quickTo(r, 'x', { duration: 0.24, ease: 'power2' });
    const ry = gsap.quickTo(r, 'y', { duration: 0.24, ease: 'power2' });

    let mode: Mode = 'gone';
    const setMode = (m: Mode) => {
      if (m === mode) return;
      mode = m;
      d.dataset.mode = m;
      r.dataset.mode = m;
    };

    let magnet: HTMLElement | null = null;
    const release = (el: HTMLElement) =>
      gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });

    let first = true;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      if (first) {
        // первый кадр — без догонялок из левого верхнего угла
        gsap.set([d, r], { x: e.clientX, y: e.clientY });
        first = false;
      }
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);

      const t = e.target instanceof Element ? e.target : null;
      const field = t?.closest(
        'input:not([type=checkbox]):not([type=radio]):not([type=submit]), textarea, [contenteditable]'
      );
      const hot = t?.closest('a, button, [role="button"], label, summary');
      const overSilk = t?.closest('[data-cursor="ring"]');
      const drag = t?.closest('[data-cursor="drag"]');
      setMode(
        field ? 'field' : drag ? 'drag' : hot ? (overSilk ? 'ring-hover' : 'hover') : overSilk ? 'ring' : 'dot'
      );

      // магнит: элемент тянется к курсору на треть смещения от центра
      const m = t?.closest<HTMLElement>('[data-magnetic]') ?? null;
      if (m !== magnet) {
        if (magnet) release(magnet);
        magnet = m;
      }
      if (m) {
        const b = m.getBoundingClientRect();
        // смещение считается от исходного центра, без уже набранного сдвига
        const cx = b.left + b.width / 2 - Number(gsap.getProperty(m, 'x'));
        const cy = b.top + b.height / 2 - Number(gsap.getProperty(m, 'y'));
        gsap.to(m, {
          x: (e.clientX - cx) * 0.3,
          y: (e.clientY - cy) * 0.3,
          duration: 0.45,
          ease: 'power3.out',
          overwrite: 'auto'
        });
      }
    };

    const onLeave = () => {
      setMode('gone');
      if (magnet) release(magnet);
      magnet = null;
    };
    const onDown = () => r.classList.add('is-down');
    const onUp = () => r.classList.remove('is-down');

    addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('mouseleave', onLeave);
    addEventListener('pointerdown', onDown);
    addEventListener('pointerup', onUp);

    return () => {
      removeEventListener('pointermove', onMove);
      root.removeEventListener('mouseleave', onLeave);
      removeEventListener('pointerdown', onDown);
      removeEventListener('pointerup', onUp);
      root.classList.remove('has-cursor');
      if (magnet) gsap.set(magnet, { x: 0, y: 0 });
    };
  }, [on]);

  if (!on) return null;

  return (
    <>
      <div ref={ring} className="cursor-ring" data-mode="gone" aria-hidden>
        <span>Крутить</span>
      </div>
      <div ref={dot} className="cursor-dot" data-mode="gone" aria-hidden />
    </>
  );
}
