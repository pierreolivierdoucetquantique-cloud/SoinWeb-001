// =========================================================
// Ntabou Aka Wé — API — transactions-routes.js
// =========================================================

const express = require('express');
const crypto = require('crypto');
const { db } = require('./db');
const { requireAuth, requireAdmin, getSessionUser } = require('./auth-routes');
const { confirmAppointmentPayment } = require('./confirmation-workflow');

function genId(prefix) {
  return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function txPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    service: row.service,
    serviceId: row.service_id,
    formulaTitle: row.formula_title,
    appointmentId: row.appointment_id,
    amount: row.amount,
    tps: row.tps,
    tvq: row.tvq,
    total: row.total,
    duration: row.duration,
    method: row.method,
    status: row.status,
    transactionReference: row.transaction_reference,
    createdAt: row.created_at
  };
}

function registerTransactionsRoutes(app) {
  const json = express.json();

  app.get('/api/transactions', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ ok: false, error: 'Non authentifié.' });
    const rows = user.role === 'admin'
      ? db.prepare('SELECT * FROM transactions ORDER BY created_at DESC').all()
      : db.prepare('SELECT * FROM transactions WHERE client_id = ? ORDER BY created_at DESC').all(user.id);
    res.json({ ok: true, transactions: rows.map(txPublic) });
  });

  app.post('/api/transactions', requireAuth, json, (req, res) => {
    const b = req.body || {};

    // SÉCURITÉ : le statut initial est TOUJOURS déterminé ici, jamais par
    // ce que le client envoie. Un paiement carte n'est marqué "paid" que
    // par le webhook Stripe (signature vérifiée) ; un virement Interac
    // reste "waiting" jusqu'à vérification manuelle par l'admin. Sans
    // cela, n'importe quel client authentifié pourrait s'auto-déclarer
    // "payé" sans avoir réellement payé.
    const method = b.method === 'stripe' ? 'stripe' : 'interac';
    const initialStatus = method === 'stripe' ? 'pending' : 'waiting';

    // Idempotence pour Stripe : si le webhook a déjà créé la transaction
    // pour ce paiement (il peut arriver avant l'appel du client), on
    // renvoie la ligne existante plutôt que d'en créer une deuxième.
    if (method === 'stripe' && b.transactionReference) {
      const existing = db.prepare('SELECT * FROM transactions WHERE transaction_reference = ?').get(b.transactionReference);
      if (existing) return res.json({ ok: true, transaction: txPublic(existing) });
    }

    const id = genId('tx');
    db.prepare(`
      INSERT INTO transactions
        (id, client_id, client_name, service, service_id, formula_title, appointment_id,
         amount, tps, tvq, total, duration, method, status, transaction_reference)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, req.user.id, `${req.user.first_name} ${req.user.last_name}`,
      b.service, b.serviceId, b.formulaTitle || null, b.appointmentId || null,
      b.amount || 0, b.tps || 0, b.tvq || 0, b.total || b.amount || 0,
      b.duration || null, method, initialStatus, b.transactionReference || null
    );
    const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    res.json({ ok: true, transaction: txPublic(row) });
  });

  app.put('/api/admin/transactions/:id/confirm', requireAdmin, async (req, res) => {
    db.prepare("UPDATE transactions SET status = 'paid' WHERE id = ?").run(req.params.id);
    const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    let workflow = null;
    if (row) {
      try {
        workflow = await confirmAppointmentPayment(row.id);
      } catch (err) {
        console.error('[Transactions] Workflow de confirmation échoué :', err.message);
      }
    }
    res.json({ ok: true, transaction: txPublic(row), workflow: workflow ? workflow.steps : undefined });
  });

  app.put('/api/admin/transactions/:id/reject', requireAdmin, (req, res) => {
    db.prepare("UPDATE transactions SET status = 'refused' WHERE id = ?").run(req.params.id);
    const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    res.json({ ok: true, transaction: txPublic(row) });
  });

  console.log('[Transactions] Routes enregistrées : /api/transactions*, /api/admin/transactions*');
}

module.exports = { registerTransactionsRoutes, txPublic };
