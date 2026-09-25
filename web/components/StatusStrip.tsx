import { shortDate } from '@/lib/calendar';

const CLS: Record<string, string> = { OK: 'bg-ok', ERROR: 'bg-err' };

/** Row of small day squares (OK / ERROR / no data), oldest first. */
export function StatusStrip({ days, size = 12 }: { days: { date: string; status: string | null }[]; size?: number }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={days.map((d) => `${d.date} ${d.status ?? 'tidak ada data'}`).join(', ')}>
      {days.map((d) => (
        <span
          key={d.date}
          title={`${shortDate(d.date)}: ${d.status ?? 'tidak ada data'}`}
          className={`inline-block rounded-[2px] ${d.status ? CLS[d.status] ?? 'bg-muted' : 'lvl-none'}`}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}
