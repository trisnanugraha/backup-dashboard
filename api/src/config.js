// All configuration comes from the environment; nothing is hardcoded.

function int(name, fallback) {
  const v = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
}

module.exports = {
  port: int('API_PORT', 3000),
  corsOrigin: process.env.API_CORS_ORIGIN || '',
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: int('MYSQL_PORT', 3306),
    database: process.env.MYSQL_DATABASE || 'backup_monitoring',
    user: process.env.MYSQL_USER || '',
    password: process.env.MYSQL_PASSWORD || '',
    socketPath: process.env.MYSQL_SOCKET || undefined,
  },
};
