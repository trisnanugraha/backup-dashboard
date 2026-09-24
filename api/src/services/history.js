const repo = require('./repo');
const agg = require('../lib/aggregate');
const { addDays, wibDateKey } = require('../lib/time');
const { noteOf } = require('./snapshot');
const { CALENDAR_DAYS } = require('./dashboard');

const HISTORY_DAYS = 30;

class NotFoundError extends Error {}

async function getGroupHistory(db, groupName, { days = HISTORY_DAYS, now = new Date() } = {}) {
  const group = await repo.findGroup(db, groupName);
  if (!group) throw new NotFoundError(`group "${groupName}" tidak ditemukan`);

  const today = wibDateKey(now);
  const from = addDays(today, -(days - 1));
  const calendarFrom = addDays(today, -(Math.max(days, CALENDAR_DAYS) - 1));

  const [backupAll, verifyAll, memberHosts, apps, notes] = await Promise.all([
    repo.dailyBackupRows(db, calendarFrom, today, { groupId: group.id }),
    repo.dailyVerifyRows(db, calendarFrom, today, { groupId: group.id }),
    repo.hostsOfGroup(db, group.id),
    repo.appsOfGroup(db, group.id),
    repo.notesIndex(db),
  ]);
  const backup = backupAll.filter((r) => r.date >= from);
  const verify = verifyAll.filter((r) => r.date >= from);

  const verifyTimeline = agg.dailyVerify(verify);
  const byHost = agg.groupBy(backup, (r) => r.host);
  const hostNames = [...new Set([...memberHosts, ...byHost.keys()])].sort();

  const hosts = hostNames.map((host) => {
    const asc = [...(byHost.get(host) ?? [])].sort(agg.byKey('date'));
    const desc = [...asc].reverse();
    return {
      host,
      ...agg.summarizeHostTimeline(desc),
      ...noteOf(notes.host, host),
      backup_timeline: desc.map(({ date, status, error_reason }) => ({ date, status, error_reason })),
    };
  });

  const latestApp = agg.latestBy(verify, (r) => r.domain);
  const appDomains = [...new Set([...apps.map((a) => a.domain), ...latestApp.keys()])].sort();
  const categoryOf = new Map(apps.map((a) => [a.domain, a.category]));
  const verifyApps = appDomains.map((domain) => {
    const last = latestApp.get(domain);
    return {
      domain,
      severity: last ? last.severity : '-',
      latest_snapshot_time: last?.latest_snapshot_time ? last.latest_snapshot_time.toISOString() : null,
      ...noteOf(notes.verify_app, domain),
      app_category: categoryOf.get(domain) ?? last?.category ?? '',
    };
  });

  return {
    group: group.name,
    total_hosts: hosts.length,
    hosts_with_fail: hosts.filter((h) => h.last_status === 'ERROR').length,
    verify_severity: agg.worstSeverity([...latestApp.values()].map((r) => r.severity)),
    verify_timeline: verifyTimeline.map(({ date, ok, warn, critical, total }) => ({ date, ok, warn, critical, total })),
    backup_daily_summary: agg.dailyBackup(backup),
    verify_apps: verifyApps,
    changed_hosts: agg.changedHosts(
      new Map(hosts.map((h) => [h.host, [...h.backup_timeline].reverse()])),
    ),
    hosts,
    ...noteOf(notes.group, group.name),
    // Extensions: ~6 months of daily success rate for the calendar heatmaps.
    calendar_backup: agg.dailyBackup(backupAll).map(({ date, successRate }) => ({ date, successRate })),
    calendar_verify: agg.dailyVerify(verifyAll).map(({ date, successRate }) => ({ date, successRate })),
  };
}

/** Sidebar list. Uses the same 30-day definitions as getGroupHistory. */
async function listGroupHistory(db, { days = HISTORY_DAYS, now = new Date() } = {}) {
  const today = wibDateKey(now);
  const from = addDays(today, -(days - 1));
  const [groups, backup, verify, notes] = await Promise.all([
    repo.listGroups(db),
    repo.dailyBackupRows(db, from, today),
    repo.dailyVerifyRows(db, from, today),
    repo.notesIndex(db),
  ]);

  const lastHost = agg.latestBy(backup, (r) => `${r.group}\u0000${r.host}`);
  const lastApp = agg.latestBy(verify, (r) => `${r.group}\u0000${r.domain}`);
  const failing = new Map();
  for (const r of lastHost.values()) {
    if (r.status === 'ERROR') failing.set(r.group, (failing.get(r.group) ?? 0) + 1);
  }
  const severities = agg.groupBy([...lastApp.values()], (r) => r.group);

  return groups.map((g) => ({
    group: g.name,
    total_hosts: Number(g.total_hosts),
    hosts_with_fail: failing.get(g.name) ?? 0,
    verify_severity: agg.worstSeverity((severities.get(g.name) ?? []).map((r) => r.severity)),
    note: noteOf(notes.group, g.name).note,
  }));
}

module.exports = { getGroupHistory, listGroupHistory, NotFoundError, HISTORY_DAYS };
