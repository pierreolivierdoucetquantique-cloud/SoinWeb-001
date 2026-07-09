// =========================================================
// Ntabou Aka Wé — API — google-calendar-service.js
//
// Intégration Google Calendar (compte Gmail personnel, pas un domaine
// Google Workspace — un compte de service ne peut donc pas y accéder
// directement). On utilise le flux OAuth2 standard : autorisation unique
// par l'admin (Pierre-Olivier), puis un refresh token stocké en base
// (table site_content, réutilisée depuis l'audit des sauvegardes admin)
// permet au serveur d'agir sur SON calendrier indéfiniment, sans
// ré-authentification.
//
// VARIABLES D'ENVIRONNEMENT REQUISES (Render → Environment)
//   GOOGLE_CLIENT_ID       Client ID OAuth2 (Google Cloud Console)
//   GOOGLE_CLIENT_SECRET   Client Secret OAuth2
//   GOOGLE_REDIRECT_URI    ex. https://ntabou-aka-we.onrender.com/api/admin/google/callback
//
// Comment obtenir ces valeurs :
//   1. https://console.cloud.google.com/ → nouveau projet
//   2. APIs & Services → Bibliothèque → activer "Google Calendar API"
//   3. APIs & Services → Identifiants → Créer des identifiants →
//      ID client OAuth → Application Web
//   4. Ajouter GOOGLE_REDIRECT_URI dans les URI de redirection autorisés
//   5. Écran de consentement : ajouter pierreolivierdoucet.quantique@gmail.com
//      comme utilisateur de test (tant que l'app n'est pas publiée/vérifiée
//      par Google, seuls les comptes de test explicitement ajoutés peuvent
//      s'authentifier — c'est suffisant ici puisqu'un seul compte est utilisé)
//
// AUTORISATION UNIQUE (à faire une fois les credentials en place) :
//   Admin → Paramètres → section Intégrations → "Connecter Google Calendar"
//   (ouvre l'écran de consentement Google, puis revient automatiquement).
// =========================================================

const { db } = require('./db');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const TOKENS_CONTENT_KEY = 'po_google_calendar_tokens';
const CALENDAR_ID = 'primary'; // calendrier principal du compte connecté

function isConfigured() {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

function _getStoredTokens() {
  const row = db.prepare('SELECT value_json FROM site_content WHERE key = ?').get(TOKENS_CONTENT_KEY);
  if (!row) return null;
  try { return JSON.parse(row.value_json); } catch { return null; }
}

function _storeTokens(tokens) {
  db.prepare(`
    INSERT INTO site_content (key, value_json, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(TOKENS_CONTENT_KEY, JSON.stringify(tokens));
}

function isAuthorized() {
  const t = _getStoredTokens();
  return !!(t && t.refreshToken);
}

// ---- Étape 1 : URL de consentement (l'admin clique une fois) ----
function getAuthUrl() {
  if (!isConfigured()) return null;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent', // force le renvoi d'un refresh_token même si déjà autorisé avant
    scope: 'https://www.googleapis.com/auth/calendar.events'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ---- Étape 2 : callback — échange le code contre un refresh token ----
async function handleOAuthCallback(code) {
  if (!isConfigured()) return { ok: false, error: 'Google Calendar non configuré.' };
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    const data = await response.json();
    if (!response.ok) return { ok: false, error: data.error_description || data.error || `Erreur Google (${response.status})` };
    if (!data.refresh_token) {
      return { ok: false, error: "Google n'a pas renvoyé de refresh token (déjà autorisé ? révoquer l'accès dans myaccount.google.com puis réessayer)." };
    }
    _storeTokens({ refreshToken: data.refresh_token, savedAt: new Date().toISOString() });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function _getAccessToken() {
  const stored = _getStoredTokens();
  if (!stored || !stored.refreshToken) throw new Error('Google Calendar non autorisé (aucun refresh token enregistré).');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: stored.refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || `Erreur de rafraîchissement Google (${response.status})`);
  return data.access_token;
}

/**
 * Crée un événement Google Calendar.
 * @param {object} p
 * @param {string} p.summary
 * @param {string} p.description
 * @param {string} p.startIso - ex. 2026-08-10T14:00:00
 * @param {string} p.endIso
 * @param {string} [p.timezone]
 * @param {string} [p.location]
 * @param {string[]} [p.attendeeEmails]
 */
async function createEvent({ summary, description, startIso, endIso, timezone, location, attendeeEmails }) {
  if (!isConfigured()) return { ok: false, skipped: true, error: 'Google Calendar non configuré.' };
  if (!isAuthorized()) return { ok: false, skipped: true, error: "Google Calendar non autorisé (voir Admin → Paramètres → Intégrations)." };
  try {
    const token = await _getAccessToken();
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary,
        description,
        location: location || undefined,
        start: { dateTime: startIso, timeZone: timezone || 'America/Toronto' },
        end: { dateTime: endIso, timeZone: timezone || 'America/Toronto' },
        attendees: (attendeeEmails || []).map(email => ({ email })),
        reminders: { useDefault: true }
      })
    });
    const data = await response.json();
    if (!response.ok) return { ok: false, error: data.error?.message || `Erreur Google Calendar (${response.status})` };
    return { ok: true, eventId: data.id, htmlLink: data.htmlLink };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function updateEvent(eventId, { summary, description, startIso, endIso, timezone }) {
  if (!isConfigured() || !isAuthorized()) return { ok: false, skipped: true, error: 'Google Calendar non configuré ou non autorisé.' };
  if (!eventId) return { ok: false, error: 'eventId requis.' };
  try {
    const token = await _getAccessToken();
    const patch = {};
    if (summary) patch.summary = summary;
    if (description) patch.description = description;
    if (startIso) patch.start = { dateTime: startIso, timeZone: timezone || 'America/Toronto' };
    if (endIso) patch.end = { dateTime: endIso, timeZone: timezone || 'America/Toronto' };
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error?.message || `Erreur Google Calendar (${response.status})` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function deleteEvent(eventId) {
  if (!isConfigured() || !isAuthorized()) return { ok: false, skipped: true, error: 'Google Calendar non configuré ou non autorisé.' };
  if (!eventId) return { ok: false, error: 'eventId requis.' };
  try {
    const token = await _getAccessToken();
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.status === 204 || response.status === 410 || response.status === 404) return { ok: true };
    const data = await response.json().catch(() => ({}));
    return { ok: false, error: data.error?.message || `Erreur Google Calendar (${response.status})` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { isConfigured, isAuthorized, getAuthUrl, handleOAuthCallback, createEvent, updateEvent, deleteEvent };
