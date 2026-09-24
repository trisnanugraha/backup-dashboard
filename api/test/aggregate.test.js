const test = require('node:test');
const assert = require('node:assert/strict');
const agg = require('../src/lib/aggregate');

test('streak dihitung dari hari terbaru dan berhenti di OK pertama', () => {
  const s = agg.summarizeHostTimeline([
    { date: '2026-09-24', status: 'ERROR' },
    { date: '2026-09-23', status: 'ERROR' },
    { date: '2026-09-22', status: 'OK' },
    { date: '2026-09-21', status: 'ERROR' },
  ]);
  assert.equal(s.streak_days, 2);
  assert.equal(s.failing, true);
  assert.equal(s.failing_since, '2026-09-23');
  assert.equal(s.consistency, 25);
  assert.equal(s.fail_days, 3);
});

test('timeline kosong / host sehat', () => {
  assert.equal(agg.summarizeHostTimeline([]).last_status, '-');
  const s = agg.summarizeHostTimeline([{ date: '2026-09-24', status: 'OK' }]);
  assert.equal(s.failing, false);
  assert.equal(s.failing_since, null);
  assert.equal(s.consistency, 100);
});

test('consistency dibulatkan 1 desimal', () => {
  const tl = [{ status: 'OK' }, { status: 'OK' }, { status: 'ERROR' }].map((x, i) => ({ ...x, date: `2026-09-0${3 - i}` }));
  assert.equal(agg.summarizeHostTimeline(tl).consistency, 66.7);
});

test('topFailHosts & topFailGroups', () => {
  const rows = [
    { host: 'a', group: 'G1', date: '2026-09-23', status: 'ERROR' },
    { host: 'a', group: 'G1', date: '2026-09-24', status: 'ERROR' },
    { host: 'b', group: 'G1', date: '2026-09-24', status: 'ERROR' },
    { host: 'c', group: 'G2', date: '2026-09-24', status: 'OK' },
  ];
  const hosts = agg.topFailHosts(rows, { sparkDates: ['2026-09-22', '2026-09-23', '2026-09-24'] });
  assert.deepEqual(hosts.map((h) => [h.host, h.failCount]), [['a', 2], ['b', 1]]);
  assert.deepEqual(hosts[0].sparkline, [null, 'ERROR', 'ERROR']);
  assert.deepEqual(agg.topFailGroups(rows), [{ group: 'G1', failDaysCount: 2, totalFailInstances: 3 }]);
});

test('urutan aplikasi bermasalah: kategori lalu umur terlama', () => {
  const sorted = agg.sortProblemApps([
    { domain: 'r', app_category: 'Rendah', age_days: 90 },
    { domain: 'u', app_category: '', age_days: 500 },
    { domain: 's1', app_category: 'Strategis', age_days: 2 },
    { domain: 's2', app_category: 'Strategis', age_days: 40 },
    { domain: 's3', app_category: 'Strategis', age_days: null },
    { domain: 't', app_category: 'Tinggi', age_days: 1 },
  ]);
  assert.deepEqual(sorted.map((a) => a.domain), ['s2', 's1', 's3', 't', 'r', 'u']);
});

test('normalizeCategory', () => {
  assert.equal(agg.normalizeCategory(' strategis '), 'Strategis');
  assert.equal(agg.normalizeCategory('TINGGI'), 'Tinggi');
  assert.equal(agg.normalizeCategory(''), '');
  assert.equal(agg.normalizeCategory('Penting'), null);
  assert.equal(agg.normalizeCategory(undefined), null);
});

test('worstSeverity & rate', () => {
  assert.equal(agg.worstSeverity(['OK', 'WARN', 'OK']), 'WARN');
  assert.equal(agg.worstSeverity(['CRITICAL', 'WARN']), 'CRITICAL');
  assert.equal(agg.worstSeverity([]), '-');
  assert.equal(agg.rate(0, 0), 0);
  assert.equal(agg.rate(2, 3), 66.7);
});
