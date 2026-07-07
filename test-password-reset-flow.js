const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

async function run() {
  // ---- 1. Prépare un compte + demande de réinitialisation (page mot-de-passe-oublie.html) ----
  const setupDom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://example.test/setup.html' });
  const w0 = setupDom.window;
  w0.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  w0.AbortSignal = { timeout: () => undefined };
  const authCode = fs.readFileSync(__dirname + '/auth.js', 'utf8').replace('const PO_Auth', 'window.PO_Auth');
  w0.eval(authCode);
  w0.PO_Auth.createAccount({ firstName: 'Gabrielle', lastName: 'Simard', email: 'gabrielle@example.com', age: 27, password: 'AncienMotDePasse1' });

  // ---- Demande via la page réelle mot-de-passe-oublie.html ----
  const forgotHtml = fs.readFileSync(__dirname + '/mot-de-passe-oublie.html', 'utf8');
  const domForgot = new JSDOM(forgotHtml, { runScripts: 'dangerously', url: 'https://example.test/mot-de-passe-oublie.html' });
  const wForgot = domForgot.window;
  const emailCalls = [];
  wForgot.fetch = async (url, opts) => {
    if (String(url).includes('/api/send-email')) {
      emailCalls.push(JSON.parse(opts.body));
      return { ok: true, json: async () => ({ ok: true, id: 'x' }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  wForgot.AbortSignal = wForgot.AbortSignal || { timeout: () => undefined };
  for (let i = 0; i < w0.localStorage.length; i++) {
    const k = w0.localStorage.key(i);
    wForgot.localStorage.setItem(k, w0.localStorage.getItem(k));
  }

  const filesForgot = ['script.js', 'auth.js', 'notifications-store.js', 'email-service.js'];
  const inlineForgot = forgotHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
  const combinedForgot = filesForgot.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + '\n;\n' + inlineForgot;
  wForgot.eval(combinedForgot);
  await new Promise(r => setTimeout(r, 30));

  const docForgot = wForgot.document;
  docForgot.getElementById('email').value = 'gabrielle@example.com';
  docForgot.getElementById('reset-form').dispatchEvent(new wForgot.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 30));

  assert(emailCalls.length === 1 && emailCalls[0].type === 'password_reset', 'un vrai courriel de réinitialisation (password_reset) est envoyé');
  assert(emailCalls[0].to === 'gabrielle@example.com', 'le courriel est envoyé à la bonne adresse');
  const linkMatch = emailCalls[0].vars.reset_link.match(/token=([a-z0-9]+)/);
  assert(!!linkMatch, 'le lien envoyé contient bien un jeton');
  const realToken = linkMatch[1];

  // ---- 2. Ouvre la page de réinitialisation avec le vrai lien reçu ----
  const resetHtml = fs.readFileSync(__dirname + '/reinitialiser-mot-de-passe.html', 'utf8');
  const domReset = new JSDOM(resetHtml, {
    runScripts: 'dangerously',
    url: `https://example.test/reinitialiser-mot-de-passe.html?email=gabrielle%40example.com&token=${realToken}`
  });
  const wReset = domReset.window;
  for (let i = 0; i < wForgot.localStorage.length; i++) {
    const k = wForgot.localStorage.key(i);
    wReset.localStorage.setItem(k, wForgot.localStorage.getItem(k));
  }
  const filesReset = ['script.js', 'auth.js'];
  const inlineReset = resetHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
  wReset.eval(filesReset.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n') + '\n;\n' + inlineReset);
  await new Promise(r => setTimeout(r, 30));

  const docReset = wReset.document;
  assert(docReset.getElementById('reset-form').hidden === false, 'le formulaire de nouveau mot de passe est visible pour un lien valide');

  // ---- Mots de passe qui ne correspondent pas ----
  docReset.getElementById('password').value = 'NouveauMotDePasse1';
  docReset.getElementById('password-confirm').value = 'Different1';
  docReset.getElementById('reset-form').dispatchEvent(new wReset.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 20));
  assert(docReset.getElementById('err-password-confirm').textContent.includes('correspondent'), 'une erreur claire apparaît si les deux mots de passe ne correspondent pas');

  // ---- Réinitialisation valide ----
  docReset.getElementById('password-confirm').value = 'NouveauMotDePasse1';
  docReset.getElementById('reset-form').dispatchEvent(new wReset.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 20));
  assert(docReset.getElementById('form-notice').textContent.includes('succès'), 'un message de succès confirme la réinitialisation');

  // ---- 3. Vérifie que le nouveau mot de passe fonctionne vraiment pour se connecter ----
  const loginDom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://example.test/login-check.html' });
  const wLogin = loginDom.window;
  for (let i = 0; i < wReset.localStorage.length; i++) {
    const k = wReset.localStorage.key(i);
    wLogin.localStorage.setItem(k, wReset.localStorage.getItem(k));
  }
  wLogin.eval(authCode.replace('window.PO_Auth', 'window.PO_Auth2'));
  const oldLogin = wLogin.PO_Auth2.login({ email: 'gabrielle@example.com', password: 'AncienMotDePasse1' });
  assert(!oldLogin.ok, "l'ancien mot de passe ne fonctionne plus après réinitialisation");
  const newLogin = wLogin.PO_Auth2.login({ email: 'gabrielle@example.com', password: 'NouveauMotDePasse1' });
  assert(newLogin.ok, 'le NOUVEAU mot de passe fonctionne réellement pour se connecter');

  // ---- 4. Le jeton est à usage unique : une seconde utilisation doit échouer ----
  const reuseCheck = wLogin.PO_Auth2.verifyResetToken('gabrielle@example.com', realToken);
  assert(!reuseCheck.ok, 'le jeton déjà utilisé est correctement rejeté (usage unique)');

  // ---- 5. Un jeton invalide/inexistant est rejeté ----
  const badCheck = wLogin.PO_Auth2.verifyResetToken('gabrielle@example.com', 'jeton-invalide-xyz');
  assert(!badCheck.ok, 'un jeton invalide est rejeté');

  console.log(`\n${pass} tests réussis, ${fail} échecs.`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
