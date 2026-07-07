# Ntabou Aka Wé — Guide de déploiement

Site web statique HTML/CSS/JS — aucune installation de serveur requise.

---

## OPTION 1 — Netlify (recommandé, gratuit)

1. Créer un compte sur [netlify.com](https://netlify.com)
2. Cliquer **"Add new site" → "Deploy manually"**
3. Glisser-déposer **le dossier entier** (ou le ZIP) dans la zone de dépôt
4. Le site est en ligne en 30 secondes ✓

**Ou via GitHub (déploiement automatique) :**
1. Pousser les fichiers dans un dépôt GitHub
2. Netlify → "Import from Git" → sélectionner le dépôt
3. Build command : *(vide)*  |  Publish directory : `.`
4. Chaque `git push` redéploie automatiquement ✓

---

## OPTION 2 — Render.com (déjà configuré)

1. Pousser les fichiers dans GitHub Desktop
2. Render redéploie automatiquement ✓

---

## OPTION 3 — Vercel (gratuit)

1. Créer un compte sur [vercel.com](https://vercel.com)
2. **"New Project" → "Import" → glisser le dossier**
3. Framework Preset : **Other**
4. Output Directory : `.`
5. Déployer ✓

---

## OPTION 4 — Hébergement mutualisé (OVH, Infomaniak, cPanel…)

1. Ouvrir le **gestionnaire de fichiers FTP** (ou FileZilla)
2. Copier **tous les fichiers** dans `public_html/` (ou `www/`)
3. Le fichier `.htaccess` est déjà inclus ✓

---

## Fichiers du projet

| Fichier | Rôle |
|---------|------|
| `index.html` | Page d'accueil |
| `services-energetiques.html` | Page Soins Énergétiques |
| `accompagnement.html` | Page Accompagnement 1:1 |
| `soins-direct.html` | Page Soins Direct |
| `admin.html` | Panneau d'administration |
| `profil.html` | Espace client |
| `connexion.html` | Connexion |
| `inscription.html` | Création de compte |
| `paiement-rdv.html` | Page de paiement |
| `soin-interactif.html` | Séance interactive |
| `histoire.html` | Page biographique |
| `styles.css` | Design complet |
| `auth.js` | Authentification & données |
| `pricing.js` | Calcul des prix (source unique) |
| `content-store.js` | CMS (textes & tarifs) |
| `admin.js` | Logique admin |
| `script.js` | Interactions publiques |
| `hero-*.jpg` | Images de couverture optimisées |
| `netlify.toml` | Config Netlify |
| `vercel.json` | Config Vercel |
| `.htaccess` | Config Apache/cPanel |
| `render.yaml` | Config Render |

---

## Identifiants admin (démo)

- Email : `admin@ntabou-aka-we.fr`
- Mot de passe : `admin1234`

> ⚠️ Ce site utilise `localStorage` comme base de données. Les données sont
> stockées dans le navigateur de chaque visiteur. Pour une vraie base de données
> partagée entre tous les appareils, une migration vers Supabase est prévue.
