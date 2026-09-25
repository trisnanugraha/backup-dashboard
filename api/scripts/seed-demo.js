#!/usr/bin/env node
// Fills a SEPARATE demo database with ~6 months of fake backup/verify data for
// local UI development. Never point this at the production database: it drops
// and recreates the target database.
//
//   MYSQL_HOST=127.0.0.1 MYSQL_USER=... MYSQL_PASSWORD=... node scripts/seed-demo.js
//   (target database: DEMO_DATABASE, default backup_monitoring_demo)

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const DB = process.env.DEMO_DATABASE || 'backup_monitoring_demo';
if (DB === (process.env.MYSQL_DATABASE || 'backup_monitoring') || DB === 'backup_monitoring') {
  console.error(`menolak: DEMO_DATABASE (${DB}) tidak boleh sama dengan database produksi`);
  process.exit(1);
}

const DAYS = 183;
const HOUR = 3600e3;
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const sqlTime = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const wibDate = (d) => new Date(d.getTime() + 7 * HOUR).toISOString().slice(0, 10);

const GROUPS = [
  'backup-to-drc-containers', 'backup-db-mysql', 'backup-db-postgres', 'backup-web-dinas',
  'backup-web-kecamatan', 'backup-fileserver', 'backup-mail', 'backup-simpeg', 'backup-bpkad', 'backup-dukcapil',
];
const CATEGORIES = ['Strategis', 'Tinggi', 'Sedang', 'Rendah', null];
const ERRORS = ['snapshot failed: disk full', 'connection timed out', 'repository locked', 'permission denied: /var/lib/docker', 'kopia: unable to upload blob'];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    multipleStatements: true,
    timezone: 'Z',
  });
  const schema = fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8').replaceAll('backup_monitoring', DB);
  await conn.query(`DROP DATABASE IF EXISTS \`${DB}\``);
  await conn.query(schema);

  const now = new Date();
  const hosts = [];
  const apps = [];
  for (const [gi, g] of GROUPS.entries()) {
    await conn.query('INSERT INTO `groups` (name) VALUES (?)', [g]);
    const nHosts = 3 + Math.floor(rand() * 6);
    for (let i = 1; i <= nHosts; i++) {
      hosts.push({ name: `${g.replace('backup-', '')}-${String(i).padStart(2, '0')}`, gid: gi + 1, flaky: rand() < 0.12 });
    }
    const nApps = 2 + Math.floor(rand() * 5);
    for (let i = 1; i <= nApps; i++) {
      apps.push({ domain: `app${i}.${g.replace('backup-', '')}.tangerangkota.go.id`, gid: gi + 1, stale: rand() < 0.15, category: pick(CATEGORIES) });
    }
  }
  // One host stuck failing for the last days, one group that has not reported yet.
  hosts[3].streak = 5;
  const pendingGid = 9;

  for (const h of hosts) await conn.query('INSERT INTO hosts (hostname, group_id) VALUES (?, ?)', [h.name, h.gid]);
  for (const a of apps) {
    await conn.query('INSERT INTO verify_apps (domain, group_id, category, category_updated_at) VALUES (?, ?, ?, ?)', [a.domain, a.gid, a.category, a.category ? sqlTime(now) : null]);
  }

  const backupRows = [];
  const verifyRows = [];
  const lastCycle = new Date(Math.floor((now.getTime() - 10 * HOUR) / (24 * HOUR)) * 24 * HOUR + 10 * HOUR); // last 17:00 WIB
  for (let d = DAYS; d >= 0; d--) {
    const cycleStart = new Date(lastCycle.getTime() - d * 24 * HOUR);
    for (const [gi] of GROUPS.entries()) {
      const gid = gi + 1;
      if (d === 0 && gid === pendingGid) continue;
      const reported = new Date(cycleStart.getTime() + (0.5 + rand() * 8) * HOUR);
      if (reported > now) continue;
      for (const [hi, h] of hosts.entries()) {
        if (h.gid !== gid) continue;
        const failing = (h.streak && d < h.streak) || rand() < (h.flaky ? 0.3 : 0.03);
        backupRows.push([hi + 1, gid, wibDate(reported), sqlTime(reported), failing ? 'ERROR' : 'OK', failing ? pick(ERRORS) : null]);
      }
      const vReported = new Date(reported.getTime() + 2 * HOUR);
      if (vReported > now) continue;
      for (const [ai, a] of apps.entries()) {
        if (a.gid !== gid) continue;
        const r = rand();
        const severity = a.stale ? (r < 0.5 ? 'CRITICAL' : 'WARN') : r < 0.9 ? 'OK' : r < 0.97 ? 'WARN' : 'CRITICAL';
        const snap = a.stale ? new Date(now.getTime() - (40 + ai) * 24 * HOUR) : new Date(vReported.getTime() - rand() * 20 * HOUR);
        verifyRows.push([ai + 1, gid, wibDate(vReported), sqlTime(vReported), severity, sqlTime(snap), 1 + Math.floor(rand() * 30)]);
      }
    }
  }

  const chunk = async (sql, rows) => {
    for (let i = 0; i < rows.length; i += 2000) await conn.query(sql, [rows.slice(i, i + 2000)]);
  };
  await conn.query(`USE \`${DB}\``);
  await chunk('INSERT INTO backup_records (host_id, group_id, report_date, reported_at, status, error_reason) VALUES ?', backupRows);
  await chunk('INSERT INTO verify_records (app_id, group_id, report_date, reported_at, severity, latest_snapshot_time, snapshot_count) VALUES ?', verifyRows);
  await conn.query(
    `INSERT INTO notes (entity_type, entity_id, note_text, category) VALUES
     ('host', 4, 'Disk penuh, sudah dilaporkan ke tim infra', 'Investigasi Berjalan'),
     ('group', 2, 'Jadwal backup dipindah ke 19:00', 'Lainnya'),
     ('verify_app', 1, 'Tim aplikasi sudah dihubungi via WA', 'Sudah Dihubungi Tim Aplikasi')`,
  );

  console.log(`seed ${DB}: ${hosts.length} host, ${apps.length} app, ${backupRows.length} backup_records, ${verifyRows.length} verify_records`);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
