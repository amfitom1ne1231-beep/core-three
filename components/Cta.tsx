import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Кнопка заявки — главное действие сайта.
 *
 * Звать, но не дёргать. Всё, что в ней движется, либо отвечает на руку,
 * либо случается редко и само заканчивается:
 *
 * - точка «на связи» дышит медленно, раз в три секунды, — это состояние,
 *   а не мигалка: мы действительно отвечаем в течение дня;
 * - по кнопке трижды за визит проходит блик и больше не возвращается;
 * - на наведении заливка акцентом растёт от точки, подпись перекатывается,
 *   стрелка разворачивается по ходу — кнопка откликается всем телом;
 * - магнит (`data-magnetic`) тянет её к курсору, как и раньше.
 *
 * При reduced motion остаются только цвета.
 */
export default function Cta({
  href,
  children,
  size = 'lg',
  tone = 'primary',
  className = '',
  dot = true,
  onClick
}: {
  href: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'sm';
  tone?: 'primary' | 'ghost';
  className?: string;
  /** Точка «на связи»: у второстепенных кнопок рядом её нет. */
  dot?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link data-magnetic href={href} onClick={onClick} className={`cta cta-${size} cta-${tone} ${className}`}>
      <span className="cta-fill" aria-hidden />
      {dot && <span className="cta-dot" aria-hidden />}
      <span className="cta-label">
        <span>{children}</span>
        <span aria-hidden>{children}</span>
      </span>
      <span className="cta-arrow" aria-hidden>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {tone === 'primary' && <span className="cta-shine" aria-hidden />}
    </Link>
  );
}
