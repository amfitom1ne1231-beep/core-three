import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { Me } from './api';

/** Кто вошёл, команда и словари — нужны почти каждому экрану. */
export const MeContext = createContext<Me | null>(null);

export function useMeData(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error('MeContext пуст');
  return me;
}

/* ---------- значки: один набор, одна толщина линии ---------- */

type IconName = 'plus' | 'search' | 'back' | 'chevron' | 'copy' | 'check' | 'close';

const PATHS: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  back: <path d="m14.5 5-7 7 7 7" />,
  chevron: <path d="m9.5 5 7 7-7 7" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />
};

/** Значок рядом с подписью — украшение: от программ чтения с экрана он скрыт. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

/* ---------- шторка снизу: выбор из списка ---------- */

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // под шторкой страница не должна прокручиваться
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      before?.focus();
    };
  }, [onClose]);

  return (
    <div className="sheet" role="presentation">
      <div className="sheet__scrim" onClick={onClose} />
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}

/** Пункт шторки. `current` — отмечен галочкой и не нажимается. */
export function SheetOption({ label, current, danger, onPick }: { label: string; current?: boolean; danger?: boolean; onPick: () => void }) {
  return (
    <button type="button" className={`option${danger ? ' option--danger' : ''}`} onClick={onPick} disabled={current} aria-current={current || undefined}>
      <span>{label}</span>
      {current && <Icon name="check" />}
    </button>
  );
}

/* ---------- состояния экрана ---------- */

export function Notice({ title, text, action }: { title: string; text?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="notice">
      <p className="notice__title">{title}</p>
      {text && <p className="notice__text">{text}</p>}
      {action && (
        <button type="button" className="btn btn--tinted" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Заготовки строк на время первой загрузки: место занято, список не прыгает. */
export function RowsPlaceholder({ rows = 4 }: { rows?: number }) {
  return (
    <div className="section" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, i) => (
        <div className="row row--ghost" key={i}>
          <span className="ghost ghost--title" />
          <span className="ghost ghost--meta" />
        </div>
      ))}
    </div>
  );
}
