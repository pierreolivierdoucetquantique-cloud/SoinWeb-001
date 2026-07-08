// Test exhaustif du serveur complet server/server.js — vraie base de
// données SQLite (node:sqlite), pas de simulation.
const fs = require('fs');
const path = require('path');

// Base de données fraîche à chaque exécution du test.
const dbFile = path.join(__dirname, 'server', 'data', 'ntabou.db');
[dbFile, dbFile + '-wal', dbFile + '-shm'].forEach(f => { try { fs.unlinkSync(f); } catch {} });

process.env.RESEND_API_KEY = 'test_resend_key';
process.env.FROM_EMAIL = 'Ntabou Aka Wé <test@example.com>';
process.env.ALLOWED_ORIGINS = 'https://example.test';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
process.env.PORT = '5098';

const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'stripe') return originalResolve.call(this, path.join(__dirname, 'server', 'node_modules', 'stripe-stub'), ...args);
  return originalResolve.call(this, request, ...args);
};

const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  if (String(url).includes('api.resend.com')) {
    return { ok: true, json: async () => ({ id: 'resend_fake_' + Date.now() }) };
  }
  return realFetch(url, opts);
};

const http = require('http');
let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

function request(method, path_, body, headers) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: 'localhost', port: 5098, path: path_, method,
      headers: Object.assign(
        payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
        headers || {}
      )
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  const app = require('./server/server.js');
  const server = await new Promise(resolve => {
    const s = app.listen(5098, () => resolve(s));
  });

  // ==================================================================
  // 1. SANTÉ + INSCRIPTION + CONNEXION
  // ==================================================================
  const health = await request('GET', '/api/health');
  assert(health.status === 200 && health.body.ok, '/api/health répond correctement');

  const register = await request('POST', '/api/auth/register', {
    firstName: 'Alice', lastName: 'Tremblay', email: 'alice@example.com', age: 30, password: 'MotDePasse1'
  });
  assert(register.status === 200 && register.body.ok, "l'inscription réussit");
  assert(!!register.body.token, 'un jeton de session est retourné à l\'inscription');
  const aliceToken = register.body.token;
  const aliceId = register.body.user.id;

  const dupRegister = await request('POST', '/api/auth/register', {
    firstName: 'Alice2', lastName: 'X', email: 'alice@example.com', age: 25, password: 'Autre1234'
  });
  assert(dupRegister.status === 409, 'un email déjà utilisé est rejeté à l\'inscription');

  const badLogin = await request('POST', '/api/auth/login', { email: 'alice@example.com', password: 'mauvais' });
  assert(badLogin.status === 401, 'un mauvais mot de passe est rejeté à la connexion');

  const login = await request('POST', '/api/auth/login', { email: 'alice@example.com', password: 'MotDePasse1' });
  assert(login.status === 200 && login.body.ok, 'la connexion réussit avec le bon mot de passe');

  const me = await request('GET', '/api/auth/me', null, { 'X-Session-Token': aliceToken });
  assert(me.body.user.email === 'alice@example.com', '/api/auth/me retourne le bon utilisateur');

  const meNoToken = await request('GET', '/api/auth/me');
  assert(meNoToken.body.user === null, 'sans jeton, aucun utilisateur retourné (pas une erreur qui plante)');

  // ---- Connexion admin ----
  const adminLogin = await request('POST', '/api/auth/login', { email: 'admin@ntabou-aka-we.fr', password: 'admin1234' });
  assert(adminLogin.status === 200 && adminLogin.body.user.role === 'admin', 'le compte admin de démo existe et se connecte');
  const adminToken = adminLogin.body.token;

  // ==================================================================
  // 2. TARIFS — les 3 services initiaux, modification, création
  // ==================================================================
  const formulas = await request('GET', '/api/formulas');
  const services = new Set(formulas.body.formulas.map(f => f.serviceId));
  assert(services.has('services-energetiques') && services.has('accompagnement'),
    'les 2 services actifs ont bien des formules par défaut (Soins Direct a été retiré)');
  assert(formulas.body.formulas.length === 6, 'les 6 formules par défaut sont présentes (3+3, Soins Direct retiré)');

  const seFormula = formulas.body.formulas.find(f => f.serviceId === 'services-energetiques' && f.title === 'Séance découverte');
  assert(seFormula.price === 60, 'le prix par défaut de la Séance découverte est 60 $');

  const editFormula = await request('PUT', `/api/admin/formulas/${seFormula.id}`, { price: 65 }, { 'X-Session-Token': adminToken });
  assert(editFormula.status === 200 && editFormula.body.formula.price === 65, 'la modification du prix par un admin fonctionne');

  const noAuthEdit = await request('PUT', `/api/admin/formulas/${seFormula.id}`, { price: 999 }, { 'X-Session-Token': aliceToken });
  assert(noAuthEdit.status === 403, 'un client (non-admin) ne peut PAS modifier les tarifs');

  const newFormula = await request('POST', '/api/admin/formulas', {
    serviceId: 'accompagnement', title: 'Séance unique', price: 120, duration: '60 min', description: 'Sans engagement.'
  }, { 'X-Session-Token': adminToken });
  assert(newFormula.status === 200 && newFormula.body.formula.price === 120, 'la création d\'une nouvelle formule fonctionne');

  // ==================================================================
  // 3. RENDEZ-VOUS
  // ==================================================================
  const createAppt = await request('POST', '/api/appointments', {
    service: 'Soins Énergétiques', serviceId: 'services-energetiques',
    date: '2026-08-10', time: '14:00', duration: 60, status: 'awaiting_confirmation'
  }, { 'X-Session-Token': aliceToken });
  assert(createAppt.status === 200 && createAppt.body.appointment.clientId === aliceId, 'un client peut créer son propre rendez-vous');
  const apptId = createAppt.body.appointment.id;

  const noAuthAppt = await request('POST', '/api/appointments', { service: 'X', serviceId: 'x', date: '2026-01-01', time: '10:00' });
  assert(noAuthAppt.status === 401, 'la création d\'un rendez-vous sans connexion est refusée');

  const aliceAppts = await request('GET', '/api/appointments', null, { 'X-Session-Token': aliceToken });
  assert(aliceAppts.body.appointments.length === 1, 'le client ne voit que ses propres rendez-vous');

  const adminAppts = await request('GET', '/api/appointments', null, { 'X-Session-Token': adminToken });
  assert(adminAppts.body.appointments.length === 1, 'l\'admin voit tous les rendez-vous (y compris ceux des clients)');

  const confirmAppt = await request('PUT', `/api/appointments/${apptId}`, { status: 'confirmed' }, { 'X-Session-Token': adminToken });
  assert(confirmAppt.body.appointment.status === 'confirmed', 'l\'admin peut confirmer un rendez-vous');

  const otherClientTryEdit = await request('PUT', `/api/appointments/${apptId}`, { status: 'cancelled' }, { 'X-Session-Token': 'jeton-inexistant' });
  assert(otherClientTryEdit.status === 401, 'un jeton invalide ne peut pas modifier un rendez-vous');

  // ==================================================================
  // 4. TRANSACTIONS / PAIEMENTS
  // ==================================================================
  const createTx = await request('POST', '/api/transactions', {
    service: 'Soins Énergétiques', serviceId: 'services-energetiques', appointmentId: apptId,
    amount: 90, total: 90, method: 'interac', status: 'waiting'
  }, { 'X-Session-Token': aliceToken });
  assert(createTx.status === 200 && createTx.body.transaction.status === 'waiting', 'la création d\'une transaction Interac fonctionne');
  const txId = createTx.body.transaction.id;

  const confirmTx = await request('PUT', `/api/admin/transactions/${txId}/confirm`, null, { 'X-Session-Token': adminToken });
  assert(confirmTx.body.transaction.status === 'paid', 'l\'admin peut confirmer un paiement Interac');

  const apptAfterPay = await request('GET', '/api/appointments', null, { 'X-Session-Token': aliceToken });
  const linkedAppt = apptAfterPay.body.appointments.find(a => a.id === apptId);
  assert(linkedAppt.status === 'confirmed', 'confirmer le paiement confirme aussi automatiquement le rendez-vous lié');
  assert(!!linkedAppt.confirmationNumber && /^NAW-\d{6}-[A-F0-9]{4}$/.test(linkedAppt.confirmationNumber),
    'WORKFLOW DE CONFIRMATION : un numéro de confirmation au bon format est généré automatiquement');

  // ==================================================================
  // SÉCURITÉ PAIEMENT — un client ne peut jamais s'auto-confirmer
  // (ni la transaction, ni le rendez-vous) sans vérification serveur réelle.
  // ==================================================================
  const bobApptForSecu = await request('POST', '/api/appointments', {
    service: 'Accompagnement 1:1', serviceId: 'accompagnement', date: '2026-09-02', time: '16:00', duration: 60
  }, { 'X-Session-Token': aliceToken });
  assert(bobApptForSecu.status === 200, 'préparation : Alice réserve un créneau pour le test de sécurité paiement');
  const bobApptIdForSecu = bobApptForSecu.body.appointment.id;

  const fakeStripeTx = await request('POST', '/api/transactions', {
    service: 'Accompagnement 1:1', serviceId: 'accompagnement', appointmentId: bobApptIdForSecu,
    amount: 80, total: 80, method: 'stripe', status: 'paid', transactionReference: 'pi_fake_jamais_payé'
  }, { 'X-Session-Token': aliceToken });
  assert(fakeStripeTx.body.transaction.status === 'pending',
    "FAILLE CORRIGÉE : un client ne peut PAS s'auto-déclarer « payé » pour Stripe — le statut reste « pending » jusqu'au webhook réel");

  const fakeConfirm = await request('PUT', `/api/appointments/${bobApptIdForSecu}`, { status: 'confirmed' }, { 'X-Session-Token': aliceToken });
  assert(fakeConfirm.status === 403,
    "FAILLE CORRIGÉE : un client ne peut PAS s'auto-confirmer un rendez-vous directement (seul le paiement vérifié ou l'admin le peuvent)");

  const clientCancelOwn = await request('PUT', `/api/appointments/${bobApptIdForSecu}`, { status: 'cancelled' }, { 'X-Session-Token': aliceToken });
  assert(clientCancelOwn.status === 200, 'un client peut toujours annuler son propre rendez-vous (action légitime)');

  // ---- Idempotence Stripe : le webhook peut créer la transaction avant le client ----
  const idempotentTx1 = await request('POST', '/api/transactions', {
    service: 'Accompagnement 1:1', serviceId: 'accompagnement', amount: 80, total: 80,
    method: 'stripe', transactionReference: 'pi_idempotence_test'
  }, { 'X-Session-Token': aliceToken });
  const idempotentTx2 = await request('POST', '/api/transactions', {
    service: 'Accompagnement 1:1', serviceId: 'accompagnement', amount: 80, total: 80,
    method: 'stripe', transactionReference: 'pi_idempotence_test'
  }, { 'X-Session-Token': aliceToken });
  assert(idempotentTx1.body.transaction.id === idempotentTx2.body.transaction.id,
    'idempotence Stripe : deux créations avec la même référence renvoient la même transaction (pas de doublon)');

  // ==================================================================
  // WORKFLOW ZOOM / GOOGLE CALENDAR — dégradation propre sans identifiants
  // (aucun des deux n'est configuré dans cet environnement de test)
  // ==================================================================
  const { confirmAppointmentPayment } = require('./server/confirmation-workflow');
  const workflowResult = await confirmAppointmentPayment(txId);
  assert(workflowResult.ok, 'confirmAppointmentPayment() réussit même sans Zoom/Google Calendar configurés');
  assert(workflowResult.steps.zoom.skipped === true, 'Zoom non configuré → étape ignorée proprement (skipped), pas d\'erreur qui bloque le reste');
  assert(workflowResult.steps.googleCalendar.skipped === true, 'Google Calendar non configuré/autorisé → étape ignorée proprement');
  assert(workflowResult.steps.clientEmail !== undefined, 'le courriel de confirmation enrichi est tenté malgré tout');

  const zoomService = require('./server/zoom-service');
  const googleCalendarService = require('./server/google-calendar-service');
  assert(zoomService.isConfigured() === false, 'zoom-service détecte correctement son absence de configuration');
  assert(googleCalendarService.isConfigured() === false, 'google-calendar-service détecte correctement son absence de configuration');
  const zoomAttempt = await zoomService.createMeeting({ topic: 'test', startTimeIso: '2026-09-02T10:00:00', durationMinutes: 60 });
  assert(zoomAttempt.ok === false && zoomAttempt.skipped === true, 'createMeeting() sans configuration renvoie un skip propre, ne lève jamais d\'exception');

  // ==================================================================
  // WEBHOOK STRIPE RÉEL — cas où le webhook arrive AVANT que le client
  // n'appelle POST /api/transactions (la vraie source de confiance).
  // ==================================================================
  const apptForWebhook = await request('POST', '/api/appointments', {
    service: 'Soins Énergétiques', serviceId: 'services-energetiques', date: '2026-09-03', time: '10:00', duration: 60
  }, { 'X-Session-Token': aliceToken });
  assert(apptForWebhook.status === 200, 'préparation : Alice réserve un créneau pour le test du webhook direct');

  const fakePaymentIntentId = 'pi_webhook_direct_test';
  const webhookEvent = {
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: fakePaymentIntentId,
        amount: 6000,
        currency: 'cad',
        metadata: {
          clientId: aliceId,
          clientName: 'Alice Tremblay',
          service: 'Soins Énergétiques',
          serviceId: 'services-energetiques',
          appointmentId: apptForWebhook.body.appointment.id,
          amount: '60', tps: '3', tvq: '6', total: '69'
        }
      }
    }
  };
  const webhookRes = await request('POST', '/api/stripe-webhook', webhookEvent, { 'stripe-signature': 'test' });
  assert(webhookRes.status === 200, 'le webhook Stripe répond 200 (aucune transaction préexistante — créée depuis les métadonnées)');
  await new Promise(r => setTimeout(r, 100)); // le traitement du webhook est asynchrone (fire-and-forget), laisser le temps

  const txFromWebhook = await request('GET', '/api/transactions', null, { 'X-Session-Token': adminToken });
  const createdTx = txFromWebhook.body.transactions.find(t => t.transactionReference === fakePaymentIntentId);
  assert(!!createdTx && createdTx.status === 'paid',
    'WEBHOOK COMME SOURCE DE VÉRITÉ : la transaction est créée directement par le webhook (signature vérifiée), avec le statut "paid" dès le départ');

  const apptAfterWebhook = await request('GET', '/api/appointments', null, { 'X-Session-Token': aliceToken });
  const confirmedByWebhook = apptAfterWebhook.body.appointments.find(a => a.id === apptForWebhook.body.appointment.id);
  assert(confirmedByWebhook.status === 'confirmed' && !!confirmedByWebhook.confirmationNumber,
    'le rendez-vous est confirmé avec un numéro de confirmation, entièrement déclenché par le webhook — aucune action du client requise');

  // ---- Idempotence du webhook : Stripe peut renvoyer le même événement plusieurs fois ----
  const webhookRes2 = await request('POST', '/api/stripe-webhook', webhookEvent, { 'stripe-signature': 'test' });
  assert(webhookRes2.status === 200, 'un deuxième envoi du même événement webhook est accepté sans erreur');
  await new Promise(r => setTimeout(r, 100));
  const txAfterDuplicate = await request('GET', '/api/transactions', null, { 'X-Session-Token': adminToken });
  const duplicateCount = txAfterDuplicate.body.transactions.filter(t => t.transactionReference === fakePaymentIntentId).length;
  assert(duplicateCount === 1, 'IDEMPOTENCE WEBHOOK : recevoir deux fois le même événement Stripe ne crée pas deux transactions ni ne relance le workflow deux fois');

  // ==================================================================
  // 5. TÉMOIGNAGES
  // ==================================================================
  const submitTesti = await request('POST', '/api/testimonials', {
    service: 'services-energetiques', text: 'Une expérience vraiment magnifique et transformatrice.', rating: 5
  }, { 'X-Session-Token': aliceToken });
  assert(submitTesti.status === 200 && submitTesti.body.testimonial.status === 'pending', 'la soumission d\'un témoignage fonctionne (en attente)');
  const testiId = submitTesti.body.testimonial.id;

  const publicTestis = await request('GET', '/api/testimonials');
  assert(publicTestis.body.testimonials.length === 0, 'un témoignage en attente n\'est pas visible publiquement');

  const approveTesti = await request('PUT', `/api/admin/testimonials/${testiId}/approve`, null, { 'X-Session-Token': adminToken });
  assert(approveTesti.status === 200, 'l\'admin peut approuver un témoignage');

  const publicTestisAfter = await request('GET', '/api/testimonials');
  assert(publicTestisAfter.body.testimonials.length === 1, 'un témoignage approuvé devient visible publiquement');

  // ==================================================================
  // 6. DISPONIBILITÉS — horaires, créneaux calculés, vacances
  // ==================================================================
  const weeklyHours = await request('GET', '/api/availability/weekly-hours?serviceId=services-energetiques');
  assert(!!weeklyHours.body.weeklyHours['services-energetiques'], 'les horaires par défaut existent pour Soins Énergétiques');

  // 2026-08-10 est un lundi
  const slots = await request('GET', '/api/availability/slots?serviceId=services-energetiques&date=2026-08-10&slotDuration=60');
  assert(slots.body.slots.length > 0, 'des créneaux disponibles sont calculés pour un lundi');
  assert(!slots.body.slots.includes('14:00'), 'le créneau déjà réservé (14:00) est bien exclu des créneaux disponibles');

  const addVacation = await request('POST', '/api/admin/availability/vacations', {
    startDate: '2026-08-10', endDate: '2026-08-15', label: 'Vacances'
  }, { 'X-Session-Token': adminToken });
  assert(addVacation.status === 200, 'l\'ajout d\'une période de vacances fonctionne');

  const slotsAfterVacation = await request('GET', '/api/availability/slots?serviceId=services-energetiques&date=2026-08-10&slotDuration=60');
  assert(slotsAfterVacation.body.slots.length === 0, 'aucun créneau disponible pendant une période de vacances');

  // ==================================================================
  // 7. MOT DE PASSE OUBLIÉ — bout en bout
  // ==================================================================
  const forgotReq = await request('POST', '/api/auth/forgot-password', { email: 'alice@example.com' });
  assert(forgotReq.body.exists === true && !!forgotReq.body.token, 'la demande de réinitialisation génère un jeton');
  const resetToken = forgotReq.body.token;

  const badTokenCheck = await request('POST', '/api/auth/verify-reset-token', { email: 'alice@example.com', token: 'faux-jeton' });
  assert(badTokenCheck.status === 400, 'un faux jeton de réinitialisation est rejeté');

  const goodTokenCheck = await request('POST', '/api/auth/verify-reset-token', { email: 'alice@example.com', token: resetToken });
  assert(goodTokenCheck.status === 200, 'le vrai jeton de réinitialisation est accepté');

  const doReset = await request('POST', '/api/auth/reset-password', { email: 'alice@example.com', token: resetToken, newPassword: 'NouveauMdp1' });
  assert(doReset.status === 200, 'la réinitialisation du mot de passe réussit');

  const loginOldPwd = await request('POST', '/api/auth/login', { email: 'alice@example.com', password: 'MotDePasse1' });
  assert(loginOldPwd.status === 401, 'l\'ancien mot de passe ne fonctionne plus après réinitialisation');

  const loginNewPwd = await request('POST', '/api/auth/login', { email: 'alice@example.com', password: 'NouveauMdp1' });
  assert(loginNewPwd.status === 200, 'le nouveau mot de passe fonctionne réellement');

  const reuseTokenCheck = await request('POST', '/api/auth/verify-reset-token', { email: 'alice@example.com', token: resetToken });
  assert(reuseTokenCheck.status === 400, 'le jeton déjà utilisé est rejeté (usage unique)');

  // ==================================================================
  // 8. MULTI-APPAREIL — LE VRAI TEST QUI COMPTE
  // Simule un client qui réserve depuis un appareil, et l'admin qui
  // consulte depuis un AUTRE appareil (nouvelle "session" HTTP, pas de
  // partage de navigateur/localStorage) — doit fonctionner maintenant.
  // ==================================================================
  const bobRegister = await request('POST', '/api/auth/register', {
    firstName: 'Bob', lastName: 'Gagnon', email: 'bob@example.com', age: 40, password: 'MotDePasse2'
  });
  const bobToken = bobRegister.body.token;

  await request('POST', '/api/appointments', {
    service: 'Accompagnement 1:1', serviceId: 'accompagnement', date: '2026-08-20', time: '10:00', duration: 60
  }, { 'X-Session-Token': bobToken });

  // "Nouvel appareil" pour l'admin = nouvelle connexion indépendante
  const adminLogin2 = await request('POST', '/api/auth/login', { email: 'admin@ntabou-aka-we.fr', password: 'admin1234' });
  const adminAppts2 = await request('GET', '/api/appointments', null, { 'X-Session-Token': adminLogin2.body.token });
  assert(adminAppts2.body.appointments.some(a => a.clientName === 'Bob Gagnon'),
    "LE VRAI PROBLÈME EST RÉSOLU : l'admin voit le rendez-vous de Bob depuis une session complètement séparée");

  // ==================================================================
  // 9. AUDIT RÉSERVATIONS — conflits, chevauchements, blocages, heures
  //    d'ouverture (un seul praticien : le calendrier est partagé entre
  //    TOUS les services, pas cloisonné service par service).
  // ==================================================================
  const carolRegister = await request('POST', '/api/auth/register', {
    firstName: 'Carol', lastName: 'Simard', email: 'carol@example.com', age: 35, password: 'MotDePasse3'
  });
  const carolToken = carolRegister.body.token;

  const bookA = await request('POST', '/api/appointments', {
    service: 'Soins Énergétiques', serviceId: 'services-energetiques', date: '2026-09-02', time: '10:00', duration: 60
  }, { 'X-Session-Token': carolToken });
  assert(bookA.status === 200, 'Carol réserve un premier créneau (Soins Énergétiques, 2026-09-02 10:00)');

  const bookConflictOtherService = await request('POST', '/api/appointments', {
    service: 'Accompagnement 1:1', serviceId: 'accompagnement', date: '2026-09-02', time: '10:00', duration: 60
  }, { 'X-Session-Token': bobToken });
  assert(bookConflictOtherService.status === 409,
    'DOUBLE RÉSERVATION INTER-SERVICES BLOQUÉE : un même créneau ne peut pas être réservé deux fois sur des services différents (un seul praticien)');

  const bookConflictOverlap = await request('POST', '/api/appointments', {
    service: 'Soins Énergétiques', serviceId: 'services-energetiques', date: '2026-09-02', time: '10:30', duration: 30
  }, { 'X-Session-Token': bobToken });
  assert(bookConflictOverlap.status === 409,
    'chevauchement partiel détecté (10:30-11:00 chevauche le rendez-vous de 10:00-11:00 de Carol)');

  const bookNoOverlap = await request('POST', '/api/appointments', {
    service: 'Accompagnement 1:1', serviceId: 'accompagnement', date: '2026-09-02', time: '11:00', duration: 60
  }, { 'X-Session-Token': bobToken });
  assert(bookNoOverlap.status === 200, 'un créneau réellement libre juste après reste réservable normalement');

  // ---- Blocage admin : doit bloquer TOUS les services, pas seulement un pseudo-service ----
  const blockSlot = await request('POST', '/api/admin/appointments', {
    service: 'Bloqué', serviceId: 'blocked', date: '2026-09-02', time: '14:00', duration: 60,
    status: 'confirmed', blocked: true, blockLabel: 'Indisponible'
  }, { 'X-Session-Token': adminToken });
  assert(blockSlot.status === 200, "l'admin bloque un créneau (14:00) dans son agenda");

  const slotsAfterBlock = await request('GET', '/api/availability/slots?serviceId=services-energetiques&date=2026-09-02&slotDuration=60');
  assert(!slotsAfterBlock.body.slots.includes('14:00'),
    "BLOCAGE ADMIN EFFECTIF : le créneau bloqué par l'admin disparaît bien des disponibilités affichées, pour un AUTRE service que celui du blocage");

  const bookIntoBlockedSlot = await request('POST', '/api/appointments', {
    service: 'Accompagnement 1:1', serviceId: 'accompagnement', date: '2026-09-02', time: '14:00', duration: 60
  }, { 'X-Session-Token': bobToken });
  assert(bookIntoBlockedSlot.status === 409, "un client ne peut PAS réserver un créneau bloqué par l'admin, quel que soit le service");

  // ---- Heures d'ouverture ----
  const bookOutsideHours = await request('POST', '/api/appointments', {
    service: 'Soins Énergétiques', serviceId: 'services-energetiques', date: '2026-09-02', time: '06:00', duration: 60
  }, { 'X-Session-Token': bobToken });
  assert(bookOutsideHours.status === 409, "réservation en dehors des heures d'ouverture (06:00) refusée");

  const bookWeekend = await request('POST', '/api/appointments', {
    service: 'Soins Énergétiques', serviceId: 'services-energetiques', date: '2026-09-05', time: '10:00', duration: 60
  }, { 'X-Session-Token': bobToken });
  assert(bookWeekend.status === 409, "réservation le week-end (aucune heure d'ouverture configurée par défaut) refusée");

  // ---- Vacances ----
  const addVacation2 = await request('POST', '/api/admin/availability/vacations', {
    startDate: '2026-10-01', endDate: '2026-10-05', label: 'Vacances test'
  }, { 'X-Session-Token': adminToken });
  assert(addVacation2.status === 200, "l'admin peut ajouter une période de vacances");

  const bookDuringVacation = await request('POST', '/api/appointments', {
    service: 'Soins Énergétiques', serviceId: 'services-energetiques', date: '2026-10-02', time: '10:00', duration: 60
  }, { 'X-Session-Token': bobToken });
  assert(bookDuringVacation.status === 409, 'réservation pendant une période de vacances refusée');

  // ---- Replanification (reschedule) vers un créneau déjà occupé ----
  const rescheduleConflict = await request('PUT', `/api/appointments/${bookNoOverlap.body.appointment.id}`, {
    date: '2026-09-02', time: '10:00'
  }, { 'X-Session-Token': bobToken });
  assert(rescheduleConflict.status === 409, 'REPLANIFICATION VERS UN CRÉNEAU OCCUPÉ BLOQUÉE (chevaucherait le rendez-vous de Carol)');

  const rescheduleOk = await request('PUT', `/api/appointments/${bookNoOverlap.body.appointment.id}`, {
    date: '2026-09-02', time: '15:00'
  }, { 'X-Session-Token': bobToken });
  assert(rescheduleOk.status === 200, 'replanification vers un créneau réellement libre fonctionne');

  // ---- Rendez-vous récurrents : une occurrence en conflit doit être
  //      ignorée individuellement, pas faire échouer toute la série ----
  const rec1 = await request('POST', '/api/admin/appointments', {
    clientId: carolRegister.body.user.id, clientName: 'Carol Simard',
    service: 'Soins Énergétiques', serviceId: 'services-energetiques',
    date: '2026-11-02', time: '09:00', duration: 60, status: 'confirmed'
  }, { 'X-Session-Token': adminToken });
  assert(rec1.status === 200, 'préparation : un rendez-vous existe le 2026-11-02 à 09:00 (fera collision avec la récurrence)');

  const recDates = ['2026-11-02', '2026-11-09', '2026-11-16'];
  let recCreated = 0, recSkipped = 0;
  for (const d of recDates) {
    const r = await request('POST', '/api/admin/appointments', {
      clientId: bobRegister.body.user.id, clientName: 'Bob Gagnon',
      service: 'Accompagnement 1:1', serviceId: 'accompagnement',
      date: d, time: '09:00', duration: 60, status: 'confirmed'
    }, { 'X-Session-Token': adminToken });
    if (r.status === 200) recCreated++; else recSkipped++;
  }
  assert(recCreated === 2 && recSkipped === 1,
    'RÉCURRENCE AVEC CONFLIT : sur 3 occurrences hebdomadaires, la seule qui chevauche un rendez-vous existant (2026-11-02) est ignorée, les 2 autres sont créées');

  // ---- Override admin explicite (force:true) pour un cas exceptionnel ----
  const forceOverride = await request('POST', '/api/admin/appointments', {
    clientId: bobRegister.body.user.id, clientName: 'Bob Gagnon',
    service: 'Accompagnement 1:1', serviceId: 'accompagnement',
    date: '2026-11-02', time: '09:00', duration: 60, status: 'confirmed', force: true
  }, { 'X-Session-Token': adminToken });
  assert(forceOverride.status === 200, "l'admin peut forcer explicitement une exception (force:true) quand c'est délibéré");

  // ==================================================================
  // 10. AUDIT SAUVEGARDES ADMIN — le contenu (services, textes, bio,
  //     templates email, automatisations, paramètres) doit être persisté
  //     en base, pas seulement dans le localStorage du navigateur admin.
  // ==================================================================
  const contentBeforeAnyLogin = await request('GET', '/api/content');
  assert(contentBeforeAnyLogin.status === 200, "GET /api/content répond publiquement, sans authentification");

  const writeWithoutAuth = await request('PUT', '/api/admin/content/po_demo_bio', { value: { hack: true } });
  assert(writeWithoutAuth.status === 401 || writeWithoutAuth.status === 403,
    "un visiteur anonyme ne peut PAS écrire dans le contenu du site");

  const writeAsClient = await request('PUT', '/api/admin/content/po_demo_bio', { value: { hack: true } }, { 'X-Session-Token': bobToken });
  assert(writeAsClient.status === 403, "un client authentifié (non-admin) ne peut PAS écrire dans le contenu du site");

  const bioSave = await request('PUT', '/api/admin/content/po_demo_bio', {
    value: { hero: { title: 'Titre modifié par le test', subtitle: 'Sous-titre test' }, photo: '', sections: [] }
  }, { 'X-Session-Token': adminToken });
  assert(bioSave.status === 200, "l'admin peut sauvegarder le contenu de la page biographie");

  // "Nouvelle connexion" / "appareil séparé" simulée par une requête HTTP
  // indépendante, sans rien partager avec la session qui a fait la sauvegarde.
  const bioFromAnotherRequest = await request('GET', '/api/content/po_demo_bio');
  assert(bioFromAnotherRequest.body.value && bioFromAnotherRequest.body.value.hero.title === 'Titre modifié par le test',
    "PERSISTANCE RÉELLE : le contenu sauvegardé par l'admin est lu depuis une requête complètement séparée (pas seulement le localStorage de l'admin)");

  // ---- Gabarit email personnalisé : doit réellement influencer les vrais courriels envoyés ----
  const emailTemplatesSave = await request('PUT', '/api/admin/content/po_cms_email_templates', {
    value: {
      layout: { signature: 'Pierre-Olivier — Ntabou Aka Wé' },
      templates: {
        registration: {
          label: 'Confirmation d\'inscription', enabled: true,
          subject: 'SUJET PERSONNALISÉ DE TEST',
          body: 'Bonjour {{first_name}}, ceci est un corps de courriel personnalisé de test.'
        }
      }
    }
  }, { 'X-Session-Token': adminToken });
  assert(emailTemplatesSave.status === 200, "l'admin peut sauvegarder un gabarit de courriel personnalisé");

  const { buildEmail } = require('./server/email-templates');
  const builtCustom = buildEmail('registration', { first_name: 'Diane' });
  assert(builtCustom.subject === 'SUJET PERSONNALISÉ DE TEST' && builtCustom.html.includes('corps de courriel personnalisé de test'),
    "GABARIT EMAIL RÉELLEMENT UTILISÉ : le sujet et le corps personnalisés sauvegardés par l'admin sont bien ceux utilisés pour un vrai courriel (pas seulement affichés dans l'aperçu admin)");

  const builtOtherType = buildEmail('appointment_confirmation', { first_name: 'Diane', service: 'Test', appointment_date: '2026-01-01', appointment_time: '10:00' });
  assert(builtOtherType.subject === 'Confirmation de votre rendez-vous',
    "un type de courriel non personnalisé continue d'utiliser le modèle par défaut");

  server.close();
  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
