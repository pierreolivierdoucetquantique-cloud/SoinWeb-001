// =========================================================
// PIERRE-OLIVIER — booking-flow.js (v2 — backend réel)
// Parcours de réservation "Soin Direct" : paiement → validation
// d'âge → avis Espace Sacré → bienvenue.
//
// Le paiement par carte est réellement traité par Stripe (test ou réel
// selon les clés configurées sur le serveur) ; les transactions et le
// blocage de compte sont désormais écrits dans la vraie base de données
// partagée (server/), plus dans localStorage.
// =========================================================

document.addEventListener('DOMContentLoaded', async () => {

  const SERVICE_ID = 'soins-direct';
  const SERVICE_LABEL = 'Soins Direct';

  const paymentVeil = document.getElementById('bf-payment-veil');
  if (!paymentVeil) return;

  const ageVeil    = document.getElementById('bf-age-veil');
  const sacredVeil = document.getElementById('bf-sacred-veil');
  const welcomeVeil = document.getElementById('bf-welcome-veil');

  // Initialise la session + les tarifs avant tout rendu dépendant.
  if (PO_Auth.init) await PO_Auth.init();
  if (typeof PO_Content !== 'undefined' && PO_Content.refreshFormulas) await PO_Content.refreshFormulas();

  function _defaultSoinsDirectPrice() {
    if (typeof PO_Content !== 'undefined' && PO_Content.listFormulasForService) {
      const formulas = PO_Content.listFormulasForService(SERVICE_ID);
      if (formulas.length > 0) return formulas[0].price || 0;
    }
    return 0;
  }
  let currentFormula = { title: SERVICE_LABEL, price: poFormatPrice(_defaultSoinsDirectPrice()), duration: '40 min' };
  document.addEventListener('po:prices-updated', () => {
    if (!currentFormula.formulaId) {
      currentFormula.price = poFormatPrice(_defaultSoinsDirectPrice());
    }
  });
  let currentMethod = 'interac';
  let currentTransactionId = null;

  function openVeil(el) { el.hidden = false; }
  function closeVeil(el) { el.hidden = true; }

  function parseAmount(val) {
    if (typeof val === 'number' && !isNaN(val)) return val;
    const str = String(val).replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  }

  async function startBooking(formula) {
    const user = PO_Auth.getCurrentUser();
    if (!user) {
      window.location.href = `connexion.html?redirect=${SERVICE_ID}`;
      return;
    }
    if (user.blocked) {
      window.location.href = 'connexion.html';
      return;
    }
    currentFormula = formula || currentFormula;
    currentTransactionId = null;
    resetPaymentPanel();

    let displayPrice = currentFormula.price;
    let numericPrice = parseAmount(currentFormula.price);
    if (typeof PO_Pricing !== 'undefined' && currentFormula.formulaId) {
      const computed = PO_Pricing.compute(currentFormula.formulaId);
      if (computed.price > 0) {
        numericPrice = computed.price;
        displayPrice = PO_Pricing.formatCAD(numericPrice);
      }
    } else if (typeof PO_Pricing !== 'undefined') {
      displayPrice = typeof displayPrice === 'number'
        ? PO_Pricing.formatCAD(displayPrice)
        : displayPrice;
    }
    currentFormula._numericPrice = numericPrice;

    document.getElementById('bf-formula-title').textContent = currentFormula.title;
    document.getElementById('bf-formula-price').textContent = displayPrice;
    document.getElementById('bf-formula-duration').textContent = currentFormula.duration;
    openVeil(paymentVeil);
  }

  document.getElementById('bf-main-cta')?.addEventListener('click', async () => {
    let price = 0;
    let formulaId = '';
    if (typeof PO_Content !== 'undefined') {
      const formulas = PO_Content.listFormulasForService ? PO_Content.listFormulasForService(SERVICE_ID) : [];
      if (formulas.length > 0) {
        price = formulas[0].price || 0;
        formulaId = formulas[0].id || '';
      }
    }
    await startBooking({ title: SERVICE_LABEL, price, duration: '60 min', formulaId });
  });

  document.getElementById('formulas-container')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.bf-formula-btn');
    if (!btn) return;
    await startBooking({
      title: btn.dataset.formulaTitle,
      price: parseAmount(btn.dataset.formulaPrice),
      duration: btn.dataset.formulaDuration,
      formulaId: btn.dataset.formulaId || ''
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

  let stripeReady = false;
  function resetPaymentPanel() {
    hideNotice();
    currentMethod = 'interac';
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.method === 'interac')));
    panelInterac.hidden = false;
    panelCard.hidden = true;
    document.getElementById('bf-card-name').value = '';
    const cardBtn = document.getElementById('bf-card-pay-btn');
    cardBtn.disabled = false;
    document.getElementById('bf-card-pay-label').textContent = 'Payer';
    const interacBtn = document.getElementById('bf-interac-confirm');
    interacBtn.disabled = false;
    interacBtn.textContent = "J'ai effectué mon virement";

    if (!stripeReady && typeof PO_StripePayment !== 'undefined') {
      PO_StripePayment.init().then(initResult => {
        if (!initResult.ok) {
          showNotice(initResult.error || 'Paiement par carte indisponible pour le moment.', 'error');
          cardBtn.disabled = true;
          return;
        }
        PO_StripePayment.mountCardElement('bf-card-element');
        stripeReady = true;

        const badge = document.getElementById('bf-mode-badge');
        const cardNotice = document.getElementById('bf-card-mode-notice');
        if (PO_StripePayment.isTestMode()) {
          if (badge) badge.textContent = 'Mode test — carte via Stripe, virement vérifié manuellement';
          if (cardNotice) cardNotice.innerHTML = 'Paiement en mode test Stripe — aucun argent réel n\'est débité. Utilisez une carte de test, par exemple <code>4242 4242 4242 4242</code>, avec une date future et n\'importe quel CVC.';
        } else {
          if (badge) badge.textContent = 'Paiement sécurisé — carte via Stripe, virement vérifié manuellement';
          if (cardNotice) cardNotice.textContent = 'Vos informations de carte sont chiffrées et transmises directement à Stripe — jamais à notre serveur.';
        }
      });
    }
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

  // ----- Interac -----
  document.getElementById('bf-interac-confirm')?.addEventListener('click', async () => {
    hideNotice();
    if (!checkSessionLimitOrFail()) return;

    const user = PO_Auth.getCurrentUser();
    const numericAmount = currentFormula._numericPrice || parseAmount(currentFormula.price);
    if (!numericAmount || numericAmount <= 0) {
      showNotice('Le prix de ce soin n\'a pas pu être déterminé. Merci de nous contacter directement pour finaliser votre réservation.', 'error');
      return;
    }
    const { transaction } = await PO_Auth.createTransaction({
      service: SERVICE_ID,
      serviceId: SERVICE_ID,
      formulaTitle: currentFormula.title,
      amount: numericAmount,
      tps: 0,
      tvq: 0,
      total: numericAmount,
      duration: currentFormula.duration,
      method: 'interac',
      status: 'waiting'
    });
    currentTransactionId = transaction.id;

    const btn = document.getElementById('bf-interac-confirm');
    btn.disabled = true;
    btn.textContent = 'En attente de confirmation...';
    showNotice('Virement signalé. Votre accès sera débloqué dès la confirmation par l\'administration — vous recevrez une notification.', 'success');
  });

  // ----- Carte (Stripe) -----
  document.getElementById('bf-card-pay-btn')?.addEventListener('click', async () => {
    hideNotice();
    if (!checkSessionLimitOrFail()) return;

    const name = document.getElementById('bf-card-name').value.trim();
    const errorEl = document.getElementById('bf-card-element-errors');
    errorEl.textContent = '';

    if (!stripeReady) {
      showNotice('Le formulaire de paiement n\'est pas encore prêt. Réessayez dans un instant.', 'error');
      return;
    }
    if (!name) {
      showNotice('Veuillez indiquer le nom inscrit sur la carte.', 'error');
      return;
    }

    const user = PO_Auth.getCurrentUser();
    const numericAmount = currentFormula._numericPrice || parseAmount(currentFormula.price);
    if (!numericAmount || numericAmount <= 0) {
      showNotice('Le prix de ce soin n\'a pas pu être déterminé. Merci de nous contacter directement pour finaliser votre réservation.', 'error');
      return;
    }

    const btn = document.getElementById('bf-card-pay-btn');
    const label = document.getElementById('bf-card-pay-label');
    btn.disabled = true;
    label.textContent = 'Traitement en cours…';

    const paymentResult = await PO_StripePayment.pay({
      amount: numericAmount,
      currency: 'cad',
      cardholderName: name,
      metadata: {
        clientId: user.id,
        clientName: `${user.firstName} ${user.lastName}`,
        service: SERVICE_LABEL
      }
    });

    if (!paymentResult.ok) {
      errorEl.textContent = paymentResult.error || 'Le paiement a été refusé.';
      showNotice(paymentResult.error || 'Le paiement a été refusé. Vérifiez les informations de votre carte.', 'error');
      btn.disabled = false;
      label.textContent = 'Payer';
      return;
    }

    const { transaction } = await PO_Auth.createTransaction({
      service: SERVICE_ID,
      serviceId: SERVICE_ID,
      formulaTitle: currentFormula.title,
      amount: numericAmount,
      tps: 0,
      tvq: 0,
      total: numericAmount,
      duration: currentFormula.duration,
      method: 'card',
      status: 'waiting',
      transactionReference: paymentResult.paymentIntent.id
    });
    await PO_Auth.confirmTransaction(transaction.id);
    currentTransactionId = transaction.id;
    label.textContent = 'Paiement réussi';
    showNotice('Paiement confirmé par Stripe. Poursuite du parcours...', 'success');
    setTimeout(() => {
      closeVeil(paymentVeil);
      runPaymentSuccessSequence();
    }, 700);
  });

  document.getElementById('bf-payment-cancel')?.addEventListener('click', () => {
    closeVeil(paymentVeil);
  });

  function runPaymentSuccessSequence() {
    openVeil(ageVeil);
    runAgeValidation();
  }

  // ---- Sondage du statut de la transaction Interac en attente ----
  // Interroge le VRAI serveur (pas un cache local) — c'est justement ce
  // qui permet de détecter la confirmation faite par l'admin depuis un
  // autre appareil/navigateur.
  let interacPollTimer = null;
  function startInteracPolling() {
    stopInteracPolling();
    interacPollTimer = setInterval(async () => {
      if (!currentTransactionId) return;
      await PO_Auth.refreshTransactions();
      const tx = PO_Auth.listTransactions().find(t => t.id === currentTransactionId);
      if (tx && (tx.status === 'paid' || tx.status === 'confirmed')) {
        stopInteracPolling();
        closeVeil(paymentVeil);
        runPaymentSuccessSequence();
      }
    }, 4000);
  }
  function stopInteracPolling() {
    if (interacPollTimer) { clearInterval(interacPollTimer); interacPollTimer = null; }
  }
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

    setTimeout(async () => {
      const user = PO_Auth.getCurrentUser();
      const age = Number(user.age);

      if (!age || Number.isNaN(age)) {
        await PO_Auth.blockClient(user.id, 'Compte bloqué : informations de profil invalides.');
        ageText.textContent = 'Compte bloqué : vos informations de profil sont invalides. Veuillez contacter l\'administration.';
        return;
      }

      if (age < 18) {
        await PO_Auth.blockClient(user.id, 'Compte bloqué. L\'âge minimum requis est de 18 ans.');
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
    window.location.href = `soin-interactif.html?tx=${encodeURIComponent(currentTransactionId || '')}`;
  });

});
