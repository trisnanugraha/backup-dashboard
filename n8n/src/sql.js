// SQL used by the n8n MySQL nodes. Placeholders use n8n's $1/$2 syntax
// ("Query Parameters" option). Parameters arrive base64-encoded (see
// normalize.js): $1 = rows JSON, $2 = group name. Each statement runs once per
// webhook call; JSON_TABLE expands the whole summary array set-based.
//
// Timestamps come from UTC_TIMESTAMP() so the result never depends on the
// MySQL session time_zone. report_date is the WIB (UTC+7) calendar date.

const ROWS = 'CONVERT(FROM_BASE64($1) USING utf8mb4)';
const GROUP = 'CONVERT(FROM_BASE64($2) USING utf8mb4) COLLATE utf8mb4_unicode_ci';

const upsertGroup = `INSERT INTO \`groups\` (name) VALUES (${GROUP}) ON DUPLICATE KEY UPDATE name = name;`;

const upsertHosts = `INSERT INTO hosts (hostname, group_id)
SELECT * FROM (
  SELECT DISTINCT jt.host, g.id AS gid
  FROM JSON_TABLE(${ROWS}, '$[*]' COLUMNS (host VARCHAR(255) COLLATE utf8mb4_unicode_ci PATH '$.host')) AS jt
  JOIN \`groups\` g ON g.name = ${GROUP}
) AS src
ON DUPLICATE KEY UPDATE group_id = src.gid;`;

const insertBackupRecords = `INSERT INTO backup_records (host_id, group_id, report_date, reported_at, status, error_reason)
SELECT h.id, g.id, DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), UTC_TIMESTAMP(), jt.status, NULLIF(jt.error_reason, '')
FROM JSON_TABLE(${ROWS}, '$[*]' COLUMNS (
  host VARCHAR(255) COLLATE utf8mb4_unicode_ci PATH '$.host',
  status VARCHAR(10) PATH '$.status',
  error_reason TEXT PATH '$.error_reason'
)) AS jt
JOIN hosts h ON h.hostname = jt.host
JOIN \`groups\` g ON g.name = ${GROUP};`;

const upsertVerifyApps = `INSERT INTO verify_apps (domain, group_id)
SELECT * FROM (
  SELECT DISTINCT jt.domain, g.id AS gid
  FROM JSON_TABLE(${ROWS}, '$[*]' COLUMNS (domain VARCHAR(255) COLLATE utf8mb4_unicode_ci PATH '$.domain')) AS jt
  JOIN \`groups\` g ON g.name = ${GROUP}
) AS src
ON DUPLICATE KEY UPDATE group_id = src.gid;`;

const insertVerifyRecords = `INSERT INTO verify_records (app_id, group_id, report_date, reported_at, severity, latest_snapshot_time, snapshot_count)
SELECT a.id, g.id, DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), UTC_TIMESTAMP(), jt.severity, jt.latest_snapshot_time, jt.snapshot_count
FROM JSON_TABLE(${ROWS}, '$[*]' COLUMNS (
  domain VARCHAR(255) COLLATE utf8mb4_unicode_ci PATH '$.domain',
  severity VARCHAR(10) PATH '$.severity',
  latest_snapshot_time DATETIME PATH '$.latest_snapshot_time' NULL ON EMPTY,
  snapshot_count INT PATH '$.snapshot_count' NULL ON EMPTY
)) AS jt
JOIN verify_apps a ON a.domain = jt.domain
JOIN \`groups\` g ON g.name = ${GROUP};`;

module.exports = { upsertGroup, upsertHosts, insertBackupRecords, upsertVerifyApps, insertVerifyRecords };
