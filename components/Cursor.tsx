'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

type Mode = 'gone' | 'dot' | 'hover' | 'ring' | 'ring-hover' | 'field' | 'drag';

/**
 * Курсор сайта и магнитные кнопки.
 *
 * В покое — точка цвета текста с тонкой кромкой цвета фона: пару «тёмное
 * рядом со светлым» видно на любой подложке и на обеих темах. Над кнопками
 * и ссылками точка сменяется кольцом с лёгкой заливкой. Над материалом
 * первого экрана и живыми сценами (data-cursor="ring") — кольцо с точкой
 * в центре: одной точки на подвижном фоне мало.
 *
 * Над блоком направлений (data-cursor="drag") кольцо раздувается и подписывает
 * жест: «Крутить».
 *
 * Смешения (difference) в курсоре нет. Белая точка в этом режиме пропадала
 * на серых кадрах и синем знаке, а круг над синей кнопкой становился
 * оранжево-коричневым — цвет, которого в палитре нет.
 *
 * Положение и размер разнесены по двум элементам. Внешний двигает GSAP,
 * вложенный круг меняет размер свойством `scale` из стилей. На одном
 * элементе они не уживались: GSAP, записывая `transform`, выставляет
 * `scale: none` и вшивает стартовый масштаб в матрицу — кольцо навсегда
 * оставалось 18 px, в каком бы режиме ни было, а подпись — высотой 2 px.
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
    let px = 0;
    let py = 0;

    /** Что под курсором: режим и магнит. Точка — в координатах окна. */
    const read = (t: Element | null, x: number, y: number) => {
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
          x: (x - cx) * 0.3,
          y: (y - cy) * 0.3,
          duration: 0.45,
          ease: 'power3.out',
          overwrite: 'auto'
        });
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      if (first) {
        // первый кадр — без догонялок из левого верхнего угла
        gsap.set([d, r], { x: e.clientX, y: e.clientY });
        first = false;
      }
      px = e.clientX;
      py = e.clientY;
      dx(px);
      dy(py);
      rx(px);
      ry(py);
      read(e.target instanceof Element ? e.target : null, px, py);
    };

    /**
     * Прокрутка уводит содержимое из-под неподвижной мыши, а события
     * движения при этом нет: Chrome после прокрутки обновляет только
     * `:hover`. Режим оставался от того, что уехало, — круг «Крутить»
     * от блока направлений доезжал до подвала и лежал на заголовке, пока
     * мышь не тронут. Safari событие присылает сам, там сбоя не было.
     *
     * Перечитываем не чаще раза в 80 мс и один раз после остановки:
     * на каждый кадр прокрутки проверка попадания не нужна.
     */
    let due = 0;
    const reread = () => {
      due = 0;
      if (first || mode === 'gone') return;
      read(document.elementFromPoint(px, py), px, py);
    };
    const onScroll = () => {
      if (!due) due = window.setTimeout(reread, 80);
    };

    const onLeave = () => {
      setMode('gone');
      if (magnet) release(magnet);
      magnet = null;
    };
    const onDown = () => r.classList.add('is-down');
    const onUp = () => r.classList.remove('is-down');

    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('mouseleave', onLeave);
    addEventListener('pointerdown', onDown);
    addEventListener('pointerup', onUp);

    return () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', onScroll);
      clearTimeout(due);
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
        <i />
        <span>Крутить</span>
      </div>
      <div ref={dot} className="cursor-dot" data-mode="gone" aria-hidden>
        <i />
      </div>
    </>
  );
}
