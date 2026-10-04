import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authHeader, haptic } from './tg';

/**
 * Запросы к сервису бота (`/api/app/*`). Типы повторяют его ответы; время
 * приходит строкой ISO. Каждое действие над заявкой возвращает её целиком —
 * экран обновляется ответом, без второго запроса.
 */

export type Stage = 'new' | 'contacted' | 'call' | 'proposal' | 'contract' | 'lost';
export type Source = 'site' | 'mail' | 'manual';

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

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/app${path}`, {
    method: body === undefined ? 'GET' : 'POST',
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
