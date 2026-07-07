const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function run() {
  // Supprime la formule Soins Direct AVANT le chargement de la page, pour
  // reproduire le cas limite (aucune formule disponible pour ce service).
  const setupDom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://example.test/setup.html' });
  const w0 = setupDom.window;
  const contentCode = fs.readFileSync(__dirname + '/content-store.js', 'utf8').replace('const PO_Content', 'window.PO_Content');
  w0.eval(contentCode);
  const formulas = w0.PO_Content.listFormulasForService('soins-direct');
  formulas.forEach(f => w0.PO_Content.deleteFormula(f.id));

  const authCode = fs.readFileSync(__dirname + '/auth.js', 'utf8').replace('const PO_Auth', 'window.PO_Auth');
  w0.eval(authCode);
  w0.PO_Auth.createAccount({ firstName: 'Farid', lastName: 'Haidari', email: 'farid@example.com', age: 29, password: 'Password1' });

  const html = fs.readFileSync(__dirname + '/soins-direct.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/soins-direct.html' });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};
  window.fetch = async (url) => {
    if (String(url).includes('/api/stripe-config')) return { ok: true, json: async () => ({ ok: false, error: 'non configuré (test)' }) };
    return { ok: true, json: async () => ({ ok: true }) };
  };
  window.AbortSignal = window.AbortSignal || { timeout: () => undefined };
  window.Stripe = undefined;
  window.confirm = () => true;

  for (let i = 0; i < w0.localStorage.length; i++) {
    const k = w0.localStorage.key(i);
    window.localStorage.setItem(k, w0.localStorage.getItem(k));
  }
  for (let i = 0; i < w0.sessionStorage.length; i++) {
    const k = w0.sessionStorage.key(i);
    window.sessionStorage.setItem(k, w0.sessionStorage.getItem(k));
  }

  const files = ['auth.js', 'content-store.js', 'pricing.js', 'script.js', 'stripe-payment.js', 'booking-flow.js'];
  const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + `
;
window.__poTest = { listTransactions: () => PO_Auth.listTransactions() };
`;
  window.eval(combined);
  await new Promise(r => setTimeout(r, 40));
  const doc = window.document;

  // ---- Ouvre le parcours de paiement Soin Direct (bouton principal de la page) ----
  const ctaBtn = doc.getElementById('bf-main-cta');
  assert(!!ctaBtn, 'le bouton de réservation Soin Direct existe');
  ctaBtn.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 20));

  // ---- Tente un paiement Interac malgré l'absence de prix ----
  const interacBtn = doc.getElementById('bf-interac-confirm');
  if (interacBtn) {
    interacBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 20));
    const txs = window.__poTest.listTransactions();
    assert(txs.length === 0, 'aucune transaction Interac créée quand le prix Soin Direct est indéterminé (garde active)');
  } else {
    fail++; console.error('FAIL: le bouton Interac du parcours Soin Direct est introuvable');
  }

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
