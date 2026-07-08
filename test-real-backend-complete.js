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
  assert(services.has('services-energetiques') && services.has('soins-direct') && services.has('accompagnement'),
    'les 3 services initiaux ont bien des formules par défaut');
  assert(formulas.body.formulas.length === 7, 'les 7 formules par défaut sont présentes (3+1+3)');

  const sdFormula = formulas.body.formulas.find(f => f.serviceId === 'soins-direct');
  assert(sdFormula.price === 88, 'le prix par défaut de Soins Direct est 88 $');

  const editFormula = await request('PUT', `/api/admin/formulas/${sdFormula.id}`, { price: 95 }, { 'X-Session-Token': adminToken });
  assert(editFormula.status === 200 && editFormula.body.formula.price === 95, 'la modification du prix par un admin fonctionne');

  const noAuthEdit = await request('PUT', `/api/admin/formulas/${sdFormula.id}`, { price: 999 }, { 'X-Session-Token': aliceToken });
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

  server.close();
  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
