# Ntabou Aka Wé — Serveur API (Node.js/Express)

## ⚠️ ÉTAPE CRITIQUE — Disque persistant (ne pas sauter)

Ce serveur utilise une vraie base de données SQLite, stockée dans un fichier
(`server/data/ntabou.db`). **Sans disque persistant Render, ce fichier est
effacé à chaque redéploiement** — exactement le problème qu'on a identifié
sur le site de Vicky. C'est une étape obligatoire, pas optionnelle :

1. Sur Render, va dans ton Web Service → onglet **Disks** (menu de gauche).
2. **Add Disk** → Mount Path : `/opt/render/project/src/server/data` → Taille : 1 GB suffit largement pour démarrer.
3. **Un disque persistant nécessite un plan payant** (Starter minimum, ~7 $ US/mois) — le plan Free ne supporte pas les disques. C'est le compromis à accepter pour une vraie base de données partagée entre tous tes clients.

Sans cette étape, le site semblera fonctionner... jusqu'au prochain
redéploiement, où tous les comptes clients, rendez-vous et paiements
disparaîtraient silencieusement.

## Version de Node.js requise

Ce serveur utilise `node:sqlite`, le module SQLite intégré à Node.js (pas de
compilation native comme `better-sqlite3` — installation plus simple et plus
fiable). **Nécessite Node.js 22.5 ou plus récent.** Sur Render, vérifie dans
Settings → Environment que la variable `NODE_VERSION` est fixée à `22` (ou
plus), ou ajoute-la si elle n'existe pas.



Ce dossier est un **vrai serveur backend**, séparé de ton site statique.
Il gère l'envoi de courriels réels (Resend) et les paiements par carte (Stripe).
Ton site statique actuel reste inchangé et continue d'exister en parallèle —
ce serveur est un **second service** sur Render, en plus du site.

## Pourquoi un service séparé ?

Un "Static Site" sur Render ne peut exécuter aucun code serveur (pas de
Node.js, pas de clés secrètes protégées, pas d'appels à Resend/Stripe). Ce
dossier doit être déployé comme un **"Web Service"** Render — un type de
service différent, capable de faire tourner ce `server.js` en continu.

---

## 1. Mettre ce dossier sur GitHub

Si ton site est déjà sur GitHub, tu peux :
- soit ajouter ce dossier `server/` dans le **même repo** que le site (à la racine, à côté de `index.html` etc.) — le plus simple ;
- soit créer un **second repo GitHub** juste pour ce serveur.

Les deux fonctionnent. Le premier est plus simple si tu débutes.

Avec GitHub Desktop (comme d'habitude) : ajoute ce dossier `server/` à ton
repo existant, commit, push.

## 2. Créer le nouveau service sur Render

1. Dashboard Render → **New +** → **Web Service** (pas "Static Site").
2. Connecte le même repo GitHub que ton site.
3. Configure :
   - **Name** : `ntabou-aka-we-api` (ou le nom de ton choix — note l'URL finale, tu en auras besoin)
   - **Root Directory** : `server` (si tu as mis ce dossier dans le même repo que le site)
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Instance Type** : Free (suffisant pour commencer)
4. Clique **Create Web Service**. Render va installer les dépendances et démarrer le serveur.

## 3. Configurer les variables d'environnement

Sur la page du service → onglet **Environment** → ajoute (voir `.env.example`
pour la liste complète et des exemples) :

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Dashboard Resend → API Keys |
| `FROM_EMAIL` | Adresse d'envoi vérifiée dans Resend |
| `ALLOWED_ORIGINS` | URLs de ton site (site statique + domaine personnalisé), séparées par des virgules |
| `STRIPE_SECRET_KEY` | Dashboard Stripe → Développeurs → Clés API |
| `STRIPE_PUBLISHABLE_KEY` | Idem |
| `STRIPE_WEBHOOK_SECRET` | Voir section 8 plus bas pour la procédure complète |

Après avoir ajouté/modifié des variables, Render redéploie automatiquement.

## 4. Configurer Resend (obligatoire pour envoyer de vrais courriels)

1. Crée un compte sur https://resend.com si ce n'est pas déjà fait.
2. Dashboard Resend → **API Keys** → crée une clé → copie-la dans `RESEND_API_KEY`.
3. Dashboard Resend → **Domains** → ajoute ton domaine (`3pierre6olivier9.com`)
   et suis les instructions pour ajouter les enregistrements DNS (via GoDaddy,
   comme pour ton domaine). **Tant que le domaine n'est pas vérifié, Resend
   n'autorise l'envoi qu'à l'adresse de ton propre compte Resend** — pratique
   pour tester, mais tes vrais clients ne recevront rien.
4. Une fois le domaine vérifié, utilise une adresse de ce domaine dans
   `FROM_EMAIL`, ex. `Ntabou Aka Wé <notifications@3pierre6olivier9.com>`.

## 5. Récupérer l'URL de ton nouveau service

Une fois déployé, Render affiche une URL du type :
```
https://soinweb-001.onrender.com
```
(ou un nom différent selon ce que tu as choisi à l'étape 2).

## 6. Brancher cette URL sur le site

Dans le code du site, remplace `API_BASE_URL` par la vraie URL de ton
service, dans **ces deux fichiers** :
- `email-service.js` (ligne avec `const API_BASE_URL = ...`)
- `stripe-payment.js` (ligne avec `const API_BASE_URL = ...`)

Si tu ne l'as pas déjà fait et que l'URL affichée par Render est différente
de `soinweb-001.onrender.com`, dis-le-moi et je mets à jour ces deux
fichiers moi-même.

## 7. Vérifier que tout fonctionne

Une fois déployé, teste dans ton navigateur :
```
https://TON-URL-RENDER.onrender.com/api/health
```
Tu dois voir `{"ok":true,"service":"ntabou-aka-we-api","resendConfigured":true}`.

Si `resendConfigured` est `false` → la variable `RESEND_API_KEY` n'est pas
encore configurée sur Render.

Ensuite, sur le site : Admin → Notifications → "Envoyer un email de test",
et Admin → Paiements → l'indicateur "Mode Stripe" doit afficher TEST ou RÉEL
selon tes clés.

## 8. Stripe — webhook et cartes de test

### Configurer le webhook

**En local (développement)** — via la Stripe CLI :
```bash
stripe login
stripe listen --forward-to localhost:PORT/api/stripe-webhook
```
La commande affiche un secret `whsec_...` à copier dans `STRIPE_WEBHOOK_SECRET`.

**En production (Render)** :
1. Dashboard Stripe → Développeurs → Webhooks → **Ajouter un endpoint**.
2. URL : `https://TON-URL-RENDER.onrender.com/api/stripe-webhook`
3. Événements à écouter : `payment_intent.succeeded`, `payment_intent.payment_failed`.
4. Une fois créé, copie le "Signing secret" (`whsec_...`) dans `STRIPE_WEBHOOK_SECRET`.

### Cartes de test (mode test uniquement, aucun argent réel)

| Numéro | Résultat |
|---|---|
| `4242 4242 4242 4242` | Paiement accepté |
| `4000 0000 0000 0002` | Carte refusée |
| `4000 0025 0000 3155` | Authentification 3D Secure requise |

### Passer en mode Live

Bascule Stripe en mode Live dans son dashboard, récupère les clés `sk_live_`/`pk_live_`,
crée un **nouveau** webhook (les webhooks test et Live sont séparés), puis remplace les
3 variables d'environnement sur Render. Le site détecte automatiquement le mode
(test/réel) à partir du préfixe de la clé — aucun changement de code nécessaire.

## Note sur le service gratuit Render

Les services gratuits Render s'endorment après 15 minutes d'inactivité et
prennent 30 à 60 secondes à se réveiller au premier appel suivant. C'est
normal — le premier clic sur "Payer" ou l'envoi du premier courriel après
une pause peut sembler lent ou temporairement en erreur ; réessaie après
une minute. Pour éviter ça en production, passe à un plan payant Render
("Starter" suffit) qui ne s'endort jamais.
