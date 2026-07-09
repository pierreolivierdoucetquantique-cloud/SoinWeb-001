// =========================================================
// Ntabou Aka Wé — API — confirmation-service.js
//
// Génère un numéro de confirmation lisible et unique pour chaque
// rendez-vous confirmé (paiement vérifié). Format : NAW-AAMMJJ-XXXX.
// =========================================================

const crypto = require('crypto');

function generateConfirmationNumber(date) {
  const d = date ? new Date(date) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `NAW-${yy}${mm}${dd}-${suffix}`;
}

module.exports = { generateConfirmationNumber };
