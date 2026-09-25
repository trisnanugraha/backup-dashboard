'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useGroupHistory, useHistoryGroups } from '@/lib/api';
import { AppHeader } from '@/components/AppHeader';
import { Empty } from '@/components/Panel';
import { GroupDetail } from '@/components/history/GroupDetail';
import { GroupSidebar } from '@/components/history/GroupSidebar';

/** Selected group lives in ?group= so the Dashboard can deep-link to it. */
export function HistoryView() {
  const router = useRouter();
  const pathname = usePathname();
  const selected = useSearchParams().get('group');
  const groups = useHistoryGroups();
  const detail = useGroupHistory(selected);

  const select = useCallback(
    (group: string) => router.replace(`${pathname}?group=${encodeURIComponent(group)}`, { scroll: false }),
    [router, pathname],
  );

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <GroupSidebar groups={groups.data ?? []} selected={selected} onSelect={select} loading={groups.isLoading} />
        <div className="min-w-0">
          {groups.error && <p className="text-sm text-err">Gagal memuat daftar group: {groups.error.message}</p>}
          {!selected ? (
            <Empty>Pilih group di sebelah kiri untuk melihat history.</Empty>
          ) : detail.isLoading ? (
            <Empty>Memuat history {selected}...</Empty>
          ) : detail.error ? (
            <p role="alert" className="rounded-lg border border-err px-4 py-3 text-sm text-err">
              {detail.error.message}
            </p>
          ) : detail.data ? (
            <GroupDetail history={detail.data} />
          ) : null}
        </div>
      </main>
    </>
  );
}
