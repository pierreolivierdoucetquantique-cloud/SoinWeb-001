const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function run() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="card-mount"></div></body></html>', { runScripts: 'dangerously' });
  const { window } = dom;

  // ---- Faux Stripe.js (reproduit l'API minimale utilisée par stripe-payment.js) ----
  const confirmCardPaymentCalls = [];
  window.Stripe = function (publishableKey) {
    return {
      _publishableKey: publishableKey,
      elements: () => ({
        create: (type, opts) => ({
          _type: type,
          _opts: opts,
          mount: (selector) => { window.__mountedSelector = selector; }
        })
      }),
      confirmCardPayment: async (clientSecret, args) => {
        confirmCardPaymentCalls.push({ clientSecret, args });
        if (clientSecret === 'cs_fail_secret') {
          return { error: { message: 'Votre carte a été refusée.' } };
        }
        return { paymentIntent: { id: 'pi_test_123', status: 'succeeded' } };
      }
    };
  };

  // ---- Faux fetch (reproduit les réponses du serveur Stripe) ----
  let nextConfigResponse = { ok: true, publishableKey: 'pk_test_abc123' };
  let nextIntentResponse = { ok: true, clientSecret: 'cs_ok_secret', id: 'pi_test_123' };
  window.fetch = async (url, opts) => {
    if (String(url).includes('/api/stripe-config')) {
      return { ok: true, json: async () => nextConfigResponse };
    }
    if (String(url).includes('/api/create-payment-intent')) {
      return { ok: true, json: async () => nextIntentResponse };
    }
    throw new Error('URL inattendue: ' + url);
  };
  window.AbortSignal = window.AbortSignal || { timeout: () => undefined };

  const code = fs.readFileSync(__dirname + '/stripe-payment.js', 'utf8')
    .replace('const PO_StripePayment', 'window.PO_StripePayment');
  window.eval(code);

  // ---- 1. init() réussit et lit la clé publiable depuis le serveur ----
  const initResult = await window.PO_StripePayment.init();
  assert(initResult.ok, "init() réussit quand le serveur répond avec une clé publiable");

  // ---- 2. mountCardElement() monte le champ carte ----
  const mountResult = window.PO_StripePayment.mountCardElement('card-mount');
  assert(mountResult.ok, 'mountCardElement() réussit après init()');
  assert(window.__mountedSelector === '#card-mount', 'le Card Element est monté sur le bon conteneur');
  assert(window.PO_StripePayment.isReady(), 'isReady() est vrai une fois initialisé et monté');

  // ---- 3. pay() réussi : crée le PaymentIntent puis confirme avec Stripe ----
  const payResult = await window.PO_StripePayment.pay({
    amount: 88, currency: 'cad', cardholderName: 'Alice Tremblay',
    metadata: { appointmentId: 'appt_1' }
  });
  assert(payResult.ok, 'pay() réussit quand le PaymentIntent est créé et confirmé avec succès');
  assert(payResult.paymentIntent.id === 'pi_test_123', "l'id du PaymentIntent retourné est correct");
  assert(confirmCardPaymentCalls.length === 1, 'confirmCardPayment a été appelé exactement une fois');
  assert(confirmCardPaymentCalls[0].args.payment_method.billing_details.name === 'Alice Tremblay',
    'le nom du titulaire de la carte est transmis à Stripe');

  // ---- 4. pay() échoue proprement si Stripe refuse la carte ----
  nextIntentResponse = { ok: true, clientSecret: 'cs_fail_secret', id: 'pi_test_456' };
  const payFail = await window.PO_StripePayment.pay({ amount: 50, currency: 'cad', cardholderName: 'Bob' });
  assert(!payFail.ok, 'pay() échoue si Stripe retourne une erreur de carte');
  assert(payFail.error === 'Votre carte a été refusée.', "le message d'erreur Stripe est bien remonté");

  // ---- 5. pay() échoue proprement si le serveur ne peut pas créer le PaymentIntent ----
  nextIntentResponse = { ok: false, error: 'Montant invalide.' };
  const payServerFail = await window.PO_StripePayment.pay({ amount: 12, currency: 'cad' });
  assert(!payServerFail.ok, 'pay() échoue si le serveur refuse de créer le PaymentIntent');
  assert(payServerFail.error === 'Montant invalide.', "le message d'erreur serveur est bien remonté");

  // ---- 6. Aucune donnée de carte ni clé secrète ne transite par ce module ----
  const src = fs.readFileSync(__dirname + '/stripe-payment.js', 'utf8');
  assert(!/sk_test|sk_live|STRIPE_SECRET/.test(src), 'aucune clé secrète Stripe ne figure dans le code frontend');

  // ---- 7. isTestMode() détecte correctement le mode à partir de la clé ----
  assert(window.PO_StripePayment.isTestMode() === true, 'isTestMode() retourne true avec une clé pk_test_...');

  // Simule un second module initialisé avec une clé Live pour vérifier la détection inverse
  const dom2 = new JSDOM('<!DOCTYPE html><html><body><div id="card-mount"></div></body></html>', { runScripts: 'dangerously' });
  dom2.window.Stripe = window.Stripe;
  dom2.window.AbortSignal = dom2.window.AbortSignal || { timeout: () => undefined };
  dom2.window.fetch = async (url) => {
    if (String(url).includes('/api/stripe-config')) {
      return { ok: true, json: async () => ({ ok: true, publishableKey: 'pk_live_xyz789' }) };
    }
    throw new Error('unexpected ' + url);
  };
  const code2 = fs.readFileSync(__dirname + '/stripe-payment.js', 'utf8')
    .replace('const PO_StripePayment', 'window.PO_StripePayment');
  dom2.window.eval(code2);
  await dom2.window.PO_StripePayment.init();
  assert(dom2.window.PO_StripePayment.isTestMode() === false, 'isTestMode() retourne false avec une clé pk_live_...');

  // ---- 8. Aucune mention de "mode test" codée en dur dans le code du module ----
  const srcCheck = fs.readFileSync(__dirname + '/stripe-payment.js', 'utf8');
  assert(!/Mode test Stripe|mode test —/.test(srcCheck), 'aucun texte "mode test" codé en dur affiché à l\'utilisateur dans stripe-payment.js');

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
