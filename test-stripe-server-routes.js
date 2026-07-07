// Test des routes server-stripe/stripe-routes.js avec un faux module "stripe"
// (aucun accès réseau requis — voir node_modules/stripe-stub).
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';

// Redirige require('stripe') vers notre faux module pour ce test uniquement.
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'stripe') {
    return originalResolve.call(this, 'stripe-stub', ...args);
  }
  return originalResolve.call(this, request, ...args);
};

const express = require('express');
const http = require('http');
const { registerStripeRoutes } = require('./server-stripe/stripe-routes');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

function startServer(onPaymentSucceeded, onPaymentFailed) {
  const app = express();
  registerStripeRoutes(app, { onPaymentSucceeded, onPaymentFailed });
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve(server));
  });
}

function request(server, method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const req = http.request({
      host: 'localhost', port, path, method,
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
  let succeededEvents = [];
  let failedEvents = [];
  const server = await startServer(
    (pi) => succeededEvents.push(pi),
    (pi) => failedEvents.push(pi)
  );

  // ---- GET /api/stripe-config : expose uniquement la clé publiable ----
  const configRes = await request(server, 'GET', '/api/stripe-config');
  assert(configRes.status === 200, '/api/stripe-config répond 200');
  assert(configRes.body.publishableKey === 'pk_test_fake', 'la clé publiable est bien retournée');
  assert(JSON.stringify(configRes.body).indexOf('sk_test') === -1, 'la clé secrète ne fuite jamais vers le frontend');

  // ---- POST /api/create-payment-intent : montant valide ----
  const intentRes = await request(server, 'POST', '/api/create-payment-intent', {
    amount: 88, currency: 'cad', metadata: { appointmentId: 'appt_1' }
  });
  assert(intentRes.status === 200 && intentRes.body.ok, 'create-payment-intent réussit avec un montant valide');
  assert(intentRes.body.clientSecret === 'cs_fake_8800', 'le montant est converti en cents (88$ -> 8800)');

  // ---- POST /api/create-payment-intent : montant invalide ----
  const badIntentRes = await request(server, 'POST', '/api/create-payment-intent', { amount: 0 });
  assert(badIntentRes.status === 400 && !badIntentRes.body.ok, 'create-payment-intent rejette un montant à 0');
  const negIntentRes = await request(server, 'POST', '/api/create-payment-intent', { amount: -5 });
  assert(negIntentRes.status === 400 && !negIntentRes.body.ok, 'create-payment-intent rejette un montant négatif');

  // ---- POST /api/stripe-webhook : signature invalide rejetée ----
  const fakeEvent = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_1', amount: 8800, currency: 'cad', metadata: {} } } });
  const badSigRes = await request(server, 'POST', '/api/stripe-webhook', fakeEvent, { 'stripe-signature': 'invalid-signature' });
  assert(badSigRes.status === 400, 'le webhook rejette une signature invalide (400)');
  assert(succeededEvents.length === 0, "aucun callback n'est déclenché sur signature invalide");

  // ---- POST /api/stripe-webhook : signature valide -> callback déclenché ----
  const goodSigRes = await request(server, 'POST', '/api/stripe-webhook', fakeEvent, { 'stripe-signature': 'valid-signature' });
  assert(goodSigRes.status === 200, 'le webhook accepte une signature valide (200)');
  assert(succeededEvents.length === 1 && succeededEvents[0].id === 'pi_1', 'onPaymentSucceeded est appelé avec le bon PaymentIntent');

  // ---- POST /api/stripe-webhook : événement payment_intent.payment_failed ----
  const failedEvent = JSON.stringify({ type: 'payment_intent.payment_failed', data: { object: { id: 'pi_2', last_payment_error: { message: 'Carte refusée' } } } });
  await request(server, 'POST', '/api/stripe-webhook', failedEvent, { 'stripe-signature': 'valid-signature' });
  assert(failedEvents.length === 1 && failedEvents[0].id === 'pi_2', 'onPaymentFailed est appelé pour un paiement échoué');

  server.close();
  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
