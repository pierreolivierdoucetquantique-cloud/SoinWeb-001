// =========================================================
// Ntabou Aka Wé — API — server.js
//
// Serveur Node.js/Express unique regroupant :
//   - l'envoi de courriels réels (Resend)     → email-routes.js
//   - les paiements par carte (Stripe)        → stripe-routes.js
//
// DÉPLOIEMENT SUR RENDER
//   Ce dossier doit être déployé comme un "Web Service" Render — PAS
//   comme un "Static Site" (le site statique du frontend reste un
//   service séparé, inchangé).
//   - Build Command : npm install
//   - Start Command : node server.js
//   - Root Directory : server   (si ce dossier est à la racine du repo,
//     indique "server" comme Root Directory dans les réglages Render ;
//     sinon laisse vide et adapte les chemins)
//
// VARIABLES D'ENVIRONNEMENT (Render → ton service → Environment)
//   RESEND_API_KEY          Clé API Resend
//   FROM_EMAIL              Adresse d'envoi vérifiée dans Resend
//   ALLOWED_ORIGINS         Domaines autorisés en CORS, séparés par virgules
//                           (ex. "https://3pierre6olivier9.com,https://soinweb-sovara.onrender.com")
//   STRIPE_SECRET_KEY       sk_test_... ou sk_live_...
//   STRIPE_PUBLISHABLE_KEY  pk_test_... ou pk_live_...
//   STRIPE_WEBHOOK_SECRET   whsec_...
//   PORT                    Fournie automatiquement par Render — ne pas fixer en dur
// =========================================================

const express = require('express');
const { registerEmailRoutes } = require('./email-routes');
const { registerStripeRoutes } = require('./stripe-routes');

const app = express();

// ---------------------------------------------------------
// CORS — autorise uniquement les domaines de ton site
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

if (!allowedOrigins.length) {
  console.warn('[CORS] ALLOWED_ORIGINS non configurée — toutes origines autorisées (à restreindre en production).');
}

// ---------------------------------------------------------
// Routes
// IMPORTANT : registerStripeRoutes() doit être appelé avant tout
// middleware express.json() global, car sa route webhook a besoin du
// corps de requête BRUT. Les deux modules ci-dessous déclarent déjà
// leur propre express.json()/express.raw() par route — ne pas ajouter
// app.use(express.json()) global ici.
// ---------------------------------------------------------
registerEmailRoutes(app);
registerStripeRoutes(app, {
  onPaymentSucceeded: (paymentIntent) => {
    console.log('[Stripe] Paiement confirmé côté serveur :', paymentIntent.id);
    // Optionnel : envoyer ici un courriel de confirmation supplémentaire
    // directement depuis le webhook (source de vérité serveur), par ex. :
    // const { buildEmail } = require('./email-templates');
    // ... voir email-routes.js pour le pattern d'envoi via sendViaResend.
  },
  onPaymentFailed: (paymentIntent) => {
    console.warn('[Stripe] Paiement échoué côté serveur :', paymentIntent.id);
  }
});

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Ntabou Aka Wé API — voir /api/health' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Ntabou Aka Wé API démarrée sur le port ${PORT}`);
});
