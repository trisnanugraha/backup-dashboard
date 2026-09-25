import { APP_CATEGORIES, CATEGORY_COLORS, UNLABELED } from '@/lib/constants';
import { formatWib } from '@/lib/calendar';
import type { Dashboard, ProblemApp } from '@/lib/types';
import { CategoryBadge } from '../CategoryBadge';
import { NoteText } from '../NoteEditor';
import { Empty, Panel } from '../Panel';
import { SeverityBadge } from '../SeverityBadge';

export function StrategicApps({ apps }: { apps: ProblemApp[] }) {
  return (
    <Panel title={`Aplikasi Strategis Bermasalah (${apps.length})`} bodyClassName="max-h-[26rem] overflow-y-auto p-0">
      {apps.length === 0 ? (
        <Empty>Tidak ada aplikasi bermasalah</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {apps.map((a) => (
            <li key={a.domain} className="px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={a.app_category} />
                <SeverityBadge value={a.severity} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={a.domain}>
                  {a.domain}
                </span>
                <span className={`text-xs tabular-nums ${a.age_days !== null && a.age_days > 30 ? 'font-bold text-err' : 'text-ink-muted'}`}>
                  {a.age_days === null ? 'tanpa snapshot' : `${a.age_days} hari`}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">
                {a.group} · snapshot terakhir {formatWib(a.latest_snapshot_time)}
              </div>
              <NoteText note={a.note} category={a.note_category} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function CategoryCounter({ counts }: { counts: Dashboard['categoryCounts'] }) {
  return (
    <Panel title="Total Aplikasi per Kategori">
      <div className="grid grid-cols-2 gap-2">
        {APP_CATEGORIES.map((c) => (
          <div key={c} className="rounded-md px-3 py-4 text-center text-white" style={{ background: CATEGORY_COLORS[c] }}>
            <div className="text-3xl font-bold tabular-nums leading-none">{counts[c]}</div>
            <div className="mt-1.5 text-xs font-semibold">{c}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        {counts[UNLABELED as 'Belum Berlabel'] > 0 ? (
          <>
            <b className="text-ink">{counts['Belum Berlabel']}</b> aplikasi belum berlabel — atur kategorinya di Detail Verify per Group atau halaman History.
          </>
        ) : (
          'Semua aplikasi sudah berlabel.'
        )}
      </p>
    </Panel>
  );
}
