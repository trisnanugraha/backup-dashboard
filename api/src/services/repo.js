// SQL access layer. Every "latest" query unions per host/app with
// ROW_NUMBER() (newest reported_at wins, id breaks ties) so retries inside a
// window or a day are never double-counted.

function windowClause(win) {
  return {
    sql: `reported_at >= ? AND reported_at ${win.endInclusive ? '<=' : '<'} ?`,
    params: [win.start, win.end],
  };
}

function groupFilter(groupId) {
  return groupId ? { sql: ' AND group_id = ?', params: [groupId] } : { sql: '', params: [] };
}

/** One row per host: its newest backup record inside the window. */
async function latestBackupInWindow(db, win) {
  const w = windowClause(win);
  const [rows] = await db.query(
    `SELECT h.hostname AS host, g.name AS \`group\`, r.status, COALESCE(r.error_reason, '') AS error_reason, r.reported_at
     FROM (
       SELECT br.*, ROW_NUMBER() OVER (PARTITION BY host_id ORDER BY reported_at DESC, id DESC) AS rn
       FROM backup_records br WHERE ${w.sql}
     ) r
     JOIN hosts h ON h.id = r.host_id
     JOIN \`groups\` g ON g.id = r.group_id
     WHERE r.rn = 1
     ORDER BY g.name, h.hostname`,
    w.params,
  );
  return rows;
}

/** One row per verify app: its newest verify record inside the window. */
async function latestVerifyInWindow(db, win) {
  const w = windowClause(win);
  const [rows] = await db.query(
    `SELECT a.domain, g.name AS \`group\`, r.severity, r.latest_snapshot_time, r.snapshot_count,
            COALESCE(a.category, '') AS category, r.reported_at
     FROM (
       SELECT vr.*, ROW_NUMBER() OVER (PARTITION BY app_id ORDER BY reported_at DESC, id DESC) AS rn
       FROM verify_records vr WHERE ${w.sql}
     ) r
     JOIN verify_apps a ON a.id = r.app_id
     JOIN \`groups\` g ON g.id = r.group_id
     WHERE r.rn = 1
     ORDER BY g.name, a.domain`,
    w.params,
  );
  return rows;
}

/** Groups that sent any backup record in the window, with their last report time. */
async function backupGroupsInWindow(db, win) {
  const w = windowClause(win);
  const [rows] = await db.query(
    `SELECT g.name AS \`group\`, MAX(br.reported_at) AS last_reported_at
     FROM backup_records br JOIN \`groups\` g ON g.id = br.group_id
     WHERE ${w.sql.replace(/reported_at/g, 'br.reported_at')}
     GROUP BY g.name`,
    w.params,
  );
  return rows;
}

/** One row per host per report_date (newest record of that day). */
async function dailyBackupRows(db, fromKey, toKey, { groupId } = {}) {
  const g = groupFilter(groupId);
  const [rows] = await db.query(
    `SELECT h.hostname AS host, g.name AS \`group\`, r.report_date AS date, r.status,
            COALESCE(r.error_reason, '') AS error_reason
     FROM (
       SELECT br.*, ROW_NUMBER() OVER (PARTITION BY host_id, report_date ORDER BY reported_at DESC, id DESC) AS rn
       FROM backup_records br WHERE report_date BETWEEN ? AND ?${g.sql}
     ) r
     JOIN hosts h ON h.id = r.host_id
     JOIN \`groups\` g ON g.id = r.group_id
     WHERE r.rn = 1`,
    [fromKey, toKey, ...g.params],
  );
  return rows;
}

/** One row per verify app per report_date (newest record of that day). */
async function dailyVerifyRows(db, fromKey, toKey, { groupId } = {}) {
  const g = groupFilter(groupId);
  const [rows] = await db.query(
    `SELECT a.domain, g.name AS \`group\`, r.report_date AS date, r.severity, r.latest_snapshot_time,
            COALESCE(a.category, '') AS category
     FROM (
       SELECT vr.*, ROW_NUMBER() OVER (PARTITION BY app_id, report_date ORDER BY reported_at DESC, id DESC) AS rn
       FROM verify_records vr WHERE report_date BETWEEN ? AND ?${g.sql}
     ) r
     JOIN verify_apps a ON a.id = r.app_id
     JOIN \`groups\` g ON g.id = r.group_id
     WHERE r.rn = 1`,
    [fromKey, toKey, ...g.params],
  );
  return rows;
}

/**
 * All notes keyed by entity type, then by hostname / group name / domain:
 * { host: Map, group: Map, verify_app: Map } of { note, note_category }.
 */
async function notesIndex(db) {
  const [rows] = await db.query(
    `SELECT n.entity_type, COALESCE(h.hostname, g.name, a.domain) AS entity_key,
            n.note_text AS note, COALESCE(n.category, '') AS note_category
     FROM notes n
     LEFT JOIN hosts h ON n.entity_type = 'host' AND h.id = n.entity_id
     LEFT JOIN \`groups\` g ON n.entity_type = 'group' AND g.id = n.entity_id
     LEFT JOIN verify_apps a ON n.entity_type = 'verify_app' AND a.id = n.entity_id`,
  );
  const index = { host: new Map(), group: new Map(), verify_app: new Map() };
  for (const r of rows) {
    if (r.entity_key !== null) index[r.entity_type].set(r.entity_key, { note: r.note, note_category: r.note_category });
  }
  return index;
}

async function findGroup(db, name) {
  const [rows] = await db.query('SELECT id, name FROM `groups` WHERE name = ?', [name]);
  return rows[0] ?? null;
}

async function listGroups(db) {
  const [rows] = await db.query(
    `SELECT g.id, g.name, COUNT(h.id) AS total_hosts
     FROM \`groups\` g LEFT JOIN hosts h ON h.group_id = g.id
     GROUP BY g.id, g.name ORDER BY g.name`,
  );
  return rows;
}

async function hostsOfGroup(db, groupId) {
  const [rows] = await db.query('SELECT hostname FROM hosts WHERE group_id = ? ORDER BY hostname', [groupId]);
  return rows.map((r) => r.hostname);
}

async function appsOfGroup(db, groupId) {
  const [rows] = await db.query(
    "SELECT domain, COALESCE(category, '') AS category FROM verify_apps WHERE group_id = ? ORDER BY domain",
    [groupId],
  );
  return rows;
}

async function categoryCounts(db) {
  const [rows] = await db.query('SELECT category, COUNT(*) AS n FROM verify_apps GROUP BY category');
  const counts = { Strategis: 0, Tinggi: 0, Sedang: 0, Rendah: 0, 'Belum Berlabel': 0 };
  for (const r of rows) counts[r.category ?? 'Belum Berlabel'] = Number(r.n);
  return counts;
}

module.exports = {
  latestBackupInWindow,
  latestVerifyInWindow,
  backupGroupsInWindow,
  dailyBackupRows,
  dailyVerifyRows,
  notesIndex,
  findGroup,
  listGroups,
  hostsOfGroup,
  appsOfGroup,
  categoryCounts,
};
