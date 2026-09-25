'use client';

import { COLORS } from '@/lib/constants';
import { todayWib } from '@/lib/calendar';
import { downloadCsv, safeFilename, toCsv } from '@/lib/csv';
import type { GroupHistory } from '@/lib/types';
import { CalendarHeatmap } from '../CalendarHeatmap';
import { NoteEditor } from '../NoteEditor';
import { Panel } from '../Panel';
import { SeverityBadge } from '../SeverityBadge';
import { StatCard } from '../StatCard';
import { AppList } from './AppList';
import { HostList } from './HostList';

function exportGroup(h: GroupHistory) {
  const rows = h.hosts.flatMap((host) => host.backup_timeline.map((t) => [host.host, t.date, t.status, t.error_reason]));
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(b[1]).localeCompare(String(a[1])));
  downloadCsv(`backup_${safeFilename(h.group)}_30hari_${todayWib()}.csv`, toCsv(['host', 'tanggal', 'status', 'keterangan'], rows));
}

export function GroupDetail({ history }: { history: GroupHistory }) {
  const failing = history.hosts.filter((h) => h.failing).length;
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3 shadow-sm">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">{history.group}</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>Verify:</span>
            {history.verify_severity === '-' ? <span>-</span> : <SeverityBadge value={history.verify_severity} />}
            {history.changed_hosts.length > 0 && <span>· {history.changed_hosts.length} perubahan status host (30 hari)</span>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatCard value={history.total_hosts} label="Host" bgColor={COLORS.primary} />
          <StatCard value={history.hosts_with_fail} label="Gagal" bgColor={history.hosts_with_fail ? COLORS.error : COLORS.muted} />
          <StatCard value={failing ? `${failing}` : '0'} label="Gagal beruntun" bgColor={failing ? COLORS.warn : COLORS.muted} textColor={failing ? '#1f2d3d' : '#fff'} />
        </div>
        <button className="btn btn-primary" onClick={() => exportGroup(history)}>
          Export CSV Group (30 hari)
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Kalender Backup (6 bulan)">
          <CalendarHeatmap data={history.calendar_backup} />
        </Panel>
        <Panel title="Kalender Verify (6 bulan)">
          <CalendarHeatmap data={history.calendar_verify} />
        </Panel>
      </div>

      <AppList apps={history.verify_apps} />

      <HostList history={history} />

      <Panel title="Catatan Group">
        <NoteEditor key={`${history.note}|${history.note_category}`} entityType="group" entityKey={history.group} note={history.note} category={history.note_category} />
      </Panel>
    </div>
  );
}
