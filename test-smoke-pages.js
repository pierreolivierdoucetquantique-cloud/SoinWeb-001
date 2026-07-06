const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function smokeTest(pageFile, extraFiles) {
  const html = fs.readFileSync(__dirname + '/' + pageFile, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/' + pageFile });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};

  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.error || e.message));

  const combined = extraFiles.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n');
  // Ajoute les scripts inline de la page elle-même, dans l'ordre où ils apparaissent
  // (reproduit fidèlement l'exécution séquentielle d'un chargement de page réel).
  const inlineScripts = [...dom.window.document.querySelectorAll('script:not([src])')]
    .map(s => s.textContent).join('\n;\n');
  const fullScript = combined + '\n;\n' + inlineScripts;
  try {
    window.eval(fullScript);
  } catch (e) {
    errors.push(e);
  }
  await new Promise(r => setTimeout(r, 40));

  assert(errors.length === 0, `${pageFile} : aucune erreur JS au chargement (scripts: ${extraFiles.join(', ')})`);
  if (errors.length) console.error(errors);
}

async function run() {
  await smokeTest('soins-direct.html', ['auth.js', 'content-store.js', 'pricing.js', 'testimonials-store.js', 'script.js', 'booking-flow.js']);
  await smokeTest('services-energetiques.html', ['auth.js', 'content-store.js', 'pricing.js', 'testimonials-store.js', 'script.js', 'availability-booking.js']);
  await smokeTest('accompagnement.html', ['auth.js', 'content-store.js', 'pricing.js', 'testimonials-store.js', 'script.js', 'availability-booking.js']);
  // profil.html n'a pas été modifié par ces changements : son script inline dépend d'un
  // chargement de page réel par balises <script src> successives, hors de portée de ce
  // harnais de test isolé (jsdom exécute les scripts inline avant que window.eval()
  // n'ait pu injecter PO_Auth). Non pertinent pour la présente vérification de régression.

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
