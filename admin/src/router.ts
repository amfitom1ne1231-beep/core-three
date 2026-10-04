import { useSyncExternalStore } from 'react';

/**
 * Маршруты приложения — три экрана, поэтому без библиотеки. Адрес — путь
 * под /app/ (History API): в браузере экран переживает перезагрузку,
 * а бот может открыть приложение сразу на заявке (`/app/leads/12`).
 *
 * Якорь (#…) не трогаем: в нём Telegram передаёт приложению параметры запуска.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export type Route = { name: 'leads' } | { name: 'lead'; id: number } | { name: 'new' };

function parse(pathname: string): Route {
  const path = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  const lead = path.match(/^\/leads\/(\d{1,9})\/?$/);
  if (lead) return { name: 'lead', id: Number(lead[1]) };
  if (/^\/new\/?$/.test(path)) return { name: 'new' };
  return { name: 'leads' };
}

export function hrefOf(route: Route) {
  if (route.name === 'lead') return `${BASE}/leads/${route.id}`;
  if (route.name === 'new') return `${BASE}/new`;
  return `${BASE}/`;
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** Сколько шагов сделано внутри приложения: есть ли куда возвращаться. Переживает перезагрузку страницы. */
let depth = (window.history.state as { depth?: number } | null)?.depth ?? 0;

export function navigate(route: Route, opts: { replace?: boolean } = {}) {
  const url = hrefOf(route) + window.location.hash;
  if (opts.replace) window.history.replaceState({ depth }, '', url);
  else window.history.pushState({ depth: ++depth }, '', url);
  window.scrollTo(0, 0);
  emit();
}

/** Назад; если приложение открыли сразу на внутреннем экране — к списку. */
export function back() {
  if (depth > 0) window.history.back();
  else navigate({ name: 'leads' }, { replace: true });
}

window.addEventListener('popstate', (e) => {
  depth = (e.state as { depth?: number } | null)?.depth ?? 0;
  emit();
});

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// useSyncExternalStore сравнивает снимки по ссылке — отдаём строку пути
const snapshot = () => window.location.pathname;

export function useRoute(): Route {
  return parse(useSyncExternalStore(subscribe, snapshot));
}
