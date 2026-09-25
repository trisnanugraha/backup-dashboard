'use client';

import { useMemo } from 'react';
import { buildCalendar, todayWib, type RateLevel } from '@/lib/calendar';
import type { DailyRate } from '@/lib/types';

const WEEKDAYS = ['S', 'S', 'R', 'K', 'J', 'S', 'M'];
const LEGEND: [RateLevel, string][] = [
  ['good', '>= 98%'],
  ['fair', '>= 90%'],
  ['poor', '>= 75%'],
  ['bad', '< 75%'],
  ['none', 'Tidak ada data'],
];

/**
 * Month grids of daily success rate (Monday = first column). The grid is
 * memoized: rebuilding it on every render is what froze the old AngularJS
 * dashboard.
 */
export function CalendarHeatmap({ data, months = 6, title }: { data: DailyRate[]; months?: number; title?: string }) {
  const today = todayWib();
  const grid = useMemo(() => buildCalendar(data, today, months), [data, today, months]);

  return (
    <div>
      {title && <h3 className="mb-2 text-sm font-semibold">{title}</h3>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {grid.map((m) => (
          <div key={m.key} className="min-w-0">
            <div className="mb-1 text-xs font-semibold text-ink-muted">{m.label}</div>
            <div className="grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((w, i) => (
                <div key={i} className="text-center text-[9px] text-ink-muted">
                  {w}
                </div>
              ))}
              {Array.from({ length: m.offset }, (_, i) => (
                <div key={`o${i}`} />
              ))}
              {m.cells.map((c) => (
                <div
                  key={c.date}
                  title={c.future ? c.date : `${c.date}: ${c.rate === null ? 'tidak ada data' : `${c.rate}%`}`}
                  className={`aspect-square rounded-[2px] ${c.future ? 'opacity-25 lvl-none' : `lvl-${c.level}`}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        {LEGEND.map(([lvl, label]) => (
          <span key={lvl} className="inline-flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-[2px] lvl-${lvl}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
