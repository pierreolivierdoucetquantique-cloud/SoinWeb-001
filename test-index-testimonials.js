const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function run() {
  const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/index.html' });
  const { window } = dom;

  // Concatène les scripts locaux (même ordre que dans index.html) pour reproduire
  // la portée globale partagée d'un chargement classique par balises <script>.
  const files = ['auth.js', 'content-store.js', 'pricing.js', 'testimonials-store.js', 'script.js'];
  const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + `
;
// Hooks de test : exposés en propriétés window (contrairement aux \`const\` de
// haut niveau, les affectations de propriété survivent aux appels eval() séparés
// dans l'environnement jsdom utilisé pour ces tests).
window.__poTest = {
  createAccount: (data) => PO_Auth.createAccount(data),
  listPending: () => PO_Testimonials.listPending(),
  approve: (id) => PO_Testimonials.adminApprove(id)
};
`;

  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};
  window.eval(combined); // les listeners s'attachent avant le DOMContentLoaded auto-déclenché par jsdom
  await new Promise(r => setTimeout(r, 30));

  const doc = window.document;

  // ---- La section témoignages est masquée par défaut ----
  const section = doc.getElementById('testimonials-section');
  assert(section.hidden === true, 'section témoignages masquée au chargement');

  // ---- Le déclencheur couronne révèle la section ----
  const crown = doc.getElementById('hero-crown-trigger');
  assert(!!crown, 'le déclencheur couronne existe');
  crown.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert(section.hidden === false, 'la section se révèle au clic sur la couronne');

  // ---- Non connecté : formulaire caché, invite à se connecter visible ----
  const form = doc.getElementById('testimonial-form');
  const loginCta = doc.getElementById('testimonial-login-cta');
  assert(form.hidden === true, 'formulaire caché si non connecté');
  assert(loginCta.hidden === false, "invite de connexion visible si non connecté");

  // ---- Aucun témoignage publié au départ ----
  assert(doc.getElementById('testimonials-empty').hidden === false, "message 'aucun témoignage' visible au départ");

  // ---- Création de compte + connexion ----
  const acc = window.__poTest.createAccount({
    firstName: 'Alice', lastName: 'Tremblay', email: 'alice@example.com', age: 30, password: 'Password1'
  });
  assert(acc.ok, 'création de compte réussie');

  // Simule un rechargement complet de page (nouvelle instance jsdom) pour que le
  // script relise l'état de connexion déjà positionné en sessionStorage.
  const dom2 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/index.html' });
  // Partage le même localStorage/sessionStorage simulé (jsdom isole par instance : on copie manuellement)
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    dom2.window.localStorage.setItem(k, window.localStorage.getItem(k));
  }
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i);
    dom2.window.sessionStorage.setItem(k, window.sessionStorage.getItem(k));
  }
  dom2.window.HTMLElement.prototype.scrollIntoView = dom2.window.HTMLElement.prototype.scrollIntoView || function () {};
  dom2.window.eval(combined);
  await new Promise(r => setTimeout(r, 30));
  const doc2 = dom2.window.document;

  const form2 = doc2.getElementById('testimonial-form');
  const loginCta2 = doc2.getElementById('testimonial-login-cta');
  assert(form2.hidden === false, 'formulaire visible une fois connecté');
  assert(loginCta2.hidden === true, 'invite de connexion masquée une fois connecté');

  // ---- Composant étoiles : sélectionner 3 étoiles ----
  const stars = doc2.querySelectorAll('#testi-star-rating .star-rating__star');
  assert(stars.length === 5, 'le composant étoiles a bien 5 étoiles');
  stars[2].dispatchEvent(new dom2.window.Event('click', { bubbles: true })); // 3e étoile
  assert(doc2.getElementById('testi-star-rating').dataset.value === '3', 'la sélection de la 3e étoile met la valeur à 3');
  assert(stars[0].classList.contains('star-rating__star--active'), 'étoile 1 active après sélection de 3');
  assert(!stars[3].classList.contains('star-rating__star--active'), 'étoile 4 inactive après sélection de 3');

  // ---- Soumission avec un texte trop court doit afficher une erreur ----
  doc2.getElementById('testi-text').value = 'Court';
  doc2.getElementById('testimonial-form').dispatchEvent(new dom2.window.Event('submit', { bubbles: true, cancelable: true }));
  const notice2 = doc2.getElementById('testimonial-form-notice');
  assert(notice2.hidden === false, "message d'erreur affiché pour un texte trop court");

  // ---- Soumission valide ----
  doc2.getElementById('testi-text').value = 'Une séance magnifique qui m\'a beaucoup apaisée, merci infiniment.';
  doc2.getElementById('testi-service').value = 'soins-direct';
  doc2.getElementById('testimonial-form').dispatchEvent(new dom2.window.Event('submit', { bubbles: true, cancelable: true }));
  const pending = dom2.window.__poTest.listPending();
  assert(pending.length === 1, 'le témoignage est enregistré en attente après soumission valide');
  assert(pending[0].rating === 3, 'la note choisie (3) est bien enregistrée');

  // ---- Toujours invisible publiquement tant que non approuvé ----
  assert(doc2.getElementById('testimonials-grid').innerHTML.trim() === '', 'témoignage en attente non affiché publiquement');

  // ---- Approbation admin -> apparaît sur la page (même onglet, événement live) ----
  dom2.window.__poTest.approve(pending[0].id);
  await new Promise(r => setTimeout(r, 10));
  const cards = doc2.querySelectorAll('.testimonial-card');
  assert(cards.length === 1, 'le témoignage approuvé apparaît immédiatement (événement po:testimonials-updated)');
  assert(doc2.getElementById('testimonials-empty').hidden === true, "message 'aucun témoignage' masqué une fois un témoignage publié");

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
