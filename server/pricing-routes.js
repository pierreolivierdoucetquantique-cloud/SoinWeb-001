// =========================================================
// Ntabou Aka Wé — API — pricing-routes.js
// =========================================================

const express = require('express');
const crypto = require('crypto');
const { db } = require('./db');
const { requireAdmin } = require('./auth-routes');

function genId(prefix) {
  return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}
// node:sqlite refuse de lier `undefined` (contrairement à better-sqlite3) —
// ce petit utilitaire convertit undefined en null partout où c'est nécessaire.
function nz(v) { return v === undefined ? null : v; }

function formulaPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    serviceId: row.service_id,
    title: row.title,
    price: row.price,
    duration: row.duration,
    description: row.description,
    featured: !!row.featured,
    order: row.sort_order
  };
}

function registerPricingRoutes(app) {
  const json = express.json();

  // Public — lu par toutes les pages de service, sans authentification.
  app.get('/api/formulas', (req, res) => {
    const serviceId = req.query.serviceId;
    const rows = serviceId
      ? db.prepare('SELECT * FROM formulas WHERE service_id = ? ORDER BY sort_order').all(serviceId)
      : db.prepare('SELECT * FROM formulas ORDER BY service_id, sort_order').all();
    res.json({ ok: true, formulas: rows.map(formulaPublic) });
  });

  app.post('/api/admin/formulas', requireAdmin, json, (req, res) => {
    const b = req.body || {};
    if (!b.title || !b.serviceId || b.price === undefined) {
      return res.status(400).json({ ok: false, error: 'Champs requis manquants.' });
    }
    const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM formulas WHERE service_id = ?').get(b.serviceId).m || 0;
    const id = genId('f');
    db.prepare(`
      INSERT INTO formulas (id, service_id, title, price, duration, description, featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, b.serviceId, b.title, b.price, b.duration || '', b.description || '', b.featured ? 1 : 0, maxOrder + 1);
    const row = db.prepare('SELECT * FROM formulas WHERE id = ?').get(id);
    res.json({ ok: true, formula: formulaPublic(row) });
  });

  app.put('/api/admin/formulas/:id', requireAdmin, json, (req, res) => {
    const existing = db.prepare('SELECT * FROM formulas WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Formule introuvable.' });
    const b = req.body || {};
    db.prepare(`
      UPDATE formulas SET
        title = COALESCE(?, title),
        price = COALESCE(?, price),
        duration = COALESCE(?, duration),
        description = COALESCE(?, description),
        featured = COALESCE(?, featured)
      WHERE id = ?
    `).run(nz(b.title), nz(b.price), nz(b.duration), nz(b.description), nz(b.featured === undefined ? undefined : (b.featured ? 1 : 0)), req.params.id);
    const row = db.prepare('SELECT * FROM formulas WHERE id = ?').get(req.params.id);
    res.json({ ok: true, formula: formulaPublic(row) });
  });

  app.delete('/api/admin/formulas/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM formulas WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---- Paramètres de paiement (taxes, courriel Interac) ----
  app.get('/api/payment-settings', (req, res) => {
    const row = db.prepare('SELECT * FROM payment_settings WHERE id = 1').get();
    res.json({
      ok: true,
      settings: {
        taxesEnabled: !!row.taxes_enabled,
        tpsRate: row.tps_rate,
        tvqRate: row.tvq_rate,
        interacEmail: row.interac_email
      }
    });
  });

  app.put('/api/admin/payment-settings', requireAdmin, json, (req, res) => {
    const b = req.body || {};
    db.prepare(`
      UPDATE payment_settings SET
        taxes_enabled = COALESCE(?, taxes_enabled),
        tps_rate = COALESCE(?, tps_rate),
        tvq_rate = COALESCE(?, tvq_rate),
        interac_email = COALESCE(?, interac_email)
      WHERE id = 1
    `).run(nz(b.taxesEnabled === undefined ? undefined : (b.taxesEnabled ? 1 : 0)), nz(b.tpsRate), nz(b.tvqRate), nz(b.interacEmail));
    res.json({ ok: true });
  });

  console.log('[Pricing] Routes enregistrées : /api/formulas, /api/admin/formulas*, /api/payment-settings');
}

module.exports = { registerPricingRoutes, formulaPublic };
