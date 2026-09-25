import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar, rateLevel, lastDays, todayWib, formatWib } from './calendar.ts';
import { toCsv } from './csv.ts';

test('kalender: offset Senin sebagai kolom pertama', () => {
  const months = buildCalendar([{ date: '2026-09-24', successRate: 95 }], '2026-09-24', 6);
  assert.equal(months.length, 6);
  assert.equal(months[0].key, '2026-04');
  const sep = months[5];
  assert.equal(sep.label, 'September 2026');
  assert.equal(sep.offset, 1); // 1 Sep 2026 = Selasa
  assert.equal(sep.cells.length, 30);
  assert.equal(sep.cells[23].level, 'fair');
  assert.equal(sep.cells[24].future, true);
  assert.equal(buildCalendar([], '2026-06-10', 1)[0].offset, 0); // 1 Jun 2026 = Senin
  assert.equal(buildCalendar([], '2026-03-10', 1)[0].offset, 6); // 1 Mar 2026 = Minggu
});

test('kalender: lintas tahun', () => {
  const months = buildCalendar([], '2027-02-01', 3);
  assert.deepEqual(months.map((m) => m.key), ['2026-12', '2027-01', '2027-02']);
});

test('ambang warna success rate', () => {
  assert.equal(rateLevel(98), 'good');
  assert.equal(rateLevel(97.9), 'fair');
  assert.equal(rateLevel(90), 'fair');
  assert.equal(rateLevel(75), 'poor');
  assert.equal(rateLevel(74.9), 'bad');
  assert.equal(rateLevel(null), 'none');
});

test('helper tanggal WIB', () => {
  assert.equal(todayWib(new Date('2026-09-24T18:00:00Z')), '2026-09-25');
  assert.deepEqual(lastDays('2026-03-01', 3), ['2026-02-27', '2026-02-28', '2026-03-01']);
  assert.equal(formatWib('2026-02-13T10:10:29.831Z'), '2026-02-13 17:10');
});

test('csv escaping', () => {
  assert.equal(toCsv(['a', 'b'], [['x,y', 'say "hi"'], [1, null]]), 'a,b\r\n"x,y","say ""hi"""\r\n1,');
});
