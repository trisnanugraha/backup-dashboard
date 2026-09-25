'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { shortDate } from '@/lib/calendar';
import { Empty } from './Panel';

type Point = { date: string; successRate: number; ok: number; total: number; fail?: number };

/** Single-series success-rate line (0-100%). */
export function TrendChart({ data, color, label }: { data: Point[]; color: string; label: string }) {
  const points = useMemo(() => data.map((d) => ({ ...d, day: shortDate(d.date) })), [data]);
  if (!points.length) return <Empty>Belum ada data 30 hari terakhir</Empty>;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--ink-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} minTickGap={16} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={{ fontSize: 11, fill: 'var(--ink-muted)' }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: 'var(--ink-muted)', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink shadow">
                  <div className="font-semibold">{p.date}</div>
                  <div>
                    {label}: <b>{p.successRate}%</b>
                  </div>
                  <div className="text-ink-muted">
                    {p.ok} OK / {p.total} total
                  </div>
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="successRate" stroke={color} strokeWidth={2} dot={{ r: 2.5, fill: color }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
