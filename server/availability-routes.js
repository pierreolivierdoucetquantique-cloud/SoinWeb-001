// =========================================================
// Ntabou Aka Wé — API — availability-routes.js
// =========================================================

const express = require('express');
const crypto = require('crypto');
const { db } = require('./db');
const { requireAdmin } = require('./auth-routes');

function genId(prefix) {
  return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function registerAvailabilityRoutes(app) {
  const json = express.json();

  // ---- Horaires hebdomadaires ----
  app.get('/api/availability/weekly-hours', (req, res) => {
    const serviceId = req.query.serviceId;
    const rows = serviceId
      ? db.prepare('SELECT * FROM weekly_hours WHERE service_id = ?').all(serviceId)
      : db.prepare('SELECT * FROM weekly_hours').all();
    const result = {};
    rows.forEach(r => {
      if (!result[r.service_id]) result[r.service_id] = {};
      result[r.service_id][r.day_key] = JSON.parse(r.ranges_json);
    });
    res.json({ ok: true, weeklyHours: result });
  });

  app.put('/api/admin/availability/weekly-hours', requireAdmin, json, (req, res) => {
    const { serviceId, dayKey, ranges } = req.body || {};
    if (!serviceId || !dayKey || !DAY_KEYS.includes(dayKey)) {
      return res.status(400).json({ ok: false, error: 'Paramètres invalides.' });
    }
    db.prepare(`
      INSERT INTO weekly_hours (service_id, day_key, ranges_json) VALUES (?, ?, ?)
      ON CONFLICT(service_id, day_key) DO UPDATE SET ranges_json = excluded.ranges_json
    `).run(serviceId, dayKey, JSON.stringify(ranges || []));
    res.json({ ok: true });
  });

  // Sauvegarde en bloc — utilisée par l'éditeur "mode brouillon" de
  // l'admin (Calendrier → Disponibilités), qui accumule les changements
  // localement puis les envoie tous ensemble au clic sur "Enregistrer".
  app.put('/api/admin/availability/weekly-hours-bulk', requireAdmin, json, (req, res) => {
    const { weeklyHours } = req.body || {};
    if (!weeklyHours || typeof weeklyHours !== 'object') {
      return res.status(400).json({ ok: false, error: 'weeklyHours requis.' });
    }
    const stmt = db.prepare(`
      INSERT INTO weekly_hours (service_id, day_key, ranges_json) VALUES (?, ?, ?)
      ON CONFLICT(service_id, day_key) DO UPDATE SET ranges_json = excluded.ranges_json
    `);
    Object.keys(weeklyHours).forEach(serviceId => {
      Object.keys(weeklyHours[serviceId] || {}).forEach(dayKey => {
        if (DAY_KEYS.includes(dayKey)) {
          stmt.run(serviceId, dayKey, JSON.stringify(weeklyHours[serviceId][dayKey] || []));
        }
      });
    });
    res.json({ ok: true });
  });

  // ---- Vacances (plages de dates fermées) ----
  app.get('/api/availability/vacations', (req, res) => {
    const rows = db.prepare('SELECT * FROM vacations ORDER BY start_date').all();
    res.json({ ok: true, vacations: rows.map(r => ({ id: r.id, startDate: r.start_date, endDate: r.end_date, label: r.label })) });
  });

  app.post('/api/admin/availability/vacations', requireAdmin, json, (req, res) => {
    const { startDate, endDate, label } = req.body || {};
    if (!startDate || !endDate) return res.status(400).json({ ok: false, error: 'Dates requises.' });
    const id = genId('vac');
    db.prepare('INSERT INTO vacations (id, start_date, end_date, label) VALUES (?, ?, ?, ?)').run(id, startDate, endDate, label || '');
    res.json({ ok: true, vacation: { id, startDate, endDate, label: label || '' } });
  });

  app.delete('/api/admin/availability/vacations/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM vacations WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---- Jours fériés ----
  app.get('/api/availability/holidays', (req, res) => {
    const rows = db.prepare('SELECT * FROM holidays ORDER BY date').all();
    res.json({ ok: true, holidays: rows.map(r => ({ id: r.id, date: r.date, label: r.label })) });
  });

  app.post('/api/admin/availability/holidays', requireAdmin, json, (req, res) => {
    const { date, label } = req.body || {};
    if (!date) return res.status(400).json({ ok: false, error: 'Date requise.' });
    const id = genId('hol');
    db.prepare('INSERT INTO holidays (id, date, label) VALUES (?, ?, ?)').run(id, date, label || '');
    res.json({ ok: true, holiday: { id, date, label: label || '' } });
  });

  app.delete('/api/admin/availability/holidays/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM holidays WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---- Blocages ponctuels (jour complet ou plage horaire précise) ----
  app.get('/api/availability/blocked-slots', (req, res) => {
    const rows = db.prepare('SELECT * FROM blocked_slots ORDER BY date').all();
    res.json({ ok: true, blockedSlots: rows.map(r => ({ id: r.id, date: r.date, time: r.time, duration: r.duration, label: r.label })) });
  });

  app.post('/api/admin/availability/blocked-slots', requireAdmin, json, (req, res) => {
    const { date, time, duration, label } = req.body || {};
    if (!date) return res.status(400).json({ ok: false, error: 'Date requise.' });
    const id = genId('blk');
    db.prepare('INSERT INTO blocked_slots (id, date, time, duration, label) VALUES (?, ?, ?, ?, ?)')
      .run(id, date, time || null, duration || null, label || '');
    res.json({ ok: true, blockedSlot: { id, date, time, duration, label: label || '' } });
  });

  app.delete('/api/admin/availability/blocked-slots/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM blocked_slots WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---- Créneaux disponibles calculés pour une date/service donnée ----
  app.get('/api/availability/slots', (req, res) => {
    const { serviceId, date, slotDuration } = req.query;
    if (!serviceId || !date) return res.status(400).json({ ok: false, error: 'serviceId et date requis.' });

    const d = new Date(date + 'T00:00:00');
    const dayKey = DAY_KEYS[d.getDay()];

    const vacation = db.prepare('SELECT * FROM vacations WHERE ? BETWEEN start_date AND end_date').get(date);
    const holiday = db.prepare('SELECT * FROM holidays WHERE date = ?').get(date);
    const fullDayBlock = db.prepare('SELECT * FROM blocked_slots WHERE date = ? AND time IS NULL').get(date);
    if (vacation || holiday || fullDayBlock) {
      return res.json({ ok: true, slots: [], reason: vacation ? 'vacation' : holiday ? 'holiday' : 'blocked' });
    }

    const hoursRow = db.prepare('SELECT ranges_json FROM weekly_hours WHERE service_id = ? AND day_key = ?').get(serviceId, dayKey);
    const ranges = hoursRow ? JSON.parse(hoursRow.ranges_json) : [];
    if (!ranges.length) return res.json({ ok: true, slots: [] });

    const duration = parseInt(slotDuration, 10) || 60;
    const existingAppts = db.prepare("SELECT time, duration FROM appointments WHERE date = ? AND service_id = ? AND status NOT IN ('cancelled', 'declined')").all(date, serviceId);
    const punctualBlocks = db.prepare('SELECT time, duration FROM blocked_slots WHERE date = ? AND time IS NOT NULL').all(date);
    const taken = [...existingAppts, ...punctualBlocks];

    function toMinutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
    function toTime(mins) { return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0'); }

    const slots = [];
    ranges.forEach(range => {
      let cursor = toMinutes(range.start);
      const end = toMinutes(range.end);
      while (cursor + duration <= end) {
        const slotStart = cursor;
        const slotEnd = cursor + duration;
        const overlaps = taken.some(t => {
          const tStart = toMinutes(t.time);
          const tEnd = tStart + (t.duration || duration);
          return slotStart < tEnd && slotEnd > tStart;
        });
        if (!overlaps) slots.push(toTime(slotStart));
        cursor += duration;
      }
    });
    res.json({ ok: true, slots });
  });

  console.log('[Availability] Routes enregistrées : /api/availability/*, /api/admin/availability/*');
}

module.exports = { registerAvailabilityRoutes };
