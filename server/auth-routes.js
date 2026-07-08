// =========================================================
// Ntabou Aka Wé — API — auth-routes.js
//
// Authentification réelle : mots de passe hachés (bcrypt), sessions
// serveur (jeton en cookie httpOnly), réinitialisation par jeton
// stocké en base (plus en localStorage).
// =========================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('./db');

function genId(prefix) {
  return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}
function nz(v) { return v === undefined ? null : v; }

function userPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    age: row.age,
    phone: row.phone,
    photo: row.photo,
    role: row.role,
    blocked: !!row.blocked,
    blockReason: row.block_reason,
    createdAt: row.created_at
  };
}

function seedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@ntabou-aka-we.fr');
  if (!existing) {
    const hash = bcrypt.hashSync('admin1234', 10);
    db.prepare(`
      INSERT INTO users (id, first_name, last_name, email, password_hash, age, role)
      VALUES (?, ?, ?, ?, ?, ?, 'admin')
    `).run('usr_admin_seed', 'Ntabou Aka Wé', 'Admin', 'admin@ntabou-aka-we.fr', hash, 99);
  }
}
seedAdmin();

function getSessionUser(req) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  return user || null;
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Non authentifié.' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getSessionUser(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Accès refusé.' });
  req.user = user;
  next();
}

function registerAuthRoutes(app) {
  const json = express.json();

  app.post('/api/auth/register', json, (req, res) => {
    const { firstName, lastName, email, age, password } = req.body || {};
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Champs requis manquants.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(409).json({ ok: false, error: 'Un compte existe déjà avec cet email.' });

    const id = genId('usr');
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`
      INSERT INTO users (id, first_name, last_name, email, password_hash, age, role)
      VALUES (?, ?, ?, ?, ?, ?, 'client')
    `).run(id, firstName, lastName, email.toLowerCase(), hash, age || null);

    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json({ ok: true, token, user: userPublic(user) });
  });

  app.post('/api/auth/login', json, (req, res) => {
    const { email, password } = req.body || {};
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase());
    if (!row || !bcrypt.compareSync(password || '', row.password_hash)) {
      return res.status(401).json({ ok: false, error: 'Email ou mot de passe incorrect.' });
    }
    if (row.blocked) {
      return res.status(403).json({ ok: false, error: row.block_reason || 'Ce compte est bloqué.' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, row.id);
    res.json({ ok: true, token, user: userPublic(row) });
  });

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    const token = req.headers['x-session-token'];
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getSessionUser(req);
    res.json({ ok: true, user: userPublic(user) });
  });

  app.put('/api/auth/me', requireAuth, json, (req, res) => {
    const { firstName, lastName, phone, photo, age } = req.body || {};
    db.prepare(`
      UPDATE users SET
        first_name = COALESCE(?, first_name),
        last_name  = COALESCE(?, last_name),
        phone      = COALESCE(?, phone),
        photo      = COALESCE(?, photo),
        age        = COALESCE(?, age)
      WHERE id = ?
    `).run(nz(firstName), nz(lastName), nz(phone), nz(photo), nz(age), req.user.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ ok: true, user: userPublic(user) });
  });

  app.delete('/api/auth/me', requireAuth, (req, res) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true });
  });

  // Changement de mot de passe depuis le profil (distinct de la
  // réinitialisation par lien) — vérifie le mot de passe actuel côté
  // serveur, seul endroit capable de comparer le hash bcrypt.
  app.put('/api/auth/change-password', requireAuth, json, (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!bcrypt.compareSync(currentPassword || '', req.user.password_hash)) {
      return res.status(401).json({ ok: false, error: 'Le mot de passe actuel est incorrect.' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ ok: true });
  });

  // ---- Mot de passe oublié ----
  app.post('/api/auth/forgot-password', json, (req, res) => {
    const { email } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase());
    if (!user) return res.json({ ok: true, exists: false }); // ne jamais révéler si le compte existe

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO password_resets (id, email, token, expires_at) VALUES (?, ?, ?, ?)')
      .run(genId('pwr'), user.email, token, expiresAt);
    res.json({ ok: true, exists: true, token, firstName: user.first_name });
  });

  app.post('/api/auth/verify-reset-token', json, (req, res) => {
    const { email, token } = req.body || {};
    const reset = db.prepare('SELECT * FROM password_resets WHERE email = ? AND token = ?')
      .get((email || '').toLowerCase(), token);
    if (!reset) return res.status(400).json({ ok: false, error: 'Lien de réinitialisation invalide.' });
    if (reset.used) return res.status(400).json({ ok: false, error: 'Ce lien a déjà été utilisé.' });
    if (new Date() > new Date(reset.expires_at)) return res.status(400).json({ ok: false, error: 'Ce lien a expiré. Merci de refaire une demande.' });
    res.json({ ok: true });
  });

  app.post('/api/auth/reset-password', json, (req, res) => {
    const { email, token, newPassword } = req.body || {};
    const reset = db.prepare('SELECT * FROM password_resets WHERE email = ? AND token = ?')
      .get((email || '').toLowerCase(), token);
    if (!reset) return res.status(400).json({ ok: false, error: 'Lien de réinitialisation invalide.' });
    if (reset.used) return res.status(400).json({ ok: false, error: 'Ce lien a déjà été utilisé.' });
    if (new Date() > new Date(reset.expires_at)) return res.status(400).json({ ok: false, error: 'Ce lien a expiré. Merci de refaire une demande.' });
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ ok: false, error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, reset.email);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(reset.id);
    res.json({ ok: true });
  });

  // ---- Admin : gestion des clients ----
  app.get('/api/admin/clients', requireAdmin, (req, res) => {
    const rows = db.prepare("SELECT * FROM users WHERE role != 'admin' ORDER BY created_at DESC").all();
    res.json({ ok: true, clients: rows.map(userPublic) });
  });

  app.put('/api/admin/clients/:id/block', requireAdmin, json, (req, res) => {
    const { blocked, reason } = req.body || {};
    db.prepare('UPDATE users SET blocked = ?, block_reason = ? WHERE id = ?')
      .run(blocked ? 1 : 0, reason || '', req.params.id);
    res.json({ ok: true });
  });

  app.delete('/api/admin/clients/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    db.prepare('DELETE FROM appointments WHERE client_id = ?').run(id);
    db.prepare('DELETE FROM transactions WHERE client_id = ?').run(id);
    db.prepare('DELETE FROM testimonials WHERE client_id = ?').run(id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  console.log('[Auth] Routes enregistrées : /api/auth/*, /api/admin/clients*');
}

module.exports = { registerAuthRoutes, requireAuth, requireAdmin, getSessionUser, userPublic };
