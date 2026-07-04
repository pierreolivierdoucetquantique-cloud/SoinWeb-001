// =========================================================
// PIERRE-OLIVIER — care-session-store.js
//
// SIMULATION FRONTEND UNIQUEMENT — voir l'avertissement complet
// en haut de auth.js. Ce module ajoute la "plateforme de soin
// interactif" qui suit le paiement du Soin Direct :
//   - Configuration des étapes du soin (éditable depuis l'admin,
//     onglet "Soin Interactif"), stockée dans localStorage.
//   - Déroulement d'une séance : progression étape par étape,
//     réponses aux questionnaires, autosauvegarde, résumé final.
//
// AVERTISSEMENT IMPORTANT — ce que ce module NE fait PAS :
//   - Il ne valide RIEN côté serveur. Toute "garde d'accès" (paiement
//     requis avant la séance, étape verrouillée, etc.) est une vérification
//     JavaScript exécutée dans le navigateur du visiteur : elle peut être
//     contournée via les DevTools (modifier le localStorage directement).
//   - Il n'y a pas de JWT, pas de CSRF, pas de session signée serveur,
//     pas de rate limiting, pas de journal d'audit hors d'atteinte du
//     client. Tout ce qui porte ces noms dans l'admin ou le code est un
//     intitulé descriptif pour la démo, pas une protection réelle.
//   - Le PDF de résumé est généré et "envoyé" uniquement dans le
//     navigateur (voir care-session.js et PO_Notifications.logEmail) :
//     aucun email n'est réellement transmis à un serveur de messagerie.
//
// Point de branchement futur (backend réel) :
//   - Remplacer le stockage localStorage par des tables Supabase
//     (care_sessions, care_progress, care_answers, care_summary)
//   - Revalider côté serveur, à CHAQUE requête : le statut de paiement,
//     l'identité du client (JWT), et l'état d'avancement de la séance
//     avant de renvoyer le contenu de l'étape suivante.
//   - Générer et envoyer le PDF depuis une fonction serveur (ex.
//     Supabase Edge Function + service d'email transactionnel), jamais
//     depuis le navigateur du client.
// =========================================================

const PO_Care = (() => {
  const STEPS_CONFIG_KEY  = 'po_demo_care_steps_config';
  const SESSIONS_KEY      = 'po_demo_care_sessions';   // une entrée par séance démarrée
  const SUMMARIES_KEY     = 'po_demo_care_summaries';  // résumé final, une fois la séance terminée

  function _read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function _write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ---------------------------------------------------------
  // CONFIGURATION DU SOIN (éditable depuis Admin → Soin Interactif)
  // ---------------------------------------------------------
  // Modèle d'une étape :
  // { id, type ('texte'|'respiration'|'questionnaire'|'visualisation'|'pause'),
  //   title, body, durationSeconds (pour respiration/pause/visualisation),
  //   question, options[] (pour questionnaire) }

  function _defaultConfig() {
    return {
      // Le prix n'est plus stocké ici : il est dérivé en direct depuis
      // le module Admin → Tarifs (formule "soins-direct"), source unique
      // de vérité pour tous les prix du site. Voir pricing.js / content-store.js.
      durationMinutes: 40,
      title: 'Soin Énergétique Interactif Personnel',
      steps: [
        {
          id: 'st_1',
          type: 'texte',
          title: 'Bienvenue dans votre espace de soin',
          body: 'Installez-vous confortablement, dans un lieu calme où vous ne serez pas dérangé(e). Fermez les yeux un instant et prenez trois respirations profondes avant de continuer.'
        },
        {
          id: 'st_2',
          type: 'respiration',
          title: 'Ancrage par la respiration',
          body: 'Suivez le rythme : inspirez pendant 4 secondes, retenez 4 secondes, expirez pendant 6 secondes. Répétez ce cycle jusqu\'à la fin du minuteur.',
          durationSeconds: 90
        },
        {
          id: 'st_3',
          type: 'questionnaire',
          title: 'Intention de la séance',
          body: 'Avant de poursuivre, prenez un instant pour nommer ce qui vous amène aujourd\'hui.',
          question: 'Quelle est votre intention principale pour ce soin ?',
          options: ['Apaiser une douleur physique', 'Relâcher une tension émotionnelle', 'Retrouver de la clarté', 'Me préparer à un évènement important', 'Autre']
        },
        {
          id: 'st_4',
          type: 'visualisation',
          title: 'Visualisation guidée',
          body: 'Imaginez une lumière chaude et dorée qui descend lentement depuis le sommet de votre tête, traverse votre corps, et se dépose dans chaque zone de tension qu\'elle rencontre.',
          durationSeconds: 120
        },
        {
          id: 'st_5',
          type: 'pause',
          title: 'Intégration silencieuse',
          body: 'Restez simplement présent(e). Aucune action requise — laissez l\'énergie circuler.',
          durationSeconds: 60
        },
        {
          id: 'st_6',
          type: 'questionnaire',
          title: 'Ressenti',
          body: 'Pour clore la séance, partagez votre ressenti.',
          question: 'Comment vous sentez-vous à présent ?',
          options: ['Plus léger(ère)', 'Plus calme', 'Encore tendu(e), mais apaisé(e)', 'Je ne sais pas encore, ça viendra']
        },
        {
          id: 'st_7',
          type: 'texte',
          title: 'Clôture',
          body: 'La séance est maintenant terminée. Une période d\'intégration énergétique de 11 jours est recommandée. Buvez de l\'eau et accordez-vous un moment de repos avant de reprendre vos activités.'
        }
      ]
    };
  }

  function getConfig() {
    let cfg = _read(STEPS_CONFIG_KEY, null);
    if (!cfg) {
      cfg = _defaultConfig();
      _write(STEPS_CONFIG_KEY, cfg);
    }
    return cfg;
  }

  function updateConfig(patch) {
    const cfg = { ...getConfig(), ...patch };
    _write(STEPS_CONFIG_KEY, cfg);
    return { ok: true, config: cfg };
  }

  function saveStep(step) {
    const cfg = getConfig();
    if (step.id) {
      const idx = cfg.steps.findIndex(s => s.id === step.id);
      if (idx === -1) return { ok: false, error: 'Étape introuvable.' };
      cfg.steps[idx] = { ...cfg.steps[idx], ...step };
    } else {
      step.id = 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      cfg.steps.push(step);
    }
    _write(STEPS_CONFIG_KEY, cfg);
    return { ok: true, steps: cfg.steps };
  }

  function removeStep(stepId) {
    const cfg = getConfig();
    cfg.steps = cfg.steps.filter(s => s.id !== stepId);
    _write(STEPS_CONFIG_KEY, cfg);
    return { ok: true, steps: cfg.steps };
  }

  function moveStep(stepId, direction) {
    const cfg = getConfig();
    const idx = cfg.steps.findIndex(s => s.id === stepId);
    const target = idx + direction;
    if (idx === -1 || target < 0 || target >= cfg.steps.length) {
      return { ok: false, error: 'Déplacement impossible.' };
    }
    [cfg.steps[idx], cfg.steps[target]] = [cfg.steps[target], cfg.steps[idx]];
    _write(STEPS_CONFIG_KEY, cfg);
    return { ok: true, steps: cfg.steps };
  }

  // ---------------------------------------------------------
  // SÉANCES (déroulement client)
  // ---------------------------------------------------------
  // Modèle d'une séance :
  // { id, clientId, clientName, transactionId, startedAt, completedAt,
  //   currentStepIndex, status ('en_cours'|'terminee'),
  //   answers: { [stepId]: réponse }, secondsElapsed, lastSavedAt }

  function _readSessions() {
    return _read(SESSIONS_KEY, []);
  }

  function _writeSessions(list) {
    _write(SESSIONS_KEY, list);
  }

  // Démarre une nouvelle séance, ou reprend la séance en cours déjà ouverte
  // pour ce client et cette transaction (permet de rafraîchir la page sans
  // perdre la progression, conformément à la règle AUTOSAVE de la demande).
  function startOrResumeSession({ clientId, clientName, transactionId }) {
    const sessions = _readSessions();
    const existing = sessions.find(s =>
      s.clientId === clientId && s.transactionId === transactionId && s.status === 'en_cours'
    );
    if (existing) return { ok: true, session: existing, resumed: true };

    const session = {
      id: 'care_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      clientId, clientName, transactionId,
      startedAt: new Date().toISOString(),
      completedAt: null,
      currentStepIndex: 0,
      status: 'en_cours',
      answers: {},
      secondsElapsed: 0,
      lastSavedAt: new Date().toISOString()
    };
    sessions.push(session);
    _writeSessions(sessions);
    return { ok: true, session, resumed: false };
  }

  function getSession(sessionId) {
    return _readSessions().find(s => s.id === sessionId) || null;
  }

  function getActiveSessionForClient(clientId) {
    return _readSessions().find(s => s.clientId === clientId && s.status === 'en_cours') || null;
  }

  // Appelée toutes les 10 secondes par care-session.js (AUTOSAVE),
  // et aussi immédiatement après chaque réponse à un questionnaire.
  function saveProgress(sessionId, patch) {
    const sessions = _readSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return { ok: false, error: 'Séance introuvable.' };
    sessions[idx] = { ...sessions[idx], ...patch, lastSavedAt: new Date().toISOString() };
    _writeSessions(sessions);
    return { ok: true, session: sessions[idx] };
  }

  function recordAnswer(sessionId, stepId, answer) {
    const session = getSession(sessionId);
    if (!session) return { ok: false, error: 'Séance introuvable.' };
    const answers = { ...session.answers, [stepId]: answer };
    return saveProgress(sessionId, { answers });
  }

  // ---------------------------------------------------------
  // FIN DE SÉANCE — RÉSUMÉ
  // ---------------------------------------------------------

  function _readSummaries() {
    return _read(SUMMARIES_KEY, []);
  }

  function _writeSummaries(list) {
    _write(SUMMARIES_KEY, list);
  }

  function completeSession(sessionId) {
    const sessions = _readSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return { ok: false, error: 'Séance introuvable.' };

    sessions[idx].status = 'terminee';
    sessions[idx].completedAt = new Date().toISOString();
    _writeSessions(sessions);

    const session = sessions[idx];
    const cfg = getConfig();
    const summary = {
      id: 'sum_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      sessionId: session.id,
      clientId: session.clientId,
      clientName: session.clientName,
      transactionId: session.transactionId,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      durationMinutes: Math.round((session.secondsElapsed || 0) / 60),
      steps: cfg.steps.map(s => ({
        title: s.title,
        type: s.type,
        question: s.question || null,
        answer: session.answers[s.id] ?? null
      })),
      pdfGeneratedAt: null
    };
    const summaries = _readSummaries();
    summaries.push(summary);
    _writeSummaries(summaries);
    return { ok: true, summary, session: sessions[idx] };
  }

  function markPdfGenerated(summaryId) {
    const summaries = _readSummaries();
    const idx = summaries.findIndex(s => s.id === summaryId);
    if (idx === -1) return { ok: false, error: 'Résumé introuvable.' };
    summaries[idx].pdfGeneratedAt = new Date().toISOString();
    _writeSummaries(summaries);
    return { ok: true, summary: summaries[idx] };
  }

  function listSummariesForClient(clientId) {
    return _readSummaries()
      .filter(s => s.clientId === clientId)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  }

  function getSummary(summaryId) {
    return _readSummaries().find(s => s.id === summaryId) || null;
  }

  // ----- ADMIN: vue d'ensemble -----
  function listAllSummaries() {
    return _readSummaries().sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  }

  function listAllSessions() {
    return _readSessions().sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  // Suppression permanente d'un résumé de séance
  function deleteSummary(summaryId) {
    const list = _readSummaries();
    if (!list.find(s => s.id === summaryId)) return { ok: false, error: 'Résumé introuvable.' };
    _writeSummaries(list.filter(s => s.id !== summaryId));
    return { ok: true };
  }

  // Vide toutes les séances et résumés (pour nettoyer les données de test)
  function purgeAllSessions() {
    _writeSessions([]);
    _writeSummaries([]);
    return { ok: true };
  }

  return {
    getConfig, updateConfig, saveStep, removeStep, moveStep,
    startOrResumeSession, getSession, getActiveSessionForClient,
    saveProgress, recordAnswer,
    completeSession, markPdfGenerated,
    listSummariesForClient, getSummary,
    listAllSummaries, listAllSessions,
    deleteSummary, purgeAllSessions
  };
})();
