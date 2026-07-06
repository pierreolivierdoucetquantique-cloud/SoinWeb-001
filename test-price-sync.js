const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function run() {
  let html = fs.readFileSync(__dirname + '/admin.html', 'utf8');
  html = html.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com[^"]*"><\/script>\s*/, '');

  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/admin.html' });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};

  const files = ['auth.js', 'profile-photo.js', 'content-store.js', 'pricing.js', 'email-service.js',
                 'messenger-store.js', 'notifications-store.js', 'care-session-store.js',
                 'testimonials-store.js', 'care-pdf.js', 'admin.js'];
  const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + `
;
window.__poTest = {
  login: (d) => PO_Auth.login(d),
  listFormulasForService: (s) => PO_Content.listFormulasForService(s),
  saveFormula: (f) => PO_Content.saveFormula(f)
};
`;
  window.eval(combined);
  window.__poTest.login({ email: 'admin@ntabou-aka-we.fr', password: 'admin1234' });

  const dom2 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/admin.html' });
  dom2.window.HTMLElement.prototype.scrollIntoView = dom2.window.HTMLElement.prototype.scrollIntoView || function () {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    dom2.window.localStorage.setItem(k, window.localStorage.getItem(k));
  }
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i);
    dom2.window.sessionStorage.setItem(k, window.sessionStorage.getItem(k));
  }
  dom2.window.eval(combined);
  await new Promise(r => setTimeout(r, 30));
  const doc2 = dom2.window.document;

  // ---- Ouvre le panneau Soin Interactif ----
  doc2.querySelector('[data-panel="care"]').dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 10));

  const priceField = doc2.getElementById('care-cfg-price');
  assert(priceField.hasAttribute('readonly'), 'le champ prix du Soin Interactif est en lecture seule');
  assert(priceField.value.includes('88'), "le prix affiché (88 $ CAD par défaut) provient bien de la formule Tarifs 'soins-direct'");

  // ---- L'admin change le tarif "Soin Direct" dans le module Tarifs ----
  const formulas = dom2.window.__poTest.listFormulasForService('soins-direct');
  dom2.window.__poTest.saveFormula({ id: formulas[0].id, price: 120 });
  await new Promise(r => setTimeout(r, 10));

  // ---- Le champ dérivé du Soin Interactif se met à jour automatiquement ----
  assert(priceField.value.includes('120'), 'le prix du Soin Interactif se met à jour automatiquement (single source of truth)');
  assert(!priceField.value.includes('88'), "l'ancien prix (88) n'apparaît plus après la mise à jour");

  // ---- Aucun prix codé en dur (88) ne subsiste dans le code source ----
  const bookingFlowSrc = fs.readFileSync(__dirname + '/booking-flow.js', 'utf8');
  const careStoreSrc = fs.readFileSync(__dirname + '/care-session-store.js', 'utf8');
  assert(!/price:\s*88\b/.test(bookingFlowSrc), 'booking-flow.js ne contient plus de prix par défaut codé en dur (88)');
  assert(!/price:\s*88\b/.test(careStoreSrc), "care-session-store.js ne stocke plus de prix indépendant (88) dans sa config");

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
