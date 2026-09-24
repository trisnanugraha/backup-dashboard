// Payload normalization for the Kopia ingest workflows.
//
// This file is the single source for the n8n Code nodes: scripts/build-n8n.js
// inlines these functions into n8n/workflows/*.json. Keep it dependency-free
// and plain ES2020 so it runs unchanged inside the n8n Code node sandbox.

function toUtcSql(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// The n8n MySQL node splits "Query Parameters" on commas (even array
// expressions are stringified first), so every value handed to SQL is base64
// encoded here and decoded with FROM_BASE64() in n8n/src/sql.js.
function b64(text) {
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(text)));
}

function result(group, rows, warnings) {
  const rowsJson = JSON.stringify(rows);
  return { group, rows, count: rows.length, warnings, group_b64: b64(group), rows_b64: b64(rowsJson) };
}

function requireGroup(body) {
  const group = cleanText(body && body.group);
  if (!group) throw new Error('payload tidak valid: field "group" wajib diisi');
  if (!Array.isArray(body.summary)) throw new Error('payload tidak valid: field "summary" harus array');
  return group;
}

function normalizeBackup(body) {
  const group = requireGroup(body);
  const rows = [];
  const warnings = [];

  body.summary.forEach((item, idx) => {
    const host = cleanText(item && item.host);
    if (!host) {
      warnings.push(`summary[${idx}]: host kosong, di-skip`);
      return;
    }
    const rawStatus = cleanText(item.status).toUpperCase();
    if (!rawStatus) warnings.push(`summary[${idx}] ${host}: status kosong, dicatat sebagai ERROR`);
    rows.push({
      host,
      status: rawStatus === 'OK' ? 'OK' : 'ERROR',
      error_reason: cleanText(item.error_reason),
    });
  });

  return result(group, rows, warnings);
}

const SEVERITY_ALIASES = { OK: 'OK', WARN: 'WARN', WARNING: 'WARN', CRITICAL: 'CRITICAL', CRIT: 'CRITICAL' };

function normalizeVerify(body) {
  const group = requireGroup(body);
  const rows = [];
  const warnings = [];

  body.summary.forEach((item, idx) => {
    const domain = cleanText(item && item.domain);
    if (!domain) {
      warnings.push(`summary[${idx}]: domain kosong, di-skip`);
      return;
    }
    // Missing/unknown severity falls back to WARN, never CRITICAL: the old
    // Node-RED flow defaulted to CRITICAL and mislabeled WARN apps.
    const rawSeverity = cleanText(item.severity).toUpperCase();
    let severity = SEVERITY_ALIASES[rawSeverity];
    if (!severity) {
      severity = 'WARN';
      warnings.push(`summary[${idx}] ${domain}: severity "${rawSeverity}" tidak dikenal/kosong, dicatat sebagai WARN`);
    }
    const count = Number.parseInt(item.snapshot_count, 10);
    rows.push({
      domain,
      severity,
      latest_snapshot_time: toUtcSql(item.latest_snapshot_time),
      snapshot_count: Number.isFinite(count) ? count : null,
    });
  });

  return result(group, rows, warnings);
}

module.exports = { normalizeBackup, normalizeVerify, toUtcSql, b64 };
