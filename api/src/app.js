const express = require('express');
const { getDashboard } = require('./services/dashboard');
const { getGroupHistory, listGroupHistory, NotFoundError } = require('./services/history');
const { saveNote, saveCategories, ValidationError } = require('./services/writes');
const { getDailyReport, getMonthlyReport } = require('./services/report');

function createApp(db, { corsOrigin = '' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  if (corsOrigin) {
    app.use((req, res, next) => {
      res.set('Access-Control-Allow-Origin', corsOrigin);
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    });
  }

  app.get('/api/health', async (req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  });

  app.get('/api/dashboard', async (req, res) => {
    res.json(await getDashboard(db));
  });

  app.get('/api/history/groups', async (req, res) => {
    res.json(await listGroupHistory(db));
  });

  app.get('/api/history', async (req, res) => {
    const group = typeof req.query.group === 'string' ? req.query.group : '';
    if (!group) throw new ValidationError('parameter group wajib diisi');
    res.json(await getGroupHistory(db, group));
  });

  app.post('/api/notes', async (req, res) => {
    res.json(await saveNote(db, req.body));
  });

  app.post('/api/categories', async (req, res) => {
    res.json(await saveCategories(db, req.body));
  });

  app.get('/api/report/daily', async (req, res) => {
    res.json(await getDailyReport(db));
  });

  app.get('/api/report/monthly', async (req, res) => {
    const preview = req.query.preview === '1' || req.query.preview === 'true';
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    res.json(await getMonthlyReport(db, { month, preview }));
  });

  app.use((req, res) => res.status(404).json({ error: 'not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) {
      return res.status(err.details?.status ?? 400).json({ error: err.message, ...(err.details?.invalidRows && { invalidRows: err.details.invalidRows }) });
    }
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'body JSON tidak valid' });
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}

module.exports = { createApp };
