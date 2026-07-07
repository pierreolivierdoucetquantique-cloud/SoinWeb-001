const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function run() {
  const html = fs.readFileSync(__dirname + '/profil.html', 'utf8');

  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/profil.html' });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};
  const emailCalls = [];
  window.fetch = async (url, opts) => {
    if (String(url).includes('/api/send-email')) {
      emailCalls.push(JSON.parse(opts.body));
      return { ok: true, json: async () => ({ ok: true, id: 'email_fake' }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  window.AbortSignal = window.AbortSignal || { timeout: () => undefined };
  window.confirm = () => true;

  const files = ['script.js', 'auth.js', 'pricing.js', 'email-service.js', 'notifications-store.js',
                 'messenger-store.js', 'care-session-store.js', 'profile-photo.js'];
  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
  const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + '\n;\n' + inlineScript + `
;
window.__poTest = {
  createAccount: (d) => PO_Auth.createAccount(d),
  createAppointment: (d) => PO_Auth.createAppointment(d)
};
`;
  window.eval(combined);

  const acc = window.__poTest.createAccount({
    firstName: 'Bruno', lastName: 'Gagnon', email: 'bruno@example.com', age: 40, password: 'Password1'
  });
  const { appointment } = window.__poTest.createAppointment({
    clientId: acc.user.id, clientName: 'Bruno Gagnon', service: 'Soins Énergétiques', serviceId: 'services-energetiques',
    date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), time: '11:00', duration: 60,
    status: 'confirmed', source: 'client'
  });

  // Recharge la page (createAccount a déjà connecté ce client automatiquement)
  const dom2 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/profil.html' });
  dom2.window.HTMLElement.prototype.scrollIntoView = dom2.window.HTMLElement.prototype.scrollIntoView || function () {};
  dom2.window.fetch = window.fetch;
  dom2.window.AbortSignal = dom2.window.AbortSignal || { timeout: () => undefined };
  dom2.window.confirm = () => true;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    dom2.window.localStorage.setItem(k, window.localStorage.getItem(k));
  }
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i);
    dom2.window.sessionStorage.setItem(k, window.sessionStorage.getItem(k));
  }
  dom2.window.eval(combined);
  await new Promise(r => setTimeout(r, 40));
  const doc2 = dom2.window.document;

  const cancelBtn = doc2.querySelector(`[data-cancel-appt="${appointment.id}"]`);
  assert(!!cancelBtn, 'le bouton "Annuler ce rendez-vous" est visible pour un rendez-vous confirmé à venir');

  cancelBtn.dispatchEvent(new dom2.window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 30));

  const cancelCall = emailCalls.find(c => c.type === 'appointment_cancelled');
  assert(!!cancelCall, 'l\'annulation par le client envoie un vrai courriel (appointment_cancelled)');
  assert(cancelCall && cancelCall.to === 'bruno@example.com', 'le courriel d\'annulation est envoyé au bon client');

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
