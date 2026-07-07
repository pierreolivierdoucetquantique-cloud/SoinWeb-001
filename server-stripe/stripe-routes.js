// =========================================================
// Ntabou Aka Wé — server-stripe/stripe-routes.js
//
// Routes Stripe (mode TEST) à brancher sur le serveur Node.js
// existant (celui qui sert déjà /api/send-email via Resend).
//
// INSTALLATION
//   npm install stripe
//
// VARIABLES D'ENVIRONNEMENT REQUISES (Render → Environment)
//   STRIPE_SECRET_KEY       sk_test_...   (jamais exposée au frontend)
//   STRIPE_PUBLISHABLE_KEY  pk_test_...   (exposée via /api/stripe-config)
//   STRIPE_WEBHOOK_SECRET   whsec_...     (générée par le CLI Stripe ou le Dashboard)
//
// INTÉGRATION DANS VOTRE server.js EXISTANT
//   const { registerStripeRoutes } = require('./server-stripe/stripe-routes');
//   registerStripeRoutes(app, {
//     onPaymentSucceeded: (paymentIntent) => {
//       // Brancher ici votre envoi d'email Resend existant, ex. :
//       // sendEmailViaResend({ to: paymentIntent.metadata.clientEmail, ... });
//     }
//   });
//
// IMPORTANT — CORPS BRUT POUR LE WEBHOOK
//   La route /api/stripe-webhook a besoin du corps de requête BRUT (non
//   parsé en JSON) pour vérifier la signature Stripe. Cette route déclare
//   son propre middleware express.raw() ci-dessous ; assurez-vous simplement
//   qu'aucun express.json() global ne s'exécute AVANT elle dans votre
//   server.js (sinon le corps brut aura déjà été consommé/transformé).
//   Le plus sûr : appelez registerStripeRoutes(app, ...) avant vos
//   app.use(express.json()) globaux, ou montez cette route sur un chemin
//   exclu de votre middleware JSON global.
//
// LIMITE DE SIMULATION HONNÊTE (à lire avant la mise en production)
//   Ce projet n'a pas encore de base de données réelle : la "confirmation"
//   finale du rendez-vous (createTxAndNotify côté frontend) se déclenche
//   quand stripe.confirmCardPayment() réussit CÔTÉ NAVIGATEUR. C'est du
//   Stripe réel (aucune donnée de carte ne transite par votre serveur —
//   propriété de sécurité principale de Stripe Elements), mais un client
//   malveillant pourrait théoriquement appeler createTxAndNotify() sans
//   avoir réellement payé, puisque rien côté serveur ne réécrit encore
//   l'état "payé" dans une base de données faisant autorité.
//   Le webhook ci-dessous est prêt et fonctionnel (signature vérifiée), et
//   constitue la bonne source de vérité pour la production — mais il ne
//   peut pas encore écrire dans localStorage (qui vit uniquement dans le
//   navigateur du client). Dès la migration Supabase prévue, branchez
//   onPaymentSucceeded pour écrire le statut "payé" dans la table
//   transactions ; ce sera alors la seule confirmation qui compte.
// =========================================================

const express = require('express');
const Stripe = require('stripe');

/**
 * Branche les routes Stripe sur une app Express existante.
 * @param {import('express').Express} app
 * @param {object} [options]
 * @param {(paymentIntent: object) => void} [options.onPaymentSucceeded]
 * @param {(paymentIntent: object) => void} [options.onPaymentFailed]
 */
function registerStripeRoutes(app, options = {}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('[Stripe] STRIPE_SECRET_KEY manquante — les routes Stripe répondront avec une erreur 500 jusqu\'à ce qu\'elle soit configurée.');
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_missing');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const onPaymentSucceeded = options.onPaymentSucceeded || _defaultOnPaymentSucceeded;
  const onPaymentFailed = options.onPaymentFailed || _defaultOnPaymentFailed;

  // ---------------------------------------------------------
  // 1. Configuration publique — expose UNIQUEMENT la clé publiable.
  //    Le frontend l'appelle avant d'initialiser Stripe.js.
  // ---------------------------------------------------------
  app.get('/api/stripe-config', (req, res) => {
    res.json({ ok: true, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null });
  });

  // ---------------------------------------------------------
  // 2. Création d'un PaymentIntent (montant fixé côté serveur à
  //    partir de ce que le frontend envoie).
  //    NOTE SÉCURITÉ : en l'absence de base de données réelle, ce
  //    montant n'est pas revalidé contre une source de vérité
  //    serveur. À corriger dès la migration Supabase (recalculer
  //    le prix à partir de l'ID de formule stocké en base, plutôt
  //    que de faire confiance à `amount` envoyé par le client).
  // ---------------------------------------------------------
  app.post('/api/create-payment-intent', express.json(), async (req, res) => {
    try {
      const { amount, currency, metadata } = req.body || {};
      const amountNum = Number(amount);
      if (!amountNum || amountNum <= 0) {
        return res.status(400).json({ ok: false, error: 'Montant invalide.' });
      }
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amountNum * 100), // dollars CAD -> cents
        currency: (currency || 'cad').toLowerCase(),
        metadata: metadata || {},
        automatic_payment_methods: { enabled: true }
      });
      res.json({ ok: true, clientSecret: paymentIntent.client_secret, id: paymentIntent.id });
    } catch (err) {
      console.error('[Stripe] Erreur create-payment-intent:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ---------------------------------------------------------
  // 3. Webhook Stripe — source de vérité serveur (signature vérifiée).
  //    À utiliser en production dès qu'une base de données réelle
  //    remplace localStorage (voir note en haut du fichier).
  // ---------------------------------------------------------
  app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), (req, res) => {
    if (!webhookSecret) {
      console.error('[Stripe] STRIPE_WEBHOOK_SECRET manquante — webhook ignoré.');
      return res.status(500).send('Webhook non configuré.');
    }
    let event;
    try {
      const signature = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err) {
      console.error('[Stripe] Signature de webhook invalide:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        onPaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        onPaymentFailed(event.data.object);
        break;
      default:
        break;
    }
    res.json({ received: true });
  });

  console.log('[Stripe] Routes enregistrées : GET /api/stripe-config, POST /api/create-payment-intent, POST /api/stripe-webhook');
}

function _defaultOnPaymentSucceeded(paymentIntent) {
  console.log(
    `[Stripe] Paiement réussi : ${paymentIntent.id} — ${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`,
    paymentIntent.metadata
  );
}
function _defaultOnPaymentFailed(paymentIntent) {
  console.warn(`[Stripe] Paiement échoué : ${paymentIntent.id}`, paymentIntent.last_payment_error && paymentIntent.last_payment_error.message);
}

module.exports = { registerStripeRoutes };
