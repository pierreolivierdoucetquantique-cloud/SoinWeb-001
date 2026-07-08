// =========================================================
// Ntabou Aka Wé — email-service.js
//
// Envoie de vrais emails via le serveur API Render.
// Si l'API n'est pas disponible, journalise localement
// (comportement de simulation habituel).
//
// CONFIGURATION :
//   Changer API_BASE_URL vers l'URL de ton service API Render.
// =========================================================

const PO_EmailService = (() => {

  // ⬇️ CHANGER CETTE URL vers ton service API Render après déploiement
  const API_BASE_URL = 'https://ntabou-aka-we.onrender.com';

  let _enabled = true;

  function _fmtDate(isoDate) {
    if (!isoDate) return '';
    try {
      return new Date(isoDate + 'T00:00:00').toLocaleDateString('fr-CA', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch { return isoDate; }
  }

  function _fmtCAD(n) {
    const v = parseFloat(n) || 0;
    return v.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0$\u00a0CAD';
  }

  /**
   * Envoie un email via le serveur API.
   * @param {string} type       - Type d'email (appointment_confirmation, payment_interac, etc.)
   * @param {string} to         - Adresse email du destinataire
   * @param {object} vars       - Variables à injecter dans le template ({{first_name}}, etc.)
   * @param {string} [subject]  - Sujet personnalisé (optionnel — sinon le template par défaut)
   * @param {string} [body]     - Corps personnalisé (optionnel — sinon le template par défaut)
   * @returns {Promise<{ok: boolean, id?: string, error?: string, simulated?: boolean}>}
   */
  async function send({ type, to, vars = {}, subject, body }) {
    if (!_enabled || !to || !type) {
      return { ok: false, simulated: true, error: 'Service email désactivé ou paramètres manquants.' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, to, vars, subject, body }),
        signal: AbortSignal.timeout(8000) // timeout 8 secondes
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        console.warn('[EmailService] Erreur API:', data.error);
        _fallbackLog(type, to, vars, subject, body);
        return { ok: false, error: data.error, simulated: true };
      }

      console.log(`[EmailService] Email "${type}" envoyé → ${to}`);
      return { ok: true, id: data.id };

    } catch (err) {
      // Si le serveur n'est pas disponible → fallback simulation locale
      console.warn('[EmailService] API indisponible, journalisation locale:', err.message);
      _fallbackLog(type, to, vars, subject, body);
      return { ok: false, error: err.message, simulated: true };
    }
  }

  // Fallback : journalise dans notifications-store.js si l'API n'est pas disponible
  function _fallbackLog(type, to, vars, subject, body) {
    if (typeof PO_Notifications !== 'undefined') {
      PO_Notifications.logEmail({
        type,
        to,
        subject: subject || `[${type}] — simulation`,
        body: body || JSON.stringify(vars)
      });
    }
  }

  // ---- Méthodes pratiques pour chaque type d'événement ----

  /** Confirmation de rendez-vous */
  function appointmentConfirmation({ client, appointment }) {
    return send({
      type: 'appointment_confirmation',
      to:   client.email,
      vars: {
        first_name:       client.firstName,
        last_name:        client.lastName,
        service:          appointment.service,
        appointment_date: _fmtDate(appointment.date),
        appointment_time: appointment.time,
        duration:         appointment.duration
      }
    });
  }

  /** Annulation de rendez-vous */
  function appointmentCancelled({ client, appointment }) {
    return send({
      type: 'appointment_cancelled',
      to:   client.email,
      vars: {
        first_name:       client.firstName,
        service:          appointment.service,
        appointment_date: _fmtDate(appointment.date),
        appointment_time: appointment.time
      }
    });
  }

  /** Replanification de rendez-vous */
  function appointmentRescheduled({ client, appointment }) {
    return send({
      type: 'appointment_rescheduled',
      to:   client.email,
      vars: {
        first_name:       client.firstName,
        service:          appointment.service,
        appointment_date: _fmtDate(appointment.date),
        appointment_time: appointment.time
      }
    });
  }

  /** Rappel de rendez-vous */
  function appointmentReminder({ client, appointment }) {
    return send({
      type: 'appointment_reminder',
      to:   client.email,
      vars: {
        first_name:       client.firstName,
        service:          appointment.service,
        appointment_date: _fmtDate(appointment.date),
        appointment_time: appointment.time
      }
    });
  }

  /** Rendez-vous refusé */
  function appointmentDeclined({ client, appointment }) {
    return send({
      type: 'appointment_declined',
      to:   client.email,
      vars: {
        first_name:       client.firstName,
        service:          appointment.service,
        appointment_date: _fmtDate(appointment.date),
        appointment_time: appointment.time
      }
    });
  }

  /** Virement Interac signalé par le client */
  function paymentInterac({ client, transaction }) {
    return send({
      type: 'payment_interac',
      to:   client.email,
      vars: {
        first_name:     client.firstName,
        service:        transaction.service,
        amount:         _fmtCAD(transaction.total || transaction.amount),
        invoice_number: transaction.id
      }
    });
  }

  /** Paiement confirmé par l'admin (Interac validé) */
  function paymentConfirmed({ client, transaction }) {
    return send({
      type: 'payment_confirmed',
      to:   client.email,
      vars: {
        first_name:     client.firstName,
        service:        transaction.service,
        amount:         _fmtCAD(transaction.total || transaction.amount),
        invoice_number: transaction.id
      }
    });
  }

  /** Paiement Stripe */
  function paymentStripe({ client, transaction }) {
    return send({
      type: 'payment_stripe',
      to:   client.email,
      vars: {
        first_name:     client.firstName,
        service:        transaction.service,
        amount:         _fmtCAD(transaction.total || transaction.amount),
        invoice_number: transaction.id
      }
    });
  }

  /** Paiement refusé */
  function paymentRefused({ client, transaction }) {
    return send({
      type: 'payment_refused',
      to:   client.email,
      vars: {
        first_name:     client.firstName,
        service:        transaction.service,
        invoice_number: transaction.id
      }
    });
  }

  /** Inscription d'un nouveau client */
  function registration({ client }) {
    return send({
      type: 'registration',
      to:   client.email,
      vars: {
        first_name: client.firstName,
        last_name:  client.lastName
      }
    });
  }

  /** Séance Soin Direct terminée */
  function careCompleted({ client }) {
    return send({
      type: 'care_completed',
      to:   client.email,
      vars: { first_name: client.firstName }
    });
  }

  /** Réinitialisation de mot de passe — lien à usage unique, valide 1h */
  function passwordReset({ email, firstName, resetLink }) {
    return send({
      type: 'password_reset',
      to:   email,
      vars: { first_name: firstName || '', reset_link: resetLink }
    });
  }

  /** Email personnalisé depuis l'admin */
  function custom({ to, subject, body, vars = {} }) {
    return send({ type: 'contact', to, vars, subject, body });
  }

  /** Vérifier que l'API est disponible */
  async function healthCheck() {
    try {
      const r = await fetch(`${API_BASE_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
      return await r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /** Envoyer un email de test vers l'admin */
  async function testEmail() {
    try {
      const r = await fetch(`${API_BASE_URL}/api/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(10000)
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function setEnabled(val) { _enabled = !!val; }

  return {
    send,
    appointmentConfirmation, appointmentCancelled, appointmentRescheduled,
    appointmentReminder, appointmentDeclined,
    paymentInterac, paymentConfirmed, paymentStripe, paymentRefused,
    registration, careCompleted, passwordReset, custom,
    healthCheck, testEmail, setEnabled
  };
})();
