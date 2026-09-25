import { COLORS } from '@/lib/constants';
import type { StatsBackup, StatsVerify } from '@/lib/types';
import { StatCard } from '../StatCard';

function rateColor(rate: number, total: number) {
  if (!total) return COLORS.muted;
  if (rate >= 98) return COLORS.ok;
  if (rate >= 90) return COLORS.warn;
  return COLORS.error;
}

function WindowTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-xs">
      <span className="font-bold uppercase tracking-wide text-brand dark:text-sky-300">{title}</span>
      <span className="text-ink-muted">{sub}</span>
    </div>
  );
}

export function BackupStats({ title, sub, s }: { title: string; sub: string; s: StatsBackup }) {
  return (
    <div>
      <WindowTitle title={title} sub={sub} />
      <div className="grid grid-cols-2 gap-2">
        <StatCard size="lg" value={s.totalHostToday ? `${s.successRateToday}%` : '-'} label="Success Rate" bgColor={rateColor(s.successRateToday, s.totalHostToday)} />
        <StatCard size="lg" value={s.totalGroupBackup} label="Group" bgColor={COLORS.primary} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <StatCard value={s.totalOkToday} label="Host OK" bgColor={COLORS.ok} />
        <StatCard value={s.totalFailToday} label="Host Gagal" bgColor={s.totalFailToday ? COLORS.error : COLORS.muted} />
        <StatCard value={s.totalHostToday} label="Total Host" />
      </div>
    </div>
  );
}

export function VerifyStats({ title, sub, s }: { title: string; sub: string; s: StatsVerify }) {
  return (
    <div>
      <WindowTitle title={title} sub={sub} />
      <div className="grid grid-cols-2 gap-2">
        <StatCard size="lg" value={s.totalVerifyApp ? `${s.successRateVerify}%` : '-'} label="Success Rate" bgColor={rateColor(s.successRateVerify, s.totalVerifyApp)} />
        <StatCard size="lg" value={s.totalGroupVerify} label="Group" bgColor={COLORS.primary} />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <StatCard value={s.totalVerifyOk} label="App OK" bgColor={COLORS.ok} />
        <StatCard value={s.totalVerifyWarn} label="Warn" bgColor={s.totalVerifyWarn ? COLORS.warn : COLORS.muted} textColor={s.totalVerifyWarn ? '#1f2d3d' : '#fff'} />
        <StatCard value={s.totalVerifyCrit} label="Critical" bgColor={s.totalVerifyCrit ? COLORS.error : COLORS.muted} />
        <StatCard value={s.totalVerifyApp} label="Total App" />
      </div>
    </div>
  );
}
