const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBackup, normalizeVerify, toUtcSql } = require('../../n8n/src/normalize');

test('severity kosong -> WARN (bukan CRITICAL) + warning', () => {
  const out = normalizeVerify({ group: 'g', summary: [{ domain: 'a' }, { domain: 'b', severity: 'critical' }, { domain: 'c', severity: 'Warning' }] });
  assert.deepEqual(out.rows.map((r) => r.severity), ['WARN', 'CRITICAL', 'WARN']);
  assert.equal(out.warnings.length, 1);
});

test('verify: timestamp ISO -> DATETIME UTC, snapshot_count', () => {
  const out = normalizeVerify({ group: 'g', summary: [{ domain: 'a', severity: 'OK', latest_snapshot_time: '2026-02-13T10:10:29.831Z', snapshot_count: '3' }, { domain: 'b', severity: 'OK', latest_snapshot_time: 'bukan-tanggal' }] });
  assert.equal(out.rows[0].latest_snapshot_time, '2026-02-13 10:10:29');
  assert.equal(out.rows[0].snapshot_count, 3);
  assert.equal(out.rows[1].latest_snapshot_time, null);
  assert.equal(out.rows[1].snapshot_count, null);
  assert.equal(toUtcSql('2026-02-13T17:10:29+07:00'), '2026-02-13 10:10:29');
});

test('backup: status dinormalisasi, host kosong di-skip', () => {
  const out = normalizeBackup({ group: ' g ', summary: [{ host: 'h1', status: 'ok' }, { host: 'h2', status: 'FAILED', error_reason: 'x' }, { host: '' }, { host: 'h3' }] });
  assert.equal(out.group, 'g');
  assert.deepEqual(out.rows.map((r) => [r.host, r.status]), [['h1', 'OK'], ['h2', 'ERROR'], ['h3', 'ERROR']]);
  assert.equal(out.warnings.length, 2);
  assert.equal(JSON.parse(out.rows_json).length, 3);
});

test('payload tidak valid ditolak', () => {
  assert.throws(() => normalizeBackup({ summary: [] }), /group/);
  assert.throws(() => normalizeVerify({ group: 'g' }), /summary/);
});
