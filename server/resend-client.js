// =========================================================
// Ntabou Aka Wé — API — resend-client.js
//
// Client Resend partagé : utilisé par email-routes.js (POST /api/send-email,
// appelé depuis le frontend) ET par confirmation-workflow.js (envoi
// déclenché directement côté serveur par le webhook Stripe, sans aucun
// frontend impliqué — voir la note de sécurité dans stripe-routes.js).
// =========================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

function isConfigured() {
  return !!RESEND_API_KEY;
}

async function sendViaResend({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY non configurée sur le serveur.');
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Erreur Resend (${response.status})`);
  }
  return data;
}

module.exports = { isConfigured, sendViaResend, FROM_EMAIL };
