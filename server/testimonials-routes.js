// =========================================================
// Ntabou Aka Wé — API — testimonials-routes.js
// =========================================================

const express = require('express');
const crypto = require('crypto');
const { db } = require('./db');
const { requireAuth, requireAdmin } = require('./auth-routes');

function genId(prefix) {
  return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}
function nz(v) { return v === undefined ? null : v; }

const SERVICE_LABELS = {
  'services-energetiques': 'Soins Énergétiques',
  'soins-direct': 'Soins Direct',
  'accompagnement': 'Accompagnement 1:1'
};

function testiPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    service: row.service,
    text: row.text,
    rating: row.rating,
    date: row.date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sanitizeText(str, maxLen) {
  const s = String(str ?? '').replace(/<[^>]*>/g, '').trim();
  return maxLen ? s.slice(0, maxLen) : s;
}

function registerTestimonialsRoutes(app) {
  const json = express.json();

  // Public — seuls les témoignages approuvés.
  app.get('/api/testimonials', (req, res) => {
    const rows = db.prepare("SELECT * FROM testimonials WHERE status = 'approved' ORDER BY created_at DESC").all();
    res.json({ ok: true, testimonials: rows.map(testiPublic) });
  });

  app.post('/api/testimonials', requireAuth, json, (req, res) => {
    const b = req.body || {};
    const text = sanitizeText(b.text, 1000);
    if (!text || text.length < 10) {
      return res.status(400).json({ ok: false, error: 'Le témoignage doit contenir au moins 10 caractères.' });
    }
    if (!b.service || !SERVICE_LABELS[b.service]) {
      return res.status(400).json({ ok: false, error: 'Service invalide.' });
    }
    const rating = Math.min(5, Math.max(1, Math.round(Number(b.rating)) || 5));
    const id = genId('t');
    db.prepare(`
      INSERT INTO testimonials (id, client_id, client_name, service, text, rating, date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(id, req.user.id, `${req.user.first_name} ${req.user.last_name}`, b.service, text, rating,
      new Date().toISOString().slice(0, 10));
    const row = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(id);
    res.json({ ok: true, testimonial: testiPublic(row) });
  });

  app.put('/api/testimonials/:id', requireAuth, json, (req, res) => {
    const existing = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Témoignage introuvable.' });
    if (existing.client_id !== req.user.id || existing.status !== 'pending') {
      return res.status(403).json({ ok: false, error: 'Ce témoignage ne peut plus être modifié.' });
    }
    const text = req.body.text !== undefined ? sanitizeText(req.body.text, 1000) : existing.text;
    if (!text || text.length < 10) {
      return res.status(400).json({ ok: false, error: 'Le témoignage doit contenir au moins 10 caractères.' });
    }
    db.prepare("UPDATE testimonials SET text = ?, updated_at = datetime('now') WHERE id = ?").run(text, req.params.id);
    res.json({ ok: true, testimonial: testiPublic(db.prepare('SELECT * FROM testimonials WHERE id = ?').get(req.params.id)) });
  });

  app.delete('/api/testimonials/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(req.params.id);
    if (!existing || existing.client_id !== req.user.id) return res.status(403).json({ ok: false, error: 'Non autorisé.' });
    db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---- Admin : modération ----
  app.get('/api/admin/testimonials', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM testimonials ORDER BY created_at DESC').all();
    res.json({ ok: true, testimonials: rows.map(testiPublic) });
  });

  app.put('/api/admin/testimonials/:id/approve', requireAdmin, (req, res) => {
    db.prepare("UPDATE testimonials SET status = 'approved', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  app.put('/api/admin/testimonials/:id/reject', requireAdmin, (req, res) => {
    db.prepare("UPDATE testimonials SET status = 'rejected', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  app.put('/api/admin/testimonials/:id', requireAdmin, json, (req, res) => {
    const b = req.body || {};
    db.prepare(`
      UPDATE testimonials SET
        text = COALESCE(?, text),
        rating = COALESCE(?, rating),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(nz(b.text !== undefined ? sanitizeText(b.text, 1000) : undefined), nz(b.rating), req.params.id);
    res.json({ ok: true, testimonial: testiPublic(db.prepare('SELECT * FROM testimonials WHERE id = ?').get(req.params.id)) });
  });

  app.delete('/api/admin/testimonials/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  console.log('[Testimonials] Routes enregistrées : /api/testimonials*, /api/admin/testimonials*');
}

module.exports = { registerTestimonialsRoutes };
