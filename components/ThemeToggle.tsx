'use client';

import { useEffect, useState } from 'react';
import { onThemeChange, readTheme, setTheme, type Theme } from '@/lib/theme';

/**
 * Переключатель темы.
 *
 * Не иконка солнца с луной: на сайте, где весь язык — тонкие штрихи и
 * моноширинные микро-лейблы, метафора из чужого набора выглядит вставкой.
 * Здесь два слова и штрих, который переезжает под выбранным, — тот же
 * приём, что в рельсе карусели.
 *
 * Обе кнопки видны всегда, поэтому состояние читается без наведения и
 * без догадок: `aria-pressed` говорит читалке, какая тема включена.
 * На телефоне кнопки стоят в шапке под пальцем — область нажатия выше.
 */

const OPTIONS: { id: Theme; label: string }[] = [
  { id: 'dark', label: 'Тёмная' },
  { id: 'light', label: 'Светлая' }
];

export default function ThemeToggle({ className = '' }: { className?: string }) {
  // на сервере темы ещё нет: до первого кадра рисуем нейтрально,
  // иначе разметка разойдётся с тем, что выставил загрузочный скрипт
  const [theme, setLocal] = useState<Theme | null>(null);

  useEffect(() => {
    setLocal(readTheme());
    return onThemeChange(setLocal);
  }, []);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-1 ${className}`}
      role="group"
      aria-label="Тема оформления"
    >
      {OPTIONS.map((o) => {
        const on = theme === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => setTheme(o.id)}
            aria-pressed={on}
            className="group relative -my-2 px-1.5 py-2 max-md:-my-3.5 max-md:py-3.5 font-mono text-[10px] uppercase tracking-rail transition-colors duration-300 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg"
            style={{ color: on ? 'var(--fg)' : 'var(--fg-faint)' }}
          >
            {o.label}
            {/* штрих под выбранным — тот же язык, что у рельса карусели */}
            <span
              aria-hidden
              className="absolute inset-x-1.5 bottom-1 block h-px origin-left bg-accent transition-transform duration-300 max-md:bottom-2.5"
              style={{ transform: `scaleX(${on ? 1 : 0})` }}
            />
          </button>
        );
      })}
    </div>
  );
}
