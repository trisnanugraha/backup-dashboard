// Pure aggregation helpers (no DB access) shared by dashboard, history and
// report services. Input rows are already "unioned" (one row per host/app per
// window or per host/app per day) by the repository layer.

const CATEGORIES = ['Strategis', 'Tinggi', 'Sedang', 'Rendah'];
const UNLABELED = 'Belum Berlabel';
const SEVERITY_RANK = { OK: 0, WARN: 1, CRITICAL: 2 };

const round1 = (x) => Math.round(x * 10) / 10;
const rate = (ok, total) => (total ? round1((ok / total) * 100) : 0);
const byKey = (key) => (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0);

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const k = keyFn(row);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}

/** Newest row (by `date`) per key. */
function latestBy(rows, keyFn) {
  const out = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!out.has(k) || out.get(k).date < r.date) out.set(k, r);
  }
  return out;
}

function statsBackup(rows) {
  const ok = rows.filter((r) => r.status === 'OK').length;
  return {
    successRateToday: rate(ok, rows.length),
    totalGroupBackup: new Set(rows.map((r) => r.group)).size,
    totalHostToday: rows.length,
    totalOkToday: ok,
    totalFailToday: rows.length - ok,
  };
}

function statsVerify(rows) {
  const count = (s) => rows.filter((r) => r.severity === s).length;
  const ok = count('OK');
  return {
    successRateVerify: rate(ok, rows.length),
    totalGroupVerify: new Set(rows.map((r) => r.group)).size,
    totalVerifyApp: rows.length,
    totalVerifyOk: ok,
    totalVerifyWarn: count('WARN'),
    totalVerifyCrit: count('CRITICAL'),
  };
}

/** Per-date backup summary from per-host-per-day rows, ascending by date. */
function dailyBackup(dailyRows) {
  return [...groupBy(dailyRows, (r) => r.date)]
    .map(([date, rows]) => {
      const ok = rows.filter((r) => r.status === 'OK').length;
      return { date, ok, fail: rows.length - ok, total: rows.length, successRate: rate(ok, rows.length) };
    })
    .sort(byKey('date'));
}

/** Per-date verify summary from per-app-per-day rows, ascending by date. */
function dailyVerify(dailyRows) {
  return [...groupBy(dailyRows, (r) => r.date)]
    .map(([date, rows]) => {
      const count = (s) => rows.filter((r) => r.severity === s).length;
      const ok = count('OK');
      return {
        date,
        ok,
        warn: count('WARN'),
        critical: count('CRITICAL'),
        total: rows.length,
        successRate: rate(ok, rows.length),
      };
    })
    .sort(byKey('date'));
}

/**
 * Hosts with the most failing days. `sparkDates` are the date keys for the
 * mini sparkline (oldest first); missing days are null.
 */
function topFailHosts(dailyRows, { limit = 5, sparkDates = [] } = {}) {
  return [...groupBy(dailyRows, (r) => r.host)]
    .map(([host, rows]) => {
      const sorted = [...rows].sort(byKey('date'));
      const byDate = new Map(sorted.map((r) => [r.date, r.status]));
      return {
        host,
        group: sorted[sorted.length - 1].group,
        failCount: rows.filter((r) => r.status === 'ERROR').length,
        sparkline: sparkDates.map((d) => byDate.get(d) ?? null),
      };
    })
    .filter((h) => h.failCount > 0)
    .sort((a, b) => b.failCount - a.failCount || byKey('host')(a, b))
    .slice(0, limit);
}

function topFailGroups(dailyRows, { limit = 5 } = {}) {
  const fails = dailyRows.filter((r) => r.status === 'ERROR');
  return [...groupBy(fails, (r) => r.group)]
    .map(([group, rows]) => ({
      group,
      failDaysCount: new Set(rows.map((r) => r.date)).size,
      totalFailInstances: rows.length,
    }))
    .sort(
      (a, b) =>
        b.failDaysCount - a.failDaysCount || b.totalFailInstances - a.totalFailInstances || byKey('group')(a, b),
    )
    .slice(0, limit);
}

/**
 * Host consistency and failing streak from a timeline sorted DESCENDING by
 * date. The streak counts consecutive ERROR entries from the newest entry and
 * stops at the first OK.
 */
function summarizeHostTimeline(timelineDesc) {
  const okDays = timelineDesc.filter((t) => t.status === 'OK').length;
  const total = timelineDesc.length;
  let streak = 0;
  for (const t of timelineDesc) {
    if (t.status !== 'ERROR') break;
    streak++;
  }
  return {
    last_status: total ? timelineDesc[0].status : '-',
    last_date: total ? timelineDesc[0].date : '',
    ok_days: okDays,
    fail_days: total - okDays,
    total_days: total,
    consistency: total ? round1((okDays / total) * 100) : 0,
    failing: streak > 0,
    streak_days: streak,
    failing_since: streak > 0 ? timelineDesc[streak - 1].date : null,
  };
}

/** Day-to-day status transitions per host (timelines ascending), newest first. */
function changedHosts(timelinesByHost) {
  const out = [];
  for (const [host, asc] of timelinesByHost) {
    for (let i = 1; i < asc.length; i++) {
      if (asc[i].status !== asc[i - 1].status) {
        out.push({ host, from: asc[i - 1].status, to: asc[i].status, date: asc[i].date });
      }
    }
  }
  return out.sort((a, b) => byKey('date')(b, a) || byKey('host')(a, b));
}

function worstSeverity(severities) {
  if (!severities.length) return '-';
  return severities.reduce((w, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[w] ? s : w), 'OK');
}

function categoryRank(category) {
  const i = CATEGORIES.indexOf(category);
  return i === -1 ? CATEGORIES.length : i;
}

/** Strategis -> Tinggi -> Sedang -> Rendah -> Belum Berlabel, then oldest snapshot first. */
function sortProblemApps(apps) {
  return [...apps].sort(
    (a, b) =>
      categoryRank(a.app_category) - categoryRank(b.app_category) ||
      (b.age_days ?? -1) - (a.age_days ?? -1) ||
      byKey('domain')(a, b),
  );
}

/** Title-case one of the four valid categories, '' to clear, or null if invalid. */
function normalizeCategory(value) {
  if (value === null || value === undefined) return null;
  const v = String(value).trim().toLowerCase();
  if (v === '') return '';
  return CATEGORIES.find((c) => c.toLowerCase() === v) ?? null;
}

module.exports = {
  CATEGORIES,
  UNLABELED,
  round1,
  rate,
  groupBy,
  byKey,
  latestBy,
  statsBackup,
  statsVerify,
  dailyBackup,
  dailyVerify,
  topFailHosts,
  topFailGroups,
  summarizeHostTimeline,
  changedHosts,
  worstSeverity,
  sortProblemApps,
  normalizeCategory,
};
