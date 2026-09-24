const agg = require('../lib/aggregate');

class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

const ENTITY_LOOKUP = {
  host: 'SELECT id FROM hosts WHERE hostname = ?',
  group: 'SELECT id FROM `groups` WHERE name = ?',
  verify_app: 'SELECT id FROM verify_apps WHERE domain = ?',
};

/**
 * Upsert a note by entity name. An empty note deletes the row (same behaviour
 * as the old "hapus catatan" in Node-RED).
 */
async function saveNote(db, body = {}) {
  const { entity_type: type, entity_key: key } = body;
  if (!ENTITY_LOOKUP[type]) throw new ValidationError('entity_type harus host, group, atau verify_app');
  if (typeof key !== 'string' || !key.trim()) throw new ValidationError('entity_key wajib diisi');

  const [found] = await db.query(ENTITY_LOOKUP[type], [key.trim()]);
  if (!found.length) throw new ValidationError(`${type} "${key}" tidak ditemukan`, { status: 404 });
  const entityId = found[0].id;

  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!note) {
    const [res] = await db.query('DELETE FROM notes WHERE entity_type = ? AND entity_id = ?', [type, entityId]);
    return { ok: true, deleted: res.affectedRows > 0 };
  }

  const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim().slice(0, 100) : null;
  await db.query(
    `INSERT INTO notes (entity_type, entity_id, note_text, category) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE note_text = VALUES(note_text), category = VALUES(category)`,
    [type, entityId, note, category],
  );
  return { ok: true, deleted: false };
}

/**
 * Set app categories. Accepts { domain, category } or { mappings: [...] }.
 * Invalid rows are reported in invalidRows; valid rows are still applied.
 */
async function saveCategories(db, body = {}) {
  const bulk = Array.isArray(body.mappings);
  const mappings = bulk ? body.mappings : [body];
  const invalidRows = [];
  const valid = [];

  mappings.forEach((m, index) => {
    const domain = typeof m?.domain === 'string' ? m.domain.trim() : '';
    const category = agg.normalizeCategory(m?.category);
    if (!domain) invalidRows.push({ index, domain: m?.domain ?? null, category: m?.category ?? null, reason: 'domain kosong' });
    else if (category === null) invalidRows.push({ index, domain, category: m?.category ?? null, reason: 'kategori tidak valid' });
    else valid.push({ index, domain, category });
  });

  let updated = 0;
  for (const v of valid) {
    const [res] = await db.query(
      'UPDATE verify_apps SET category = ?, category_updated_at = UTC_TIMESTAMP() WHERE domain = ?',
      [v.category || null, v.domain],
    );
    if (res.affectedRows === 0) invalidRows.push({ index: v.index, domain: v.domain, category: v.category, reason: 'domain tidak ditemukan' });
    else updated++;
  }

  invalidRows.sort((a, b) => a.index - b.index);
  if (!bulk && invalidRows.length) throw new ValidationError(invalidRows[0].reason, { invalidRows });
  return { ok: true, updated, invalidRows };
}

module.exports = { saveNote, saveCategories, ValidationError };
