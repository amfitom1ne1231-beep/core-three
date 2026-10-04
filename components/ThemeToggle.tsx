'use client';

import { useEffect, useRef, useState } from 'react';
import { onThemeChange, readTheme, switchTheme, type Theme } from '@/lib/theme';

/**
 * Кнопка света — одна круглая, с переливами внутри.
 *
 * Сфера показывает не текущую тему, а другую: на тёмной странице это
 * жемчужина света, на светлой — капля тёмного стекла. Что нажимаешь,
 * то и получаешь: содержимое сферы расходится по странице волной
 * (`switchTheme` в lib/theme.ts), а сама она становится тем, чем была
 * страница. Слова «тёмная / светлая» объясняли это в лоб, лампа на
 * шнурке — слишком буквально; сфера показывает.
 *
 * Сами сферы сняты в Blender (brand/blender/orb.py): два слоя шума
 * вращаются внутри шара навстречу друг другу — петля без шва. В браузере
 * это два маленьких ролика, обрезанных кругом; виден и играет один.
 * Какой — решает CSS по `data-theme`, поэтому кнопка верна с первого
 * кадра, ещё до того как проснётся скрипт.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  // на сервере темы ещё нет — подпись для читалки появляется после первого кадра
  const [theme, setLocal] = useState<Theme | null>(null);
  const ball = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setLocal(readTheme());
    return onThemeChange(setLocal);
  }, []);

  // играет только видимая сфера; без движения — стоят обе, на первом кадре
  useEffect(() => {
    const films = ball.current?.querySelectorAll('video');
    if (!films || !theme) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    films.forEach((v) => {
      // на тёмной странице видна светлая сфера, и наоборот
      const shown = v.dataset.orb !== theme;
      if (shown && !still) v.play().catch(() => {});
      else v.pause();
    });
  }, [theme]);

  /** Под курсором переливы идут быстрее — кнопка отвечает раньше, чем её нажали. */
  const pace = (rate: number) => ball.current?.querySelectorAll('video').forEach((v) => (v.playbackRate = rate));

  const lit = theme === 'light';

  return (
    <button
      type="button"
      onClick={() => {
        const r = ball.current?.getBoundingClientRect();
        switchTheme(readTheme() === 'light' ? 'dark' : 'light', r && { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      onPointerEnter={() => pace(2.2)}
      onPointerLeave={() => pace(1)}
      aria-pressed={lit}
      aria-label={lit ? 'Свет включён. Выключить — тёмная тема' : 'Свет выключен. Включить — светлая тема'}
      className={`orb pointer-events-auto ${className}`}
    >
      <span ref={ball} className="orb-ball">
        {(['light', 'dark'] as const).map((kind) => (
          <video
            key={kind}
            data-orb={kind}
            className="orb-film"
            src={`/theme/orb-${kind}.mp4`}
            poster={`/theme/orb-${kind}.webp`}
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            tabIndex={-1}
            aria-hidden
          />
        ))}
      </span>
      <span className="orb-hint" aria-hidden>
        {lit ? 'выключить свет' : 'включить свет'}
      </span>
    </button>
  );
}
