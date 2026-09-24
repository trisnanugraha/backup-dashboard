const test = require('node:test');
const assert = require('node:assert/strict');
const t = require('../src/lib/time');

const iso = (d) => d.toISOString();

test('10:00 WIB -> window berjalan mulai 17:00 WIB kemarin', () => {
  const w = t.operationalWindows(new Date('2026-09-24T03:00:00Z'));
  assert.equal(iso(w.current.start), '2026-09-23T10:00:00.000Z');
  assert.equal(iso(w.current.end), '2026-09-24T03:00:00.000Z');
  assert.equal(iso(w.previous.start), '2026-09-22T10:00:00.000Z');
  assert.equal(iso(w.previous.end), '2026-09-23T10:00:00.000Z');
  assert.equal(w.current.label, 'Berjalan (17:00 WIB 2026-09-23 - sekarang)');
  assert.equal(w.previous.label, '17:00 WIB 2026-09-22 s/d 17:00 WIB 2026-09-23');
  assert.equal(w.todayKey, '2026-09-24');
});

test('20:00 WIB -> window berjalan baru reset di 17:00 WIB hari ini', () => {
  const w = t.operationalWindows(new Date('2026-09-24T13:00:00Z'));
  assert.equal(iso(w.current.start), '2026-09-24T10:00:00.000Z');
  assert.equal(iso(w.previous.start), '2026-09-23T10:00:00.000Z');
});

test('batas tepat 17:00 WIB dan 16:59 WIB', () => {
  assert.equal(iso(t.operationalWindows(new Date('2026-09-24T10:00:00Z')).current.start), '2026-09-24T10:00:00.000Z');
  assert.equal(iso(t.operationalWindows(new Date('2026-09-24T09:59:59Z')).current.start), '2026-09-23T10:00:00.000Z');
});

test('dini hari WIB (tanggal UTC masih kemarin)', () => {
  // 2026-09-25 01:30 WIB = 2026-09-24 18:30 UTC
  const w = t.operationalWindows(new Date('2026-09-24T18:30:00Z'));
  assert.equal(w.todayKey, '2026-09-25');
  assert.equal(iso(w.current.start), '2026-09-24T10:00:00.000Z');
});

test('pergantian bulan & tahun', () => {
  const w = t.operationalWindows(new Date('2027-01-01T02:00:00Z')); // 09:00 WIB 1 Jan
  assert.equal(iso(w.current.start), '2026-12-31T10:00:00.000Z');
  assert.equal(w.previous.label, '17:00 WIB 2026-12-30 s/d 17:00 WIB 2026-12-31');
});

test('helpers tanggal', () => {
  assert.equal(t.wibDateKey(new Date('2026-09-24T17:00:00Z')), '2026-09-25');
  assert.equal(t.wibTime(new Date('2026-09-22T13:30:00Z')), '20:30');
  assert.deepEqual(t.monthRange('2026-02'), { first: '2026-02-01', last: '2026-02-28' });
  assert.equal(t.previousMonth('2026-01'), '2025-12');
  assert.deepEqual(t.dateRange('2026-02-27', '2026-03-01'), ['2026-02-27', '2026-02-28', '2026-03-01']);
  assert.equal(t.ageDays(null), null);
  assert.equal(t.ageDays(new Date('2026-09-01T00:00:00Z'), new Date('2026-09-11T12:00:00Z')), 10);
});
