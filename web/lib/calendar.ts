// Pure date/calendar helpers. All dates are 'YYYY-MM-DD' keys in WIB.

const DAY_MS = 86_400_000;
const WIB_OFFSET_MS = 7 * 3_600_000;
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function todayWib(now: Date = new Date()): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(dateKey: string, n: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Last `n` date keys ending at `end` (oldest first). */
export function lastDays(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

export type RateLevel = 'good' | 'fair' | 'poor' | 'bad' | 'none';

/** >=98 good, >=90 fair, >=75 poor, below that bad; no data -> none. */
export function rateLevel(rate: number | null | undefined): RateLevel {
  if (rate === null || rate === undefined) return 'none';
  if (rate >= 98) return 'good';
  if (rate >= 90) return 'fair';
  if (rate >= 75) return 'poor';
  return 'bad';
}

export interface CalendarCell {
  date: string;
  day: number;
  rate: number | null;
  level: RateLevel;
  future: boolean;
}

export interface CalendarMonth {
  key: string; // 'YYYY-MM'
  label: string; // 'September 2026'
  offset: number; // empty cells before day 1 (Monday = column 0)
  cells: CalendarCell[];
}

/**
 * Month grids for the `months` calendar months ending with the month of
 * `today`. Monday is the first column.
 */
export function buildCalendar(
  data: { date: string; successRate: number }[],
  today: string,
  months = 6,
): CalendarMonth[] {
  const rates = new Map(data.map((d) => [d.date, d.successRate]));
  const [ty, tm] = today.split('-').map(Number);
  const out: CalendarMonth[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const first = new Date(Date.UTC(ty, tm - 1 - i, 1));
    const y = first.getUTCFullYear();
    const m = first.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const cells: CalendarCell[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const rate = rates.get(date) ?? null;
      cells.push({ date, day: d, rate, level: rateLevel(rate), future: date > today });
    }
    out.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTHS[m]} ${y}`,
      offset: (first.getUTCDay() + 6) % 7,
      cells,
    });
  }
  return out;
}

/** '2026-09-24' -> '24 Sep' */
export function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** ISO timestamp -> 'YYYY-MM-DD HH:mm' WIB */
export function formatWib(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(Date.parse(iso) + WIB_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
}
