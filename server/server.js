// =========================================================
// Ntabou Aka Wé — API — server.js
//
// Serveur complet : base de données SQLite réelle (remplace
// localStorage), authentification, rendez-vous, paiements, tarifs,
// témoignages, disponibilités, courriels (Resend), paiements (Stripe).
//
// DÉPLOIEMENT SUR RENDER
//   Web Service (PAS Static Site) — Root Directory : server
//   Build Command : npm install
//   Start Command : node server.js
//   ⚠️ Nécessite un disque persistant (SQLite écrit sur le disque) —
//   voir server/GUIDE-INSTALLATION.md pour la configuration exacte.
// =========================================================

const express = require('express');
const { db } = require('./db');
const crypto = require('crypto');
const { registerEmailRoutes } = require('./email-routes');
const { registerStripeRoutes } = require('./stripe-routes');
const { registerAuthRoutes } = require('./auth-routes');
const { registerAppointmentsRoutes } = require('./appointments-routes');
const { confirmAppointmentPayment } = require('./confirmation-workflow');
const { registerTransactionsRoutes } = require('./transactions-routes');
const { registerPricingRoutes } = require('./pricing-routes');
const { registerTestimonialsRoutes } = require('./testimonials-routes');
const { registerAvailabilityRoutes } = require('./availability-routes');
const { registerContentRoutes } = require('./content-routes');
const { registerGoogleOAuthRoutes } = require('./google-oauth-routes');

const app = express();

// ---------------------------------------------------------
// CORS
// ---------------------------------------------------------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!allowedOrigins.length || (origin && allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature, X-Session-Token');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

if (!allowedOrigins.length) {
  console.warn('[CORS] ALLOWED_ORIGINS non configurée — toutes origines autorisées (à restreindre en production).');
}

// ---------------------------------------------------------
// Routes — l'ordre importe : Stripe (webhook = corps brut) avant
// tout middleware JSON global (aucun ici, chaque module déclare le sien).
// ---------------------------------------------------------
registerEmailRoutes(app);
registerStripeRoutes(app, {
  // SOURCE DE VÉRITÉ : c'est ICI, sur réception du webhook Stripe
  // (signature vérifiée par stripe-routes.js), qu'un paiement carte est
  // réellement considéré confirmé — jamais sur la simple affirmation du
  // navigateur du client. Voir la note de sécurité dans stripe-routes.js
  // et le durcissement de POST /api/transactions (transactions-routes.js).
  onPaymentSucceeded: async (paymentIntent) => {
    try {
      let tx = db.prepare('SELECT * FROM transactions WHERE transaction_reference = ?').get(paymentIntent.id);

      if (tx && tx.status === 'paid') {
        // Stripe peut renvoyer le même événement plusieurs fois (au-moins-
        // une-fois garanti, pas exactement-une-fois) — idempotence requise
        // pour ne jamais créer deux fois la réunion Zoom / l'événement Calendar.
        return;
      }

      if (!tx) {
        // Le webhook est arrivé avant l'appel createTransaction du client —
        // on crée la transaction directement à partir des métadonnées du
        // PaymentIntent (mises là par paiement-rdv.html, transportées par
        // Stripe lui-même — donc fiables, contrairement à un champ envoyé
        // librement par le client sur un autre endpoint).
        const m = paymentIntent.metadata || {};
        if (!m.clientId || !m.service) {
          console.warn('[Stripe] Webhook reçu sans transaction existante et métadonnées insuffisantes :', paymentIntent.id);
          return;
        }
        const id = 'tx_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
        db.prepare(`
          INSERT INTO transactions
            (id, client_id, client_name, service, service_id, formula_title, appointment_id,
             amount, tps, tvq, total, duration, method, status, transaction_reference)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'stripe', 'paid', ?)
        `).run(
          id, m.clientId, m.clientName || '', m.service, m.serviceId || '', m.formulaTitle || null,
          m.appointmentId || null, Number(m.amount) || 0, Number(m.tps) || 0, Number(m.tvq) || 0,
          Number(m.total) || (paymentIntent.amount / 100), m.duration || null, paymentIntent.id
        );
        tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
      } else {
        db.prepare("UPDATE transactions SET status = 'paid' WHERE id = ?").run(tx.id);
        tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(tx.id);
      }

      const result = await confirmAppointmentPayment(tx.id);
      console.log('[Stripe] Paiement confirmé, workflow exécuté :', paymentIntent.id, JSON.stringify(result.steps));
    } catch (err) {
      console.error('[Stripe] Erreur de traitement du webhook payment_intent.succeeded :', err.message);
    }
  },
  onPaymentFailed: (paymentIntent) => {
    console.warn('[Stripe] Paiement échoué côté serveur :', paymentIntent.id);
    try {
      const tx = db.prepare('SELECT * FROM transactions WHERE transaction_reference = ?').get(paymentIntent.id);
      if (tx && tx.status !== 'refused') {
        db.prepare("UPDATE transactions SET status = 'refused' WHERE id = ?").run(tx.id);
      }
    } catch (err) {
      console.error('[Stripe] Erreur de traitement de payment_intent.payment_failed :', err.message);
    }
  }
});
registerAuthRoutes(app);
registerAppointmentsRoutes(app);
registerTransactionsRoutes(app);
registerPricingRoutes(app);
registerTestimonialsRoutes(app);
registerAvailabilityRoutes(app);
registerContentRoutes(app);
registerGoogleOAuthRoutes(app);

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Ntabou Aka Wé API — voir /api/health' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Server] Ntabou Aka Wé API démarrée sur le port ${PORT}`);
  });
}

module.exports = app;
