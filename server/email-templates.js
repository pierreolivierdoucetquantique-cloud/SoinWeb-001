// =========================================================
// Ntabou Aka Wé — API — email-templates.js
//
// Modèles par défaut pour chaque type de courriel envoyé par le frontend
// (voir email-service.js côté site). Chaque modèle reçoit les variables
// (`vars`) déjà préparées par le frontend et retourne { subject, html }.
//
// Si le frontend fournit `subject`/`body` explicitement (ex. via
// PO_EmailService.custom()), ces valeurs remplacent le modèle par défaut —
// voir email-routes.js.
// =========================================================

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function wrap(title, bodyHtml) {
  return `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#2a2a2a;">
    <h2 style="font-weight:500;color:#8a6d1f;margin-bottom:20px;">${esc(title)}</h2>
    <div style="font-size:15px;line-height:1.6;">${bodyHtml}</div>
    <p style="margin-top:32px;font-size:12px;color:#888;">Ntabou Aka Wé — ce courriel a été envoyé automatiquement, merci de ne pas y répondre directement.</p>
  </div>`;
}

const TEMPLATES = {
  appointment_confirmation: (v) => {
    const durationLine = v.duration ? ` (${esc(v.duration)} min)` : '';
    const dayLine = v.day_of_week ? `${esc(v.day_of_week)} ` : '';
    const tzLine = v.timezone ? ` (${esc(v.timezone)})` : '';

    // Message d'accueil demandé — inclus dès qu'un rendez-vous est confirmé
    // suite à un paiement vérifié (numéro de confirmation présent).
    const welcomeMessage = v.confirmation_number ? `
      <p>Bonjour,</p>
      <p>Merci sincèrement pour votre confiance.</p>
      <p>Votre rendez-vous est maintenant confirmé.</p>
      <p>Ce moment vous est entièrement réservé afin de vous offrir un espace d'écoute, de présence
      et d'accompagnement dans le respect, la confidentialité et la bienveillance.</p>
      <p>Je vous invite simplement à prendre quelques instants pour vous déposer intérieurement
      avant notre rencontre.</p>
      <p>Au plaisir de vous accompagner.</p>
      <p>Avec respect,<br>Pierre-Olivier Doucet</p>
    ` : `
      <p>Bonjour ${esc(v.first_name)},</p>
      <p>Votre rendez-vous <strong>${esc(v.service)}</strong> est confirmé pour le
      ${esc(v.appointment_date)} à ${esc(v.appointment_time)}${durationLine}.</p>
      <p>Au plaisir de vous accompagner.</p>
    `;

    // Détails structurés — n'apparaissent que si l'information existe
    // réellement (jamais de lien Zoom/Calendar fabriqué ou vide).
    const detailRows = [
      ['Service', v.service ? esc(v.service) : null],
      ['Date', v.appointment_date ? `${dayLine}${esc(v.appointment_date)}` : null],
      ['Heure', v.appointment_time ? `${esc(v.appointment_time)}${tzLine}` : null],
      ['Durée', v.duration ? `${esc(v.duration)} min` : null],
      ['Montant payé', v.amount_paid ? esc(v.amount_paid) : null],
      ['Statut du paiement', v.payment_status ? esc(v.payment_status) : null],
      ['Numéro de confirmation', v.confirmation_number ? esc(v.confirmation_number) : null]
    ].filter(([, val]) => !!val);

    const detailsHtml = detailRows.length ? `
      <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:14px;">
        ${detailRows.map(([label, val]) => `
          <tr>
            <td style="padding:6px 10px; color:#888; white-space:nowrap;">${esc(label)}</td>
            <td style="padding:6px 10px; font-weight:600;">${val}</td>
          </tr>
        `).join('')}
      </table>` : '';

    const zoomHtml = v.zoom_join_url ? `
      <div style="background:#f5f0e6; border-radius:8px; padding:16px 20px; margin:20px 0;">
        <p style="margin:0 0 8px; font-weight:600;">Rencontre par visioconférence (Zoom)</p>
        <p style="margin:0 0 6px;"><a href="${esc(v.zoom_join_url)}" style="color:#8a6d1f;">${esc(v.zoom_join_url)}</a></p>
        ${v.zoom_meeting_id ? `<p style="margin:0; font-size:13px; color:#666;">ID de réunion : ${esc(v.zoom_meeting_id)}${v.zoom_password ? ` — Mot de passe : ${esc(v.zoom_password)}` : ''}</p>` : ''}
      </div>` : '';

    const googleCalendarHtml = v.google_calendar_link ? `
      <p style="margin:20px 0;">
        <a href="${esc(v.google_calendar_link)}" style="display:inline-block; background:#8a6d1f; color:#fff; text-decoration:none; padding:10px 18px; border-radius:6px; font-size:14px;">
          Ajouter à Google Calendar
        </a>
      </p>` : '';

    const rescheduleCancelHtml = v.confirmation_number ? `
      <p style="font-size:13px; color:#888; margin-top:24px;">
        Besoin de replanifier ou d'annuler ? Rendez-vous dans votre espace personnel, section
        « Rendez-vous à venir ». Conservez votre numéro de confirmation pour toute question.
      </p>` : '';

    return {
      subject: v.confirmation_number ? `Rendez-vous confirmé — ${v.confirmation_number}` : 'Confirmation de votre rendez-vous',
      html: wrap('Rendez-vous confirmé', `${welcomeMessage}${detailsHtml}${zoomHtml}${googleCalendarHtml}${rescheduleCancelHtml}`)
    };
  },
  appointment_cancelled: (v) => ({
    subject: 'Annulation de votre rendez-vous',
    html: wrap('Rendez-vous annulé', `
      <p>Bonjour ${esc(v.first_name)},</p>
      <p>Votre rendez-vous <strong>${esc(v.service)}</strong> prévu le ${esc(v.appointment_date)}
      à ${esc(v.appointment_time)} a été annulé.</p>
      <p>N'hésitez pas à reprendre un nouveau créneau depuis votre espace personnel.</p>`)
  }),
  appointment_rescheduled: (v) => ({
    subject: 'Votre rendez-vous a été replanifié',
    html: wrap('Rendez-vous replanifié', `
      <p>Bonjour ${esc(v.first_name)},</p>
      <p>Votre rendez-vous <strong>${esc(v.service)}</strong> a été déplacé au
      ${esc(v.appointment_date)} à ${esc(v.appointment_time)}.</p>
      <p>Merci de vérifier ce nouveau créneau dans votre espace personnel.</p>`)
  }),
  appointment_reminder: (v) => ({
    subject: 'Rappel de votre rendez-vous',
    html: wrap('Petit rappel', `
      <p>Bonjour ${esc(v.first_name)},</p>
      <p>Votre rendez-vous <strong>${esc(v.service)}</strong> est prévu le
      ${esc(v.appointment_date)} à ${esc(v.appointment_time)}.</p>
      <p>Au plaisir de vous accompagner.</p>`)
  }),
  appointment_declined: (v) => ({
    subject: 'Votre demande de rendez-vous n\'a pas pu être confirmée',
    html: wrap('Demande non confirmée', `
      <p>Bonjour ${esc(v.first_name)},</p>
      <p>Votre demande de rendez-vous <strong>${esc(v.service)}</strong> prévue le
      ${esc(v.appointment_date)} à ${esc(v.appointment_time)} n'a malheureusement pas pu être confirmée.</p>
      <p>N'hésitez pas à choisir un autre créneau depuis votre espace personnel.</p>`)
  }),
  payment_interac: (v) => ({
    subject: 'Votre virement Interac est en attente de vérification',
    html: wrap('Virement reçu', `
      <p>Bonjour ${esc(v.first_name)},</p>
      <p>Nous avons bien reçu votre demande de paiement par virement Interac de
      <strong>${esc(v.amount)}</strong> pour "${esc(v.service)}".</p>
      <p>Votre rendez-vous sera confirmé dès réception vérifiée.</p>
      <p style="font-size:13px;color:#888;">Référence : ${esc(v.invoice_number)}</p>`)
  }),
  payment_confirmed: (v) => ({
    subject: 'Votre paiement a été confirmé',
    html: wrap('Paiement confirmé', `
      <p>Bonjour ${esc(v.first_name)},</p>
      <p>Nous avons bien confirmé votre paiement de <strong>${esc(v.amount)}</strong>
      pour "${esc(v.service)}". Votre rendez-vous est maintenant confirmé.</p>
      <p style="font-size:13px;color:#888;">Référence : ${esc(v.invoice_number)}</p>`)
  }),
  payment_stripe: (v) => ({
    subject: 'Paiement confirmé — votre rendez-vous est réservé',
    html: wrap('Paiement accepté', `
      <p>Bonjour ${esc(v.first_name)},</p>
      <p>Votre paiement de <strong>${esc(v.amount)}</strong> pour "${esc(v.service)}"
      a été accepté. Votre rendez-vous est confirmé.</p>
      <p style="font-size:13px;color:#888;">Référence : ${esc(v.invoice_number)}</p>`)
  }),
  payment_refused: (v) => ({
    subject: 'Votre paiement n\'a pas pu être vérifié',
    html: wrap('Paiement refusé', `
      <p>Bonjour ${esc(v.first_name)},</p>
      <p>Nous n'avons pas pu vérifier votre paiement pour "${esc(v.service)}".
      Veuillez nous contacter pour régulariser la situation.</p>
      <p style="font-size:13px;color:#888;">Référence : ${esc(v.invoice_number)}</p>`)
  }),
  registration: (v) => ({
    subject: 'Bienvenue chez Ntabou Aka Wé',
    html: wrap('Bienvenue', `
      <p>Bonjour ${esc(v.first_name)} ${esc(v.last_name)},</p>
      <p>Votre compte a été créé avec succès. Bienvenue !</p>`)
  }),
  // ---- Notifications internes (destinataire : l'administrateur) ----
  admin_new_appointment_request: (v) => ({
    subject: `Nouvelle demande de rendez-vous — ${esc(v.client_name)} (${esc(v.service)})`,
    html: wrap('Nouvelle demande de rendez-vous', `
      <p>Un client vient de prendre un rendez-vous sur le site.</p>
      <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:14px;">
        <tr><td style="padding:6px 10px; color:#888;">Client</td><td style="padding:6px 10px; font-weight:600;">${esc(v.client_name)} (${esc(v.client_email)})</td></tr>
        <tr><td style="padding:6px 10px; color:#888;">Service</td><td style="padding:6px 10px; font-weight:600;">${esc(v.service)}</td></tr>
        <tr><td style="padding:6px 10px; color:#888;">Date</td><td style="padding:6px 10px; font-weight:600;">${esc(v.day_of_week)} ${esc(v.appointment_date)} à ${esc(v.appointment_time)}</td></tr>
        <tr><td style="padding:6px 10px; color:#888;">Statut</td><td style="padding:6px 10px; font-weight:600;">En attente de confirmation / paiement</td></tr>
      </table>
      <p style="font-size:13px;color:#888;">Ce rendez-vous apparaît maintenant dans l'agenda admin.</p>`)
  }),
  admin_appointment_confirmed: (v) => ({
    subject: `Rendez-vous confirmé — ${esc(v.client_name)} (${esc(v.confirmation_number || v.transaction_id || '')})`,
    html: wrap('Rendez-vous confirmé (paiement reçu)', `
      <p>Le paiement a été confirmé et le rendez-vous ci-dessous est maintenant réservé.</p>
      <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:14px;">
        <tr><td style="padding:6px 10px; color:#888;">Client</td><td style="padding:6px 10px; font-weight:600;">${esc(v.client_name)} (${esc(v.client_email)})</td></tr>
        <tr><td style="padding:6px 10px; color:#888;">Service</td><td style="padding:6px 10px; font-weight:600;">${esc(v.service)}</td></tr>
        <tr><td style="padding:6px 10px; color:#888;">Date</td><td style="padding:6px 10px; font-weight:600;">${esc(v.day_of_week)} ${esc(v.appointment_date)} à ${esc(v.appointment_time)}</td></tr>
        <tr><td style="padding:6px 10px; color:#888;">Zoom</td><td style="padding:6px 10px; font-weight:600;">${v.zoom_join_url ? `<a href="${esc(v.zoom_join_url)}">${esc(v.zoom_join_url)}</a>` : 'non créé'}</td></tr>
        <tr><td style="padding:6px 10px; color:#888;">Numéro de confirmation</td><td style="padding:6px 10px; font-weight:600;">${esc(v.confirmation_number || '—')}</td></tr>
      </table>`)
  }),
  password_reset: (v) => ({
    subject: 'Réinitialisation de votre mot de passe',
    html: wrap('Réinitialisation de mot de passe', `
      <p>Bonjour${v.first_name ? ' ' + esc(v.first_name) : ''},</p>
      <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.</p>
      <p><a href="${esc(v.reset_link)}" style="display:inline-block;padding:12px 24px;background:#c9a54b;color:#1a1305;text-decoration:none;border-radius:8px;font-weight:600;">Choisir un nouveau mot de passe</a></p>
      <p style="font-size:13px;color:#888;">Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce courriel — votre mot de passe actuel reste inchangé.</p>`)
  }),
  contact: (v, subject, body) => ({
    subject: subject || 'Message de Ntabou Aka Wé',
    html: wrap(subject || 'Message', `<p>${esc(body || '').replace(/\n/g, '<br>')}</p>`)
  })
};

/**
 * Résout les variables {{var}} dans un gabarit personnalisé (même logique
 * que PO_Content.renderEmailTemplate() côté frontend, dupliquée ici car le
 * serveur ne partage pas l'état du navigateur).
 */
function _resolveVars(str, vars) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{{${k}}}`));
}

// Cherche un gabarit personnalisé sauvegardé par l'admin (Admin → Templates
// Email → table site_content, clé "po_cms_email_templates"). Retourne null
// si aucune personnalisation n'existe, si le type est désactivé, ou si le
// serveur n'a pas encore accès à la DB (tests unitaires isolés, etc.).
function _getCustomTemplate(type, vars) {
  let db;
  try { db = require('./db').db; } catch { return null; }
  try {
    const row = db.prepare('SELECT value_json FROM site_content WHERE key = ?').get('po_cms_email_templates');
    if (!row) return null;
    const parsed = JSON.parse(row.value_json);
    const tpl = parsed && parsed.templates && parsed.templates[type];
    if (!tpl || tpl.enabled === false || !tpl.subject || !tpl.body) return null;
    const signature = (parsed.layout && parsed.layout.signature) || 'Ntabou Aka Wé';
    const allVars = Object.assign({ signature, company_name: 'Ntabou Aka Wé' }, vars);
    const subject = _resolveVars(tpl.subject, allVars);
    const bodyText = _resolveVars(tpl.body, allVars);
    return { subject, html: wrap(subject, `<p>${esc(bodyText).replace(/\n/g, '<br>')}</p>`) };
  } catch (e) {
    console.warn('[Email] Lecture du gabarit personnalisé échouée, repli sur le modèle par défaut:', e.message);
    return null;
  }
}

/**
 * Construit { subject, html } pour un type d'email donné.
 * @param {string} type
 * @param {object} vars
 * @param {string} [subjectOverride] - utilisé par le type 'contact' ou si fourni explicitement
 * @param {string} [bodyOverride]
 */
function buildEmail(type, vars, subjectOverride, bodyOverride) {
  // Priorité : override explicite de l'appelant > gabarit personnalisé
  // sauvegardé par l'admin > modèle par défaut codé en dur.
  if (!subjectOverride && !bodyOverride) {
    const custom = _getCustomTemplate(type, vars || {});
    if (custom) return custom;
  }

  const tpl = TEMPLATES[type];
  if (!tpl) {
    // Type inconnu : repli générique plutôt que d'échouer silencieusement.
    return {
      subject: subjectOverride || `Notification — ${type}`,
      html: wrap(subjectOverride || 'Notification', `<p>${esc(bodyOverride || JSON.stringify(vars))}</p>`)
    };
  }
  const built = tpl(vars || {}, subjectOverride, bodyOverride);
  return {
    subject: subjectOverride || built.subject,
    html: built.html
  };
}

module.exports = { buildEmail, TEMPLATES };
