// Aggregated data for the daily and monthly PDF reports. Reuses the same
// window/union/snapshot logic as /api/dashboard.

const repo = require('./repo');
const agg = require('../lib/aggregate');
const { operationalWindows, addDays, dateRange, monthRange, previousMonth, wibDateKey, ageDays } = require('../lib/time');
const { windowSnapshot, groupReportStatus, evidenceNotes } = require('./snapshot');
const { ValidationError } = require('./writes');

const OVERDUE_DAYS = 30;

function groupDetails(backupRows) {
  return [...agg.groupBy(backupRows, (r) => r.group)]
    .map(([group, rows]) => {
      const ok = rows.filter((r) => r.status === 'OK').length;
      return {
        group,
        ok,
        fail: rows.length - ok,
        total: rows.length,
        hosts: [...rows]
          .sort(agg.byKey('host'))
          .map(({ host, status, error_reason }) => ({ host, status, error_reason })),
      };
    })
    .sort(agg.byKey('group'));
}

function verifyByGroup(verifyRows, refDate) {
  return [...agg.groupBy(verifyRows, (r) => r.group)]
    .map(([group, rows]) => {
      const count = (s) => rows.filter((r) => r.severity === s).length;
      const problemApps = agg.sortProblemApps(
        rows
          .filter((r) => r.severity !== 'OK')
          .map((r) => {
            const age = ageDays(r.latest_snapshot_time, refDate);
            return {
              domain: r.domain,
              app_category: r.category,
              severity: r.severity,
              latest_snapshot_time: r.latest_snapshot_time ? r.latest_snapshot_time.toISOString() : null,
              age_days: age,
              overdue: age !== null && age > OVERDUE_DAYS,
            };
          }),
      );
      return {
        group,
        ok: count('OK'),
        warn: count('WARN'),
        critical: count('CRITICAL'),
        total: rows.length,
        problemApps,
        okApps: rows.filter((r) => r.severity === 'OK').map((r) => r.domain).sort(),
      };
    })
    .sort(agg.byKey('group'));
}

function reference(prefix, dateKey) {
  return `${prefix}/${dateKey.replace(/-/g, '/')}`;
}

async function getDailyReport(db, now = new Date()) {
  const win = operationalWindows(now);
  const today = win.todayKey;
  const from30 = addDays(today, -29);
  const notes = await repo.notesIndex(db);

  const [snap, backup30] = await Promise.all([
    windowSnapshot(db, win.previous, notes, now),
    repo.dailyBackupRows(db, from30, today),
  ]);
  const groupStatus = await groupReportStatus(db, win.previous, win.beforePrevious, snap.backupRows, notes);

  return {
    type: 'daily',
    reference: reference('LAP-BACKUP', today),
    generatedAt: now.toISOString(),
    period: { label: win.previous.label, start: win.previous.start.toISOString(), end: win.previous.end.toISOString() },
    stats: snap.stats,
    statsVerify: snap.statsVerify,
    pendingGroups: groupStatus
      .filter((g) => g.report_status === 'pending')
      .map(({ group, usual_report_time }) => ({ group, usual_report_time })),
    evidenceNotes: evidenceNotes(snap, notes),
    topFailHosts: agg.topFailHosts(backup30, { limit: 5, sparkDates: dateRange(addDays(today, -6), today) }),
    topFailGroups: agg.topFailGroups(backup30, { limit: 5 }),
    groupDetails: groupDetails(snap.backupRows),
    verifyGroups: verifyByGroup(snap.verifyRows, now),
  };
}

function average(days) {
  const withData = days.filter((d) => d.total > 0);
  if (!withData.length) return null;
  return agg.round1(withData.reduce((s, d) => s + d.successRate, 0) / withData.length);
}

function compare(current, previous) {
  if (current === null || previous === null) return { current, previous, delta: null, direction: '-' };
  const delta = agg.round1(current - previous);
  return { current, previous, delta, direction: delta > 0 ? 'Naik' : delta < 0 ? 'Turun' : 'Tetap' };
}

function worstDay(days) {
  const withData = days.filter((d) => d.total > 0);
  if (!withData.length) return null;
  return withData.reduce((w, d) => (d.successRate < w.successRate ? d : w));
}

/**
 * Monthly report. `month` = 'YYYY-MM' (default: previous calendar month).
 * With preview=true the period is the 1st of the current month up to today.
 */
async function getMonthlyReport(db, { month, preview = false, now = new Date() } = {}) {
  const today = wibDateKey(now);
  let first;
  let last;
  if (preview) {
    first = `${today.slice(0, 7)}-01`;
    last = today;
  } else {
    const target = month || previousMonth(today.slice(0, 7));
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(target)) throw new ValidationError('month harus format YYYY-MM');
    ({ first, last } = monthRange(target));
    if (first > today) throw new ValidationError('bulan belum berjalan');
    if (last > today) last = today;
  }
  const prev = monthRange(previousMonth(first.slice(0, 7)));
  const periodEnd = new Date(`${addDays(last, 1)}T00:00:00+07:00`);
  const refDate = periodEnd < now ? periodEnd : now;

  const [backup, verify, prevBackup, prevVerify, notes] = await Promise.all([
    repo.dailyBackupRows(db, first, last),
    repo.dailyVerifyRows(db, first, last),
    repo.dailyBackupRows(db, prev.first, prev.last),
    repo.dailyVerifyRows(db, prev.first, prev.last),
    repo.notesIndex(db),
  ]);

  const backupDays = agg.dailyBackup(backup);
  const verifyDays = agg.dailyVerify(verify);
  const bByDate = new Map(backupDays.map((d) => [d.date, d]));
  const vByDate = new Map(verifyDays.map((d) => [d.date, d]));
  const dailyTrend = dateRange(first, last).map((date) => {
    const b = bByDate.get(date) ?? null;
    const v = vByDate.get(date) ?? null;
    return { date, backup: b, verify: v, hasFailure: Boolean((b && b.fail > 0) || (v && v.ok < v.total)) };
  });

  // End-of-period state: per-host/app union over the last 7 days of the period,
  // because the final day alone may not have every group reported yet.
  const tailFrom = addDays(last, -6) < first ? first : addDays(last, -6);
  const endBackup = [...agg.latestBy(backup.filter((r) => r.date >= tailFrom), (r) => r.host).values()];
  const endVerify = [...agg.latestBy(verify.filter((r) => r.date >= tailFrom), (r) => r.domain).values()];

  const avgBackup = average(backupDays);
  const avgVerify = average(verifyDays);

  return {
    type: preview ? 'monthly-preview' : 'monthly',
    reference: reference('LAP-BACKUP', first.slice(0, 7)),
    generatedAt: now.toISOString(),
    period: { first, last, endOfPeriodFrom: tailFrom },
    averages: { backup: avgBackup, verify: avgVerify },
    comparison: {
      backup: compare(avgBackup, average(agg.dailyBackup(prevBackup))),
      verify: compare(avgVerify, average(agg.dailyVerify(prevVerify))),
    },
    worstDay: { backup: worstDay(backupDays), verify: worstDay(verifyDays) },
    dailyTrend,
    endOfPeriod: {
      stats: agg.statsBackup(endBackup),
      statsVerify: agg.statsVerify(endVerify),
      groupDetails: groupDetails(endBackup),
      verifyGroups: verifyByGroup(endVerify, refDate),
    },
    evidenceNotes: evidenceNotes({ backupRows: endBackup, verifyRows: endVerify }, notes),
    topFailHosts: agg.topFailHosts(backup, { limit: 10, sparkDates: dateRange(addDays(last, -6), last) }),
    topFailGroups: agg.topFailGroups(backup, { limit: 10 }),
  };
}

module.exports = { getDailyReport, getMonthlyReport };
