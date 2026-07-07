const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function setupAdmin() {
  let html = fs.readFileSync(__dirname + '/admin.html', 'utf8');
  html = html.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com[^"]*"><\/script>\s*/, '');

  const dom1 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/admin.html' });
  const w1 = dom1.window;
  w1.HTMLElement.prototype.scrollIntoView = function () {};
  w1.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  w1.AbortSignal = w1.AbortSignal || { timeout: () => undefined };

  const files = ['auth.js', 'profile-photo.js', 'content-store.js', 'pricing.js', 'email-service.js',
                 'messenger-store.js', 'notifications-store.js', 'care-session-store.js',
                 'testimonials-store.js', 'care-pdf.js', 'admin.js'];
  const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + `
;
window.__poTest = {
  login: (d) => PO_Auth.login(d),
  listFormulasForService: (s) => PO_Content.listFormulasForService(s)
};
`;
  w1.eval(combined);
  w1.__poTest.login({ email: 'admin@ntabou-aka-we.fr', password: 'admin1234' });

  const dom2 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/admin.html' });
  const w2 = dom2.window;
  w2.HTMLElement.prototype.scrollIntoView = function () {};
  w2.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  w2.AbortSignal = w2.AbortSignal || { timeout: () => undefined };
  w2.confirm = () => true;
  for (let i = 0; i < w1.localStorage.length; i++) {
    const k = w1.localStorage.key(i);
    w2.localStorage.setItem(k, w1.localStorage.getItem(k));
  }
  for (let i = 0; i < w1.sessionStorage.length; i++) {
    const k = w1.sessionStorage.key(i);
    w2.sessionStorage.setItem(k, w1.sessionStorage.getItem(k));
  }
  w2.eval(combined);
  await new Promise(r => setTimeout(r, 30));
  return { window: w2, doc: w2.document };
}

function selectService(doc, window, serviceId) {
  const select = doc.getElementById('pricing-service-filter');
  select.value = serviceId;
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
}

async function run() {
  const { window, doc } = await setupAdmin();

  // ---- Ouvre le panneau Tarifs ----
  doc.querySelector('[data-panel="pricing"]').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));

  // ==================================================================
  // 1. Les 3 services initiaux sont bien listés dans le filtre ET ont
  //    chacun leurs formules par défaut visibles.
  // ==================================================================
  const filterOptions = [...doc.getElementById('pricing-service-filter').options].map(o => o.value);
  assert(filterOptions.includes('services-energetiques'), 'Soins Énergétiques est présent dans le filtre Tarifs');
  assert(filterOptions.includes('soins-direct'), 'Soins Direct est présent dans le filtre Tarifs');
  assert(filterOptions.includes('accompagnement'), 'Accompagnement 1:1 est présent dans le filtre Tarifs');

  for (const [serviceId, expectedCount, label] of [
    ['services-energetiques', 3, 'Soins Énergétiques'],
    ['soins-direct', 1, 'Soins Direct'],
    ['accompagnement', 3, 'Accompagnement 1:1']
  ]) {
    selectService(doc, window, serviceId);
    await new Promise(r => setTimeout(r, 20));
    const rows = doc.querySelectorAll('#pricing-tbody tr');
    assert(rows.length === expectedCount, `${label} affiche bien ses ${expectedCount} formule(s) par défaut dans le tableau`);
    assert(doc.getElementById('pricing-empty').hidden === true, `${label} : le message "aucune formule" est masqué quand des formules existent`);
  }

  // ==================================================================
  // 2. Modifier une formule existante (Soins Énergétiques) et vérifier
  //    la mise à jour immédiate dans le tableau.
  // ==================================================================
  selectService(doc, window, 'services-energetiques');
  await new Promise(r => setTimeout(r, 20));
  const firstEditBtn = doc.querySelector('#pricing-tbody [data-edit-formula]');
  const editedId = firstEditBtn.dataset.editFormula;
  firstEditBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));

  doc.getElementById('formula-price').value = '77';
  doc.getElementById('formula-title').value = 'Séance découverte modifiée';
  doc.getElementById('formula-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 20));

  const updated = window.__poTest.listFormulasForService('services-energetiques').find(f => f.id === editedId);
  assert(updated.price === 77, 'le nouveau prix (77 $) est bien enregistré après modification');
  assert(updated.title === 'Séance découverte modifiée', 'le nouveau titre est bien enregistré après modification');
  assert(doc.getElementById('pricing-tbody').textContent.includes('77,00'), 'le tableau reflète immédiatement le nouveau prix (77,00 $)');

  // ==================================================================
  // 3. Créer une nouvelle formule (Accompagnement 1:1) et vérifier
  //    qu'elle apparaît avec le bon ordre et le bon service.
  // ==================================================================
  selectService(doc, window, 'accompagnement');
  await new Promise(r => setTimeout(r, 20));
  doc.getElementById('open-new-formula').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));

  doc.getElementById('formula-title').value = 'Séance unique';
  doc.getElementById('formula-price').value = '120';
  doc.getElementById('formula-duration').value = '60 min';
  doc.getElementById('formula-description').value = 'Une séance ponctuelle, sans engagement.';
  doc.getElementById('formula-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 20));

  const accFormulas = window.__poTest.listFormulasForService('accompagnement');
  assert(accFormulas.length === 4, 'la nouvelle formule est bien ajoutée (4 formules pour Accompagnement 1:1)');
  const newFormula = accFormulas.find(f => f.title === 'Séance unique');
  assert(!!newFormula && newFormula.price === 120, 'la nouvelle formule a le bon prix (120 $)');
  assert(newFormula.serviceId === 'accompagnement', 'la nouvelle formule est bien rattachée au bon service');
  assert(newFormula.order === 4, "la nouvelle formule reçoit le bon numéro d'ordre (4, après les 3 existantes)");

  // ==================================================================
  // 4. Supprimer une formule (Soins Direct — cas sensible : un seul
  //    prix par défaut, très utilisé ailleurs dans le site) puis la
  //    recréer, pour vérifier qu'aucun état ne reste bloqué.
  // ==================================================================
  selectService(doc, window, 'soins-direct');
  await new Promise(r => setTimeout(r, 20));
  const deleteBtn = doc.querySelector('#pricing-tbody [data-delete-formula]');
  assert(!!deleteBtn, 'le bouton de suppression est disponible pour la formule Soins Direct');
  deleteBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));
  doc.getElementById('confirm-modal-ok').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));

  assert(window.__poTest.listFormulasForService('soins-direct').length === 0, 'la formule Soins Direct est bien supprimée');
  assert(doc.getElementById('pricing-empty').hidden === false, 'le message "aucune formule" apparaît bien quand la liste est vide (aucun crash)');
  assert(doc.querySelectorAll('#pricing-tbody tr').length === 0, 'le tableau est bien vide, sans ligne fantôme');

  // ---- Recrée une formule pour Soins Direct : tout redevient fonctionnel ----
  doc.getElementById('open-new-formula').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));
  doc.getElementById('formula-title').value = 'Soin Direct';
  doc.getElementById('formula-price').value = '88';
  doc.getElementById('formula-duration').value = '60 min';
  doc.getElementById('formula-description').value = 'Séance de soin énergétique direct.';
  doc.getElementById('formula-featured').checked = true;
  doc.getElementById('formula-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 20));

  const restored = window.__poTest.listFormulasForService('soins-direct');
  assert(restored.length === 1 && restored[0].price === 88, 'Soins Direct redevient pleinement fonctionnel après recréation (88 $)');
  assert(restored[0].order === 1, "le premier ordre disponible (1) est bien réattribué après suppression totale");

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
