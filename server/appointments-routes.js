// =========================================================
// Ntabou Aka Wé — API — appointments-routes.js
// =========================================================

const express = require('express');
const crypto = require('crypto');
const { db } = require('./db');
const { requireAuth, requireAdmin, getSessionUser } = require('./auth-routes');

function genId(prefix) {
  return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function apptPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    service: row.service,
    serviceId: row.service_id,
    date: row.date,
    time: row.time,
    duration: row.duration,
    status: row.status,
    source: row.source,
    recurringGroupId: row.recurring_group_id,
    blocked: !!row.blocked,
    blockLabel: row.block_label,
    reminderSentAt: row.reminder_sent_at,
    createdAt: row.created_at
  };
}

function registerAppointmentsRoutes(app) {
  const json = express.json();

  // Liste : admin voit tout, client voit seulement les siens.
  app.get('/api/appointments', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ ok: false, error: 'Non authentifié.' });
    const rows = user.role === 'admin'
      ? db.prepare('SELECT * FROM appointments ORDER BY date, time').all()
      : db.prepare('SELECT * FROM appointments WHERE client_id = ? ORDER BY date, time').all(user.id);
    res.json({ ok: true, appointments: rows.map(apptPublic) });
  });

  app.post('/api/appointments', requireAuth, json, (req, res) => {
    const { service, serviceId, date, time, duration, status, source } = req.body || {};
    if (!service || !serviceId || !date || !time) {
      return res.status(400).json({ ok: false, error: 'Champs requis manquants.' });
    }
    const id = genId('appt');
    db.prepare(`
      INSERT INTO appointments (id, client_id, client_name, service, service_id, date, time, duration, status, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, `${req.user.first_name} ${req.user.last_name}`, service, serviceId, date, time, duration || null, status || 'pending', source || 'client');
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    res.json({ ok: true, appointment: apptPublic(row) });
  });

  // Création par l'admin (peut cibler n'importe quel client)
  app.post('/api/admin/appointments', requireAdmin, json, (req, res) => {
    const { clientId, clientName, service, serviceId, date, time, duration, status, blocked, blockLabel } = req.body || {};
    // Un blocage de créneau (bloquer une plage horaire dans l'agenda) n'a
    // pas de client associé — on utilise l'admin lui-même comme titulaire
    // technique pour respecter la contrainte de clé étrangère.
    const effectiveClientId = clientId || req.user.id;
    const effectiveClientName = clientName || (blocked ? (blockLabel || 'Créneau bloqué') : `${req.user.first_name} ${req.user.last_name}`);
    if (!service || !serviceId || !date) {
      return res.status(400).json({ ok: false, error: 'Champs requis manquants.' });
    }
    const id = genId('appt');
    db.prepare(`
      INSERT INTO appointments (id, client_id, client_name, service, service_id, date, time, duration, status, source, blocked, block_label)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?)
    `).run(id, effectiveClientId, effectiveClientName, service, serviceId, date, time || '00:00', duration || null,
      status || 'confirmed', blocked ? 1 : 0, blockLabel || null);
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    res.json({ ok: true, appointment: apptPublic(row) });
  });

  app.put('/api/appointments/:id', requireAuth, json, (req, res) => {
    const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!appt) return res.status(404).json({ ok: false, error: 'Rendez-vous introuvable.' });
    if (req.user.role !== 'admin' && appt.client_id !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'Accès refusé.' });
    }
    const patch = req.body || {};
    const fields = ['status', 'date', 'time', 'duration', 'reminder_sent_at'];
    const map = { status: 'status', date: 'date', time: 'time', duration: 'duration', reminderSentAt: 'reminder_sent_at' };
    const updates = [];
    const values = [];
    Object.keys(map).forEach(key => {
      if (patch[key] !== undefined) { updates.push(`${map[key]} = ?`); values.push(patch[key]); }
    });
    if (updates.length) {
      values.push(req.params.id);
      db.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    res.json({ ok: true, appointment: apptPublic(row) });
  });

  app.delete('/api/appointments/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // Rendez-vous confirmés de demain sans rappel envoyé — pour le bouton
  // manuel "Envoyer les rappels de demain" (Admin → Notifications).
  app.get('/api/admin/appointments/pending-reminders', requireAdmin, (req, res) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT * FROM appointments
      WHERE date = ? AND status = 'confirmed' AND reminder_sent_at IS NULL
    `).all(tomorrow);
    res.json({ ok: true, appointments: rows.map(apptPublic) });
  });

  console.log('[Appointments] Routes enregistrées : /api/appointments*, /api/admin/appointments*');
}

module.exports = { registerAppointmentsRoutes, apptPublic };
