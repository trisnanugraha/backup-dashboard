'use client';

import { useDashboard } from '@/lib/api';
import { COLORS } from '@/lib/constants';
import { formatWib } from '@/lib/calendar';
import type { Dashboard } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { CalendarHeatmap } from '@/components/CalendarHeatmap';
import { Panel } from '@/components/Panel';
import { TrendChart } from '@/components/TrendChart';
import { AlertBanner } from '@/components/dashboard/AlertBanner';
import { BackupStats, VerifyStats } from '@/components/dashboard/StatsSection';
import { HostDetails } from '@/components/dashboard/HostDetails';
import { CategoryCounter, StrategicApps } from '@/components/dashboard/PriorityApps';
import { TodayStatus } from '@/components/dashboard/TodayStatus';
import { TopFailGroups, TopFailHosts } from '@/components/dashboard/TopFail';
import { VerifyDetail } from '@/components/dashboard/VerifyDetail';

export function DashboardView({ initial }: { initial?: Dashboard }) {
  const { data, error, isFetching, refetch, dataUpdatedAt } = useDashboard(initial);

  return (
    <>
      <AppHeader>
        <button className="rounded bg-accent px-3 py-1 text-sm font-bold text-[#1f2d3d] hover:brightness-95 disabled:opacity-60" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Memuat...' : 'Refresh'}
        </button>
      </AppHeader>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        {data && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
            <span>
              Window berjalan: <b className="text-ink">{data.windowLabel}</b>
            </span>
            <span>
              Window kemarin: <b className="text-ink">{data.windowKemarin.label}</b>
            </span>
            <span>
              Refresh terakhir: <b className="text-ink">{formatWib(new Date(dataUpdatedAt).toISOString())} WIB</b> (otomatis tiap 5 menit)
            </span>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-err bg-err/10 px-4 py-2 text-sm text-err">
            Gagal memuat data: {error.message}
            {data ? ' — menampilkan data terakhir.' : ''}
          </div>
        )}

        {!data ? (
          !error && <p className="py-20 text-center text-ink-muted">Memuat data...</p>
        ) : (
          <>
            <AlertBanner hosts={data.hostDetails} />

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Backup">
                <div className="space-y-4">
                  <BackupStats title="Window Berjalan" sub={data.windowLabel} s={data.stats} />
                  <BackupStats title="Window Kemarin" sub={data.windowKemarin.label} s={data.windowKemarin.stats} />
                </div>
              </Panel>
              <Panel title="Verify">
                <div className="space-y-4">
                  <VerifyStats title="Window Berjalan" sub={data.windowLabel} s={data.statsVerify} />
                  <VerifyStats title="Window Kemarin" sub={data.windowKemarin.label} s={data.windowKemarin.statsVerify} />
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Trend Success Rate Backup (30 hari)">
                <TrendChart data={data.trendBackup} color={COLORS.primary} label="Backup" />
              </Panel>
              <Panel title="Trend Success Rate Verify (30 hari)">
                <TrendChart data={data.trendVerify} color={COLORS.ok} label="Verify" />
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TopFailGroups groups={data.topFailGroups} />
              <TopFailHosts hosts={data.topFailHosts} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <StrategicApps apps={data.strategicProblemApps} />
              <CategoryCounter counts={data.categoryCounts} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TodayStatus groups={data.todaySummary} />
              <HostDetails hosts={data.hostDetails} />
            </div>

            <VerifyDetail groups={data.verifySummary} />

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Kalender Success Rate Backup (6 bulan)">
                <CalendarHeatmap data={data.calendarBackup} />
              </Panel>
              <Panel title="Kalender Success Rate Verify (6 bulan)">
                <CalendarHeatmap data={data.calendarVerify} />
              </Panel>
            </div>
          </>
        )}
      </main>
    </>
  );
}
