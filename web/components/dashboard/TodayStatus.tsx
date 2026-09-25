'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GroupStatus } from '@/lib/types';
import { NoteEditor, NoteText, PencilIcon } from '../NoteEditor';
import { Empty, Panel } from '../Panel';
import { SeverityBadge } from '../SeverityBadge';

function statusBadge(g: GroupStatus) {
  if (g.report_status === 'pending') return <SeverityBadge value="PENDING" />;
  return g.fail ? <SeverityBadge value="ERROR" label="Ada Gagal" /> : <SeverityBadge value="OK" />;
}

/** Per-group status of the current window. Row click opens History. */
export function TodayStatus({ groups }: { groups: GroupStatus[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const pending = groups.filter((g) => g.report_status === 'pending').length;

  return (
    <Panel title={`Status Hari Ini (${groups.length} group${pending ? `, ${pending} belum lapor` : ''})`} bodyClassName="max-h-[32rem] overflow-auto p-0">
      {groups.length === 0 ? (
        <Empty>Belum ada laporan</Empty>
      ) : (
        <table className="tbl">
          <thead className="sticky top-0 bg-panel">
            <tr>
              <th>Group</th>
              <th>Status</th>
              <th className="num">OK</th>
              <th className="num">Gagal</th>
              <th className="num">Total</th>
              <th aria-label="Catatan" />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.group}>
                <tr className="cursor-pointer" onClick={() => router.push(`/history?group=${encodeURIComponent(g.group)}`)}>
                  <td>
                    <div className="font-medium">{g.group}</div>
                    {g.report_status === 'pending' && g.usual_report_time && (
                      <div className="text-xs text-ink-muted">biasanya lapor ±{g.usual_report_time} WIB</div>
                    )}
                    {editing !== g.group && <NoteText note={g.note} category={g.note_category} />}
                  </td>
                  <td>{statusBadge(g)}</td>
                  <td className="num">{g.ok ?? '-'}</td>
                  <td className={`num ${g.fail ? 'font-bold text-err' : ''}`}>{g.fail ?? '-'}</td>
                  <td className="num">{g.total ?? '-'}</td>
                  <td className="w-8">
                    <button
                      className="rounded p-1 text-ink-muted hover:bg-row-hover hover:text-brand"
                      title={g.note ? 'Ubah catatan' : 'Tambah catatan'}
                      aria-label={`Catatan ${g.group}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(editing === g.group ? null : g.group);
                      }}
                    >
                      <PencilIcon />
                    </button>
                  </td>
                </tr>
                {editing === g.group && (
                  <tr>
                    <td colSpan={6} className="bg-row-hover">
                      <NoteEditor entityType="group" entityKey={g.group} note={g.note} category={g.note_category} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
