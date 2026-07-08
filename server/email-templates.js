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
  appointment_confirmation: (v) => ({
    subject: 'Confirmation de votre rendez-vous',
    html: wrap('Rendez-vous confirmé', `
      <p>Bonjour ${esc(v.first_name)},</p>
      <p>Votre rendez-vous <strong>${esc(v.service)}</strong> est confirmé pour le
      ${esc(v.appointment_date)} à ${esc(v.appointment_time)}${v.duration ? ` (${esc(v.duration)} min)` : ''}.</p>
      <p>Au plaisir de vous accompagner.</p>`)
  }),
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
