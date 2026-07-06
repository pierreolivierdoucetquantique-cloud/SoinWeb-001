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
  window.confirm = () => true;

  const files = ['auth.js', 'profile-photo.js', 'content-store.js', 'pricing.js', 'email-service.js',
                 'messenger-store.js', 'notifications-store.js', 'care-session-store.js',
                 'testimonials-store.js', 'care-pdf.js', 'admin.js'];
  const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + `
;
window.__poTest = {
  login: (d) => PO_Auth.login(d),
  submitTestimonial: (t) => PO_Testimonials.submit(t)
};
`;
  window.eval(combined);
  window.__poTest.login({ email: 'admin@ntabou-aka-we.fr', password: 'admin1234' });
  window.__poTest.submitTestimonial({
    clientId: 'c1', clientName: 'Alice Tremblay', service: 'soins-direct',
    text: 'Une expérience vraiment magnifique, merci pour cet accompagnement.', rating: 5
  });
  window.__poTest.submitTestimonial({
    clientId: 'c2', clientName: 'Bruno Gagnon', service: 'accompagnement',
    text: "Un suivi precieux qui m'a beaucoup aide a avancer sereinement.", rating: 4
  });

  const dom2 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/admin.html' });
  dom2.window.HTMLElement.prototype.scrollIntoView = dom2.window.HTMLElement.prototype.scrollIntoView || function () {};
  dom2.window.confirm = () => true;
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

  // ---- Badge du nombre de témoignages en attente ----
  const badge = doc2.getElementById('testimonials-badge');
  assert(badge.hidden === false, 'le badge Témoignages est visible quand des témoignages sont en attente');
  assert(badge.textContent === '2', 'le badge affiche le bon nombre de témoignages en attente (2)');

  // ---- Ouvre le panneau Témoignages (filtre "En attente" par défaut) ----
  doc2.querySelector('[data-panel="testimonials"]').dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 10));

  let rows = doc2.querySelectorAll('#testi-tbody tr');
  assert(rows.length === 2, 'les 2 témoignages en attente apparaissent dans le tableau');

  // ---- Approuver le premier ----
  const approveBtn = doc2.querySelector('[data-testi-approve]');
  assert(!!approveBtn, 'un bouton Approuver est disponible pour un témoignage en attente');
  const approvedId = approveBtn.dataset.testiApprove;
  approveBtn.dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 10));

  rows = doc2.querySelectorAll('#testi-tbody tr');
  assert(rows.length === 1, "après approbation, il ne reste plus qu'un témoignage en attente (filtre courant)");
  assert(badge.textContent === '1', 'le badge se met à jour après approbation (1 restant)');

  // ---- Onglet "Approuvés" affiche bien le témoignage approuvé ----
  doc2.querySelector('#testi-status-tabs [data-status="approved"]').dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 10));
  rows = doc2.querySelectorAll('#testi-tbody tr');
  assert(rows.length === 1, "l'onglet Approuvés affiche exactement le témoignage approuvé");
  assert(rows[0].dataset.testiId === approvedId, "c'est bien le témoignage approuvé qui s'affiche dans l'onglet Approuvés");

  // ---- Rejeter l'autre depuis l'onglet "En attente" ----
  doc2.querySelector('#testi-status-tabs [data-status="pending"]').dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 10));
  const rejectBtn = doc2.querySelector('[data-testi-reject]');
  rejectBtn.dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 10));
  assert(badge.hidden === true, 'le badge disparaît une fois plus aucun témoignage en attente');

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
