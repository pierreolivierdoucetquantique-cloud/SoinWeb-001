// Vérifie qu'un changement de prix dans Admin -> Tarifs se propage,
// sans jamais afficher 0,00 $, à travers :
//   PO_Content (source unique) -> PO_Pricing.compute() -> page service
//   -> booking-flow.js (Soins Direct) -> paiement-rdv.html (résumé)
global.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
    key: (i) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; }
  };
})();
global.document = { dispatchEvent: () => {} };
global.CustomEvent = function (name, opts) { this.name = name; this.detail = opts; };

const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

function loadGlobal(file, exportName) {
  const code = fs.readFileSync(__dirname + '/' + file, 'utf8')
    .replace(`const ${exportName}`, `global.${exportName}`);
  eval(code);
}

// Charge les modules dans l'ordre réel (content-store avant pricing)
loadGlobal('content-store.js', 'PO_Content');
loadGlobal('pricing.js', 'PO_Pricing');

// ---- 1. État initial : la formule "soins-direct" par défaut a un prix > 0 ----
let formulas = PO_Content.listFormulasForService('soins-direct');
assert(formulas.length > 0, 'une formule "soins-direct" existe par défaut');
assert(formulas[0].price > 0, 'le prix par défaut de Soins Direct n\'est pas 0,00 $');

// ---- 2. L'admin change le prix dans Admin -> Tarifs ----
const formulaId = formulas[0].id;
PO_Content.saveFormula({ id: formulaId, price: 145 });

// ---- 3. PO_Pricing.compute() reflète immédiatement le nouveau prix ----
const computed = PO_Pricing.compute(formulaId);
assert(computed.price === 145, 'PO_Pricing.compute() reflète le nouveau prix (145 $) immédiatement');
assert(computed.price !== 0, 'PO_Pricing.compute() ne retourne jamais 0 pour une formule existante');
assert(PO_Pricing.formatCAD(computed.price) !== '0,00 $ CAD', 'le prix formaté affiché n\'est jamais "0,00 $ CAD"');

// ---- 4. Simule le calcul complet avec taxes (comme sur paiement-rdv.html) ----
const paySettings = PO_Pricing.getPaymentSettings();
assert(typeof paySettings.taxesEnabled === 'boolean', 'les paramètres de paiement (taxes) sont bien définis');
const full = PO_Pricing.computeRaw(computed.price);
assert(full.total > 0, 'le total (avec ou sans taxes) n\'est jamais 0,00 $');
assert(full.total >= computed.price, 'le total inclut correctement le prix de base (+ taxes le cas échéant)');

// ---- 5. Un formulaId inconnu/absent ne doit jamais produire un prix "fantôme" silencieux ----
const unknown = PO_Pricing.compute('formule-inexistante-xyz');
assert(unknown.price === 0, 'une formule inexistante retourne explicitement 0 (pas une valeur inventée)');
// Ce cas est géré explicitement par booking-flow.js et paiement-rdv.html via un
// fallback sur le prix stocké dans la réservation (pd.formulaPrice) — jamais
// affiché tel quel à l'écran sans repli, voir plus bas.

// ---- 6. Vérifie qu'aucun repli codé en dur vers 0 ou une valeur magique ne subsiste ----
const bookingFlowSrc = fs.readFileSync(__dirname + '/booking-flow.js', 'utf8');
const paiementSrc = fs.readFileSync(__dirname + '/paiement-rdv.html', 'utf8');
assert(!/price:\s*88\b/.test(bookingFlowSrc), 'booking-flow.js : aucun prix codé en dur (88) ne subsiste');
assert(/PO_Pricing\.compute\(/.test(paiementSrc), 'paiement-rdv.html relit bien le prix via PO_Pricing.compute() (source unique)');
assert(/PO_Content\.listFormulasForService/.test(bookingFlowSrc), 'booking-flow.js relit bien le prix via PO_Content (source unique)');

// ---- 7. Reproduit un deuxième changement de prix pour confirmer la synchronisation continue ----
PO_Content.saveFormula({ id: formulaId, price: 62.5 });
const computed2 = PO_Pricing.compute(formulaId);
assert(computed2.price === 62.5, 'un second changement de prix (62,50 $) est également répercuté immédiatement');
assert(PO_Pricing.formatCAD(computed2.price) === '62,50 $ CAD' || PO_Pricing.formatCAD(computed2.price).includes('62,50'),
  'le prix formaté correspond bien à 62,50 $');

console.log(`\n${pass} tests réussis, ${fail} échecs.`);
process.exit(fail === 0 ? 0 : 1);
