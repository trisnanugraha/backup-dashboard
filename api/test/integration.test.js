// Integration tests against a real MySQL 8. Skipped unless MYSQL_TEST_URL is
// set, e.g. MYSQL_TEST_URL=mysql://root@localhost:3306 (the test creates and
// drops its own database `backup_monitoring_test`).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { createPool } = require('../src/db');
const { createApp } = require('../src/app');
const { getDashboard } = require('../src/services/dashboard');
const { getGroupHistory, listGroupHistory } = require('../src/services/history');
const { getDailyReport, getMonthlyReport } = require('../src/services/report');
const ingestSql = require('../../n8n/src/sql');
const { normalizeBackup, normalizeVerify } = require('../../n8n/src/normalize');

const URL_ENV = process.env.MYSQL_TEST_URL;
const DB = 'backup_monitoring_test';
const NOW = new Date('2026-09-24T03:00:00Z'); // 10:00 WIB

let admin;
let db;
let server;
let base;

async function seed() {
  const q = (sql, p) => db.query(sql, p);
  for (const g of ['A', 'B', 'C', 'D']) await q('INSERT INTO `groups` (name) VALUES (?)', [g]);
  const gid = async (name) => (await q('SELECT id FROM `groups` WHERE name = ?', [name]))[0][0].id;
  const hosts = { a1: 'A', a2: 'A', a3: 'A', b1: 'B', c1: 'C', d1: 'D' };
  for (const [h, g] of Object.entries(hosts)) await q('INSERT INTO hosts (hostname, group_id) VALUES (?, ?)', [h, await gid(g)]);

  const backup = async (host, at, status, reason = null) =>
    q(
      `INSERT INTO backup_records (host_id, group_id, report_date, reported_at, status, error_reason)
       SELECT h.id, h.group_id, DATE(? + INTERVAL 7 HOUR), ?, ?, ? FROM hosts h WHERE h.hostname = ?`,
      [at, at, status, reason, host],
    );
  // window kemarin: 2026-09-22 10:00Z .. 2026-09-23 10:00Z
  await backup('a1', '2026-09-22 11:00:00', 'OK');
  await backup('a2', '2026-09-22 11:00:00', 'ERROR', 'disk full');
  await backup('a3', '2026-09-22 11:00:00', 'ERROR', 'timeout');
  await backup('b1', '2026-09-22 13:30:00', 'OK'); // 20:30 WIB, lalu tidak lapor lagi
  await backup('d1', '2026-09-22 10:00:00', 'OK'); // tepat di awal window kemarin
  // window berjalan: 2026-09-23 10:00Z .. now
  await backup('a1', '2026-09-23 11:00:00', 'ERROR', 'retry'); // retry -> yang terbaru OK
  await backup('a1', '2026-09-23 12:00:00', 'OK');
  await backup('a2', '2026-09-23 11:00:00', 'ERROR', 'disk full');
  await backup('a3', '2026-09-23 11:00:00', 'OK');
  await backup('c1', '2026-09-23 10:00:00', 'OK'); // tepat 17:00 WIB -> window berjalan

  for (const [domain, g, cat] of [['x.go.id', 'A', null], ['y.go.id', 'A', 'Strategis'], ['z.go.id', 'A', 'Rendah']]) {
    await q('INSERT INTO verify_apps (domain, group_id, category) VALUES (?, ?, ?)', [domain, await gid(g), cat]);
  }
  const verify = async (domain, at, sev, snap) =>
    q(
      `INSERT INTO verify_records (app_id, group_id, report_date, reported_at, severity, latest_snapshot_time, snapshot_count)
       SELECT a.id, a.group_id, DATE(? + INTERVAL 7 HOUR), ?, ?, ?, 1 FROM verify_apps a WHERE a.domain = ?`,
      [at, at, sev, snap, domain],
    );
  await verify('x.go.id', '2026-09-22 12:00:00', 'WARN', '2026-08-10 00:00:00');
  await verify('x.go.id', '2026-09-23 12:00:00', 'WARN', '2026-08-10 00:00:00');
  await verify('y.go.id', '2026-09-23 12:00:00', 'CRITICAL', '2026-09-20 00:00:00');
  await verify('z.go.id', '2026-09-23 12:00:00', 'OK', '2026-09-23 00:00:00');
}

test('integration', { skip: !URL_ENV && 'MYSQL_TEST_URL tidak di-set' }, async (t) => {
  admin = await mysql.createConnection({ uri: URL_ENV, multipleStatements: true });
  const schema = fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8').replaceAll('backup_monitoring', DB);
  await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
  await admin.query(schema);
  const u = new URL(URL_ENV);
  db = createPool({ host: u.hostname, port: Number(u.port || 3306), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: DB, socketPath: undefined });
  await seed();

  server = createApp(db).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  t.after(async () => {
    server.close();
    await db.end();
    await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
    await admin.end();
  });

  await t.test('dashboard: window, union per host, belum lapor', async () => {
    const d = await getDashboard(db, NOW);
    assert.equal(d.windowLabel, 'Berjalan (17:00 WIB 2026-09-23 - sekarang)');
    // current: a1 OK (retry, bukan double count), a2 ERROR, a3 OK, c1 OK
    assert.deepEqual(d.stats, { successRateToday: 75, totalGroupBackup: 2, totalHostToday: 4, totalOkToday: 3, totalFailToday: 1 });
    // kemarin: a1 OK, a2 ERR, a3 ERR, b1 OK, d1 OK
    assert.deepEqual(d.windowKemarin.stats, { successRateToday: 60, totalGroupBackup: 3, totalHostToday: 5, totalOkToday: 3, totalFailToday: 2 });

    const byGroup = Object.fromEntries(d.todaySummary.map((g) => [g.group, g]));
    assert.equal(byGroup.A.report_status, 'reported');
    assert.equal(byGroup.A.fail, 1);
    assert.equal(byGroup.B.report_status, 'pending');
    assert.equal(byGroup.B.usual_report_time, '20:30');
    assert.equal(byGroup.B.ok, null);
    assert.equal(byGroup.C.report_status, 'reported');
    assert.equal(byGroup.D.report_status, 'pending');

    assert.deepEqual(d.statsVerify, { successRateVerify: 33.3, totalGroupVerify: 1, totalVerifyApp: 3, totalVerifyOk: 1, totalVerifyWarn: 1, totalVerifyCrit: 1 });
    assert.deepEqual(d.strategicProblemApps.map((a) => [a.domain, a.app_category, a.severity]), [['y.go.id', 'Strategis', 'CRITICAL'], ['x.go.id', '', 'WARN']]);
    assert.equal(d.strategicProblemApps[1].age_days, 45);
    assert.deepEqual(d.verifySummary[0].okApps, [{ domain: 'z.go.id', app_category: 'Rendah' }]);
    assert.deepEqual(d.categoryCounts, { Strategis: 1, Tinggi: 0, Sedang: 0, Rendah: 1, 'Belum Berlabel': 1 });

    assert.deepEqual(d.trendBackup.map((x) => [x.date, x.ok, x.fail]), [['2026-09-22', 3, 2], ['2026-09-23', 3, 1]]);
    assert.deepEqual(d.topFailHosts.map((h) => [h.host, h.failCount]), [['a2', 2], ['a3', 1]]);
    assert.deepEqual(d.topFailHosts[0].sparkline, [null, null, null, null, 'ERROR', 'ERROR', null]);
    assert.deepEqual(d.topFailGroups, [{ group: 'A', failDaysCount: 2, totalFailInstances: 3 }]);
    assert.equal(d.hostDetails.length, 4);
  });

  await t.test('history per group', async () => {
    const h = await getGroupHistory(db, 'A', { now: NOW });
    assert.equal(h.total_hosts, 3);
    assert.equal(h.hosts_with_fail, 1);
    assert.equal(h.verify_severity, 'CRITICAL');
    const a2 = h.hosts.find((x) => x.host === 'a2');
    assert.equal(a2.streak_days, 2);
    assert.equal(a2.failing_since, '2026-09-22');
    assert.equal(a2.consistency, 0);
    const a1 = h.hosts.find((x) => x.host === 'a1');
    assert.deepEqual(a1.backup_timeline.map((x) => [x.date, x.status]), [['2026-09-23', 'OK'], ['2026-09-22', 'OK']]);
    assert.deepEqual(h.changed_hosts, [{ host: 'a3', from: 'ERROR', to: 'OK', date: '2026-09-23' }]);
    assert.deepEqual(h.verify_timeline, [
      { date: '2026-09-22', ok: 0, warn: 1, critical: 0, total: 1 },
      { date: '2026-09-23', ok: 1, warn: 1, critical: 1, total: 3 },
    ]);
    await assert.rejects(getGroupHistory(db, 'tidak-ada', { now: NOW }), /tidak ditemukan/);

    const list = await listGroupHistory(db, { now: NOW });
    assert.deepEqual(list.find((g) => g.group === 'A'), { group: 'A', total_hosts: 3, hosts_with_fail: 1, verify_severity: 'CRITICAL', note: '' });
  });

  await t.test('notes: simpan, evidence, hapus dengan string kosong', async () => {
    let r = await post('/api/notes', { entity_type: 'host', entity_key: 'a2', note: 'Sudah lapor ke tim 😀', category: 'Investigasi Berjalan' });
    assert.equal(r.status, 200);
    await post('/api/notes', { entity_type: 'host', entity_key: 'a1', note: 'catatan lama' });
    await post('/api/notes', { entity_type: 'verify_app', entity_key: 'y.go.id', note: 'app down' });
    r = await post('/api/notes', { entity_type: 'host', entity_key: 'a2', note: 'update', category: 'Sudah Dihubungi Tim Aplikasi' });
    assert.equal(r.status, 200);

    const daily = await getDailyReport(db, NOW);
    // window kemarin: a2 ERROR -> evidence; a1 OK -> bukan evidence; y.go.id tidak ada di window kemarin
    assert.deepEqual(daily.evidenceNotes.map((n) => [n.entity_type, n.entity_key, n.note, n.note_category]), [['host', 'a2', 'update', 'Sudah Dihubungi Tim Aplikasi']]);

    r = await post('/api/notes', { entity_type: 'host', entity_key: 'a2', note: '   ' });
    assert.deepEqual(await r.json(), { ok: true, deleted: true });
    const [rows] = await db.query("SELECT COUNT(*) AS n FROM notes WHERE entity_type = 'host'");
    assert.equal(rows[0].n, 1);

    r = await post('/api/notes', { entity_type: 'host', entity_key: 'nope', note: 'x' });
    assert.equal(r.status, 404);
    r = await post('/api/notes', { entity_type: 'server', entity_key: 'a1', note: 'x' });
    assert.equal(r.status, 400);
  });

  await t.test('categories: single, bulk dengan invalidRows', async () => {
    let r = await post('/api/categories', { domain: 'x.go.id', category: 'tinggi' });
    assert.deepEqual(await r.json(), { ok: true, updated: 1, invalidRows: [] });
    r = await post('/api/categories', { domain: 'x.go.id', category: 'Penting' });
    assert.equal(r.status, 400);

    r = await post('/api/categories', {
      mappings: [
        { domain: 'z.go.id', category: 'SEDANG' },
        { domain: 'y.go.id', category: 'bogus' },
        { domain: 'unknown.go.id', category: 'Rendah' },
        { domain: 'x.go.id', category: '' },
      ],
    });
    const body = await r.json();
    assert.equal(r.status, 200);
    assert.equal(body.updated, 2);
    assert.deepEqual(body.invalidRows.map((x) => [x.index, x.reason]), [[1, 'kategori tidak valid'], [2, 'domain tidak ditemukan']]);
    const [rows] = await db.query('SELECT domain, category FROM verify_apps ORDER BY domain');
    assert.deepEqual(rows.map((x) => [x.domain, x.category]), [['x.go.id', null], ['y.go.id', 'Strategis'], ['z.go.id', 'Sedang']]);
  });

  await t.test('report harian & bulanan', async () => {
    const daily = await getDailyReport(db, NOW);
    assert.equal(daily.reference, 'LAP-BACKUP/2026/09/24');
    assert.equal(daily.stats.totalHostToday, 5);
    assert.deepEqual(daily.pendingGroups, []); // tidak ada data window sebelum kemarin
    assert.equal(daily.groupDetails.find((g) => g.group === 'A').fail, 2);
    assert.equal(daily.verifyGroups[0].problemApps[0].overdue, true);

    const m = await getMonthlyReport(db, { month: '2026-09', now: new Date('2026-10-01T00:00:00Z') });
    assert.equal(m.reference, 'LAP-BACKUP/2026/09');
    assert.equal(m.dailyTrend.length, 30);
    assert.equal(m.averages.backup, 67.5); // (60 + 75) / 2
    assert.deepEqual(m.comparison.backup.direction, '-');
    assert.equal(m.worstDay.backup.date, '2026-09-22');
    assert.equal(m.period.endOfPeriodFrom, '2026-09-24');
    assert.equal(m.endOfPeriod.stats.totalHostToday, 0); // tidak ada data 24-30 Sep
    const preview = await getMonthlyReport(db, { preview: true, now: NOW });
    assert.equal(preview.period.first, '2026-09-01');
    assert.equal(preview.period.last, '2026-09-24');
    // union 7 hari terakhir (18-24 Sep): semua 6 host, hanya a2 masih ERROR
    assert.equal(preview.endOfPeriod.stats.totalHostToday, 6);
    assert.equal(preview.endOfPeriod.stats.totalFailToday, 1);
    assert.deepEqual(preview.evidenceNotes.map((n) => n.entity_key), ['y.go.id']);
    await assert.rejects(getMonthlyReport(db, { month: '2026-13', now: NOW }), /YYYY-MM/);
  });

  await t.test('HTTP routes', async () => {
    let r = await fetch(`${base}/api/dashboard`);
    assert.equal(r.status, 200);
    r = await fetch(`${base}/api/history?group=A`);
    assert.equal((await r.json()).group, 'A');
    r = await fetch(`${base}/api/history`);
    assert.equal(r.status, 400);
    r = await fetch(`${base}/api/history?group=zzz`);
    assert.equal(r.status, 404);
    r = await fetch(`${base}/api/report/monthly?preview=1`);
    assert.equal(r.status, 200);
  });

  await t.test('SQL ingest n8n: upsert + report_date WIB', async () => {
    const toQ = (q, params) => {
      const vals = [];
      return [q.replace(/\$(\d+)/g, (_, n) => (vals.push(params[n - 1]), '?')), vals];
    };
    const run = async (q, params) => (await db.query(...toQ(q, params)))[0];
    const b = normalizeBackup({ group: 'Grp, baru', summary: [{ host: 'n1', status: 'OK' }, { host: 'a1', status: 'ERROR', error_reason: "it's broken" }] });
    await run(ingestSql.upsertGroup, [b.rows_b64, b.group_b64]);
    await run(ingestSql.upsertHosts, [b.rows_b64, b.group_b64]);
    const ins = await run(ingestSql.insertBackupRecords, [b.rows_b64, b.group_b64]);
    assert.equal(ins.affectedRows, 2);
    const [[row]] = await db.query(
      `SELECT h.hostname, g.name, r.report_date = DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR) AS wib_ok
       FROM backup_records r JOIN hosts h ON h.id = r.host_id JOIN \`groups\` g ON g.id = h.group_id
       WHERE h.hostname = 'a1' ORDER BY r.id DESC LIMIT 1`,
    );
    assert.deepEqual([row.hostname, row.name, row.wib_ok], ['a1', 'Grp, baru', 1]); // host pindah group

    const v = normalizeVerify({ group: 'Grp, baru', summary: [{ domain: 'new.go.id' }] });
    await run(ingestSql.upsertVerifyApps, [v.rows_b64, v.group_b64]);
    await run(ingestSql.insertVerifyRecords, [v.rows_b64, v.group_b64]);
    const [[vr]] = await db.query("SELECT severity FROM verify_records r JOIN verify_apps a ON a.id = r.app_id WHERE a.domain = 'new.go.id'");
    assert.equal(vr.severity, 'WARN');
  });
});
