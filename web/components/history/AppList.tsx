'use client';

import { useState } from 'react';
import { formatWib } from '@/lib/calendar';
import type { GroupHistory } from '@/lib/types';
import { CategoryBadge } from '../CategoryBadge';
import { CategorySelect } from '../CategorySelect';
import { NoteEditor, NoteText, PencilIcon } from '../NoteEditor';
import { Empty, Panel } from '../Panel';
import { SeverityBadge } from '../SeverityBadge';

export function AppList({ apps }: { apps: GroupHistory['verify_apps'] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Panel title={`Aplikasi di Group (${apps.length})`} bodyClassName="p-0">
      {apps.length === 0 ? (
        <Empty>Tidak ada aplikasi verify di group ini</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {apps.map((a) => (
            <li key={a.domain} className="px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 break-all text-sm font-medium">{a.domain}</span>
                <CategoryBadge category={a.app_category} />
                {a.severity !== '-' && <SeverityBadge value={a.severity} />}
                <CategorySelect domain={a.domain} value={a.app_category} />
                <button
                  className={`rounded p-1 hover:text-brand ${a.note ? 'text-brand dark:text-sky-300' : 'text-ink-muted'}`}
                  aria-label={`Catatan ${a.domain}`}
                  aria-expanded={editing === a.domain}
                  onClick={() => setEditing(editing === a.domain ? null : a.domain)}
                >
                  <PencilIcon />
                </button>
              </div>
              <div className="text-xs text-ink-muted">Snapshot terakhir: {formatWib(a.latest_snapshot_time)} WIB</div>
              {editing === a.domain ? (
                <div className="mt-2">
                  <NoteEditor entityType="verify_app" entityKey={a.domain} note={a.note} category={a.note_category} onDone={() => setEditing(null)} />
                </div>
              ) : (
                <NoteText note={a.note} category={a.note_category} />
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
