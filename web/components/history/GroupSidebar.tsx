'use client';

import { useMemo, useState } from 'react';
import type { HistoryGroupItem } from '@/lib/types';
import { SeverityBadge } from '../SeverityBadge';

export function GroupSidebar({
  groups,
  selected,
  onSelect,
  loading,
}: {
  groups: HistoryGroupItem[];
  selected: string | null;
  onSelect: (group: string) => void;
  loading: boolean;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? groups.filter((g) => g.group.toLowerCase().includes(needle)) : groups;
  }, [groups, q]);

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]">
      <div className="bg-panel-head px-3 py-2 text-sm font-semibold text-panel-head-ink">Group ({groups.length})</div>
      <div className="border-b border-line p-2">
        <input className="input w-full" placeholder="Cari group..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari group" />
      </div>
      <ul className="max-h-72 overflow-y-auto lg:max-h-none lg:flex-1">
        {loading && <li className="p-3 text-sm text-ink-muted">Memuat...</li>}
        {shown.map((g) => (
          <li key={g.group}>
            <button
              onClick={() => onSelect(g.group)}
              aria-current={selected === g.group}
              className={`flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left ${
                selected === g.group ? 'bg-brand text-white' : 'hover:bg-row-hover'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{g.group}</span>
                <span className={`text-xs ${selected === g.group ? 'text-white/85' : 'text-ink-muted'}`}>
                  {g.total_hosts} host{g.hosts_with_fail > 0 && <b className={selected === g.group ? '' : 'text-err'}> · {g.hosts_with_fail} gagal</b>}
                  {g.note && ' · ada catatan'}
                </span>
              </span>
              {g.verify_severity !== '-' && <SeverityBadge value={g.verify_severity} />}
            </button>
          </li>
        ))}
        {!loading && shown.length === 0 && <li className="p-3 text-sm text-ink-muted">Group tidak ditemukan</li>}
      </ul>
    </aside>
  );
}
