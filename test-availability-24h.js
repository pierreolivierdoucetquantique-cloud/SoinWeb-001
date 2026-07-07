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
window.__poTest = { login: (d) => PO_Auth.login(d) };
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

  // ---- Ouvre Calendrier -> sous-onglet "Disponibilités & vacances" ----
  doc2.querySelector('[data-panel="calendar"]')?.dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 10));
  doc2.getElementById('calsub-tab-availability').dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 10));

  const grid = doc2.getElementById('weekly-hours-grid');
  assert(!!grid && grid.innerHTML.trim() !== '', 'la grille des horaires hebdomadaires est bien rendue');

  const timeInputs = grid.querySelectorAll('input');
  assert(timeInputs.length > 0, 'des champs horaires sont présents dans la grille');
  timeInputs.forEach(inp => {
    assert(inp.getAttribute('type') !== 'time', `un champ horaire (valeur "${inp.value}") n'est plus un <input type="time"> natif`);
    assert(inp.classList.contains('po-time-input'), 'le champ horaire porte la classe de saisie 24h contrôlée');
  });

  // ---- Vérifie qu'aucun input type="time" ne subsiste dans le HTML source ----
  const rawHtml = fs.readFileSync(__dirname + '/admin.html', 'utf8');
  assert(!/type="time"/.test(rawHtml), 'plus aucun <input type="time"> natif dans admin.html');
  const rawJs = fs.readFileSync(__dirname + '/admin.js', 'utf8');
  assert(!/<input type="time"[^>]*value=/.test(rawJs), 'plus aucun <input type="time"> généré dynamiquement (avec valeur) dans admin.js');

  // ---- La saisie 24h fonctionne sur un champ de la grille (auto-formatage, pas d'AM/PM) ----
  const firstInput = timeInputs[0];
  firstInput.value = '1745';
  firstInput.dispatchEvent(new dom2.window.Event('input', { bubbles: true }));
  assert(firstInput.value === '17:45', "la saisie '1745' est reformatée en '17:45' dans la grille hebdomadaire");

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
