// =========================================================
// PIERRE-OLIVIER — booking-flow.js
// Parcours de réservation "Soin Direct" : paiement → validation
// d'âge → avis Espace Sacré → bienvenue.
//
// SIMULATION FRONTEND UNIQUEMENT — voir l'avertissement complet
// en haut de auth.js. Résumé :
//   - Aucun paiement réel n'est traité (pas de Stripe, pas de clé API).
//   - Les règles de sécurité (limite de séances, blocage par âge)
//     sont vérifiées dans le navigateur et peuvent être contournées
//     via les DevTools. Elles doivent être revalidées côté serveur
//     avant toute mise en production.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {

  const SERVICE_ID = 'soins-direct';
  const SERVICE_LABEL = 'Soins Direct';

  // Éléments ne sont présents que sur soins-direct.html — sortie silencieuse sinon.
  const paymentVeil = document.getElementById('bf-payment-veil');
  if (!paymentVeil) return;

  const ageVeil    = document.getElementById('bf-age-veil');
  const sacredVeil = document.getElementById('bf-sacred-veil');
  const welcomeVeil = document.getElementById('bf-welcome-veil');

  // ---- État de la formule sélectionnée pour cette tentative de réservation ----
  let currentFormula = { title: SERVICE_LABEL, price: poFormatPrice(88), duration: '40 min' };
  let currentMethod = 'interac';
  let currentTransactionId = null;

  function openVeil(el) { el.hidden = false; }
  function closeVeil(el) { el.hidden = true; }
  function closeAll() {
    closeVeil(paymentVeil);
    closeVeil(ageVeil);
    closeVeil(sacredVeil);
    closeVeil(welcomeVeil);
  }

  // ---------------------------------------------------------
  // POINT D'ENTRÉE — déclenché par le CTA principal et les
  // boutons "Réserver" des cartes de formule.
  // ---------------------------------------------------------
  function startBooking(formula) {
    const user = PO_Auth.getCurrentUser();
    if (!user) {
      // Comportement inchangé pour un visiteur non connecté : on redirige
      // vers la connexion, exactement comme avant l'ajout de ce parcours.
      window.location.href = `connexion.html?redirect=${SERVICE_ID}`;
      return;
    }
    if (user.blocked) {
      // Un compte déjà bloqué ne peut pas initier de nouvelle réservation.
      window.location.href = 'connexion.html';
      return;
    }
    currentFormula = formula || currentFormula;
    currentTransactionId = null;
    resetPaymentPanel();
    document.getElementById('bf-formula-title').textContent = currentFormula.title;
    document.getElementById('bf-formula-price').textContent = currentFormula.price;
    document.getElementById('bf-formula-duration').textContent = currentFormula.duration;
    openVeil(paymentVeil);
  }

  document.getElementById('bf-main-cta')?.addEventListener('click', () => {
    startBooking({ title: SERVICE_LABEL, price: poFormatPrice(88), duration: '40 min' });
  });

  document.getElementById('formulas-container')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.bf-formula-btn');
    if (!btn) return;
    startBooking({
      title: btn.dataset.formulaTitle,
      price: btn.dataset.formulaPrice,
      duration: btn.dataset.formulaDuration
    });
  });

  // ---------------------------------------------------------
  // MODAL 1 — PAIEMENT
  // ---------------------------------------------------------
  const notice = document.getElementById('bf-payment-notice');
  function showNotice(msg, tone) {
    notice.hidden = false;
    notice.dataset.tone = tone || 'error';
    notice.textContent = msg;
  }
  function hideNotice() { notice.hidden = true; }

  const panelInterac = document.getElementById('bf-panel-interac');
  const panelCard = document.getElementById('bf-panel-card');
  const tabs = document.querySelectorAll('.bf-pay-tab');

  function resetPaymentPanel() {
    hideNotice();
    currentMethod = 'interac';
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.method === 'interac')));
    panelInterac.hidden = false;
    panelCard.hidden = true;
    document.getElementById('bf-card-number').value = '';
    document.getElementById('bf-card-exp').value = '';
    document.getElementById('bf-card-cvc').value = '';
    const cardBtn = document.getElementById('bf-card-pay-btn');
    cardBtn.disabled = false;
    document.getElementById('bf-card-pay-label').textContent = 'Payer (démo)';
    const interacBtn = document.getElementById('bf-interac-confirm');
    interacBtn.disabled = false;
    interacBtn.textContent = "J'ai effectué mon virement";
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      currentMethod = tab.dataset.method;
      tabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));
      panelInterac.hidden = currentMethod !== 'interac';
      panelCard.hidden = currentMethod !== 'card';
      hideNotice();
    });
  });

  document.getElementById('bf-copy-email')?.addEventListener('click', () => {
    const email = 'pierreolivierdoucet.quantique@gmail.com';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(email).catch(() => {});
    }
    const btn = document.getElementById('bf-copy-email');
    const original = btn.textContent;
    btn.textContent = 'Copié !';
    setTimeout(() => { btn.textContent = original; }, 1500);
  });

  function checkSessionLimitOrFail() {
    const user = PO_Auth.getCurrentUser();
    if (!PO_Auth.canBookDirectSession(user.id)) {
      showNotice('Limite de 2 Soins Direct atteinte pour cette période.', 'error');
      return false;
    }
    return true;
  }

  // ----- Interac : "virement effectué" → transaction en attente de confirmation admin -----
  document.getElementById('bf-interac-confirm')?.addEventListener('click', () => {
    hideNotice();
    if (!checkSessionLimitOrFail()) return;

    const user = PO_Auth.getCurrentUser();
    const { transaction } = PO_Auth.createTransaction({
      clientId: user.id,
      clientName: `${user.firstName} ${user.lastName}`,
      service: SERVICE_ID,
      formulaTitle: currentFormula.title,
      amount: currentFormula.price,
      duration: currentFormula.duration,
      method: 'interac'
    });
    currentTransactionId = transaction.id;

    const btn = document.getElementById('bf-interac-confirm');
    btn.disabled = true;
    btn.textContent = 'En attente de confirmation...';
    showNotice('Virement signalé. Votre accès sera débloqué dès la confirmation par l\'administration — vous recevrez une notification.', 'success');
  });

  // ----- Carte (Stripe simulé) : faux délai puis confirmation automatique -----
  document.getElementById('bf-card-pay-btn')?.addEventListener('click', () => {
    hideNotice();
    if (!checkSessionLimitOrFail()) return;

    const btn = document.getElementById('bf-card-pay-btn');
    const label = document.getElementById('bf-card-pay-label');
    btn.disabled = true;
    label.textContent = 'Traitement en cours (démo)...';

    setTimeout(() => {
      const user = PO_Auth.getCurrentUser();
      const { transaction } = PO_Auth.createTransaction({
        clientId: user.id,
        clientName: `${user.firstName} ${user.lastName}`,
        service: SERVICE_ID,
        formulaTitle: currentFormula.title,
        amount: currentFormula.price,
        duration: currentFormula.duration,
        method: 'card'
      });
      PO_Auth.confirmTransaction(transaction.id);
      currentTransactionId = transaction.id;
      label.textContent = 'Paiement réussi (démo)';
      showNotice('Paiement confirmé (simulation). Poursuite du parcours...', 'success');
      setTimeout(() => {
        closeVeil(paymentVeil);
        runPaymentSuccessSequence();
      }, 700);
    }, 1400);
  });

  document.getElementById('bf-payment-cancel')?.addEventListener('click', () => {
    closeVeil(paymentVeil);
  });

  // ---------------------------------------------------------
  // PAYMENT_SUCCESS — déclenché uniquement pour le paiement carte
  // (le virement Interac attend une confirmation manuelle distincte,
  // gérée plus bas via un sondage léger du statut de transaction).
  // ---------------------------------------------------------
  function runPaymentSuccessSequence() {
    openVeil(ageVeil);
    runAgeValidation();
  }

  // ---- Sondage du statut de la transaction Interac en attente ----
  // Si l'admin confirme le virement pendant que le client est sur la page,
  // on enchaîne automatiquement la suite du parcours.
  let interacPollTimer = null;
  function startInteracPolling() {
    stopInteracPolling();
    interacPollTimer = setInterval(() => {
      if (!currentTransactionId) return;
      const tx = PO_Auth.listTransactions().find(t => t.id === currentTransactionId);
      if (tx && tx.status === 'confirmed') {
        stopInteracPolling();
        closeVeil(paymentVeil);
        runPaymentSuccessSequence();
      }
    }, 2000);
  }
  function stopInteracPolling() {
    if (interacPollTimer) { clearInterval(interacPollTimer); interacPollTimer = null; }
  }
  // Le sondage démarre dès qu'un virement est signalé.
  document.getElementById('bf-interac-confirm')?.addEventListener('click', startInteracPolling);
  document.getElementById('bf-payment-cancel')?.addEventListener('click', stopInteracPolling);

  // ---------------------------------------------------------
  // MODAL 2 — VALIDATION D'ÂGE
  // ---------------------------------------------------------
  function runAgeValidation() {
    const ageText = document.getElementById('bf-age-text');
    const ageActions = document.getElementById('bf-age-actions');
    ageActions.hidden = true;
    ageText.textContent = 'Vérification de votre dossier en cours...';

    setTimeout(() => {
      const user = PO_Auth.getCurrentUser();
      const age = Number(user.age);

      if (!age || Number.isNaN(age)) {
        // Données de première connexion invalides ou manquantes : blocage permanent,
        // conformément à la règle FIRST_LOGIN_DATA_INVALID de la demande d'origine.
        PO_Auth.blockClient(user.id, 'Compte bloqué : informations de profil invalides.');
        ageText.textContent = 'Compte bloqué : vos informations de profil sont invalides. Veuillez contacter l\'administration.';
        return;
      }

      if (age < 18) {
        PO_Auth.blockClient(user.id, 'Compte bloqué. L\'âge minimum requis est de 18 ans.');
        ageText.textContent = 'Compte bloqué. L\'âge minimum requis est de 18 ans.';
        return;
      }

      ageText.textContent = 'Âge vérifié. Vous pouvez continuer.';
      ageActions.hidden = false;
    }, 900);
  }

  document.getElementById('bf-age-continue')?.addEventListener('click', () => {
    closeVeil(ageVeil);
    document.getElementById('bf-sacred-check').checked = false;
    document.getElementById('bf-sacred-continue').disabled = true;
    openVeil(sacredVeil);
  });

  // ---------------------------------------------------------
  // MODAL 3 — AVIS ESPACE SACRÉ
  // ---------------------------------------------------------
  document.getElementById('bf-sacred-check')?.addEventListener('change', (e) => {
    document.getElementById('bf-sacred-continue').disabled = !e.target.checked;
  });

  document.getElementById('bf-sacred-continue')?.addEventListener('click', () => {
    closeVeil(sacredVeil);
    openVeil(welcomeVeil);
  });

  // ---------------------------------------------------------
  // MODAL 4 — BIENVENUE
  // ---------------------------------------------------------
  document.getElementById('bf-start-session')?.addEventListener('click', () => {
    closeVeil(welcomeVeil);
    // Démarrage de la séance interactive : la garde d'accès de
    // soin-interactif.html revérifie que cette transaction est bien confirmée.
    window.location.href = `soin-interactif.html?tx=${encodeURIComponent(currentTransactionId || '')}`;
  });

});
