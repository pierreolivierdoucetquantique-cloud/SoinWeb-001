// =========================================================
// Ntabou Aka Wé — api-client.js
//
// Client HTTP centralisé vers le vrai serveur (server/). Remplace les
// appels localStorage par de vrais appels réseau. Le jeton de session
// est conservé dans sessionStorage (survit à un rafraîchissement de
// page, pas à la fermeture de l'onglet — comme avant).
// =========================================================

const PO_Api = (() => {
  // ⬇️ Même URL que email-service.js / stripe-payment.js
  const API_BASE_URL = 'https://ntabou-aka-we.onrender.com';
  const SESSION_TOKEN_KEY = 'po_session_token';

  function getToken() {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  }
  function setToken(token) {
    if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  function clearToken() {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }

  async function request(method, path, body) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = getToken();
      if (token) headers['X-Session-Token'] = token;

      const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(12000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, error: data.error || `Erreur serveur (${response.status})`, status: response.status };
      }
      return data;
    } catch (err) {
      return { ok: false, error: 'Serveur injoignable : ' + err.message, offline: true };
    }
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    del: (path) => request('DELETE', path),
    getToken, setToken, clearToken
  };
})();
