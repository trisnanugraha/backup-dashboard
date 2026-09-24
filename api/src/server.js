const config = require('./config');
const { createPool } = require('./db');
const { createApp } = require('./app');

const db = createPool();
const server = createApp(db, { corsOrigin: config.corsOrigin }).listen(config.port, () => {
  console.log(`backup-monitoring-api listening on :${config.port}`);
});

function shutdown() {
  server.close(() => db.end().finally(() => process.exit(0)));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
