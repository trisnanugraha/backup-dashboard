const repo = require('./repo');
const agg = require('../lib/aggregate');
const { operationalWindows, addDays, dateRange } = require('../lib/time');
const { windowSnapshot, groupReportStatus } = require('./snapshot');

const TREND_DAYS = 30;
const SPARK_DAYS = 7;
const CALENDAR_DAYS = 183; // ~6 months for the heatmap

async function getDashboard(db, now = new Date()) {
  const win = operationalWindows(now);
  const today = win.todayKey;
  const trendFrom = addDays(today, -(TREND_DAYS - 1));
  const notes = await repo.notesIndex(db);

  const [current, previous, backupDaily, verifyDaily, categoryCounts] = await Promise.all([
    windowSnapshot(db, win.current, notes, now),
    windowSnapshot(db, win.previous, notes, now),
    repo.dailyBackupRows(db, addDays(today, -(CALENDAR_DAYS - 1)), today),
    repo.dailyVerifyRows(db, addDays(today, -(CALENDAR_DAYS - 1)), today),
    repo.categoryCounts(db),
  ]);
  const todaySummary = await groupReportStatus(db, win.current, win.previous, current.backupRows, notes);

  const backup30 = backupDaily.filter((r) => r.date >= trendFrom);
  const verify30 = verifyDaily.filter((r) => r.date >= trendFrom);
  const backupByDay = agg.dailyBackup(backupDaily);
  const verifyByDay = agg.dailyVerify(verifyDaily);

  return {
    windowLabel: win.current.label,
    windowKemarin: {
      label: win.previous.label,
      stats: previous.stats,
      statsVerify: previous.statsVerify,
    },
    stats: current.stats,
    statsVerify: current.statsVerify,
    trendBackup: backupByDay
      .filter((d) => d.date >= trendFrom)
      .map(({ date, ok, fail, total, successRate }) => ({ date, ok, fail, total, successRate })),
    trendVerify: verifyByDay
      .filter((d) => d.date >= trendFrom)
      .map(({ date, ok, total, successRate }) => ({ date, ok, total, successRate })),
    topFailHosts: agg.topFailHosts(backup30, { limit: 5, sparkDates: dateRange(addDays(today, -(SPARK_DAYS - 1)), today) }),
    topFailGroups: agg.topFailGroups(backup30, { limit: 5 }),
    todaySummary,
    hostDetails: current.hostDetails,
    verifySummary: current.verifySummary,
    strategicProblemApps: current.strategicProblemApps,
    categoryCounts,
    // Extensions beyond the Node-RED contract (heatmap on the dashboard).
    calendarBackup: backupByDay.map(({ date, successRate }) => ({ date, successRate })),
    calendarVerify: verifyByDay.map(({ date, successRate }) => ({ date, successRate })),
    generatedAt: now.toISOString(),
  };
}

module.exports = { getDashboard, TREND_DAYS, CALENDAR_DAYS };
