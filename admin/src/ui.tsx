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

type IconName = 'plus' | 'search' | 'back' | 'chevron' | 'copy' | 'check' | 'close' | 'inbox' | 'layers' | 'link' | 'file' | 'lock';

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

const TABS: { route: Route; label: string; icon: 'inbox' | 'layers' }[] = [
  { route: { name: 'leads' }, label: 'Заявки', icon: 'inbox' },
  { route: { name: 'projects' }, label: 'Проекты', icon: 'layers' }
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
          <Icon name={t.icon} size={24} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
