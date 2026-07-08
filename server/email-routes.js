// =========================================================
// Ntabou Aka Wé — API — email-routes.js
//
// Routes d'envoi de courriels réels via Resend (https://resend.com).
//
// VARIABLES D'ENVIRONNEMENT REQUISES
//   RESEND_API_KEY   Clé API Resend (Dashboard Resend → API Keys)
//   FROM_EMAIL       Adresse d'envoi vérifiée dans Resend
//                     (ex. "Ntabou Aka Wé <notifications@tondomaine.com>")
//
// IMPORTANT — DOMAINE VÉRIFIÉ
//   Resend exige que le domaine de FROM_EMAIL soit vérifié (DNS) dans le
//   Dashboard Resend avant de pouvoir envoyer à des destinataires réels.
//   Sans domaine vérifié, Resend n'autorise l'envoi qu'à l'adresse du
//   compte Resend lui-même — pratique pour tester, insuffisant pour de
//   vrais clients.
// =========================================================

const express = require('express');
const { isConfigured: isResendConfigured, sendViaResend, FROM_EMAIL } = require('./resend-client');

function registerEmailRoutes(app) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const { buildEmail } = require('./email-templates');
  let db;
  try { db = require('./db').db; } catch { db = null; }

  function logToDb(type, to, subject, body) {
    if (!db) return;
    try {
      const crypto = require('crypto');
      db.prepare('INSERT INTO notifications_log (id, channel, type, to_email, subject, body) VALUES (?, ?, ?, ?, ?, ?)')
        .run('log_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'), 'email', type, to, subject, body);
    } catch (e) { console.warn('[Email] Journalisation DB échouée:', e.message); }
  }

  if (!RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY manquante — les envois échoueront jusqu\'à configuration.');
  }

  // ---- Santé de l'API (utilisé par Admin → Notifications → "Vérifier l'API") ----
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'ntabou-aka-we-api', resendConfigured: !!RESEND_API_KEY });
  });

  // ---- Envoi d'un courriel (appelé par PO_EmailService.send()) ----
  app.post('/api/send-email', express.json(), async (req, res) => {
    try {
      const { type, to, vars, subject, body } = req.body || {};
      if (!to || !type) {
        return res.status(400).json({ ok: false, error: 'Paramètres "to" et "type" requis.' });
      }
      if (!RESEND_API_KEY) {
        return res.status(500).json({ ok: false, error: 'RESEND_API_KEY non configurée sur le serveur.' });
      }
      const { subject: finalSubject, html } = buildEmail(type, vars, subject, body);
      const result = await sendViaResend({ to, subject: finalSubject, html });
      logToDb(type, to, finalSubject, html);
      res.json({ ok: true, id: result.id });
    } catch (err) {
      console.error('[Email] Erreur envoi:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ---- Email de test (bouton Admin → Notifications → "Envoyer un email de test") ----
  app.post('/api/test-email', express.json(), async (req, res) => {
    try {
      if (!RESEND_API_KEY) {
        return res.status(500).json({ ok: false, error: 'RESEND_API_KEY non configurée sur le serveur.' });
      }
      const to = (req.body && req.body.to) || process.env.TEST_EMAIL_TO || FROM_EMAIL;
      const result = await sendViaResend({
        to,
        subject: 'Ntabou Aka Wé — email de test',
        html: '<p>Ceci est un email de test envoyé depuis le panneau Admin → Notifications.</p>'
      });
      res.json({ ok: true, id: result.id });
    } catch (err) {
      console.error('[Email] Erreur test:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  console.log('[Email] Routes enregistrées : GET /api/health, POST /api/send-email, POST /api/test-email');
}

module.exports = { registerEmailRoutes };
