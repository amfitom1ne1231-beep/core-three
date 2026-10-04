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

export type Detail = { lead: Lead; owner: { id: number; name: string } | null; events: LeadEvent[] };

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
