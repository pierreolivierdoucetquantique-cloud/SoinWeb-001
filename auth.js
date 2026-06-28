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
//   email : admin@pierre-olivier.fr
//   mot de passe : admin1234
//   (l'inscription publique ne permet jamais de créer un compte admin — c'est volontaire)
// =========================================================

const PO_Auth = (() => {
  const USERS_KEY        = 'po_demo_users';
  const SESSION_KEY      = 'po_demo_session';
  const APPOINTMENTS_KEY = 'po_demo_appointments';

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

  // Crée le compte admin de démo une seule fois, s'il n'existe pas déjà
  function _seedAdmin() {
    const users = _readUsers();
    if (!users.some(u => u.email.toLowerCase() === 'admin@pierre-olivier.fr')) {
      users.push({
        id: 'usr_admin_seed',
        firstName: 'Pierre-Olivier',
        lastName: 'Admin',
        email: 'admin@pierre-olivier.fr',
        age: 99,
        password: 'admin1234',
        phone: '',
        photo: '',
        role: 'admin',
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

  return {
    createAccount, login, logout, getCurrentUser, isAdmin,
    updateProfile, deleteAccount, requestPasswordReset,
    listClients, deleteClientAsAdmin,
    listAppointments, listAppointmentsForClient,
    createAppointment, updateAppointment, deleteAppointment
  };
})();
