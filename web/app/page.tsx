import { fetchApi } from '@/lib/server';
import type { Dashboard } from '@/lib/types';
import { DashboardView } from './DashboardView';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const initial = await fetchApi<Dashboard>('/api/dashboard');
  return <DashboardView initial={initial} />;
}
