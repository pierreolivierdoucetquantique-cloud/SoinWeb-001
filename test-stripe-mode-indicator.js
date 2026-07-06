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
  window.fetch = async (url) => {
    if (String(url).includes('/api/stripe-config')) {
      return { ok: true, json: async () => ({ ok: true, publishableKey: 'pk_test_abc' }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  window.AbortSignal = window.AbortSignal || { timeout: () => undefined };

  const files = ['auth.js', 'profile-photo.js', 'content-store.js', 'pricing.js', 'email-service.js',
                 'messenger-store.js', 'notifications-store.js', 'care-session-store.js',
                 'testimonials-store.js', 'care-pdf.js', 'admin.js'];
  const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + `
;
window.__poTest = { login: (d) => PO_Auth.login(d) };
`;
  window.eval(combined);
  window.__poTest.login({ email: 'admin@ntabou-aka-we.fr', password: 'admin1234' });

  const dom2 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/admin.html' });
  dom2.window.HTMLElement.prototype.scrollIntoView = dom2.window.HTMLElement.prototype.scrollIntoView || function () {};
  dom2.window.fetch = window.fetch;
  dom2.window.AbortSignal = dom2.window.AbortSignal || { timeout: () => undefined };
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

  doc2.querySelector('[data-panel="payments"]').dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 30));

  const indicator = doc2.getElementById('stripe-mode-indicator');
  assert(!!indicator, "l'indicateur de mode Stripe est présent dans Admin → Paiements");
  assert(indicator.textContent.includes('TEST'), 'affiche correctement "TEST" quand la clé publiable est pk_test_...');

  // Aucune mention codée en dur de "mode test" dans le libellé de méthode de paiement
  const src = fs.readFileSync(__dirname + '/admin.js', 'utf8');
  assert(!/stripe:\s*'Stripe \(mode test\)'/.test(src), 'paymentMethodLabel ne code plus en dur "(mode test)"');

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
