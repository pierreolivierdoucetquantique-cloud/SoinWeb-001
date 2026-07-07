// Test du module PO_Testimonials en environnement Node simulé (localStorage maison).
global.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; }
  };
})();
global.document = { dispatchEvent: () => {} };
global.CustomEvent = function (name, opts) { this.name = name; this.detail = opts; };

const fs = require('fs');
const code = fs.readFileSync(__dirname + '/testimonials-store.js', 'utf8')
  .replace('const PO_Testimonials', 'global.PO_Testimonials');
eval(code);

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

// ---- Soumission valide ----
const r1 = PO_Testimonials.submit({
  clientId: 'c1', clientName: 'Alice Tremblay', service: 'soins-direct',
  text: 'Une expérience transformatrice, je recommande vivement ce soin.', rating: 5
});
assert(r1.ok, 'soumission valide acceptée');
assert(r1.testimonial.status === 'pending', 'statut par défaut = pending');

// ---- Soumission avec texte trop court ----
const r2 = PO_Testimonials.submit({ clientId: 'c1', clientName: 'Alice', service: 'soins-direct', text: 'top court', rating: 5 });
assert(!r2.ok, 'texte trop court rejeté');

// ---- Sanitisation HTML/JS ----
const r3 = PO_Testimonials.submit({
  clientId: 'c2', clientName: '<b>Bob</b>', service: 'accompagnement',
  text: '<script>alert(1)</script> Ceci est un témoignage tout à fait honnête et sincère.', rating: 4
});
assert(r3.ok, 'soumission avec balises acceptée après nettoyage');
assert(!r3.testimonial.text.includes('<script>'), 'balises script retirées du texte');
assert(!r3.testimonial.clientName.includes('<b>'), 'balises HTML retirées du nom');

// ---- Note hors bornes ----
const r4 = PO_Testimonials.submit({ clientId: 'c3', clientName: 'Chris', service: 'services-energetiques', text: 'Un très beau moment de calme et de reconnexion à moi-même.', rating: 99 });
assert(r4.testimonial.rating === 5, 'note clampée à 5 max');
const r5 = PO_Testimonials.submit({ clientId: 'c4', clientName: 'Dana', service: 'services-energetiques', text: 'Un très beau moment de calme et de reconnexion à moi-même.', rating: -3 });
assert(r5.testimonial.rating === 1, 'note clampée à 1 min');

// ---- Visibilité publique : seuls les approuvés apparaissent ----
assert(PO_Testimonials.listApproved().length === 0, 'aucun témoignage approuvé au départ');
PO_Testimonials.adminApprove(r1.testimonial.id);
assert(PO_Testimonials.listApproved().length === 1, 'un témoignage visible après approbation');
assert(PO_Testimonials.listApproved()[0].id === r1.testimonial.id, 'le bon témoignage est visible');

// ---- Rejet reste caché ----
PO_Testimonials.adminReject(r3.testimonial.id);
assert(PO_Testimonials.listApproved().length === 1, 'le rejet ne publie pas le témoignage');
assert(PO_Testimonials.getById(r3.testimonial.id).status === 'rejected', 'statut correctement mis à jour en rejected');

// ---- Un client ne peut modifier que son propre témoignage en attente ----
assert(PO_Testimonials.canClientEdit(r4.testimonial.id, 'c3') === true, 'auteur peut éditer son témoignage en attente');
assert(PO_Testimonials.canClientEdit(r4.testimonial.id, 'c999') === false, 'un autre client ne peut pas éditer');
assert(PO_Testimonials.canClientEdit(r1.testimonial.id, 'c1') === false, 'impossible d\'éditer un témoignage déjà approuvé');

const editResult = PO_Testimonials.clientUpdate(r4.testimonial.id, 'c3', { text: 'Texte mis à jour par le client, toujours suffisamment long.' });
assert(editResult.ok, 'édition autorisée par le propriétaire sur un témoignage pending');

const editDenied = PO_Testimonials.clientUpdate(r1.testimonial.id, 'c1', { text: 'Tentative sur un témoignage déjà approuvé, donc refusée normalement.' });
assert(!editDenied.ok, 'édition refusée sur un témoignage déjà approuvé');

// ---- Suppression par un tiers refusée ----
const deleteDenied = PO_Testimonials.clientDelete(r4.testimonial.id, 'c999');
assert(!deleteDenied.ok, 'suppression par un tiers refusée');

console.log(`\n${pass} tests réussis, ${fail} échecs.`);
process.exit(fail === 0 ? 0 : 1);
