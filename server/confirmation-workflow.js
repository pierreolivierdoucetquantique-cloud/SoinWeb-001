// =========================================================
// Ntabou Aka Wé — API — confirmation-workflow.js
//
// Orchestre tout ce qui doit se produire automatiquement dès qu'un
// paiement est réellement confirmé (webhook Stripe signé, ou virement
// Interac vérifié manuellement par l'admin) :
//
//   Paiement confirmé
//     → Numéro de confirmation généré
//     → Réunion Zoom créée (si configuré)
//     → Événement Google Calendar créé (si configuré/autorisé)
//     → Courriel de confirmation enrichi envoyé au client
//     → Notification envoyée à l'administrateur
//
// Chaque intégration externe (Zoom, Google Calendar) échoue de façon
// silencieuse-mais-journalisée si elle n'est pas configurée : un rendez-
// vous payé est TOUJOURS confirmé, même sans Zoom/Calendar branchés.
// =========================================================

const crypto = require('crypto');
const { db } = require('./db');
const zoom = require('./zoom-service');
const googleCalendar = require('./google-calendar-service');
const { generateConfirmationNumber } = require('./confirmation-service');
const { buildEmail } = require('./email-templates');
const { isConfigured: isResendConfigured, sendViaResend } = require('./resend-client');

const DAY_NAMES_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const ADMIN_EMAIL = 'pierreolivierdoucet.quantique@gmail.com';

function _dayOfWeekFr(dateStr) {
  try { return DAY_NAMES_FR[new Date(dateStr + 'T00:00:00').getDay()]; } catch { return ''; }
}

function _fmtCAD(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $ CAD';
}

function _logNotification(type, to, subject, body) {
  try {
    db.prepare('INSERT INTO notifications_log (id, channel, type, to_email, subject, body) VALUES (?, ?, ?, ?, ?, ?)')
      .run('log_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'), 'email', type, to, subject, body);
  } catch (e) { console.warn('[Workflow] Journalisation notification échouée:', e.message); }
}

async function _sendEmail(type, to, vars) {
  if (!isResendConfigured()) {
    console.warn(`[Workflow] Resend non configuré — courriel "${type}" pour ${to} non envoyé (journalisé seulement).`);
    _logNotification(type, to, `[non envoyé — Resend non configuré] ${type}`, JSON.stringify(vars));
    return { ok: false, skipped: true };
  }
  try {
    const { subject, html } = buildEmail(type, vars);
    const result = await sendViaResend({ to, subject, html });
    _logNotification(type, to, subject, html);
    return { ok: true, id: result.id };
  } catch (err) {
    console.error(`[Workflow] Échec envoi courriel "${type}" à ${to}:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Point d'entrée principal : à appeler dès qu'un paiement est réellement
 * confirmé (webhook Stripe vérifié, ou confirmation Interac par l'admin).
 * @param {string} transactionId
 * @returns {Promise<{ok: boolean, steps: object}>} détail de chaque étape,
 *   pour le rapport de validation et le débogage.
 */
async function confirmAppointmentPayment(transactionId) {
  const steps = {};
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!tx) return { ok: false, error: 'Transaction introuvable.', steps };

  const client = db.prepare('SELECT * FROM users WHERE id = ?').get(tx.client_id);
  const appt = tx.appointment_id ? db.prepare('SELECT * FROM appointments WHERE id = ?').get(tx.appointment_id) : null;

  // ---- 1. Rendez-vous confirmé + numéro de confirmation ----
  let confirmationNumber = appt?.confirmation_number || null;
  if (appt && !confirmationNumber) {
    confirmationNumber = generateConfirmationNumber(appt.date);
    db.prepare("UPDATE appointments SET status = 'confirmed', confirmation_number = ? WHERE id = ?")
      .run(confirmationNumber, appt.id);
  } else if (appt) {
    db.prepare("UPDATE appointments SET status = 'confirmed' WHERE id = ?").run(appt.id);
  }
  steps.appointmentConfirmed = { ok: true, confirmationNumber };

  if (!appt || !client) {
    steps.aborted = 'Rendez-vous ou client introuvable — arrêt après confirmation de base.';
    return { ok: true, steps };
  }

  const timezone = appt.timezone || 'America/Toronto';
  const startTimeIso = `${appt.date}T${appt.time}:00`;
  const durationMinutes = appt.duration || 60;
  const endDate = new Date(`${appt.date}T${appt.time}:00`);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);
  const endTimeIso = endDate.toISOString().slice(0, 19);
  const topic = `${appt.service} — ${client.first_name} ${client.last_name}`;

  // ---- 2. Réunion Zoom ----
  if (zoom.isConfigured()) {
    const zoomResult = await zoom.createMeeting({ topic, startTimeIso, durationMinutes, timezone });
    steps.zoom = zoomResult;
    if (zoomResult.ok) {
      db.prepare('UPDATE appointments SET zoom_meeting_id = ?, zoom_join_url = ?, zoom_password = ? WHERE id = ?')
        .run(zoomResult.meetingId, zoomResult.joinUrl, zoomResult.password || null, appt.id);
    } else {
      console.warn('[Workflow] Création réunion Zoom échouée :', zoomResult.error);
    }
  } else {
    steps.zoom = { ok: false, skipped: true, error: 'Zoom non configuré.' };
  }

  // ---- 3. Événement Google Calendar ----
  if (googleCalendar.isConfigured() && googleCalendar.isAuthorized()) {
    const description = [
      `Client : ${client.first_name} ${client.last_name}`,
      `Courriel : ${client.email}`,
      client.phone ? `Téléphone : ${client.phone}` : null,
      `Service : ${appt.service}`,
      confirmationNumber ? `Numéro de confirmation : ${confirmationNumber}` : null,
      'Statut du paiement : payé',
      steps.zoom?.ok ? `Zoom : ${steps.zoom.joinUrl}` : null
    ].filter(Boolean).join('\n');

    const calResult = await googleCalendar.createEvent({
      summary: topic,
      description,
      startIso: startTimeIso,
      endIso: endTimeIso,
      timezone,
      attendeeEmails: [client.email]
    });
    steps.googleCalendar = calResult;
    if (calResult.ok) {
      db.prepare('UPDATE appointments SET google_event_id = ?, google_event_link = ? WHERE id = ?')
        .run(calResult.eventId, calResult.htmlLink || null, appt.id);
    } else {
      console.warn('[Workflow] Création événement Google Calendar échouée :', calResult.error);
    }
  } else {
    steps.googleCalendar = { ok: false, skipped: true, error: 'Google Calendar non configuré ou non autorisé.' };
  }

  // ---- 4. Courriel de confirmation enrichi (client) ----
  const emailVars = {
    first_name: client.first_name,
    service: appt.service,
    appointment_date: appt.date,
    appointment_time: appt.time,
    day_of_week: _dayOfWeekFr(appt.date),
    duration: durationMinutes,
    timezone,
    amount_paid: _fmtCAD(tx.total),
    payment_status: 'Payé',
    confirmation_number: confirmationNumber,
    zoom_join_url: steps.zoom?.ok ? steps.zoom.joinUrl : null,
    zoom_meeting_id: steps.zoom?.ok ? steps.zoom.meetingId : null,
    zoom_password: steps.zoom?.ok ? steps.zoom.password : null,
    google_calendar_link: steps.googleCalendar?.ok ? steps.googleCalendar.htmlLink : null
  };
  steps.clientEmail = await _sendEmail('appointment_confirmation', client.email, emailVars);

  // ---- 5. Notification administrateur (courriel réel, en plus du journal) ----
  const adminEmailVars = {
    client_name: `${client.first_name} ${client.last_name}`,
    client_email: client.email,
    service: appt.service,
    appointment_date: appt.date,
    appointment_time: appt.time,
    day_of_week: _dayOfWeekFr(appt.date),
    zoom_join_url: steps.zoom?.ok ? steps.zoom.joinUrl : null,
    confirmation_number: confirmationNumber,
    transaction_id: tx.id
  };
  steps.adminNotification = await _sendEmail('admin_appointment_confirmed', ADMIN_EMAIL, adminEmailVars);

  return { ok: true, steps };
}

/**
 * À appeler dès qu'un client prend un rendez-vous (avant tout paiement) :
 * avise immédiatement l'administrateur par courriel qu'une nouvelle
 * demande de rendez-vous vient d'être créée.
 * @param {string} appointmentId
 */
async function notifyAdminNewBookingRequest(appointmentId) {
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
  if (!appt) return { ok: false, error: 'Rendez-vous introuvable.' };
  const client = db.prepare('SELECT * FROM users WHERE id = ?').get(appt.client_id);
  if (!client) return { ok: false, error: 'Client introuvable.' };

  const vars = {
    client_name: `${client.first_name} ${client.last_name}`,
    client_email: client.email,
    service: appt.service,
    appointment_date: appt.date,
    appointment_time: appt.time,
    day_of_week: _dayOfWeekFr(appt.date)
  };
  return _sendEmail('admin_new_appointment_request', ADMIN_EMAIL, vars);
}

/**
 * À appeler quand un rendez-vous confirmé est annulé : supprime la
 * réunion Zoom et l'événement Google Calendar associés, s'ils existent.
 */
async function handleAppointmentCancelled(appointmentId) {
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
  if (!appt) return { ok: false, error: 'Rendez-vous introuvable.' };
  const steps = {};
  if (appt.zoom_meeting_id) steps.zoom = await zoom.deleteMeeting(appt.zoom_meeting_id);
  if (appt.google_event_id) steps.googleCalendar = await googleCalendar.deleteEvent(appt.google_event_id);
  return { ok: true, steps };
}

/**
 * À appeler quand un rendez-vous confirmé est replanifié : met à jour la
 * réunion Zoom et l'événement Google Calendar associés, s'ils existent.
 */
async function handleAppointmentRescheduled(appointmentId) {
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
  if (!appt) return { ok: false, error: 'Rendez-vous introuvable.' };
  const steps = {};
  const timezone = appt.timezone || 'America/Toronto';
  const startTimeIso = `${appt.date}T${appt.time}:00`;
  const durationMinutes = appt.duration || 60;
  const endDate = new Date(startTimeIso);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);
  const endTimeIso = endDate.toISOString().slice(0, 19);

  if (appt.zoom_meeting_id) {
    steps.zoom = await zoom.updateMeeting(appt.zoom_meeting_id, { startTimeIso, durationMinutes, timezone });
  }
  if (appt.google_event_id) {
    steps.googleCalendar = await googleCalendar.updateEvent(appt.google_event_id, { startIso: startTimeIso, endIso: endTimeIso, timezone });
  }
  return { ok: true, steps };
}

module.exports = { confirmAppointmentPayment, handleAppointmentCancelled, handleAppointmentRescheduled, notifyAdminNewBookingRequest };
