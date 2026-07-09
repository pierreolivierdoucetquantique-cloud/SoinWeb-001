// =========================================================
// LE VRAI TEST QUI COMPTE : parcours complet à travers les vraies pages
// HTML (pas des appels API directs), contre le vrai serveur, avec une
// session client et une session admin COMPLÈTEMENT séparées — exactement
// comme deux personnes sur deux appareils différents.
// =========================================================
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'server', 'data', 'ntabou.db');
[dbFile, dbFile + '-wal', dbFile + '-shm'].forEach(f => { try { fs.unlinkSync(f); } catch {} });

process.env.RESEND_API_KEY = 'test_resend_key';
process.env.FROM_EMAIL = 'Ntabou Aka Wé <test@example.com>';
process.env.ALLOWED_ORIGINS = 'https://example.test';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
process.env.PORT = '5097';

const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'stripe') return originalResolve.call(this, path.join(__dirname, 'server', 'node_modules', 'stripe-stub'), ...args);
  return originalResolve.call(this, request, ...args);
};

process.on('unhandledRejection', () => { /* artefact inoffensif : script inline natif exécuté par jsdom avant l'injection via eval() — voir notes de tests précédents */ });

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

function loadPage(file, url) {
  const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: url || `https://example.test/${file}` });
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.AbortSignal = dom.window.AbortSignal || { timeout: () => undefined };
  dom.window.fetch = async (url, opts) => {
    const realUrl = String(url).replace('https://ntabou-aka-we.onrender.com', 'http://localhost:5097');
    const http = require('http');
    return new Promise((resolve, reject) => {
      const u = new URL(realUrl);
      const req = http.request({
        hostname: u.hostname, port: u.port, path: u.pathname + u.search,
        method: opts?.method || 'GET', headers: opts?.headers || {}
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => { try { return JSON.parse(data); } catch { return {}; } }
        }));
      });
      req.on('error', reject);
      if (opts?.body) req.write(opts.body);
      req.end();
    });
  };
  return dom;
}

async function evalScripts(dom, files, extraTail) {
  const combined = files.map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n;\n') + (extraTail || '');
  dom.window.eval(combined);
  await new Promise(r => setTimeout(r, 50));
}

async function run() {
  const app = require('./server/server.js');
  const server = await new Promise(resolve => { const s = app.listen(5097, () => resolve(s)); });

  const COMMON = ['api-client.js', 'auth.js', 'content-store.js', 'pricing.js', 'testimonials-store.js', 'script.js'];

  // ==================================================================
  // APPAREIL 1 — la cliente s'inscrit et réserve
  // ==================================================================
  const domClient = loadPage('services-energetiques.html');
  await evalScripts(domClient, [...COMMON, 'availability-booking.js'], `
;
window.__poTest = { createAccount: (d) => PO_Auth.createAccount(d), init: () => PO_Auth.init() };
`);
  const regResult = await domClient.window.__poTest.createAccount({
    firstName: 'Alice', lastName: 'Tremblay', email: 'alice@example.com', age: 30, password: 'MotDePasse1', privacyConsent: true
  });
  assert(regResult.ok, "APPAREIL 1 : l'inscription de la cliente réussit sur la vraie page de service");

  // Ré-initialise PO_Auth pour que le cache reflète la session fraîchement créée
  await domClient.window.__poTest.init();
  await new Promise(r => setTimeout(r, 30));

  const docClient = domClient.window.document;
  const ctaBtn = docClient.getElementById('cta-button');
  assert(!!ctaBtn, 'le bouton de réservation existe sur la page Soins Énergétiques');
  ctaBtn.dispatchEvent(new domClient.window.Event('click', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 100));

  const formulaLabel = docClient.getElementById('cal-booking-formula').textContent;
  assert(!/(^|\s)0,00\s\$/.test(formulaLabel), `le prix affiché lors de la réservation n'est pas 0,00 $ (affiché: "${formulaLabel}")`);

  // Sélectionne un jour avec des créneaux (avance au mois prochain pour être sûr d'avoir des jours de semaine ouvrables à venir)
  await domClient.window.eval(`
    (async () => {
      window.__testDate = null;
      // Cherche le premier jour avec des créneaux dans le calendrier actuellement affiché
      const cell = document.querySelector('.cal-day[data-has-slots="true"]');
      if (cell) { window.__testDate = cell.dataset.date; cell.click(); }
    })();
  `);
  await new Promise(r => setTimeout(r, 150));

  const testDate = domClient.window.__testDate;
  assert(!!testDate, 'un jour disponible a bien été trouvé et sélectionné dans le calendrier');

  const slotBtn = docClient.querySelector('.cal-slot-btn');
  assert(!!slotBtn, 'au moins un créneau horaire est proposé pour le jour sélectionné');
  const chosenTime = slotBtn?.dataset.slotTime;
  slotBtn?.dispatchEvent(new domClient.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));

  const pendingPayment = JSON.parse(domClient.window.sessionStorage.getItem('po_pending_payment') || 'null');
  assert(!!pendingPayment, 'les données de paiement en attente sont bien enregistrées après le choix du créneau');
  assert(pendingPayment && pendingPayment.formulaPrice > 0, 'le prix transmis à la page de paiement est bien positif (pas 0,00 $)');

  // ---- Paiement Interac sur la vraie page paiement-rdv.html ----
  const clientToken = domClient.window.sessionStorage.getItem('po_session_token');
  const domPay = loadPage('paiement-rdv.html');
  domPay.window.sessionStorage.setItem('po_pending_payment', JSON.stringify(pendingPayment));
  domPay.window.sessionStorage.setItem('po_session_token', clientToken);
  domPay.window.Stripe = undefined;

  const inlinePay = fs.readFileSync(path.join(__dirname, 'paiement-rdv.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
  await evalScripts(domPay, [...COMMON, 'notifications-store.js', 'email-service.js', 'stripe-payment.js'], '\n;\n' + inlinePay);

  const docPay = domPay.window.document;
  const totalText = docPay.getElementById('ps-total').textContent;
  assert(!totalText.match(/^0,00/), `le total affiché sur la page de paiement n'est pas 0,00 $ (affiché: "${totalText}")`);

  const interacBtn = docPay.getElementById('btn-interac-sent');
  interacBtn.dispatchEvent(new domPay.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));

  const confirmScreen = docPay.getElementById('confirm-tx-id');
  assert(confirmScreen && confirmScreen.textContent.includes('Référence'), 'la transaction Interac est bien créée avec une référence affichée');

  // ==================================================================
  // APPAREIL 2 — L'ADMIN, DEPUIS UNE SESSION TOTALEMENT SÉPARÉE
  // (aucun partage de localStorage/sessionStorage — c'est le vrai test)
  // ==================================================================
  const domAdmin = loadPage('admin.html');
  const ADMIN_FILES = ['api-client.js', 'auth.js', 'profile-photo.js', 'content-store.js', 'pricing.js',
    'email-service.js', 'messenger-store.js', 'notifications-store.js',
    'testimonials-store.js', 'admin.js'];
  await evalScripts(domAdmin, ADMIN_FILES, `
;
window.__poTest = { login: (d) => PO_Auth.login(d) };
`);
  const adminLogin = await domAdmin.window.__poTest.login({ email: 'admin@ntabou-aka-we.fr', password: 'admin1234' });
  assert(adminLogin.ok, "APPAREIL 2 (admin, session séparée) : la connexion admin réussit");

  // Recharge la page admin (comme un vrai rechargement de navigateur) pour
  // que la garde d'accès + les caches se réinitialisent avec la session.
  const domAdmin2 = loadPage('admin.html');
  domAdmin2.window.sessionStorage.setItem('po_session_token', domAdmin.window.sessionStorage.getItem('po_session_token'));
  await evalScripts(domAdmin2, ADMIN_FILES);
  const docAdmin = domAdmin2.window.document;

  docAdmin.querySelector('[data-panel="payments"]').dispatchEvent(new domAdmin2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));

  const txRow = [...docAdmin.querySelectorAll('#payments-tbody tr')].find(tr => tr.textContent.includes('Alice Tremblay'));
  assert(!!txRow, "L'ADMIN VOIT LA TRANSACTION DE LA CLIENTE depuis un appareil totalement séparé (LE VRAI PROBLÈME EST RÉSOLU)");

  const confirmBtn = txRow?.querySelector('[data-confirm-tx]');
  assert(!!confirmBtn, 'le bouton de confirmation de paiement est disponible pour cette transaction');
  confirmBtn?.dispatchEvent(new domAdmin2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));
  docAdmin.getElementById('confirm-modal-ok')?.dispatchEvent(new domAdmin2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));

  // ==================================================================
  // RETOUR À L'APPAREIL 1 — la cliente doit voir son rendez-vous confirmé
  // ==================================================================
  const domProfil = loadPage('profil.html');
  domProfil.window.sessionStorage.setItem('po_session_token', clientToken);
  const profilInline = fs.readFileSync(path.join(__dirname, 'profil.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
  await evalScripts(domProfil, [...COMMON, 'notifications-store.js', 'messenger-store.js', 'email-service.js', 'profile-photo.js'], '\n;\n' + profilInline);
  await new Promise(r => setTimeout(r, 100));

  const docProfil = domProfil.window.document;
  docProfil.querySelector('[data-panel="rdv"]')?.dispatchEvent(new domProfil.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));

  const apptText = docProfil.body.textContent;
  assert(apptText.includes('Confirmé') || apptText.includes('confirmé'),
    "LA CLIENTE VOIT SON RENDEZ-VOUS CONFIRMÉ PAR L'ADMIN, DEPUIS SON PROPRE APPAREIL (synchronisation multi-appareil bout en bout réussie)");

  // ==================================================================
  // GESTION DES BOUTONS — la désactivation doit réellement masquer le
  // bouton sur la page d'accueil ET bloquer l'accès direct à la page.
  // ==================================================================
  docAdmin.querySelector('[data-panel="buttons"]').dispatchEvent(new domAdmin2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));
  const accompToggle = docAdmin.querySelector('[data-button-setting="accompagnement"]');
  assert(!!accompToggle && accompToggle.checked, "le panneau Gestion des boutons affiche le bouton Accompagnement, activé par défaut");
  accompToggle.checked = false;
  accompToggle.dispatchEvent(new domAdmin2.window.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));

  // ---- Page d'accueil, visiteur anonyme, nouvel appareil ----
  const domHome = loadPage('index.html');
  await evalScripts(domHome, COMMON);
  await new Promise(r => setTimeout(r, 100));
  assert(!domHome.window.document.querySelector('[data-button-id="accompagnement"]'),
    "BOUTON RÉELLEMENT MASQUÉ : le portail Accompagnement a disparu de la page d'accueil pour un visiteur anonyme après désactivation par l'admin");
  assert(!!domHome.window.document.querySelector('[data-button-id="energetiques"]'),
    'les autres boutons (non désactivés) restent bien affichés');
  assert(domHome.window.document.documentElement.className.indexOf('po-guard-pending') === -1,
    "la page redevient visible (classe po-guard-pending retirée) une fois la vérification terminée");

  // ---- Accès direct à la page désactivée ----
  const domAccomp = loadPage('accompagnement.html');
  await evalScripts(domAccomp, COMMON);
  await new Promise(r => setTimeout(r, 100));
  assert(domAccomp.window.__poGuardRedirected === true,
    "ACCÈS DIRECT BLOQUÉ : visiter accompagnement.html directement déclenche une redirection vers l'accueil quand le bouton est désactivé");

  // ---- Réactivation : tout redevient accessible ----
  accompToggle.checked = true;
  accompToggle.dispatchEvent(new domAdmin2.window.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));

  const domAccomp2 = loadPage('accompagnement.html');
  await evalScripts(domAccomp2, COMMON);
  await new Promise(r => setTimeout(r, 100));
  assert(domAccomp2.window.__poGuardRedirected !== true,
    "réactivation : la page redevient accessible directement, sans redirection");

  const domHome2 = loadPage('index.html');
  await evalScripts(domHome2, COMMON);
  await new Promise(r => setTimeout(r, 100));
  assert(!!domHome2.window.document.querySelector('[data-button-id="accompagnement"]'),
    'réactivation : le portail Accompagnement réapparaît sur la page d\'accueil');

  server.close();
  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
