'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { lastDays, todayWib } from '@/lib/calendar';
import type { Dashboard } from '@/lib/types';
import { Empty, Panel } from '../Panel';
import { StatusStrip } from '../StatusStrip';

function Rank({ n }: { n: number }) {
  return <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-[#1f2d3d]">{n}</span>;
}

export function TopFailGroups({ groups }: { groups: Dashboard['topFailGroups'] }) {
  return (
    <Panel title="Group Paling Sering Bermasalah (30 hari)">
      {groups.length === 0 ? (
        <Empty>Tidak ada group bermasalah</Empty>
      ) : (
        <ol className="divide-y divide-line">
          {groups.map((g, i) => (
            <li key={g.group} className="flex items-center gap-3 py-2">
              <Rank n={i + 1} />
              <Link href={`/history?group=${encodeURIComponent(g.group)}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {g.group}
              </Link>
              <span className="text-right text-xs text-ink-muted">
                <b className="text-sm text-err">{g.failDaysCount}</b> hari gagal
                <br />
                {g.totalFailInstances} kejadian
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function TopFailHosts({ hosts }: { hosts: Dashboard['topFailHosts'] }) {
  const days = useMemo(() => lastDays(todayWib(), 7), []);
  return (
    <Panel title="Top 5 Host Paling Sering Gagal (30 hari)">
      {hosts.length === 0 ? (
        <Empty>Tidak ada host gagal</Empty>
      ) : (
        <ol className="divide-y divide-line">
          {hosts.map((h, i) => (
            <li key={h.host} className="flex items-center gap-3 py-2">
              <Rank n={i + 1} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{h.host}</div>
                <div className="truncate text-xs text-ink-muted">{h.group}</div>
              </div>
              <StatusStrip days={days.map((date, idx) => ({ date, status: h.sparkline[idx] ?? null }))} />
              <span className="w-14 text-right text-xs text-ink-muted">
                <b className="text-sm text-err">{h.failCount}</b> hari
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
