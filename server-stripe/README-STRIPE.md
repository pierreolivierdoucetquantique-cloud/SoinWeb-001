# Intégration Stripe — serveur

## ⚡ Checklist de mise en ligne (mode Live)

Ton compte Stripe est déjà activé en mode Live ? Voici les seules étapes qui
restent — **aucune modification de code n'est nécessaire**, tout le site
détecte automatiquement le mode (test/réel) à partir des clés configurées :

1. Dashboard Stripe → bascule en haut à droite sur **Mode Live** (pas Test).
2. Développeurs → Clés API → copie `pk_live_...` et `sk_live_...`.
3. Développeurs → Webhooks → crée un NOUVEL endpoint pour la production (les
   webhooks test et Live sont séparés) → URL : `https://soinweb-001.onrender.com/api/stripe-webhook`
   → événements `payment_intent.succeeded` et `payment_intent.payment_failed`
   → copie le nouveau `whsec_...`.
4. Sur Render → ton service API → Environment → remplace les 3 variables
   (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`)
   par les valeurs Live ci-dessus, puis redéploie.
5. Vérifie sur `https://soinweb-001.onrender.com/api/stripe-config` que
   `publishableKey` commence bien par `pk_live_`.
6. Sur le site, Admin → Paiements affiche désormais "Mode Stripe : RÉEL" —
   et tous les badges "mode test" disparaissent automatiquement partout sur
   le site (page de paiement, Soin Direct) puisqu'ils sont détectés en
   direct, pas codés en dur.
7. Fais un vrai paiement de faible montant avec ta propre carte pour
   confirmer que tout fonctionne avant d'annoncer le lancement.

---


Ce dossier contient les routes Stripe à brancher sur ton serveur Node.js
existant (celui qui sert déjà `/api/send-email` via Resend, déployé sur
Render). Il ne remplace pas ce serveur : il s'y ajoute.

## 1. Installation

Dans ton dossier serveur (celui de `server.js` / `email-service` Resend) :

```bash
npm install stripe
```

Copie le fichier `stripe-routes.js` de ce dossier dans ton projet serveur
(par exemple à côté de ton `server.js`).

## 2. Variables d'environnement (Render → ton service → Environment)

| Variable | Exemple | Où la trouver |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_51...` | Dashboard Stripe → Développeurs → Clés API (mode **Test**) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_51...` | Même page |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Voir étape 4 ci-dessous |

⚠️ `STRIPE_SECRET_KEY` ne doit **jamais** apparaître dans le code frontend,
ni être commit dans Git. Seule `STRIPE_PUBLISHABLE_KEY` est exposée au
navigateur (via la route `/api/stripe-config`).

## 3. Brancher les routes dans ton `server.js`

```js
const { registerStripeRoutes } = require('./stripe-routes');

registerStripeRoutes(app, {
  onPaymentSucceeded: (paymentIntent) => {
    // Optionnel : envoyer un email de confirmation via ta logique Resend
    // existante, par ex. :
    // sendEmail({
    //   to: paymentIntent.metadata.clientEmail,
    //   type: 'payment_stripe',
    //   vars: { total: (paymentIntent.amount / 100).toFixed(2) }
    // });
    console.log('Paiement confirmé côté serveur :', paymentIntent.id);
  },
  onPaymentFailed: (paymentIntent) => {
    console.warn('Paiement échoué :', paymentIntent.id);
  }
});
```

**Important** — la route webhook a besoin du corps de requête *brut* (pas
JSON parsé) pour vérifier la signature. Le fichier `stripe-routes.js` gère
déjà ça avec `express.raw()` sur sa propre route. Assure-toi seulement que
`registerStripeRoutes(app, ...)` est appelé **avant** un éventuel
`app.use(express.json())` global dans ton `server.js` — sinon ce middleware
global aurait déjà consommé le corps de la requête avant que la route
webhook ne puisse le lire en brut.

## 4. Configurer le webhook Stripe

### En local (pendant le développement) — Stripe CLI

```bash
stripe login
stripe listen --forward-to localhost:PORT/api/stripe-webhook
```

La commande affiche un secret `whsec_...` à copier dans `STRIPE_WEBHOOK_SECRET`.

### En production (Render)

1. Dashboard Stripe → Développeurs → Webhooks → **Ajouter un endpoint**.
2. URL : `https://soinweb-001.onrender.com/api/stripe-webhook`
   (remplace par l'URL réelle de ton service API Render).
3. Événements à écouter : `payment_intent.succeeded`,
   `payment_intent.payment_failed`.
4. Une fois créé, Stripe affiche un "Signing secret" (`whsec_...`) → copie-le
   dans la variable d'environnement `STRIPE_WEBHOOK_SECRET` sur Render.

## 5. Cartes de test Stripe

Utilise n'importe quelle date d'expiration future et n'importe quel CVC à 3
chiffres avec ces numéros (mode test uniquement, aucun argent réel) :

| Numéro | Résultat |
|---|---|
| `4242 4242 4242 4242` | Paiement accepté |
| `4000 0000 0000 0002` | Carte refusée (`card_declined`) |
| `4000 0025 0000 3155` | Demande d'authentification 3D Secure |

Liste complète : https://docs.stripe.com/testing

## 6. Ce qui reste "simulation" — honnêteté sur les limites actuelles

- Aucune carte réelle n'est débitée en mode test — c'est voulu (mode TEST
  Stripe, pas encore le mode Live/production).
- La confirmation finale du rendez-vous se déclenche encore côté navigateur
  après succès de `stripe.confirmCardPayment()`, pas depuis le webhook,
  puisqu'il n'y a pas encore de base de données réelle où le webhook
  pourrait écrire le statut "payé" de façon autoritaire. Le webhook
  fonctionne déjà et vérifie correctement la signature Stripe — il attend
  simplement la migration Supabase pour devenir la source de vérité.
- Pour passer en argent réel plus tard : basculer les 3 variables
  d'environnement vers les clés **Live** (`sk_live_...`, `pk_live_...`) et
  reconfigurer le webhook avec l'URL de production — aucun changement de
  code nécessaire.
