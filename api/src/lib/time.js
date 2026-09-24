// WIB (Asia/Jakarta) is a fixed UTC+7 offset with no DST, so all window math
// is plain UTC arithmetic. The operational day is cut at 17:00 WIB (10:00 UTC).

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WIB_OFFSET_MS = 7 * HOUR_MS;
const CUTOFF_HOUR_UTC = 10; // 17:00 WIB

const pad = (n) => String(n).padStart(2, '0');

function toWib(date) {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

/** 'YYYY-MM-DD' of the WIB calendar date of `date`. */
function wibDateKey(date) {
  return toWib(date).toISOString().slice(0, 10);
}

/** 'HH:mm' in WIB. */
function wibTime(date) {
  return toWib(date).toISOString().slice(11, 16);
}

/** 'YYYY-MM-DD HH:mm' in WIB. */
function wibDateTime(date) {
  return `${wibDateKey(date)} ${wibTime(date)}`;
}

function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** Inclusive list of date keys from `from` to `to`. */
function dateRange(from, to) {
  const out = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/**
 * Operational windows relative to `now`.
 *  current:  [last 17:00 WIB, now]
 *  previous: [last 17:00 WIB - 24h, last 17:00 WIB)
 *  beforePrevious: the full cycle before `previous` (used by the daily report
 *  to find groups that stopped reporting).
 */
function operationalWindows(now = new Date()) {
  const nowWib = toWib(now);
  const todayKey = nowWib.toISOString().slice(0, 10);
  const last17Key = nowWib.getUTCHours() < 17 ? addDays(todayKey, -1) : todayKey;
  const last17 = new Date(`${last17Key}T${pad(CUTOFF_HOUR_UTC)}:00:00Z`);
  const prevStart = new Date(last17.getTime() - DAY_MS);
  const beforePrevStart = new Date(prevStart.getTime() - DAY_MS);

  return {
    now,
    todayKey,
    current: {
      start: last17,
      end: now,
      endInclusive: true,
      label: `Berjalan (17:00 WIB ${last17Key} - sekarang)`,
    },
    previous: {
      start: prevStart,
      end: last17,
      endInclusive: false,
      label: `17:00 WIB ${addDays(last17Key, -1)} s/d 17:00 WIB ${last17Key}`,
    },
    beforePrevious: {
      start: beforePrevStart,
      end: prevStart,
      endInclusive: false,
      label: `17:00 WIB ${addDays(last17Key, -2)} s/d 17:00 WIB ${addDays(last17Key, -1)}`,
    },
  };
}

/** Calendar month [first, last] date keys. `month` = 'YYYY-MM'. */
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const first = `${y}-${pad(m)}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { first, last };
}

function previousMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Whole days elapsed since `date`, or null. */
function ageDays(date, now = new Date()) {
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(date).getTime()) / DAY_MS));
}

module.exports = {
  DAY_MS,
  wibDateKey,
  wibTime,
  wibDateTime,
  addDays,
  dateRange,
  operationalWindows,
  monthRange,
  previousMonth,
  ageDays,
};
