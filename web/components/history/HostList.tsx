'use client';

import { useMemo, useState } from 'react';
import { lastDays, shortDate, todayWib } from '@/lib/calendar';
import { downloadCsv, safeFilename, toCsv } from '@/lib/csv';
import type { GroupHistory, HostHistory } from '@/lib/types';
import { NoteEditor, NoteText } from '../NoteEditor';
import { Empty, Panel } from '../Panel';
import { SeverityBadge } from '../SeverityBadge';
import { StatusStrip } from '../StatusStrip';

type Sort = 'name' | 'most-failed' | 'recent-failed';

const lastFailDate = (h: HostHistory) => h.backup_timeline.find((t) => t.status === 'ERROR')?.date ?? '';

function exportHost(h: HostHistory) {
  const csv = toCsv(['tanggal', 'status', 'keterangan'], h.backup_timeline.map((t) => [t.date, t.status, t.error_reason]));
  downloadCsv(`backup_${safeFilename(h.host)}_${todayWib()}.csv`, csv);
}

function HostPanel({ h, verifyTimeline }: { h: HostHistory; verifyTimeline: GroupHistory['verify_timeline'] }) {
  const days = useMemo(() => {
    const byDate = new Map(h.backup_timeline.map((t) => [t.date, t.status]));
    return lastDays(todayWib(), 30).map((date) => ({ date, status: byDate.get(date) ?? null }));
  }, [h.backup_timeline]);

  return (
    <div className="space-y-3 border-t border-line bg-row-hover/40 px-3 py-3">
      <div>
        <div className="mb-1 text-xs font-semibold text-ink-muted">Backup 30 hari terakhir</div>
        <StatusStrip days={days} size={14} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-ink-muted">Timeline backup harian</div>
          <div className="max-h-60 overflow-auto rounded border border-line">
            <table className="tbl">
              <thead className="sticky top-0 bg-panel">
                <tr>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {h.backup_timeline.map((t) => (
                  <tr key={t.date}>
                    <td className="whitespace-nowrap">{t.date}</td>
                    <td>
                      <SeverityBadge value={t.status} />
                    </td>
                    <td className="break-all text-xs">{t.error_reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-ink-muted">Timeline verify group</div>
          <div className="max-h-60 overflow-auto rounded border border-line">
            <table className="tbl">
              <thead className="sticky top-0 bg-panel">
                <tr>
                  <th>Tanggal</th>
                  <th className="num">OK</th>
                  <th className="num">Warn</th>
                  <th className="num">Crit</th>
                </tr>
              </thead>
              <tbody>
                {[...verifyTimeline].reverse().map((v) => (
                  <tr key={v.date}>
                    <td>{v.date}</td>
                    <td className="num">{v.ok}</td>
                    <td className={`num ${v.warn ? 'text-warn' : ''}`}>{v.warn}</td>
                    <td className={`num ${v.critical ? 'text-err' : ''}`}>{v.critical}</td>
                  </tr>
                ))}
                {verifyTimeline.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-ink-muted">
                      Tidak ada data verify
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-ink-muted">Catatan host</div>
        <NoteEditor key={`${h.note}|${h.note_category}`} entityType="host" entityKey={h.host} note={h.note} category={h.note_category} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => exportHost(h)}>
          Export CSV host
        </button>
        <button className="btn" disabled title="Segera hadir">
          Lihat Log Server
        </button>
      </div>
    </div>
  );
}

export function HostList({ history }: { history: GroupHistory }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [open, setOpen] = useState<string | null>(null);

  const hosts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = history.hosts.filter((h) => !needle || h.host.toLowerCase().includes(needle));
    const byName = (a: HostHistory, b: HostHistory) => a.host.localeCompare(b.host);
    if (sort === 'most-failed') return [...list].sort((a, b) => b.fail_days - a.fail_days || byName(a, b));
    if (sort === 'recent-failed') return [...list].sort((a, b) => lastFailDate(b).localeCompare(lastFailDate(a)) || byName(a, b));
    return [...list].sort(byName);
  }, [history.hosts, q, sort]);

  return (
    <Panel
      title={`Host (${history.hosts.length})`}
      bodyClassName="p-0"
      actions={
        <>
          <input className="input w-28 py-0.5 sm:w-40" placeholder="Cari host" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari host" />
          <select className="input py-0.5" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Urutkan host">
            <option value="name">Nama A-Z</option>
            <option value="most-failed">Paling sering gagal</option>
            <option value="recent-failed">Paling baru gagal</option>
          </select>
        </>
      }
    >
      {hosts.length === 0 ? (
        <Empty>Tidak ada host</Empty>
      ) : (
        <ul>
          {hosts.map((h) => {
            const isOpen = open === h.host;
            return (
              <li key={h.host} className="border-b border-line last:border-b-0">
                <button className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-row-hover" onClick={() => setOpen(isOpen ? null : h.host)} aria-expanded={isOpen}>
                  <span className="w-3 text-ink-muted">{isOpen ? '▾' : '▸'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{h.host}</span>
                    <span className="text-xs text-ink-muted">
                      {h.total_days ? `terakhir ${shortDate(h.last_date)}` : 'belum ada data'}
                      {h.failing && <b className="text-err"> · gagal {h.streak_days} hari berturut-turut sejak {h.failing_since}</b>}
                    </span>
                    {!isOpen && <NoteText note={h.note} category={h.note_category} />}
                  </span>
                  <span className="text-right text-xs text-ink-muted">
                    Konsistensi <b className="text-sm text-ink">{h.consistency}%</b>
                    <br />
                    {h.ok_days} OK / {h.fail_days} gagal
                  </span>
                  {h.last_status !== '-' && <SeverityBadge value={h.last_status} />}
                </button>
                {isOpen && <HostPanel h={h} verifyTimeline={history.verify_timeline} />}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
