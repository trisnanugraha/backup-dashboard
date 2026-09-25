'use client';

import { Fragment, useMemo, useState } from 'react';
import { APP_CATEGORIES, UNLABELED } from '@/lib/constants';
import { formatWib } from '@/lib/calendar';
import type { ProblemApp, VerifyGroup } from '@/lib/types';
import { CategorySelect } from '../CategorySelect';
import { NoteEditor, NoteText, PencilIcon } from '../NoteEditor';
import { Empty, Panel } from '../Panel';
import { SeverityBadge } from '../SeverityBadge';

const matches = (filter: string, category: string) => filter === 'all' || (category || UNLABELED) === filter;

function ProblemRow({ a }: { a: ProblemApp }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <tr>
        <td className="break-all font-medium">
          {a.domain}
          {!editing && <NoteText note={a.note} category={a.note_category} />}
        </td>
        <td>
          <SeverityBadge value={a.severity} />
        </td>
        <td>
          <CategorySelect domain={a.domain} value={a.app_category} />
        </td>
        <td className="whitespace-nowrap text-xs">{formatWib(a.latest_snapshot_time)}</td>
        <td className={`num ${a.age_days !== null && a.age_days > 30 ? 'font-bold text-err' : ''}`}>{a.age_days ?? '-'}</td>
        <td className="w-8">
          <button className="rounded p-1 text-ink-muted hover:text-brand" aria-label={`Catatan ${a.domain}`} onClick={() => setEditing(!editing)}>
            <PencilIcon />
          </button>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} className="bg-row-hover">
            <NoteEditor entityType="verify_app" entityKey={a.domain} note={a.note} category={a.note_category} onDone={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function GroupApps({ g, filter }: { g: VerifyGroup; filter: string }) {
  const [showOk, setShowOk] = useState(false);
  const problems = g.problemApps.filter((a) => matches(filter, a.app_category));
  const oks = g.okApps.filter((a) => matches(filter, a.app_category));
  return (
    <div className="space-y-2 py-1">
      {problems.length > 0 ? (
        <table className="tbl">
          <thead>
            <tr>
              <th>Aplikasi bermasalah</th>
              <th>Severity</th>
              <th>Kategori</th>
              <th>Snapshot terakhir</th>
              <th className="num">Umur (hari)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {problems.map((a) => (
              <ProblemRow key={a.domain} a={a} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-ink-muted">Tidak ada aplikasi WARN/CRITICAL{filter !== 'all' ? ' untuk kategori ini' : ''}.</p>
      )}
      {oks.length > 0 && (
        <div>
          <button className="text-xs font-semibold text-brand hover:underline dark:text-sky-300" onClick={() => setShowOk(!showOk)} aria-expanded={showOk}>
            {showOk ? 'Sembunyikan' : 'Tampilkan'} {oks.length} aplikasi OK
          </button>
          {showOk && (
            <ul className="mt-1 grid gap-1 sm:grid-cols-2">
              {oks.map((a) => (
                <li key={a.domain} className="flex items-center justify-between gap-2 rounded border border-line px-2 py-1 text-xs">
                  <span className="min-w-0 truncate" title={a.domain}>
                    {a.domain}
                  </span>
                  <CategorySelect domain={a.domain} value={a.app_category} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function VerifyDetail({ groups }: { groups: VerifyGroup[] }) {
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const visible = useMemo(
    () =>
      filter === 'all'
        ? groups
        : groups.filter((g) => [...g.problemApps, ...g.okApps].some((a) => matches(filter, a.app_category))),
    [groups, filter],
  );
  const toggle = (group: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    <Panel
      title="Detail Verify per Group"
      bodyClassName="p-0"
      actions={
        <select className="input py-0.5" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter kategori">
          <option value="all">Semua kategori</option>
          {[...APP_CATEGORIES, UNLABELED].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      }
    >
      {visible.length === 0 ? (
        <Empty>Tidak ada data verify</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Group</th>
                <th className="num">OK</th>
                <th className="num">Warn</th>
                <th className="num">Critical</th>
                <th className="num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => {
                const isOpen = open.has(g.group);
                return (
                  <Fragment key={g.group}>
                    <tr className="cursor-pointer" onClick={() => toggle(g.group)} aria-expanded={isOpen}>
                      <td className="font-medium">
                        <span className="mr-1.5 inline-block w-3 text-ink-muted">{isOpen ? '▾' : '▸'}</span>
                        {g.group}
                      </td>
                      <td className="num">{g.ok}</td>
                      <td className={`num ${g.warn ? 'font-bold text-warn' : ''}`}>{g.warn}</td>
                      <td className={`num ${g.critical ? 'font-bold text-err' : ''}`}>{g.critical}</td>
                      <td className="num">{g.total}</td>
                      <td>
                        <SeverityBadge value={g.critical ? 'CRITICAL' : g.warn ? 'WARN' : 'OK'} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} className="bg-row-hover/40">
                          <GroupApps g={g} filter={filter} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
