'use client';

import { useMemo, useState } from 'react';
import type { HostDetail } from '@/lib/types';
import { Empty, Panel } from '../Panel';
import { SeverityBadge } from '../SeverityBadge';

export function HostDetails({ hosts }: { hosts: HostDetail[] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'ERROR' | 'OK'>('all');
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return hosts.filter(
      (h) =>
        (status === 'all' || h.status === status) &&
        (!needle || h.host.toLowerCase().includes(needle) || h.group.toLowerCase().includes(needle)),
    );
  }, [hosts, q, status]);

  return (
    <Panel
      title={`Detail per Host (${hosts.length})`}
      bodyClassName="p-0"
      actions={
        <>
          <input className="input w-32 py-0.5 sm:w-40" placeholder="Cari host/group" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari host" />
          <select className="input py-0.5" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter status">
            <option value="all">Semua</option>
            <option value="ERROR">Gagal</option>
            <option value="OK">OK</option>
          </select>
        </>
      }
    >
      <div className="max-h-[32rem] overflow-auto">
        {rows.length === 0 ? (
          <Empty>Tidak ada host</Empty>
        ) : (
          <table className="tbl">
            <thead className="sticky top-0 bg-panel">
              <tr>
                <th>Group</th>
                <th>Host</th>
                <th>Status</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.host}>
                  <td className="text-ink-muted">{h.group}</td>
                  <td className="font-medium">{h.host}</td>
                  <td>
                    <SeverityBadge value={h.status} />
                  </td>
                  <td className="break-all text-xs">{h.error_reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}
