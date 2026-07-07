const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function run() {
  const html = fs.readFileSync(__dirname + '/services-energetiques.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/services-energetiques.html' });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};

  const files = ['auth.js', 'content-store.js', 'pricing.js', 'testimonials-store.js', 'script.js', 'availability-booking.js'];
  const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + `
;
window.__poTest = {
  createAccount: (d) => PO_Auth.createAccount(d)
};
`;
  window.eval(combined);
  await new Promise(r => setTimeout(r, 30));

  // ---- Connecte un client (le bouton CTA principal n'intercepte le clic que si connecté) ----
  window.__poTest.createAccount({ firstName: 'Denise', lastName: 'Roy', email: 'denise@example.com', age: 35, password: 'Password1' });

  const doc = window.document;
  const ctaBtn = doc.getElementById('cta-button');
  assert(!!ctaBtn, 'le bouton CTA principal existe sur la page Soins Énergétiques');

  ctaBtn.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 20));

  // ---- Le libellé affiché dans le calendrier de réservation ne doit plus afficher 0,00 $ ----
  const formulaLabel = doc.getElementById('cal-booking-formula');
  assert(!!formulaLabel, 'le libellé de la formule sélectionnée est affiché');
  assert(!/(^|\s)0,00\s\$/.test(formulaLabel.textContent), 'le prix affiché après un clic sur le bouton principal n\'est plus 0,00 $ (bug corrigé)');
  assert(formulaLabel.textContent.includes('60,00'), 'le prix de la première formule disponible (60,00 $) est bien utilisé par défaut');

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
