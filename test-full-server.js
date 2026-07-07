// Test du serveur complet (server/server.js) : santé, envoi d'email (Resend
// simulé), et routes Stripe (module stripe simulé, aucun accès réseau réel).
process.env.RESEND_API_KEY = 'test_resend_key';
process.env.FROM_EMAIL = 'Ntabou Aka Wé <test@example.com>';
process.env.ALLOWED_ORIGINS = 'https://example.test';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
process.env.PORT = '5099';

const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'stripe') return originalResolve.call(this, 'stripe-stub', ...args);
  return originalResolve.call(this, request, ...args);
};

const resendCalls = [];
const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  if (String(url).includes('api.resend.com')) {
    const body = JSON.parse(opts.body);
    resendCalls.push(body);
    if (body.to === 'fail@example.com') {
      return { ok: false, status: 422, json: async () => ({ message: 'Adresse invalide (simulation)' }) };
    }
    return { ok: true, json: async () => ({ id: 'resend_fake_' + resendCalls.length }) };
  }
  return realFetch(url, opts);
};

const http = require('http');
let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const req = http.request({
      host: 'localhost', port: 5099, path, method,
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
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  require('./server/server.js');
  await new Promise(r => setTimeout(r, 200)); // laisse le temps au serveur de démarrer

  // ---- Santé ----
  const health = await request('GET', '/api/health');
  assert(health.status === 200 && health.body.ok, '/api/health répond 200 ok');
  assert(health.body.resendConfigured === true, 'resendConfigured est vrai (clé présente)');

  // ---- CORS ----
  const corsRes = await request('GET', '/api/health', null, { Origin: 'https://example.test' });
  assert(corsRes.headers['access-control-allow-origin'] === 'https://example.test', 'CORS autorise le domaine listé dans ALLOWED_ORIGINS');

  // ---- Envoi d'email réel (confirmation de rendez-vous) ----
  const sendRes = await request('POST', '/api/send-email', {
    type: 'appointment_confirmation', to: 'alice@example.com',
    vars: { first_name: 'Alice', service: 'Soins Énergétiques', appointment_date: '10 juillet 2026', appointment_time: '14:00', duration: 60 }
  });
  assert(sendRes.status === 200 && sendRes.body.ok, "l'envoi d'un email de confirmation réussit");
  assert(resendCalls.length === 1, 'un vrai appel à l\'API Resend a été effectué');
  assert(resendCalls[0].to === 'alice@example.com', 'le destinataire est correct');
  assert(resendCalls[0].subject.includes('Confirmation'), 'le sujet du modèle de confirmation est utilisé');
  assert(resendCalls[0].html.includes('Alice'), 'le prénom du client est bien injecté dans le contenu');

  // ---- Paramètres manquants ----
  const missingRes = await request('POST', '/api/send-email', { to: 'alice@example.com' });
  assert(missingRes.status === 400, "l'envoi sans 'type' est rejeté (400)");

  // ---- Échec Resend propagé proprement ----
  const failRes = await request('POST', '/api/send-email', {
    type: 'registration', to: 'fail@example.com', vars: { first_name: 'Bob', last_name: 'X' }
  });
  assert(failRes.status === 500 && !failRes.body.ok, 'une erreur Resend est proprement renvoyée au frontend');

  // ---- Email de test ----
  const testRes = await request('POST', '/api/test-email', {});
  assert(testRes.status === 200 && testRes.body.ok, "l'email de test réussit");

  // ---- Stripe : config publique ----
  const configRes = await request('GET', '/api/stripe-config');
  assert(configRes.body.publishableKey === 'pk_test_fake', 'la config Stripe expose la bonne clé publiable');

  // ---- Stripe : création de PaymentIntent ----
  const intentRes = await request('POST', '/api/create-payment-intent', { amount: 88, currency: 'cad' });
  assert(intentRes.status === 200 && intentRes.body.ok, 'la création de PaymentIntent fonctionne toujours après intégration au serveur complet');

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
