// Window snapshot: everything derived from the unioned rows of one window.
// Shared by /api/dashboard (window berjalan + kemarin) and the reports.

const repo = require('./repo');
const agg = require('../lib/aggregate');
const { ageDays, wibTime } = require('../lib/time');

const EMPTY_NOTE = { note: '', note_category: '' };
const noteOf = (map, key) => map.get(key) ?? EMPTY_NOTE;

function problemApp(row, notes, now) {
  return {
    domain: row.domain,
    group: row.group,
    severity: row.severity,
    app_category: row.category,
    latest_snapshot_time: row.latest_snapshot_time ? row.latest_snapshot_time.toISOString() : null,
    age_days: ageDays(row.latest_snapshot_time, now),
    ...noteOf(notes.verify_app, row.domain),
  };
}

function buildVerifySummary(verifyRows, notes, now) {
  return [...agg.groupBy(verifyRows, (r) => r.group)].map(([group, rows]) => {
    const count = (s) => rows.filter((r) => r.severity === s).length;
    return {
      group,
      ok: count('OK'),
      warn: count('WARN'),
      critical: count('CRITICAL'),
      total: rows.length,
      problemApps: agg.sortProblemApps(rows.filter((r) => r.severity !== 'OK').map((r) => problemApp(r, notes, now))),
      okApps: rows.filter((r) => r.severity === 'OK').map((r) => ({ domain: r.domain, app_category: r.category })),
      ...noteOf(notes.group, group),
    };
  });
}

function buildHostDetails(backupRows) {
  return backupRows.map((r) => ({ group: r.group, host: r.host, status: r.status, error_reason: r.error_reason }));
}

/**
 * Notes that still count as evidence: the entity is still problematic in this
 * window (host ERROR, group with fail > 0, app WARN/CRITICAL). Notes on
 * entities that recovered stay in the DB but are not reported as active.
 */
function evidenceNotes({ backupRows, verifyRows }, notes) {
  const out = [];
  for (const r of backupRows) {
    const n = notes.host.get(r.host);
    if (n && r.status === 'ERROR') {
      out.push({ entity_type: 'host', entity_key: r.host, group: r.group, status: r.status, ...n });
    }
  }
  for (const [group, rows] of agg.groupBy(backupRows, (r) => r.group)) {
    const n = notes.group.get(group);
    const fail = rows.filter((r) => r.status === 'ERROR').length;
    if (n && fail > 0) {
      out.push({ entity_type: 'group', entity_key: group, group, status: `${fail} gagal`, ...n });
    }
  }
  for (const r of verifyRows) {
    const n = notes.verify_app.get(r.domain);
    if (n && r.severity !== 'OK') {
      out.push({ entity_type: 'verify_app', entity_key: r.domain, group: r.group, status: r.severity, ...n });
    }
  }
  return out;
}

async function windowSnapshot(db, win, notes, now) {
  const [backupRows, verifyRows] = await Promise.all([
    repo.latestBackupInWindow(db, win),
    repo.latestVerifyInWindow(db, win),
  ]);
  const verifySummary = buildVerifySummary(verifyRows, notes, now);
  return {
    label: win.label,
    backupRows,
    verifyRows,
    stats: agg.statsBackup(backupRows),
    statsVerify: agg.statsVerify(verifyRows),
    hostDetails: buildHostDetails(backupRows),
    verifySummary,
    strategicProblemApps: agg.sortProblemApps(verifySummary.flatMap((g) => g.problemApps)),
  };
}

/**
 * Per-group backup status for `win`. A group that reported in `prevWin` but
 * has no record in `win` is 'pending', with its usual report time taken from
 * its last report in `prevWin`.
 */
async function groupReportStatus(db, win, prevWin, backupRows, notes) {
  const [inWin, inPrev] = await Promise.all([
    repo.backupGroupsInWindow(db, win),
    repo.backupGroupsInWindow(db, prevWin),
  ]);
  const reported = new Set(inWin.map((g) => g.group));
  const rowsByGroup = agg.groupBy(backupRows, (r) => r.group);
  const out = [];

  for (const { group } of inWin) {
    const rows = rowsByGroup.get(group) ?? [];
    const ok = rows.filter((r) => r.status === 'OK').length;
    const fail = rows.length - ok;
    out.push({
      group,
      ok,
      fail,
      total: rows.length,
      report_status: 'reported',
      ...noteOf(notes.group, group),
      note_active: fail > 0 && notes.group.has(group),
    });
  }
  for (const { group, last_reported_at } of inPrev) {
    if (reported.has(group)) continue;
    out.push({
      group,
      ok: null,
      fail: null,
      total: null,
      report_status: 'pending',
      usual_report_time: wibTime(last_reported_at),
      ...noteOf(notes.group, group),
      note_active: false,
    });
  }
  return out.sort(agg.byKey('group'));
}

module.exports = { windowSnapshot, groupReportStatus, evidenceNotes, noteOf, EMPTY_NOTE };
