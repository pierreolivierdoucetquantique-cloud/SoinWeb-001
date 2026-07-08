// =========================================================
// PIERRE-OLIVIER — care-session.js
//
// Logique de la page soin-interactif.html : garde d'accès,
// déroulement des étapes, chronomètre, autosauvegarde, résumé,
// génération du PDF et "envoi" simulé par courriel.
//
// SIMULATION FRONTEND UNIQUEMENT — voir l'avertissement complet
// en haut de care-session-store.js. La garde d'accès ci-dessous
// vérifie le statut de paiement dans localStorage : un visiteur
// qui modifie le localStorage via les DevTools peut la contourner.
// Dans un vrai backend, cette vérification doit être refaite côté
// serveur à chaque requête, jamais seulement au chargement de la page.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {

  const guardScreen   = document.getElementById('care-guard-screen');
  const headerEl       = document.getElementById('care-header');
  const stageEl        = document.getElementById('care-stage');
  const summaryScreen = document.getElementById('care-summary-screen');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }

  function denyAccess(reason) {
    guardScreen.innerHTML = `
      <div style="text-align:center; max-width:420px; padding:0 20px;">
        <p style="font-family:var(--serif); font-size:1.1rem; color:var(--ink); margin-bottom:12px;">Accès refusé</p>
        <p style="margin-bottom:24px;">${escapeHtml(reason)}</p>
        <a href="soins-direct.html" class="btn btn--accent">Retour au Soin Direct</a>
      </div>
    `;
  }

  // ---------------------------------------------------------
  // GARDE D'ACCÈS
  // Conditions cumulatives (équivalent du SERVER CHECK demandé,
  // ici simulé côté client) :
  //   1. Un client est connecté et n'est pas bloqué.
  //   2. La transaction passée en paramètre (?tx=...) existe, lui
  //      appartient, concerne le service "soins-direct", et est confirmée.
  // ---------------------------------------------------------
  const user = PO_Auth.getCurrentUser();
  if (!user) {
    window.location.href = 'connexion.html?redirect=soins-direct';
    return;
  }
  if (user.blocked) {
    denyAccess(user.blockReason || 'Votre compte a été bloqué.');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const txId = params.get('tx');
  const transaction = txId ? PO_Auth.listTransactions().find(t => t.id === txId) : null;

  if (!transaction || transaction.clientId !== user.id || transaction.service !== 'soins-direct') {
    denyAccess('Paiement obligatoire. Aucune transaction valide n\'a été trouvée pour ce soin.');
    return;
  }
  if (transaction.status !== 'confirmed') {
    denyAccess('Paiement obligatoire. Votre transaction n\'a pas encore été confirmée.');
    return;
  }

  // Accès autorisé — on démarre ou on reprend la séance.
  const cfg = PO_Care.getConfig();
  const { session } = PO_Care.startOrResumeSession({
    clientId: user.id,
    clientName: `${user.firstName} ${user.lastName}`,
    transactionId: transaction.id
  });

  guardScreen.hidden = true;
  headerEl.hidden = false;
  stageEl.hidden = false;

  document.getElementById('care-client-name').textContent = `${user.firstName} ${user.lastName}`;

  // ---------------------------------------------------------
  // CHRONOMÈTRE — compte à rebours depuis la durée configurée,
  // reprend où la séance en était (secondsElapsed) en cas de retour.
  // ---------------------------------------------------------
  const totalSeconds = (cfg.durationMinutes || 40) * 60;
  let secondsElapsed = session.secondsElapsed || 0;
  const timerEl = document.getElementById('care-timer');

  function renderTimer() {
    const remaining = Math.max(0, totalSeconds - secondsElapsed);
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    timerEl.textContent = `${mm}:${ss}`;
  }
  renderTimer();

  const tickInterval = setInterval(() => {
    secondsElapsed += 1;
    renderTimer();
  }, 1000);

  // ---------------------------------------------------------
  // MOTEUR D'ÉTAPES — états LOCKED / CURRENT / COMPLETED.
  // currentStepIndex est la seule étape "CURRENT" ; tout ce qui
  // précède est COMPLETED, tout ce qui suit est LOCKED et donc
  // inaccessible via la navigation (pas de saut d'étape possible).
  // ---------------------------------------------------------
  const steps = cfg.steps;
  let currentIndex = Math.min(session.currentStepIndex || 0, steps.length - 1);
  let pendingAnswer = session.answers[steps[currentIndex]?.id] ?? null;
  let stepTimerInterval = null;

  const stepCard   = document.getElementById('care-step-card');
  const prevBtn    = document.getElementById('care-prev-btn');
  const nextBtn    = document.getElementById('care-next-btn');
  const fillEl     = document.getElementById('care-progress-fill');
  const labelEl    = document.getElementById('care-progress-label');

  function renderProgress() {
    const pct = Math.round(((currentIndex) / Math.max(1, steps.length - 1)) * 100);
    fillEl.style.width = `${Math.min(100, pct)}%`;
    labelEl.textContent = `Étape ${currentIndex + 1} / ${steps.length}`;
  }

  function clearStepTimer() {
    if (stepTimerInterval) { clearInterval(stepTimerInterval); stepTimerInterval = null; }
  }

  function renderStep() {
    clearStepTimer();
    const step = steps[currentIndex];
    pendingAnswer = session.answers[step.id] ?? null;
    prevBtn.disabled = currentIndex === 0;
    renderProgress();

    let innerHtml = `
      <span class="care-card__eyebrow">${escapeHtml(typeLabel(step.type))}</span>
      <h2 class="care-card__title">${escapeHtml(step.title)}</h2>
      <p class="care-card__body">${escapeHtml(step.body)}</p>
    `;

    if (step.type === 'respiration' || step.type === 'visualisation' || step.type === 'pause') {
      innerHtml += `
        <div class="care-breath-ring" id="care-breath-ring">${step.durationSeconds || 60}s</div>
        <p class="care-timer-ring-label" id="care-ring-label">Laissez le temps s'écouler avant de continuer.</p>
      `;
    }

    if (step.type === 'questionnaire') {
      innerHtml += `<div class="care-questionnaire" id="care-questionnaire" role="radiogroup" aria-label="${escapeHtml(step.question || '')}">`;
      innerHtml += `<p style="font-family:var(--garamond); font-size:1.05rem; color:var(--ink); margin-bottom:6px;">${escapeHtml(step.question || '')}</p>`;
      (step.options || []).forEach((opt, i) => {
        const checked = pendingAnswer === opt;
        innerHtml += `
          <label class="care-option" aria-checked="${checked}" data-option-index="${i}">
            <input type="radio" name="care-option" value="${escapeHtml(opt)}" ${checked ? 'checked' : ''}>
            <span>${escapeHtml(opt)}</span>
          </label>
        `;
      });
      innerHtml += `</div>`;
    }

    stepCard.innerHTML = innerHtml;

    // Pour un questionnaire : on exige une réponse avant de continuer.
    if (step.type === 'questionnaire') {
      nextBtn.disabled = !pendingAnswer;
      stepCard.querySelectorAll('.care-option').forEach(label => {
        label.addEventListener('click', () => {
          const value = label.querySelector('input').value;
          pendingAnswer = value;
          PO_Care.recordAnswer(session.id, step.id, value);
          stepCard.querySelectorAll('.care-option').forEach(l => l.setAttribute('aria-checked', String(l === label)));
          nextBtn.disabled = false;
        });
      });
    } else if (step.durationSeconds) {
      // Pour respiration / visualisation / pause : minuteur d'étape obligatoire.
      let remaining = step.durationSeconds;
      const ring = document.getElementById('care-breath-ring');
      const ringLabel = document.getElementById('care-ring-label');
      nextBtn.disabled = true;
      stepTimerInterval = setInterval(() => {
        remaining -= 1;
        if (ring) ring.textContent = `${Math.max(0, remaining)}s`;
        if (remaining <= 0) {
          clearStepTimer();
          if (ringLabel) ringLabel.textContent = 'Vous pouvez poursuivre.';
          nextBtn.disabled = false;
        }
      }, 1000);
    } else {
      nextBtn.disabled = false;
    }

    nextBtn.textContent = currentIndex === steps.length - 1 ? 'Terminer la séance' : 'Continuer →';
  }

  function typeLabel(type) {
    const map = {
      texte: 'Lecture', respiration: 'Respiration guidée', questionnaire: 'Questionnaire',
      visualisation: 'Visualisation', pause: 'Intégration silencieuse'
    };
    return map[type] || type;
  }

  prevBtn.addEventListener('click', () => {
    if (currentIndex === 0) return;
    currentIndex -= 1;
    PO_Care.saveProgress(session.id, { currentStepIndex: currentIndex, secondsElapsed });
    renderStep();
  });

  nextBtn.addEventListener('click', () => {
    if (currentIndex < steps.length - 1) {
      currentIndex += 1;
      PO_Care.saveProgress(session.id, { currentStepIndex: currentIndex, secondsElapsed });
      renderStep();
    } else {
      finishSession();
    }
  });

  renderStep();

  // ---------------------------------------------------------
  // AUTOSAVE — toutes les 10 secondes, conformément à la demande.
  // ---------------------------------------------------------
  const autosaveTimer = setInterval(() => {
    PO_Care.saveProgress(session.id, { currentStepIndex: currentIndex, secondsElapsed });
    const indicator = document.getElementById('care-autosave-indicator');
    if (indicator) {
      indicator.textContent = 'Sauvegardé · ' + new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }, 10000);

  window.addEventListener('beforeunload', () => {
    PO_Care.saveProgress(session.id, { currentStepIndex: currentIndex, secondsElapsed });
  });

  // ---------------------------------------------------------
  // FIN DE SÉANCE
  // ---------------------------------------------------------
  function finishSession() {
    clearInterval(tickInterval);
    clearInterval(autosaveTimer);
    clearStepTimer();

    const { summary } = PO_Care.completeSession(session.id);

    headerEl.hidden = true;
    stageEl.hidden = true;
    summaryScreen.hidden = false;

    renderSummary(summary);
    sendSummaryEmail(summary, user);
  }

  function renderSummary(summary) {
    const content = document.getElementById('care-summary-content');
    const dateStr = new Date(summary.completedAt).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

    let html = `
      <div class="care-summary__row"><span>Soin</span><span>${escapeHtml(cfg.title)}</span></div>
      <div class="care-summary__row"><span>Date</span><span>${escapeHtml(dateStr)}</span></div>
      <div class="care-summary__row"><span>Durée de la séance</span><span>${summary.durationMinutes} minutes</span></div>
      <div class="care-summary__row"><span>Référence de transaction</span><span>${escapeHtml(summary.transactionId)}</span></div>
    `;

    const answered = summary.steps.filter(s => s.question);
    if (answered.length) {
      html += `<div class="care-summary__answer-block">`;
      answered.forEach(s => {
        html += `<p>${escapeHtml(s.question)}</p><strong>${escapeHtml(s.answer || '—')}</strong>`;
      });
      html += `</div>`;
    }
    content.innerHTML = html;

    document.getElementById('care-download-pdf').addEventListener('click', () => downloadPdf(summary));
  }

  // ---------------------------------------------------------
  // PDF — délégué à care-pdf.js (utilitaire partagé avec profil.html).
  // ---------------------------------------------------------
  function downloadPdf(summary) {
    PO_CarePdf.generate(summary, cfg.title);
  }

  // ---------------------------------------------------------
  // ENVOI AUTOMATIQUE PAR COURRIEL — simulation via PO_Notifications
  // (voir notifications-store.js). Aucun email n'est réellement transmis ;
  // l'entrée est journalisée et consultable par l'admin.
  // ---------------------------------------------------------
  function sendSummaryEmail(summary, user) {
    const statusEl = document.getElementById('care-email-status');
    const result = PO_Notifications.logEmail({
      type: 'care_session_summary',
      to: user.email,
      subject: 'Votre résumé de séance — Soin Interactif',
      body: `Bonjour ${user.firstName}, merci pour votre confiance. Votre séance "${cfg.title}" du ${new Date(summary.completedAt).toLocaleDateString('fr-CA')} est résumée en pièce jointe (PDF). Référence : ${summary.transactionId}.`
    });
    if (statusEl) {
      statusEl.textContent = result.ok
        ? `Résumé envoyé par courriel à ${user.email} (simulation).`
        : 'Envoi par courriel désactivé dans les réglages de notification.';
    }
  }

});
