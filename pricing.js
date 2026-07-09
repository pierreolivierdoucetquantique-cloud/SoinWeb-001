// =========================================================
// PIERRE-OLIVIER — pricing.js
//
// SOURCE DE VÉRITÉ UNIQUE pour tous les calculs de prix du site.
// Branchement : charger pricing.js APRÈS auth.js et content-store.js.
// =========================================================
const PO_Pricing = (() => {
  const DEPOSIT_RATE = 0.40;

  function formatCAD(value) {
    const n = parseFloat(value) || 0;
    return n.toLocaleString('fr-CA', { minimumFractionDigits:2, maximumFractionDigits:2 }) + String.fromCharCode(160) + '$' + String.fromCharCode(160) + 'CAD';
  }
  function formatCADShort(value) {
    const n = parseFloat(value) || 0;
    return n.toLocaleString('fr-CA', { minimumFractionDigits:0, maximumFractionDigits:2 }) + String.fromCharCode(160) + '$';
  }

  function getPaymentSettings() {
    if (typeof PO_Auth !== 'undefined' && PO_Auth.getPaymentSettings) return PO_Auth.getPaymentSettings();
    return { taxesEnabled:false, tpsRate:5, tvqRate:9.975, interacEmail:'pierreolivierdoucet.quantique@gmail.com' };
  }
  function getFormula(formulaId) {
    if (!formulaId || typeof PO_Content === 'undefined') return null;
    const all = PO_Content.listFormulas ? PO_Content.listFormulas() : [];
    return all.find(f => f.id === formulaId) || null;
  }
  function getFormulasForService(serviceId) {
    if (!serviceId || typeof PO_Content === 'undefined') return [];
    return PO_Content.listFormulasForService ? PO_Content.listFormulasForService(serviceId) : [];
  }

  function computeRaw(unitPrice) {
    const s = getPaymentSettings();
    const price   = Math.round((parseFloat(unitPrice) || 0) * 100) / 100;
    const tps     = s.taxesEnabled ? Math.round(price * (s.tpsRate  || 5)     / 100 * 100) / 100 : 0;
    const tvq     = s.taxesEnabled ? Math.round(price * (s.tvqRate  || 9.975) / 100 * 100) / 100 : 0;
    const total   = Math.round((price + tps + tvq) * 100) / 100;
    const deposit = Math.round(total * DEPOSIT_RATE * 100) / 100;
    const balance = Math.round((total - deposit) * 100) / 100;
    return { price, tps, tvq, total, deposit, balance,
             tpsEnabled:s.taxesEnabled, tpsRate:s.tpsRate, tvqRate:s.tvqRate,
             interacEmail:s.interacEmail, depositRate:DEPOSIT_RATE };
  }
  function compute(formulaId) {
    const formula = getFormula(formulaId);
    const result  = computeRaw(formula ? formula.price : 0);
    result.formula = formula;
    return result;
  }
  function syncAll() {
    document.dispatchEvent(new CustomEvent('po:prices-updated', { bubbles:true }));
  }
  function summaryHTML(c) {
    let h = `<div class="pay-summary__row"><span>Prix unitaire</span><strong>${formatCAD(c.price)}</strong></div>`;
    if (c.tpsEnabled) {
      h += `<div class="pay-summary__row"><span>TPS (${c.tpsRate}\u00a0%)</span><strong>${formatCAD(c.tps)}</strong></div>`;
      h += `<div class="pay-summary__row"><span>TVQ (${c.tvqRate}\u00a0%)</span><strong>${formatCAD(c.tvq)}</strong></div>`;
    }
    h += `<div class="pay-summary__total"><span>Total</span><span class="pay-summary__total-amount">${formatCAD(c.total)}</span></div>`;
    return h;
  }

  return { DEPOSIT_RATE, formatCAD, formatCADShort, getPaymentSettings, getFormula,
           getFormulasForService, computeRaw, compute, syncAll, summaryHTML };
})();
