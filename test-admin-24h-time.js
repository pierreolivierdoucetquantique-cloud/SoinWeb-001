const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function run() {
  let html = fs.readFileSync(__dirname + '/admin.html', 'utf8');
  // Retire le <script> CDN externe (jsPDF) : inutile pour ce test et non joignable
  // dans cet environnement d'exécution isolé.
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

  // Connexion admin AVANT le rendu de admin.js (garde d'accès basée sur la session)
  window.eval(combined);
  const loginResult = window.__poTest.login({ email: 'admin@ntabou-aka-we.fr', password: 'admin1234' });
  assert(loginResult.ok, 'connexion admin réussie (compte de démo auto-créé)');

  // Recharge la page (nouvelle instance) une fois la session admin active, pour
  // que la garde d'accès de admin.js laisse passer et construise l'interface.
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

  // ---- Les champs horaires ne sont plus des <input type="time"> (jamais d'AM/PM natif) ----
  const apptTime = doc2.getElementById('appt-time');
  const blockTime = doc2.getElementById('block-time');
  assert(apptTime.getAttribute('type') !== 'time', "le champ heure du rendez-vous n'est pas un input natif type=time");
  assert(blockTime.getAttribute('type') !== 'time', "le champ heure de blocage n'est pas un input natif type=time");
  assert(apptTime.classList.contains('po-time-input'), 'le champ heure du rendez-vous porte la classe de saisie 24h');

  function fire(el, value) {
    el.value = value;
    el.dispatchEvent(new dom2.window.Event('input', { bubbles: true }));
  }
  function blur(el) {
    el.dispatchEvent(new dom2.window.Event('blur', { bubbles: true }));
  }

  // ---- Saisie normale ----
  fire(apptTime, '1330');
  assert(apptTime.value === '13:30', "la saisie '1330' est reformatée automatiquement en '13:30'");

  // ---- Lettres ignorées (aucune notion AM/PM ne peut être saisie) ----
  fire(apptTime, '13h3O'); // lettres + O au lieu de 0
  assert(/^[0-9:]*$/.test(apptTime.value), 'aucune lettre (donc aucun A/P/M) ne peut apparaître dans le champ');

  // ---- Heure hors bornes clampée à 23 ----
  fire(apptTime, '2560');
  blur(apptTime);
  assert(apptTime.value === '23:59' || (apptTime.value.startsWith('23:') && Number(apptTime.value.split(':')[1]) <= 59),
    'heure/minute hors bornes ramenées dans la plage 00:00–23:59');

  // ---- Complétion au blur ----
  fire(apptTime, '8');
  blur(apptTime);
  assert(apptTime.value === '08:00', "une saisie partielle '8' est complétée en '08:00' au blur");

  // ---- Pré-remplissage programmatique (édition d'un rendez-vous existant) reste au format HH:mm ----
  apptTime.value = '18:45';
  assert(apptTime.value === '18:45', 'la valeur HH:mm assignée programmatiquement est conservée telle quelle');

  // ---- Aucune trace de logique AM/PM dans le HTML livré ----
  const rawHtml = fs.readFileSync(__dirname + '/admin.html', 'utf8');
  assert(!/type="time"/.test(rawHtml), "plus aucun <input type=\"time\"> natif dans admin.html");

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
