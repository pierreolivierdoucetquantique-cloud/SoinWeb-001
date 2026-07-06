const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function run() {
  let html = fs.readFileSync(__dirname + '/admin.html', 'utf8');
  html = html.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com[^"]*"><\/script>\s*/, '');

  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/admin.html' });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};

  // ---- Capture tous les appels réseau vers l'API email sans jamais y accéder réellement ----
  const emailCalls = [];
  window.fetch = async (url, opts) => {
    if (String(url).includes('/api/send-email')) {
      const body = JSON.parse(opts.body);
      emailCalls.push(body);
      return { ok: true, json: async () => ({ ok: true, id: 'email_fake_' + emailCalls.length }) };
    }
    throw new Error('URL inattendue en test : ' + url);
  };
  window.AbortSignal = window.AbortSignal || { timeout: () => undefined };

  const files = ['auth.js', 'profile-photo.js', 'content-store.js', 'pricing.js', 'email-service.js',
                 'messenger-store.js', 'notifications-store.js', 'care-session-store.js',
                 'testimonials-store.js', 'care-pdf.js', 'admin.js'];
  const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + `
;
window.__poTest = {
  login: (d) => PO_Auth.login(d),
  createAccount: (d) => PO_Auth.createAccount(d),
  createAppointment: (d) => PO_Auth.createAppointment(d),
  updateAppointment: (id, p) => PO_Auth.updateAppointment(id, p),
  listAppointments: () => PO_Auth.listAppointments()
};
`;
  window.eval(combined);
  window.__poTest.login({ email: 'admin@ntabou-aka-we.fr', password: 'admin1234' });

  // Crée un client de test + un rendez-vous confirmé pour demain
  const acc = window.__poTest.createAccount({
    firstName: 'Alice', lastName: 'Tremblay', email: 'alice@example.com', age: 30, password: 'Password1'
  });
  const clientId = acc.user.id;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const { appointment } = window.__poTest.createAppointment({
    clientId, clientName: 'Alice Tremblay', service: 'Soins Énergétiques', serviceId: 'services-energetiques',
    date: tomorrowStr, time: '14:00', duration: 60, status: 'confirmed', source: 'admin'
  });

  // IMPORTANT : createAccount() connecte automatiquement le nouveau client
  // (comportement normal de l'app — voir auth.js), ce qui remplace la session
  // admin. On se reconnecte donc en admin avant de copier la session vers la
  // deuxième instance, sans quoi la garde d'accès de admin.js redirigerait.
  window.__poTest.login({ email: 'admin@ntabou-aka-we.fr', password: 'admin1234' });

  const dom2 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/admin.html' });
  dom2.window.HTMLElement.prototype.scrollIntoView = dom2.window.HTMLElement.prototype.scrollIntoView || function () {};
  dom2.window.fetch = window.fetch;
  dom2.window.AbortSignal = dom2.window.AbortSignal || { timeout: () => undefined };
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    dom2.window.localStorage.setItem(k, window.localStorage.getItem(k));
  }
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i);
    dom2.window.sessionStorage.setItem(k, window.sessionStorage.getItem(k));
  }
  dom2.window.eval(combined);
  await new Promise(r => setTimeout(r, 30));
  const doc2 = dom2.window.document;

  // ==================================================================
  // 1. RAPPEL — bouton "Envoyer les rappels de demain"
  // ==================================================================
  doc2.querySelector('[data-panel="notifications"]').dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 10));

  const remindersBtn = doc2.getElementById('send-reminders-btn');
  assert(!!remindersBtn, 'le bouton "Envoyer les rappels de demain" existe dans Admin → Notifications');
  remindersBtn.dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));

  const reminderCall = emailCalls.find(c => c.type === 'appointment_reminder');
  assert(!!reminderCall, 'un vrai courriel de rappel (appointment_reminder) a été envoyé via PO_EmailService');
  assert(reminderCall && reminderCall.to === 'alice@example.com', 'le rappel est envoyé au bon destinataire');

  const updatedAppt = dom2.window.__poTest.listAppointments().find(a => a.id === appointment.id);
  assert(!!updatedAppt.reminderSentAt, 'le rendez-vous est marqué comme ayant reçu son rappel (reminderSentAt)');

  // ---- Un second clic ne doit PAS renvoyer un rappel en double ----
  const callsBefore = emailCalls.length;
  remindersBtn.dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));
  assert(emailCalls.length === callsBefore, 'un second clic n\'envoie pas de rappel en double pour le même rendez-vous');

  // ==================================================================
  // 2. CONFIRMATION / ANNULATION — via les vrais boutons d'action rapide
  //    de la liste "Rendez-vous du jour" (Calendrier), comme un admin réel.
  // ==================================================================
  const todayStr = new Date().toISOString().slice(0, 10);
  const { appointment: appt2 } = dom2.window.__poTest.createAppointment({
    clientId, clientName: 'Alice Tremblay', service: 'Accompagnement 1:1', serviceId: 'accompagnement',
    date: todayStr, time: '10:00', duration: 90, status: 'pending', source: 'admin'
  });

  function clickQuickStatus(apptId, newStatus) {
    doc2.querySelector('[data-panel="calendar"]').dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
    const btn = doc2.querySelector(`[data-quick-status="${apptId}"][data-new-status="${newStatus}"]`);
    if (!btn) return false;
    btn.dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
    doc2.getElementById('confirm-modal-ok').dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
    return true;
  }

  const beforeConfirm = emailCalls.length;
  const clicked1 = clickQuickStatus(appt2.id, 'confirmed');
  assert(clicked1, 'le bouton "Accepter" est bien présent pour un rendez-vous en attente');
  await new Promise(r => setTimeout(r, 30));
  const confirmCall = emailCalls.slice(beforeConfirm).find(c => c.type === 'appointment_confirmation');
  assert(!!confirmCall, 'la confirmation d\'un rendez-vous envoie un vrai courriel (appointment_confirmation)');

  const beforeCancel = emailCalls.length;
  const clicked2 = clickQuickStatus(appt2.id, 'cancelled');
  assert(clicked2, 'le bouton "Annuler" est bien présent pour un rendez-vous confirmé');
  await new Promise(r => setTimeout(r, 30));
  const cancelCall = emailCalls.slice(beforeCancel).find(c => c.type === 'appointment_cancelled');
  assert(!!cancelCall, 'l\'annulation d\'un rendez-vous par l\'admin envoie un vrai courriel (appointment_cancelled)');

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
