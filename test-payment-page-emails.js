const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function run() {
  const html = fs.readFileSync(__dirname + '/paiement-rdv.html', 'utf8');

  // ---- Prépare un utilisateur + une réservation en attente de paiement ----
  const setupDom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://example.test/setup.html' });
  const w0 = setupDom.window;
  w0.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  w0.AbortSignal = { timeout: () => undefined };
  const authCode = fs.readFileSync(__dirname + '/auth.js', 'utf8').replace('const PO_Auth', 'window.PO_Auth');
  w0.eval(authCode);
  const acc = w0.PO_Auth.createAccount({ firstName: 'Chris', lastName: 'Roy', email: 'chris@example.com', age: 28, password: 'Password1' });
  const { appointment } = w0.PO_Auth.createAppointment({
    clientId: acc.user.id, clientName: 'Chris Roy', service: 'Soins Énergétiques', serviceId: 'services-energetiques',
    date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), time: '09:00', duration: 60,
    status: 'awaiting_confirmation', source: 'client'
  });

  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/paiement-rdv.html' });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};
  const emailCalls = [];
  window.fetch = async (url, opts) => {
    if (String(url).includes('/api/send-email')) {
      emailCalls.push(JSON.parse(opts.body));
      return { ok: true, json: async () => ({ ok: true, id: 'x' }) };
    }
    if (String(url).includes('/api/stripe-config')) {
      return { ok: true, json: async () => ({ ok: false, error: 'non configuré (test)' }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  window.AbortSignal = window.AbortSignal || { timeout: () => undefined };
  window.Stripe = undefined; // Stripe.js absent en test — le panneau carte n'est pas testé ici

  for (let i = 0; i < w0.localStorage.length; i++) {
    const k = w0.localStorage.key(i);
    window.localStorage.setItem(k, w0.localStorage.getItem(k));
  }
  for (let i = 0; i < w0.sessionStorage.length; i++) {
    const k = w0.sessionStorage.key(i);
    window.sessionStorage.setItem(k, w0.sessionStorage.getItem(k));
  }
  window.sessionStorage.setItem('po_pending_payment', JSON.stringify({
    appointmentId: appointment.id, serviceId: 'services-energetiques', serviceLabel: 'Soins Énergétiques',
    formulaId: '', formulaLabel: '', formulaDuration: '', formulaPrice: '88,00 $ CAD',
    date: appointment.date, time: appointment.time, duration: appointment.duration,
    clientId: acc.user.id, clientName: 'Chris Roy', clientEmail: 'chris@example.com'
  }));

  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
  const files = ['auth.js', 'content-store.js', 'pricing.js', 'notifications-store.js', 'email-service.js', 'script.js', 'stripe-payment.js'];
  const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + '\n;\n' + inlineScript;
  window.eval(combined);
  await new Promise(r => setTimeout(r, 40));

  const doc = window.document;
  const interacBtn = doc.getElementById('btn-interac-sent');
  assert(!!interacBtn, 'le bouton de confirmation Interac est présent sur la page de paiement');

  interacBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 30));

  const interacCall = emailCalls.find(c => c.type === 'payment_interac');
  assert(!!interacCall, 'le signalement d\'un virement Interac envoie un vrai courriel (payment_interac)');
  assert(interacCall && interacCall.to === 'chris@example.com', 'le courriel Interac est envoyé au bon client');

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error('ERROR:', e && e.name, e && e.message, e && e.stack); process.exit(1); });
