const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function run() {
  const html = fs.readFileSync(__dirname + '/paiement-rdv.html', 'utf8');

  const setupDom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://example.test/setup.html' });
  const w0 = setupDom.window;
  w0.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  w0.AbortSignal = { timeout: () => undefined };
  const authCode = fs.readFileSync(__dirname + '/auth.js', 'utf8').replace('const PO_Auth', 'window.PO_Auth');
  w0.eval(authCode);
  const acc = w0.PO_Auth.createAccount({ firstName: 'Eve', lastName: 'Martin', email: 'eve@example.com', age: 33, password: 'Password1' });
  const { appointment } = w0.PO_Auth.createAppointment({
    clientId: acc.user.id, clientName: 'Eve Martin', service: 'Soins Énergétiques', serviceId: 'services-energetiques',
    date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), time: '09:00', duration: 60,
    status: 'awaiting_confirmation', source: 'client'
  });

  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/paiement-rdv.html' });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};
  window.fetch = async (url) => {
    if (String(url).includes('/api/stripe-config')) return { ok: true, json: async () => ({ ok: false, error: 'non configuré (test)' }) };
    return { ok: true, json: async () => ({ ok: true }) };
  };
  window.AbortSignal = window.AbortSignal || { timeout: () => undefined };
  window.Stripe = undefined;

  for (let i = 0; i < w0.localStorage.length; i++) {
    const k = w0.localStorage.key(i);
    window.localStorage.setItem(k, w0.localStorage.getItem(k));
  }
  for (let i = 0; i < w0.sessionStorage.length; i++) {
    const k = w0.sessionStorage.key(i);
    window.sessionStorage.setItem(k, w0.sessionStorage.getItem(k));
  }
  // Reproduit exactement le bug rapporté : aucun formulaId ni formulaPrice
  // transmis (comme lorsque la réservation partait du bouton CTA principal
  // avant correctif).
  window.sessionStorage.setItem('po_pending_payment', JSON.stringify({
    appointmentId: appointment.id, serviceId: 'services-energetiques', serviceLabel: 'Soins Énergétiques',
    formulaId: '', formulaLabel: '', formulaDuration: '', formulaPrice: '',
    date: appointment.date, time: appointment.time, duration: appointment.duration,
    clientId: acc.user.id, clientName: 'Eve Martin', clientEmail: 'eve@example.com'
  }));

  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
  const files = ['auth.js', 'content-store.js', 'pricing.js', 'notifications-store.js', 'email-service.js', 'script.js', 'stripe-payment.js'];
  const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + '\n;\n' + inlineScript + `
;
window.__poTest2 = { listTransactions: () => PO_Auth.listTransactions() };
`;
  window.eval(combined);
  await new Promise(r => setTimeout(r, 40));

  const doc = window.document;
  assert(doc.getElementById('ps-total').textContent.includes('0,00'), 'scénario de test : le prix est bien à 0,00 $ (formule non transmise)');

  const notice = doc.getElementById('pay-general-notice');
  assert(notice.textContent.includes('n\'a pas pu être déterminé'), 'un message clair explique que le prix est indéterminé');

  const methodsPanel = doc.querySelector('.pay-methods');
  assert(methodsPanel.style.display === 'none', 'les méthodes de paiement sont masquées quand le prix est indéterminé (blocage)');

  // Même si un bouton était malgré tout cliqué (ex. via manipulation DOM), rien ne doit se produire.
  const interacBtn = doc.getElementById('btn-interac-sent');
  interacBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));
  const pending = window.__poTest2.listTransactions();
  assert(pending.length === 0, 'aucune transaction n\'est créée même si le bouton Interac est déclenché manuellement (garde défensive)');

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
