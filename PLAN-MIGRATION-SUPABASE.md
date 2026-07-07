# Plan de migration vers une vraie base de données (Supabase)

## Pourquoi ce document existe

Le document reçu ("PRODUCTION READINESS AUDIT") demande de retirer toute
donnée simulée et de faire fonctionner le site "exactement comme en
production". C'est impossible à faire silencieusement dans le code : le
site repose entièrement sur localStorage (aucun vrai serveur de données),
et changer ça touche l'architecture, l'hébergement et les identifiants —
des décisions qui t'appartiennent. Ce document propose un plan concret,
pas une exécution automatique.

## Où on en est aujourd'hui

- **Frontend** : HTML/CSS/JS statique, hébergé sur Render.
- **"Base de données"** : `localStorage` du navigateur — chaque appareil a
  ses propres données, rien n'est partagé entre client et admin en dehors
  du même navigateur.
- **Paiement carte** : déjà réel (Stripe, mode test) — voir la conversation
  précédente. C'est la seule partie déjà connectée à un vrai service
  externe.
- **Email** : déjà réel (Resend, via ton petit serveur Node séparé).

## Ce que la migration impliquerait concrètement

1. **Créer un projet Supabase** (gratuit pour commencer) — nécessite un
   compte, comme pour Stripe.
2. **Concevoir le schéma de base de données** : tables `users`,
   `appointments`, `transactions`, `formulas`, `testimonials`,
   `availability`, etc. — essentiellement la structure de ce qui est
   aujourd'hui dans localStorage, mais partagée et persistante.
3. **Remplacer l'authentification maison** (`auth.js`) par Supabase Auth
   (JWT réel, sessions sécurisées côté serveur).
4. **Réécrire chaque module de données** (`content-store.js`,
   `notifications-store.js`, `care-session-store.js`,
   `testimonials-store.js`, etc.) pour appeler l'API Supabase au lieu de
   `localStorage.getItem/setItem`.
5. **Brancher le webhook Stripe existant** (déjà prêt côté serveur, voir
   `server-stripe/`) pour qu'il écrive directement le statut "payé" dans
   Supabase — il deviendrait enfin la seule source de vérité, au lieu de
   la confirmation côté navigateur actuelle.
6. **Revalider côté serveur** les règles aujourd'hui uniquement
   côté navigateur (limite de 2 séances/30 jours, blocage par âge, calcul
   des prix) — actuellement contournables via les DevTools.
7. **Migrer les données existantes** (comptes de test, rendez-vous déjà
   créés) si tu veux les conserver.

## Ce que ça change pour l'utilisateur final

- Les réservations et paiements seraient visibles depuis n'importe quel
  appareil (plus seulement le navigateur où ils ont été créés).
- L'admin verrait les vrais paiements confirmés par Stripe en temps réel,
  sans dépendre du navigateur du client.
- Les règles de sécurité (âge, limite de séances) deviendraient réellement
  infalsifiables.

## Ce qu'il faut décider avant de commencer

- **Budget/plan Supabase** — le plan gratuit suffit largement pour démarrer.
- **Échéancier** — c'est un chantier de plusieurs semaines, pas quelques
  heures, vu le nombre de modules à réécrire (8+ stores de données).
- **Ordre de priorité** — on peut migrer un module à la fois (ex. commencer
  par les paiements/transactions, qui bénéficient le plus du webhook Stripe
  déjà prêt) plutôt que tout d'un coup.
- **Continuité du site en ligne** — la migration peut se faire sans jamais
  couper l'accès public, en basculant module par module.

## Prochaine étape suggérée

Si tu veux avancer là-dessus, la façon la plus sûre de commencer :
1. Créer le compte Supabase (je peux te guider, comme pour Stripe).
2. Migrer UN seul module en premier — je suggère **Transactions/Paiements**,
   puisque le webhook Stripe est déjà écrit et n'attend que ça.
3. Valider que tout fonctionne encore avant de passer au module suivant.

Dis-moi si tu veux qu'on commence par là, ou si tu préfères garder
l'architecture actuelle pour l'instant et qu'on se concentre sur d'autres
améliorations.
