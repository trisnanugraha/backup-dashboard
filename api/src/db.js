const mysql = require('mysql2/promise');
const config = require('./config');

// DATETIME columns hold UTC. timezone 'Z' makes mysql2 read/write them as UTC
// Date objects; DATE columns (report_date) stay 'YYYY-MM-DD' strings.
function createPool(overrides = {}) {
  const pool = mysql.createPool({
    ...config.mysql,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    dateStrings: ['DATE'],
    connectionLimit: 10,
    ...overrides,
  });
  pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));
  return pool;
}

module.exports = { createPool };
