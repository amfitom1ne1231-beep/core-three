'use client';

import type { ReactNode } from 'react';
import { scrollToEl } from '@/lib/scroll';

/**
 * Ссылка на раздел этой же страницы.
 *
 * Прокрутку ведёт Lenis: нативный переход по якорю он отменяет своей
 * целью и возвращает страницу назад (то же, что в оглавлении документов).
 * Фокус уходит в раздел, чтобы клавиатура и читалка продолжили оттуда,
 * а не с карточки наверху.
 */
export default function Jump({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        const el = document.getElementById(to);
        if (!el) return;
        e.preventDefault();
        // −88: заголовок раздела не должен уезжать под плавающую шапку
        scrollToEl(el, -88);
        history.replaceState(null, '', `#${to}`);
        el.focus({ preventScroll: true });
      }}
    >
      {children}
    </a>
  );
}
