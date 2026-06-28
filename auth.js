// =========================================================
// PIERRE-OLIVIER — auth.js
//
// SIMULATION FRONTEND UNIQUEMENT.
// Aucune donnée n'est envoyée à un serveur : tout est stocké
// dans localStorage/sessionStorage du navigateur, à titre de démonstration.
//
// Point de branchement futur (backend réel) :
//   - Remplacer PO_Auth.createAccount()  par un appel POST /auth/signup (Supabase Auth)
//   - Remplacer PO_Auth.login()          par un appel POST /auth/login
//   - Remplacer PO_Auth.getCurrentUser() par la lecture du JWT / session Supabase
//   - Remplacer PO_Auth.updateProfile()  par un appel PATCH /profile
//   - Remplacer PO_Auth.deleteAccount()  par un appel DELETE /account
//   - Remplacer les fonctions de rendez-vous par les appels au Calendar Manager / Supabase
//
// COMPTE ADMIN DE DÉMONSTRATION (créé automatiquement au premier chargement) :
//   email : admin@ntabou-aka-we.fr
//   mot de passe : admin1234
//   (l'inscription publique ne permet jamais de créer un compte admin — c'est volontaire)
//
// ---------------------------------------------------------------------------
// MODULE PAIEMENTS / SÉCURITÉ (Soins Direct) — AVERTISSEMENT IMPORTANT
//
// Les fonctions ci-dessous (transactions, limite de 2 séances / 30 jours,
// blocage de compte pour âge < 18) sont une SIMULATION FRONTEND. Elles
// donnent un parcours complet et un panneau admin fonctionnel pour la démo,
// mais elles ne constituent PAS un système de paiement ou de sécurité réel :
//   - Aucune carte n'est débitée : le "paiement par carte" n'est qu'une
//     attente artificielle suivie d'un statut "réussi" écrit en localStorage.
//   - Aucune clé Stripe n'est utilisée ni ne doit jamais apparaître en frontend.
//   - Toutes les règles (limite de séances, blocage par âge, statut de
//     paiement) sont vérifiées dans le navigateur : un visiteur qui ouvre les
//     DevTools peut modifier le localStorage et contourner ces règles.
// Avant toute mise en production avec de vrais paiements, il faut un backend
// (ex. Supabase + une fonction serveur) qui : crée les PaymentIntent Stripe
// côté serveur, vérifie les webhooks Stripe, revalide la limite de séances et
// l'âge côté serveur à chaque tentative de réservation, et journalise les
// événements de sécurité hors d'atteinte du navigateur.
// ---------------------------------------------------------------------------
// =========================================================

const PO_Auth = (() => {
  const USERS_KEY        = 'po_demo_users';
  const SESSION_KEY      = 'po_demo_session';
  const APPOINTMENTS_KEY = 'po_demo_appointments';
  const TRANSACTIONS_KEY = 'po_demo_transactions';

  function _readUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function _writeUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function _readAppointments() {
    try {
      return JSON.parse(localStorage.getItem(APPOINTMENTS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function _writeAppointments(appts) {
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appts));
  }

  function _readTransactions() {
    try {
      return JSON.parse(localStorage.getItem(TRANSACTIONS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function _writeTransactions(transactions) {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  }

  // Crée le compte admin de démo une seule fois, s'il n'existe pas déjà
  function _seedAdmin() {
    const users = _readUsers();
    if (!users.some(u => u.email.toLowerCase() === 'admin@ntabou-aka-we.fr')) {
      users.push({
        id: 'usr_admin_seed',
        firstName: 'Ntabou Aka Wé',
        lastName: 'Admin',
        email: 'admin@ntabou-aka-we.fr',
        age: 99,
        password: 'admin1234',
        phone: '',
        photo: '',
        role: 'admin',
        blocked: false,
        blockReason: '',
        createdAt: new Date().toISOString()
      });
      _writeUsers(users);
    }
  }
  _seedAdmin();

  function createAccount({ firstName, lastName, email, age, password }) {
    const users = _readUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: 'Un compte existe déjà avec cet email.' };
    }
    const user = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      firstName, lastName, email, age,
      password, // NOTE: démonstration uniquement — un vrai backend doit hasher ce champ, jamais le stocker en clair
      phone: '',
      photo: '',
      role: 'client', // l'inscription publique ne crée jamais de compte admin
      blocked: false,
      blockReason: '',
      createdAt: new Date().toISOString()
    };
    users.push(user);
    _writeUsers(users);
    sessionStorage.setItem(SESSION_KEY, user.id);
    return { ok: true, user };
  }

  function login({ email, password }) {
    const users = _readUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) {
      return { ok: false, error: 'Email ou mot de passe incorrect.' };
    }
    if (user.blocked) {
      return { ok: false, error: user.blockReason || 'Ce compte a été bloqué.', blocked: true };
    }
    sessionStorage.setItem(SESSION_KEY, user.id);
    return { ok: true, user };
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getCurrentUser() {
    const id = sessionStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const users = _readUsers();
    return users.find(u => u.id === id) || null;
  }

  function isAdmin() {
    const user = getCurrentUser();
    return Boolean(user && user.role === 'admin');
  }

  function updateProfile(id, patch) {
    const users = _readUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return { ok: false, error: 'Utilisateur introuvable.' };
    users[idx] = { ...users[idx], ...patch };
    _writeUsers(users);
    return { ok: true, user: users[idx] };
  }

  function deleteAccount(id) {
    const users = _readUsers().filter(u => u.id !== id);
    _writeUsers(users);
    logout();
    return { ok: true };
  }

  function requestPasswordReset(email) {
    const users = _readUsers();
    const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
    // Toujours répondre positivement côté UI, qu'un compte existe ou non,
    // pour ne jamais révéler si un email est enregistré (bonne pratique de sécurité).
    return { ok: true, exists };
  }

  // ----- ADMIN: Client Manager -----

  function listClients() {
    return _readUsers().filter(u => u.role !== 'admin');
  }

  function deleteClientAsAdmin(id) {
    const users = _readUsers().filter(u => u.id !== id);
    _writeUsers(users);
    // Supprime aussi ses rendez-vous
    const appts = _readAppointments().filter(a => a.clientId !== id);
    _writeAppointments(appts);
    return { ok: true };
  }

  // ----- ADMIN + CLIENT: Calendar Manager / Appointments -----
  //
  // Modèle d'un rendez-vous :
  // { id, clientId, clientName, service, date (ISO 'YYYY-MM-DD'), time ('HH:MM'),
  //   duration (minutes), status ('confirmed' | 'pending' | 'cancelled' | 'done'), notes }

  function listAppointments() {
    return _readAppointments();
  }

  function listAppointmentsForClient(clientId) {
    return _readAppointments().filter(a => a.clientId === clientId);
  }

  function createAppointment(data) {
    const appts = _readAppointments();
    const appt = {
      id: 'appt_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      status: 'confirmed',
      ...data
    };
    appts.push(appt);
    _writeAppointments(appts);
    return { ok: true, appointment: appt };
  }

  function updateAppointment(id, patch) {
    const appts = _readAppointments();
    const idx = appts.findIndex(a => a.id === id);
    if (idx === -1) return { ok: false, error: 'Rendez-vous introuvable.' };
    appts[idx] = { ...appts[idx], ...patch };
    _writeAppointments(appts);
    return { ok: true, appointment: appts[idx] };
  }

  function deleteAppointment(id) {
    const appts = _readAppointments().filter(a => a.id !== id);
    _writeAppointments(appts);
    return { ok: true };
  }

  // ===========================================================
  // PAIEMENTS / TRANSACTIONS (SIMULATION) — Soins Direct
  //
  // Modèle d'une transaction :
  // { id, clientId, clientName, service, formulaTitle, amount, duration,
  //   method ('interac' | 'card'), status ('pending_admin' | 'confirmed' | 'cancelled'),
  //   createdAt, confirmedAt }
  // ===========================================================

  function listTransactions() {
    return _readTransactions();
  }

  function listTransactionsForClient(clientId) {
    return _readTransactions().filter(t => t.clientId === clientId);
  }

  function createTransaction(data) {
    const transactions = _readTransactions();
    const tx = {
      id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      status: 'pending_admin',
      createdAt: new Date().toISOString(),
      confirmedAt: null,
      ...data
    };
    transactions.push(tx);
    _writeTransactions(transactions);
    return { ok: true, transaction: tx };
  }

  // Confirmation manuelle d'un virement Interac par l'admin.
  // NOTE: dans un vrai backend, la confirmation Stripe par carte se fait
  // via vérification de webhook signé — jamais par un simple bouton client.
  function confirmTransaction(id) {
    const transactions = _readTransactions();
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return { ok: false, error: 'Transaction introuvable.' };
    transactions[idx].status = 'confirmed';
    transactions[idx].confirmedAt = new Date().toISOString();
    _writeTransactions(transactions);
    return { ok: true, transaction: transactions[idx] };
  }

  function cancelTransaction(id) {
    const transactions = _readTransactions();
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return { ok: false, error: 'Transaction introuvable.' };
    transactions[idx].status = 'cancelled';
    _writeTransactions(transactions);
    return { ok: true, transaction: transactions[idx] };
  }

  // ===========================================================
  // RÈGLE : maximum 2 Soins Direct confirmés par période de 30 jours.
  //
  // AVERTISSEMENT : cette vérification tourne dans le navigateur, donc
  // elle est démonstrative seulement — un visiteur peut la contourner via
  // les DevTools. Dans un vrai backend, cette règle doit être revalidée
  // côté serveur avant toute confirmation de paiement, indépendamment de
  // ce que le frontend affiche.
  // ===========================================================

  function countDirectSessionsLast30Days(clientId) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return _readTransactions().filter(t =>
      t.clientId === clientId &&
      t.service === 'soins-direct' &&
      t.status === 'confirmed' &&
      new Date(t.createdAt).getTime() >= cutoff
    ).length;
  }

  function canBookDirectSession(clientId) {
    return countDirectSessionsLast30Days(clientId) < 2;
  }

  // ===========================================================
  // BLOCAGE DE COMPTE (validation d'âge et autres motifs)
  //
  // AVERTISSEMENT : un compte "bloqué" ici n'est qu'un indicateur stocké en
  // localStorage. Un vrai système doit invalider la session côté serveur et
  // empêcher toute nouvelle authentification, pas seulement masquer l'accès
  // dans l'interface.
  // ===========================================================

  function blockClient(clientId, reason) {
    const users = _readUsers();
    const idx = users.findIndex(u => u.id === clientId);
    if (idx === -1) return { ok: false, error: 'Client introuvable.' };
    users[idx].blocked = true;
    users[idx].blockReason = reason || 'Compte bloqué.';
    _writeUsers(users);
    logout(); // si c'est la session active, on la termine immédiatement
    return { ok: true, user: users[idx] };
  }

  function unblockClient(clientId) {
    const users = _readUsers();
    const idx = users.findIndex(u => u.id === clientId);
    if (idx === -1) return { ok: false, error: 'Client introuvable.' };
    users[idx].blocked = false;
    users[idx].blockReason = '';
    _writeUsers(users);
    return { ok: true, user: users[idx] };
  }

  return {
    createAccount, login, logout, getCurrentUser, isAdmin,
    updateProfile, deleteAccount, requestPasswordReset,
    listClients, deleteClientAsAdmin,
    listAppointments, listAppointmentsForClient,
    createAppointment, updateAppointment, deleteAppointment,
    listTransactions, listTransactionsForClient,
    createTransaction, confirmTransaction, cancelTransaction,
    countDirectSessionsLast30Days, canBookDirectSession,
    blockClient, unblockClient
  };
})();
