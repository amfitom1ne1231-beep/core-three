import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authHeader, haptic } from './tg';

/**
 * Запросы к сервису бота (`/api/app/*`). Типы повторяют его ответы; время
 * приходит строкой ISO. Каждое действие над заявкой возвращает её целиком —
 * экран обновляется ответом, без второго запроса.
 */

export type Stage = 'new' | 'contacted' | 'call' | 'proposal' | 'contract' | 'lost';
export type Source = 'site' | 'mail' | 'manual' | 'help';

export type Lead = {
  id: number;
  source: Source;
  name: string;
  contact: string;
  task: string;
  kind: string;
  page: string | null;
  meta: Record<string, string> | null;
  spam: boolean;
  stage: Stage;
  lostReason: string | null;
  ownerId: number | null;
  createdAt: string;
  takenAt: string | null;
  firstReplyAt: string | null;
  closedAt: string | null;
};

export type LeadRow = Lead & { ownerName: string | null };

export type LeadEvent = {
  id: number;
  type: 'created' | 'taken' | 'released' | 'stage' | 'note' | 'lost' | 'reopened' | 'reminded' | 'alarmed';
  at: string;
  who: string | null;
  data: Record<string, unknown> | null;
};

export type Detail = {
  lead: Lead;
  owner: { id: number; name: string } | null;
  /** Проект, выросший из заявки на «Договоре». */
  project: { id: number; title: string } | null;
  events: LeadEvent[];
};

export type Me = {
  me: { id: number; name: string; role: 'owner' | 'member' };
  team: { id: number; name: string }[];
  dict: {
    stages: { id: Stage; label: string }[];
    funnel: Stage[];
    closed: Stage[];
    lostReasons: { id: string; label: string }[];
    kinds: { id: string; label: string }[];
    sources: Record<Source, string>;
  };
  /** Пояс студии: время в приложении — то же, что на карточках в группе. */
  tz: string;
  /** Чего в этой установке нет: доступы — без ключа шифрования, файлы — без бота. */
  features: { secrets: boolean; files: boolean };
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error?: string; fields?: Record<string, string> } | null
  ) {
    super(`API ${status}`);
  }
}

async function call<T>(path: string, body?: unknown, method?: 'PUT' | 'DELETE'): Promise<T> {
  const res = await fetch(`/api/app${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: { ...authHeader(), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return (await res.json()) as T;
}

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => call<Me>('/me'), staleTime: Infinity });

export type Scope = 'open' | 'closed' | 'all';

export function useLeads(scope: Scope, opts: { q?: string; enabled?: boolean } = {}) {
  const q = opts.q ?? '';
  const params = new URLSearchParams({ scope });
  if (q) params.set('q', q);
  return useQuery({
    queryKey: ['leads', scope, q],
    queryFn: async () => (await call<{ leads: LeadRow[] }>(`/leads?${params}`)).leads,
    // закрытые и поиск запрашиваются, только когда на них смотрят
    enabled: opts.enabled ?? true,
    // список открыт рядом с чатом: новое в группе должно появиться и здесь
    refetchInterval: 30_000,
    placeholderData: (prev) => prev
  });
}

export const useLead = (id: number) =>
  useQuery({ queryKey: ['lead', id], queryFn: () => call<Detail>(`/leads/${id}`), refetchInterval: 30_000 });

export type Action =
  | { do: 'take' }
  | { do: 'reopen' }
  | { do: 'stage'; stage: Stage }
  | { do: 'lost'; reason: string }
  | { do: 'note'; text: string };

/** Действие над заявкой — то же, что кнопка под карточкой в группе. */
export function useLeadAction(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ do: path, ...body }: Action) => call<Detail>(`/leads/${id}/${path}`, body),
    onSuccess: (detail) => {
      qc.setQueryData(['lead', id], detail);
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['today'] });
      // «Договор» заводит проект
      void qc.invalidateQueries({ queryKey: ['projects'] });
      haptic.done();
    },
    onError: () => haptic.fail()
  });
}

export type NewLead = { name: string; contact: string; task: string; kind: string; take: boolean };

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewLead) => call<Detail>('/leads', body),
    onSuccess: (detail) => {
      qc.setQueryData(['lead', detail.lead.id], detail);
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['today'] });
      haptic.done();
    },
    onError: () => haptic.fail()
  });
}

/* ---------- проекты ---------- */

export type ProjectStatus = 'active' | 'paused' | 'done' | 'cancelled';

export type Project = {
  id: number;
  title: string;
  client: string;
  contact: string | null;
  kind: string;
  status: ProjectStatus;
  leadId: number | null;
  ownerId: number | null;
  createdAt: string;
  closedAt: string | null;
};

export type ProjectRow = Project & {
  ownerName: string | null;
  stage: string | null;
  stagesDone: number;
  stagesTotal: number;
  openTasks: number;
  overdue: number;
  nextDue: string | null;
};

/** Срок — день без времени: «2026-10-15». */
export type Day = string;

export type ProjectStage = { id: number; projectId: number; position: number; title: string; dueOn: Day | null; doneAt: string | null };
export type Task = {
  id: number;
  projectId: number;
  stageId: number | null;
  title: string;
  assigneeId: number | null;
  dueOn: Day | null;
  doneAt: string | null;
  createdAt: string;
};
export type MyTask = Task & { project: string };
export type Material = {
  id: number;
  projectId: number;
  kind: 'link' | 'file';
  title: string;
  url: string | null;
  fileKind: 'document' | 'photo' | 'video' | 'audio' | 'voice' | null;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
};
export type SecretRef = { id: number; title: string; updatedAt: string };
export type ProjectEvent = { id: number; type: string; at: string; who: string | null; data: Record<string, unknown> | null };

export type ProjectView = {
  project: Project;
  ownerName: string | null;
  stages: ProjectStage[];
  tasks: Task[];
  materials: Material[];
  secrets: SecretRef[];
  events: ProjectEvent[];
};

export function useProjects(scope: 'active' | 'archive') {
  return useQuery({
    queryKey: ['projects', scope],
    queryFn: () => call<{ projects: ProjectRow[]; today: Day }>(`/projects?scope=${scope}`),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev
  });
}

export const useProject = (id: number) =>
  useQuery({ queryKey: ['project', id], queryFn: () => call<ProjectView>(`/projects/${id}`), refetchInterval: 30_000 });

export const useMyTasks = () =>
  useQuery({ queryKey: ['tasks', 'mine'], queryFn: () => call<{ tasks: MyTask[]; today: Day }>('/tasks/mine'), refetchInterval: 30_000 });

/**
 * Любое изменение проекта: сервис отвечает проектом целиком, им и
 * обновляется экран. `path` — адрес действия, `body` — его данные.
 */
export function useProjectChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) => call<ProjectView>(path, body ?? {}),
    onSuccess: (view) => {
      qc.setQueryData(['project', view.project.id], view);
      void qc.invalidateQueries({ queryKey: ['projects'] });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['today'] });
      // проект вырос из заявки — у неё на экране есть ссылка на него
      void qc.invalidateQueries({ queryKey: ['lead'] });
      haptic.done();
    },
    onError: () => haptic.fail()
  });
}

/** Показать доступ: значение приходит отдельным запросом и нигде не хранится. */
export const revealSecret = (id: number) => call<{ value: string }>(`/secrets/${id}/reveal`, {});

/** Файл лежит в Telegram — бот присылает его в личку. */
export const sendMaterial = (id: number) => call<{ ok: true }>(`/materials/${id}/send`, {});

/* ---------- метрики ---------- */

export type MetricsPeriod = '7' | '30' | '90' | 'all';

export type Metrics = {
  from: string | null;
  to: string;
  leads: { total: number; spam: number; open: number; won: number; lost: number };
  /** Сколько заявок, пришедших за период, дошли до каждого этапа. */
  funnel: { stage: Stage; reached: number }[];
  firstReply: { answered: number; medianMin: number | null; withinSla: number; slaMin: number; waiting: number };
  bySource: { id: string; label: string; count: number; won: number }[];
  byKind: { id: string; count: number; won: number }[];
  lostReasons: { id: string; label: string; count: number }[];
  bucket: 'day' | 'week' | 'month';
  timeline: { start: Day; count: number }[];
  projects: { active: number; paused: number; done: number; openTasks: number; overdueTasks: number; overdueStages: number };
  previous: { total: number; won: number } | null;
};

export function useMetrics(period: MetricsPeriod) {
  return useQuery({
    queryKey: ['metrics', period],
    queryFn: () => call<Metrics>(`/metrics?days=${period}`),
    staleTime: 60_000,
    // при смене периода прежние графики остаются на месте, пока грузятся новые
    placeholderData: (prev) => prev
  });
}

/* ---------- «Сегодня» ---------- */

type Who = { id: number; name: string } | null;

/** Что ждёт этого человека — та же выборка, что у пульта в боте. */
export type Today = {
  day: Day;
  /** Клиенту ещё не ответили. */
  waiting: LeadRow[];
  /** Мои открытые заявки, кроме тех, что уже в `waiting`. */
  mine: LeadRow[];
  /** Открытые заявки без движения два рабочих дня и больше. */
  stale: (LeadRow & { idleDays: number })[];
  tasks: MyTask[];
  /** Что горит у всей команды: срок сегодня или раньше. */
  due: { tasks: (Task & { project: string; assignee: Who })[]; stages: (ProjectStage & { project: string; owner: Who })[] };
};

export const useToday = () => useQuery({ queryKey: ['today'], queryFn: () => call<Today>('/today'), refetchInterval: 30_000 });

/* ---------- справка ---------- */

export type HelpSection = { id: string; title: string; intro: string; items: { term: string; text: string }[] };

/** Справочник меняется только вместе с настройками — перезапрашивать его незачем. */
export const useHelp = () => useQuery({ queryKey: ['help'], queryFn: async () => (await call<{ sections: HelpSection[] }>('/help')).sections, staleTime: 5 * 60_000 });

/* ---------- команда и настройки ---------- */

export type Prefs = {
  /** Минуты от полуночи. */
  workStart: number;
  workEnd: number;
  /** 0 — воскресенье … 6 — суббота. */
  workDays: number[];
  takeMin: number;
  alarmBeforeEndMin: number;
  morningDigest: boolean;
  weeklyDigest: boolean;
};

export type Settings = {
  prefs: Prefs;
  tz: string;
  canEdit: boolean;
  canInvite: boolean;
  team: { id: number; name: string; username: string | null; role: 'owner' | 'member'; me: boolean }[];
  group: { title: string | null; topic: boolean } | null;
};

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => call<Settings>('/settings') });

/** Правка настроек или состава команды: сервис отвечает всем экраном целиком. */
export function useSettingsChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (change: { prefs: Partial<Prefs> } | { remove: number }) =>
      'prefs' in change ? call<Settings>('/settings', change.prefs, 'PUT') : call<Settings>(`/team/${change.remove}`, undefined, 'DELETE'),
    onSuccess: (next) => {
      qc.setQueryData(['settings'], next);
      // от рабочих часов зависят «Сегодня», метрики и числа в справке
      for (const key of ['today', 'metrics', 'help', 'me']) void qc.invalidateQueries({ queryKey: [key] });
      haptic.done();
    },
    onError: () => haptic.fail()
  });
}

/** Ссылка-приглашение: действует двое суток и один раз. */
export const createInvite = () => call<{ link: string }>('/team/invite', {});

