'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { REFRESH_MS } from './constants';
import type { AppCategory, Dashboard, EntityType, GroupHistory, HistoryGroupItem, NoteFields } from './types';

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  historyGroups: ['history', 'groups'] as const,
  history: (group: string) => ['history', 'group', group] as const,
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body as T;
}

export function useDashboard(initialData?: Dashboard) {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => request<Dashboard>('/api/dashboard'),
    refetchInterval: REFRESH_MS,
    initialData,
    initialDataUpdatedAt: initialData ? Date.parse(initialData.generatedAt) : undefined,
  });
}

export function useHistoryGroups() {
  return useQuery({
    queryKey: queryKeys.historyGroups,
    queryFn: () => request<HistoryGroupItem[]>('/api/history/groups'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGroupHistory(group: string | null) {
  return useQuery({
    queryKey: queryKeys.history(group ?? ''),
    queryFn: () => request<GroupHistory>(`/api/history?group=${encodeURIComponent(group ?? '')}`),
    enabled: Boolean(group),
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Optimistic cache patches. Each returns a new object (never mutates cache).
// ---------------------------------------------------------------------------

type NoteInput = { entity_type: EntityType; entity_key: string; note: string; category: string };
type CategoryInput = { domain: string; category: AppCategory };

function withNote<T extends NoteFields>(item: T, n: NoteInput): T {
  return { ...item, note: n.note.trim(), note_category: n.note.trim() ? n.category : '' };
}

function patchDashboardNote(d: Dashboard, n: NoteInput): Dashboard {
  const appMatch = (domain: string) => n.entity_type === 'verify_app' && domain === n.entity_key;
  const groupMatch = (group: string) => n.entity_type === 'group' && group === n.entity_key;
  return {
    ...d,
    todaySummary: d.todaySummary.map((g) => (groupMatch(g.group) ? withNote(g, n) : g)),
    verifySummary: d.verifySummary.map((g) => ({
      ...(groupMatch(g.group) ? withNote(g, n) : g),
      problemApps: g.problemApps.map((a) => (appMatch(a.domain) ? withNote(a, n) : a)),
    })),
    strategicProblemApps: d.strategicProblemApps.map((a) => (appMatch(a.domain) ? withNote(a, n) : a)),
  };
}

function patchHistoryNote(h: GroupHistory, n: NoteInput): GroupHistory {
  return {
    ...(n.entity_type === 'group' && h.group === n.entity_key ? withNote(h, n) : h),
    hosts: h.hosts.map((x) => (n.entity_type === 'host' && x.host === n.entity_key ? withNote(x, n) : x)),
    verify_apps: h.verify_apps.map((a) => (n.entity_type === 'verify_app' && a.domain === n.entity_key ? withNote(a, n) : a)),
  };
}

function patchDashboardCategory(d: Dashboard, c: CategoryInput): Dashboard {
  const fix = <T extends { domain: string; app_category: AppCategory }>(a: T): T =>
    a.domain === c.domain ? { ...a, app_category: c.category } : a;
  return {
    ...d,
    verifySummary: d.verifySummary.map((g) => ({ ...g, problemApps: g.problemApps.map(fix), okApps: g.okApps.map(fix) })),
    strategicProblemApps: d.strategicProblemApps.map(fix),
  };
}

function patchHistoryCategory(h: GroupHistory, c: CategoryInput): GroupHistory {
  return { ...h, verify_apps: h.verify_apps.map((a) => (a.domain === c.domain ? { ...a, app_category: c.category } : a)) };
}

/** Apply `patch` to dashboard + every cached history detail; returns a rollback fn. */
function optimistic(
  qc: QueryClient,
  patchDash: (d: Dashboard) => Dashboard,
  patchHist: (h: GroupHistory) => GroupHistory,
) {
  const snapshots = qc.getQueriesData<unknown>({ queryKey: ['history'] });
  const dash = qc.getQueryData<Dashboard>(queryKeys.dashboard);
  if (dash) qc.setQueryData(queryKeys.dashboard, patchDash(dash));
  qc.setQueriesData<GroupHistory>({ queryKey: ['history', 'group'] }, (h) => (h ? patchHist(h) : h));
  return () => {
    if (dash) qc.setQueryData(queryKeys.dashboard, dash);
    for (const [key, data] of snapshots) qc.setQueryData(key, data);
  };
}

export function useSaveNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (n: NoteInput) => request<{ ok: boolean }>('/api/notes', { method: 'POST', body: JSON.stringify({ ...n, note: n.note.trim() }) }),
    onMutate: async (n) => {
      await Promise.all([qc.cancelQueries({ queryKey: queryKeys.dashboard }), qc.cancelQueries({ queryKey: ['history'] })]);
      return { rollback: optimistic(qc, (d) => patchDashboardNote(d, n), (h) => patchHistoryNote(h, n)) };
    },
    onError: (_err, _n, ctx) => ctx?.rollback(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: CategoryInput) => request<{ ok: boolean }>('/api/categories', { method: 'POST', body: JSON.stringify(c) }),
    onMutate: async (c) => {
      await Promise.all([qc.cancelQueries({ queryKey: queryKeys.dashboard }), qc.cancelQueries({ queryKey: ['history'] })]);
      return { rollback: optimistic(qc, (d) => patchDashboardCategory(d, c), (h) => patchHistoryCategory(h, c)) };
    },
    onError: (_err, _c, ctx) => ctx?.rollback(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
}
