// =========================================================
// PIERRE-OLIVIER — notifications-store.js
//
// SIMULATION FRONTEND UNIQUEMENT.
// Aucun email ou notification push n'est réellement envoyé.
// Ce module journalise ce qui AURAIT été envoyé (destinataire,
// sujet, contenu) pour que l'admin puisse vérifier le comportement
// du système avant le branchement à un vrai service d'envoi.
//
// Point de branchement futur (backend réel) :
//   - Remplacer logEmail() par un appel à l'API d'envoi
//     (SMTP / Resend, conformément au brief EMAIL_AUTOMATION)
//   - Remplacer logPush() par l'API Firebase Cloud Messaging
//   - Les "paramètres" (settings) deviendraient des préférences
//     serveur, vérifiées avant l'envoi de chaque notification
// =========================================================

const PO_Notifications = (() => {
  const LOG_KEY = 'po_demo_notifications_log';
  const SETTINGS_KEY = 'po_demo_notifications_settings';

  const EMAIL_TYPES = {
    registration: 'Confirmation d\'inscription',
    appointment_confirmation: 'Confirmation de rendez-vous',
    appointment_reminder: 'Rappel de rendez-vous',
    appointment_cancellation: 'Annulation de rendez-vous',
    admin_message: 'Nouveau message de l\'administrateur',
    password_reset: 'Réinitialisation de mot de passe'
  };

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

  function _seed() {
    if (_read(SETTINGS_KEY, null) === null) {
      _write(SETTINGS_KEY, {
        registration: true,
        appointment_confirmation: true,
        appointment_reminder: true,
        appointment_cancellation: true,
        admin_message: true,
        password_reset: true,
        pushEnabled: true
      });
    }
    if (_read(LOG_KEY, null) === null) {
      _write(LOG_KEY, []);
    }
  }
  _seed();

  function getSettings() {
    return _read(SETTINGS_KEY, {});
  }

  function updateSettings(patch) {
    const settings = { ...getSettings(), ...patch };
    _write(SETTINGS_KEY, settings);
    return { ok: true, settings };
  }

  function isEnabled(type) {
    const settings = getSettings();
    return Boolean(settings[type]);
  }

  // Journalise un email "envoyé" — ne fait rien si ce type est désactivé dans les réglages.
  function logEmail({ type, to, subject, body }) {
    if (!isEnabled(type)) {
      return { ok: false, skipped: true, reason: 'Ce type de notification est désactivé.' };
    }
    const log = _read(LOG_KEY, []);
    const entry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      channel: 'email',
      type,
      typeLabel: EMAIL_TYPES[type] || type,
      to,
      subject,
      body,
      createdAt: new Date().toISOString()
    };
    log.push(entry);
    _write(LOG_KEY, log);
    return { ok: true, entry };
  }

  function logPush({ to, title, body }) {
    if (!isEnabled('pushEnabled')) {
      return { ok: false, skipped: true, reason: 'Les notifications push sont désactivées.' };
    }
    const log = _read(LOG_KEY, []);
    const entry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      channel: 'push',
      type: 'push',
      typeLabel: 'Notification push',
      to,
      subject: title,
      body,
      createdAt: new Date().toISOString()
    };
    log.push(entry);
    _write(LOG_KEY, log);
    return { ok: true, entry };
  }

  function listLog() {
    return _read(LOG_KEY, []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function clearLog() {
    _write(LOG_KEY, []);
    return { ok: true };
  }

  return {
    EMAIL_TYPES, getSettings, updateSettings, isEnabled,
    logEmail, logPush, listLog, clearLog
  };
})();
