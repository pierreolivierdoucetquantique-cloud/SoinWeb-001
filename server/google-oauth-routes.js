// =========================================================
// Ntabou Aka Wé — API — google-oauth-routes.js
//
// Routes d'autorisation unique pour connecter le Google Calendar de
// Pierre-Olivier (voir google-calendar-service.js pour le détail du flux).
// =========================================================

const { requireAdmin } = require('./auth-routes');
const googleCalendar = require('./google-calendar-service');
const zoom = require('./zoom-service');
const { isConfigured: isResendConfigured } = require('./resend-client');

function registerGoogleOAuthRoutes(app) {
  app.get('/api/admin/integrations-status', requireAdmin, (req, res) => {
    res.json({
      ok: true,
      zoom: { configured: zoom.isConfigured() },
      googleCalendar: { configured: googleCalendar.isConfigured(), authorized: googleCalendar.isAuthorized() },
      resend: { configured: isResendConfigured() },
      stripe: { configured: !!process.env.STRIPE_SECRET_KEY }
    });
  });

  app.get('/api/admin/google/status', requireAdmin, (req, res) => {
    res.json({
      ok: true,
      configured: googleCalendar.isConfigured(),
      authorized: googleCalendar.isAuthorized()
    });
  });

  app.get('/api/admin/google/auth-url', requireAdmin, (req, res) => {
    const url = googleCalendar.getAuthUrl();
    if (!url) return res.status(500).json({ ok: false, error: "Google Calendar non configuré (variables d'environnement manquantes)." });
    res.json({ ok: true, url });
  });

  app.get('/api/admin/google/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) {
      return res.status(400).send(`Autorisation refusée ou annulée (${error}). Vous pouvez fermer cette fenêtre et réessayer depuis Admin → Paramètres.`);
    }
    if (!code) {
      return res.status(400).send("Code d'autorisation manquant.");
    }
    const result = await googleCalendar.handleOAuthCallback(code);
    if (!result.ok) {
      return res.status(500).send(`Échec de la connexion à Google Calendar : ${result.error}. Vous pouvez fermer cette fenêtre et réessayer depuis Admin → Paramètres.`);
    }
    res.send('<html><body style="font-family:sans-serif; text-align:center; padding:60px;"><h2>Google Calendar connecté avec succès</h2><p>Vous pouvez fermer cette fenêtre et retourner dans Admin → Paramètres.</p></body></html>');
  });

  console.log('[Google] Routes enregistrées : GET /api/admin/integrations-status, /api/admin/google/status, /auth-url, /callback');
}

module.exports = { registerGoogleOAuthRoutes };
