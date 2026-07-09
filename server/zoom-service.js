// =========================================================
// Ntabou Aka Wé — API — zoom-service.js
//
// Intégration Zoom via Server-to-Server OAuth (méthode recommandée par
// Zoom depuis la dépréciation des JWT apps — ne nécessite aucun
// consentement utilisateur, adaptée à un compte unique comme celui de
// Pierre-Olivier).
//
// VARIABLES D'ENVIRONNEMENT REQUISES (Render → Environment)
//   ZOOM_ACCOUNT_ID      Account ID de l'app Server-to-Server OAuth
//   ZOOM_CLIENT_ID       Client ID de la même app
//   ZOOM_CLIENT_SECRET   Client Secret de la même app
//
// Comment obtenir ces valeurs :
//   1. https://marketplace.zoom.us/ → Develop → Build App
//   2. Choisir "Server-to-Server OAuth"
//   3. Ajouter les scopes : meeting:write:admin, meeting:update:admin,
//      meeting:delete:admin (ou meeting:write si compte non-admin)
//   4. Copier Account ID / Client ID / Client Secret dans Render.
//
// Le Personal Meeting ID (7012962399) n'est PAS utilisé ici : les
// meetings créés via l'API sont des réunions planifiées indépendantes
// (une par rendez-vous) — pratique recommandée, pour ne pas exposer le
// même lien à tous les clients simultanément. Si l'usage du PMI est
// réellement souhaité, il faudra le préciser explicitement.
// =========================================================

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

function isConfigured() {
  return !!(ZOOM_ACCOUNT_ID && ZOOM_CLIENT_ID && ZOOM_CLIENT_SECRET);
}

let _tokenCache = { accessToken: null, expiresAt: 0 };

async function _getAccessToken() {
  if (_tokenCache.accessToken && Date.now() < _tokenCache.expiresAt - 60000) {
    return _tokenCache.accessToken;
  }
  const basicAuth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basicAuth}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.reason || data.error || `Erreur d'authentification Zoom (${response.status})`);
  }
  _tokenCache = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return _tokenCache.accessToken;
}

async function createMeeting({ topic, startTimeIso, durationMinutes, timezone, agenda }) {
  if (!isConfigured()) {
    return { ok: false, skipped: true, error: 'Zoom non configuré (ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET manquants).' };
  }
  try {
    const token = await _getAccessToken();
    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic || 'Rendez-vous Ntabou Aka Wé',
        type: 2,
        start_time: startTimeIso,
        duration: durationMinutes || 60,
        timezone: timezone || 'America/Toronto',
        agenda: agenda || '',
        settings: {
          join_before_host: false,
          waiting_room: true,
          approval_type: 2,
          audio: 'both',
          host_video: true,
          participant_video: true
        }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.message || `Erreur Zoom (${response.status})` };
    }
    return {
      ok: true,
      meetingId: String(data.id),
      joinUrl: data.join_url,
      password: data.password || null,
      waitingRoom: !!(data.settings && data.settings.waiting_room)
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function updateMeeting(meetingId, { startTimeIso, durationMinutes, timezone, topic }) {
  if (!isConfigured()) return { ok: false, skipped: true, error: 'Zoom non configuré.' };
  if (!meetingId) return { ok: false, error: 'meetingId requis.' };
  try {
    const token = await _getAccessToken();
    const patch = {};
    if (topic) patch.topic = topic;
    if (startTimeIso) patch.start_time = startTimeIso;
    if (durationMinutes) patch.duration = durationMinutes;
    if (timezone) patch.timezone = timezone;
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (response.status === 204) return { ok: true };
    const data = await response.json().catch(() => ({}));
    return { ok: false, error: data.message || `Erreur Zoom (${response.status})` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function deleteMeeting(meetingId) {
  if (!isConfigured()) return { ok: false, skipped: true, error: 'Zoom non configuré.' };
  if (!meetingId) return { ok: false, error: 'meetingId requis.' };
  try {
    const token = await _getAccessToken();
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.status === 204 || response.status === 404) return { ok: true };
    const data = await response.json().catch(() => ({}));
    return { ok: false, error: data.message || `Erreur Zoom (${response.status})` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { isConfigured, createMeeting, updateMeeting, deleteMeeting };
