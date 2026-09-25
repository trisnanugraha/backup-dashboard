import { COLORS } from '@/lib/constants';

const STYLES: Record<string, { bg: string; fg: string; label?: string }> = {
  OK: { bg: COLORS.ok, fg: '#fff' },
  WARN: { bg: COLORS.warn, fg: '#1f2d3d' },
  CRITICAL: { bg: COLORS.error, fg: '#fff' },
  ERROR: { bg: COLORS.error, fg: '#fff' },
  PENDING: { bg: COLORS.muted, fg: '#fff', label: 'Belum Lapor' },
};

/** Status badge; always carries a text label, never color alone. */
export function SeverityBadge({ value, label }: { value: string; label?: string }) {
  const s = STYLES[value] ?? { bg: COLORS.muted, fg: '#fff' };
  return (
    <span
      className="inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold leading-none tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {label ?? s.label ?? value}
    </span>
  );
}
