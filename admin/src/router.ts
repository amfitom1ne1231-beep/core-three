import { useSyncExternalStore } from 'react';

/**
 * Маршруты приложения — десяток экранов, поэтому без библиотеки. Адрес — путь
 * под /app/ (History API): в браузере экран переживает перезагрузку,
 * а бот может открыть приложение сразу на заявке (`/app/leads/12`).
 *
 * Якорь (#…) не трогаем: в нём Telegram передаёт приложению параметры запуска.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export type Route =
  | { name: 'today' }
  | { name: 'leads' }
  | { name: 'lead'; id: number }
  | { name: 'new' }
  | { name: 'projects' }
  | { name: 'project'; id: number }
  | { name: 'project-new' }
  | { name: 'metrics' }
  | { name: 'help' }
  | { name: 'settings' };

/** Корневые экраны — те, что стоят на вкладках внизу. */
export const isRoot = (route: Route) => route.name === 'today' || route.name === 'leads' || route.name === 'projects' || route.name === 'metrics';

function parse(pathname: string): Route {
  const path = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  const lead = path.match(/^\/leads\/(\d{1,9})\/?$/);
  if (lead) return { name: 'lead', id: Number(lead[1]) };
  if (/^\/new\/?$/.test(path)) return { name: 'new' };
  const project = path.match(/^\/projects\/(\d{1,9})\/?$/);
  if (project) return { name: 'project', id: Number(project[1]) };
  if (/^\/projects\/new\/?$/.test(path)) return { name: 'project-new' };
  if (/^\/projects\/?$/.test(path)) return { name: 'projects' };
  if (/^\/metrics\/?$/.test(path)) return { name: 'metrics' };
  if (/^\/leads\/?$/.test(path)) return { name: 'leads' };
  if (/^\/help\/?$/.test(path)) return { name: 'help' };
  if (/^\/settings\/?$/.test(path)) return { name: 'settings' };
  // корень — «Сегодня»: приложение открывается на том, что ждёт именно этого человека
  return { name: 'today' };
}

export function hrefOf(route: Route) {
  switch (route.name) {
    case 'lead':
      return `${BASE}/leads/${route.id}`;
    case 'new':
      return `${BASE}/new`;
    case 'projects':
      return `${BASE}/projects`;
    case 'project':
      return `${BASE}/projects/${route.id}`;
    case 'project-new':
      return `${BASE}/projects/new`;
    case 'metrics':
      return `${BASE}/metrics`;
    case 'leads':
      return `${BASE}/leads`;
    case 'help':
      return `${BASE}/help`;
    case 'settings':
      return `${BASE}/settings`;
    default:
      return `${BASE}/`;
  }
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

/** Назад; если приложение открыли сразу на внутреннем экране — к его списку. */
export function back() {
  if (depth > 0) return window.history.back();
  const here = parse(window.location.pathname).name;
  const up: Route['name'] = here === 'project' || here === 'project-new' ? 'projects' : here === 'lead' || here === 'new' ? 'leads' : 'today';
  navigate({ name: up } as Route, { replace: true });
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
