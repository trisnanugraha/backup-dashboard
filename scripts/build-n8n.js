#!/usr/bin/env node
// Generates importable n8n workflows from n8n/src/*.js.
// Usage: node scripts/build-n8n.js   (writes n8n/workflows/*.json)

const fs = require('node:fs');
const path = require('node:path');
const sql = require('../n8n/src/sql.js');

const root = path.join(__dirname, '..');
const normalizeSrc = fs
  .readFileSync(path.join(root, 'n8n/src/normalize.js'), 'utf8')
  .replace(/^module\.exports.*$/m, '')
  .trim();

const MYSQL_CREDENTIAL = { mySql: { id: 'REPLACE_ME', name: 'MySQL backup_monitoring' } };

function codeNode(fnName) {
  return [
    normalizeSrc,
    '',
    `return [{ json: ${fnName}($input.first().json.body || {}) }];`,
  ].join('\n');
}

function mysqlNode(name, query, replacement, position) {
  return {
    parameters: {
      operation: 'executeQuery',
      query,
      options: { queryReplacement: replacement },
    },
    name,
    type: 'n8n-nodes-base.mySql',
    typeVersion: 2.4,
    position,
    credentials: MYSQL_CREDENTIAL,
  };
}

function buildWorkflow({ name, webhookPath, fnName, upsertName, upsertSql, insertName, insertSql }) {
  const normalized = "$('Normalize Payload').first().json";
  const nodes = [
    {
      parameters: { httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {} },
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 0],
      webhookId: webhookPath,
    },
    {
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: codeNode(fnName) },
      name: 'Normalize Payload',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 0],
    },
    mysqlNode('Upsert Group', sql.upsertGroup, '={{ $json.group }}', [440, 0]),
    mysqlNode(upsertName, upsertSql, `={{ ${normalized}.rows_json }},{{ ${normalized}.group }}`, [660, 0]),
    mysqlNode(insertName, insertSql, `={{ ${normalized}.rows_json }},{{ ${normalized}.group }}`, [880, 0]),
    {
      parameters: {
        respondWith: 'json',
        responseBody: `={{ JSON.stringify({ ok: true, group: ${normalized}.group, received: ${normalized}.count, stored: $json.affectedRows ?? 0, warnings: ${normalized}.warnings }) }}`,
        options: { responseCode: 200 },
      },
      name: 'Respond OK',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1100, 0],
    },
  ];

  const order = nodes.map((n) => n.name);
  const connections = {};
  for (let i = 0; i < order.length - 1; i++) {
    connections[order[i]] = { main: [[{ node: order[i + 1], type: 'main', index: 0 }]] };
  }

  return {
    name,
    nodes,
    connections,
    active: false,
    settings: { executionOrder: 'v1', saveDataErrorExecution: 'all' },
    pinData: {},
  };
}

const workflows = {
  'kopia-backup.json': buildWorkflow({
    name: 'Kopia Backup Ingest',
    webhookPath: 'kopia-backup',
    fnName: 'normalizeBackup',
    upsertName: 'Upsert Hosts',
    upsertSql: sql.upsertHosts,
    insertName: 'Insert Backup Records',
    insertSql: sql.insertBackupRecords,
  }),
  'kopia-verify.json': buildWorkflow({
    name: 'Kopia Verify Ingest',
    webhookPath: 'kopia-verify',
    fnName: 'normalizeVerify',
    upsertName: 'Upsert Verify Apps',
    upsertSql: sql.upsertVerifyApps,
    insertName: 'Insert Verify Records',
    insertSql: sql.insertVerifyRecords,
  }),
};

for (const [file, wf] of Object.entries(workflows)) {
  const out = path.join(root, 'n8n/workflows', file);
  fs.writeFileSync(out, JSON.stringify(wf, null, 2) + '\n');
  console.log(`wrote ${path.relative(root, out)}`);
}
