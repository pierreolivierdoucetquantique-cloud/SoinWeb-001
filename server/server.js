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
const { registerEmailRoutes } = require('./email-routes');
const { registerStripeRoutes } = require('./stripe-routes');
const { registerAuthRoutes } = require('./auth-routes');
const { registerAppointmentsRoutes } = require('./appointments-routes');
const { registerTransactionsRoutes } = require('./transactions-routes');
const { registerPricingRoutes } = require('./pricing-routes');
const { registerTestimonialsRoutes } = require('./testimonials-routes');
const { registerAvailabilityRoutes } = require('./availability-routes');

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
  onPaymentSucceeded: (paymentIntent) => {
    console.log('[Stripe] Paiement confirmé côté serveur :', paymentIntent.id);
  },
  onPaymentFailed: (paymentIntent) => {
    console.warn('[Stripe] Paiement échoué côté serveur :', paymentIntent.id);
  }
});
registerAuthRoutes(app);
registerAppointmentsRoutes(app);
registerTransactionsRoutes(app);
registerPricingRoutes(app);
registerTestimonialsRoutes(app);
registerAvailabilityRoutes(app);

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
