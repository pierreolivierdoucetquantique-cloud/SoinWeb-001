// =========================================================
// Ntabou Aka Wé — API — content-routes.js
//
// Stockage clé/valeur générique pour tout le contenu éditable depuis
// l'admin (Services, Contenu, Bio, Templates Email, Automatisations,
// Paramètres, Médiathèque, Journal d'audit) — voir content-store.js
// côté frontend, qui consomme ces routes.
// =========================================================

const express = require('express');
const { db } = require('./db');
const { requireAdmin } = require('./auth-routes');

function registerContentRoutes(app) {
  // Certaines valeurs (médiathèque en base64) peuvent être volumineuses.
  const json = express.json({ limit: '20mb' });

  // Lecture publique : les pages publiques doivent pouvoir charger le
  // contenu (textes, bio, services) sans être authentifiées.
  app.get('/api/content', (req, res) => {
    const rows = db.prepare('SELECT key, value_json FROM site_content').all();
    const content = {};
    rows.forEach(r => {
      try { content[r.key] = JSON.parse(r.value_json); } catch { content[r.key] = null; }
    });
    res.json({ ok: true, content });
  });

  app.get('/api/content/:key', (req, res) => {
    const row = db.prepare('SELECT value_json FROM site_content WHERE key = ?').get(req.params.key);
    if (!row) return res.json({ ok: true, value: null });
    try {
      res.json({ ok: true, value: JSON.parse(row.value_json) });
    } catch {
      res.json({ ok: true, value: null });
    }
  });

  // Écriture : réservée à l'admin. Chaque section du panneau Admin (voir
  // content-store.js) écrit sous sa propre clé (ex. "po_demo_bio").
  app.put('/api/admin/content/:key', requireAdmin, json, (req, res) => {
    const key = req.params.key;
    const body = req.body || {};
    if (!('value' in body)) {
      return res.status(400).json({ ok: false, error: 'value requis.' });
    }
    db.prepare(`
      INSERT INTO site_content (key, value_json, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).run(key, JSON.stringify(body.value));
    res.json({ ok: true });
  });

  console.log('[Content] Routes enregistrées : GET /api/content, GET /api/content/:key, PUT /api/admin/content/:key');
}

module.exports = { registerContentRoutes };
