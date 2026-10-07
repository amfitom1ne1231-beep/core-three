import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Me } from './api';
import { navigate, type Route } from './router';
import { haptic } from './tg';

/** Кто вошёл, команда и словари — нужны почти каждому экрану. */
export const MeContext = createContext<Me | null>(null);

export function useMeData(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error('MeContext пуст');
  return me;
}

/* ---------- значки: один набор, одна толщина линии ---------- */

type IconName = 'plus' | 'search' | 'back' | 'chevron' | 'copy' | 'check' | 'close' | 'inbox' | 'layers' | 'bars' | 'link' | 'file' | 'lock' | 'today' | 'gear' | 'book';

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
  close: <path d="M6 6l12 12M18 6 6 18" />,
  inbox: (
    <>
      <path d="M4 13.5 6.2 6.3A2 2 0 0 1 8.1 5h7.8a2 2 0 0 1 1.9 1.3L20 13.5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 13.5h4.5l1 2h5l1-2H20" />
    </>
  ),
  layers: (
    <>
      <path d="m12 4 8 4.5-8 4.5-8-4.5z" />
      <path d="m4 13 8 4.5 8-4.5" />
    </>
  ),
  bars: <path d="M6 19v-6M12 19V5M18 19v-9" />,
  link: (
    <>
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  file: (
    <>
      <path d="M7 3.5h6.5L18 8v10.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" />
      <path d="M13.5 3.5V8H18" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  // «сегодня» — лист календаря с отмеченным днём
  today: (
    <>
      <rect x="4.5" y="5.5" width="15" height="14" rx="1.5" />
      <path d="M4.5 10h15M8.5 3.5v3.5M15.5 3.5v3.5" />
      <path d="M11 14.5h2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
    </>
  ),
  book: (
    <>
      <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 8.5h6" />
    </>
  )
};

/** Значок рядом с подписью — украшение: от программ чтения с экрана он скрыт. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

/* ---------- знак и шапка ---------- */

/** Знак CoreThree одним цветом — те же грани, что в `brand/mark-solid.svg`. */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M67.00 24.36 L90.39 64.88 L75.40 56.23 L59.50 28.69 Z" />
      <path d="M78.44 57.32 L73.28 54.35 L61.25 33.50 L61.25 27.55 Z" />
      <path d="M63.81 14.22 L63.81 23.84 L58.78 26.75 L58.78 32.92 L73.31 58.09 L57.66 49.05 Q51.30 45.39 51.30 38.32 L51.30 21.44 Z" />
      <path d="M49.37 21.11 L49.37 58.58 L36.58 65.97 L36.58 13.73 Z" />
      <path d="M50.47 4.51 L63.56 12.07 L50.34 19.70 L37.25 12.14 Z" />
      <path d="M66.58 82.04 L72.77 85.61 L72.77 90.97 L27.90 90.97 L43.38 82.04 Z" />
      <path d="M58.16 70.10 L65.35 70.10 L84.11 80.93 L84.11 95.45 L75.08 90.24 L75.08 83.89 L68.00 79.80 L41.36 79.80 Z" />
      <path d="M84.68 78.89 L51.35 59.64 L51.35 44.62 L97.69 71.37 Z" />
      <path d="M98.00 87.58 L85.60 94.74 L85.60 80.67 L98.00 73.51 Z" />
      <path d="M10.84 63.85 L34.62 22.67 L34.62 39.96 L18.33 68.17 Z" />
      <path d="M34.09 36.48 L34.09 41.85 L21.21 64.16 L16.56 66.85 Z" />
      <path d="M3.39 71.48 L11.73 66.66 L17.11 69.76 L22.22 66.81 L36.68 41.78 L36.68 59.33 Q36.68 67.02 30.99 70.31 L16.17 78.86 Z" />
      <path d="M16.89 80.91 L49.54 62.05 L62.09 69.30 L16.89 95.39 Z" />
      <path d="M2.00 88.12 L2.00 73.14 L14.77 80.51 L14.77 95.49 Z" />
    </svg>
  );
}

/**
 * Шапка корневого экрана: знак и имя студии слева, справа — то, что
 * экран считает нужным (день, действие). По ней приложение узнаётся
 * как продолжение сайта, а не как ещё один экран Telegram: цвета здесь
 * от темы Telegram, своя у приложения только форма.
 */
export function Brand({ children }: { children?: ReactNode }) {
  return (
    <div className="brand">
      <span className="brand__name">
        <Mark />
        CoreThree
      </span>
      {children && <span className="brand__side">{children}</span>}
    </div>
  );
}

/* ---------- шторка снизу: выбор из списка ---------- */

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    // форма — сразу в первое поле (на телефоне откроется клавиатура), список — на первую кнопку
    (panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>('button'))?.focus();
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

/* ---------- поле формы: подпись сверху, ошибка или подсказка — под полем ---------- */

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p className="field__error" id={`${id}-err`} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className="field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/* ---------- удаление: второе нажатие подтверждает ---------- */

/** Первое нажатие спрашивает, второе — делает. Не нажали за четыре секунды — вопрос снят. */
export function ConfirmButton({ label, confirm, disabled, onConfirm }: { label: string; confirm: string; disabled?: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className="btn btn--danger btn--wide"
      disabled={disabled}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirm : label}
    </button>
  );
}

/* ---------- отметка «сделано» ---------- */

/** Круглая отметка у задачи и этапа. Подпись обязательна — о чём отметка, без неё не понять. */
export function Check({ done, label, disabled, onToggle }: { done: boolean; label: string; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      className={`check-btn${done ? ' is-done' : ''}`}
      disabled={disabled}
      onClick={() => {
        haptic.tap();
        onToggle();
      }}
    >
      <span className="check-btn__box">{done && <Icon name="check" size={14} />}</span>
    </button>
  );
}

/* ---------- вкладки внизу: разделы приложения ---------- */

const TABS: { route: Route; label: string; icon: 'today' | 'inbox' | 'layers' | 'bars' }[] = [
  { route: { name: 'today' }, label: 'Сегодня', icon: 'today' },
  { route: { name: 'leads' }, label: 'Заявки', icon: 'inbox' },
  { route: { name: 'projects' }, label: 'Проекты', icon: 'layers' },
  { route: { name: 'metrics' }, label: 'Метрики', icon: 'bars' }
];

export function TabBar({ current }: { current: Route['name'] }) {
  return (
    <nav className="tabbar" aria-label="Разделы">
      {TABS.map((t) => (
        <button
          key={t.route.name}
          type="button"
          className="tabbar__item"
          aria-current={current === t.route.name ? 'page' : undefined}
          onClick={() => {
            if (current === t.route.name) return window.scrollTo({ top: 0 });
            haptic.tap();
            navigate(t.route, { replace: true });
          }}
        >
          <Icon name={t.icon} size={22} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
