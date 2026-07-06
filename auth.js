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
// Le paiement par carte est réellement traité par Stripe (mode TEST) via
// Stripe Elements — voir stripe-payment.js (frontend) et
// server-stripe/stripe-routes.js (serveur : création du PaymentIntent +
// webhook signé). Aucune donnée de carte ne transite par ce fichier ni par
// notre serveur. Ce qui reste une simulation :
//   - Il n'y a pas encore de base de données réelle : la confirmation finale
//     du rendez-vous/de la transaction s'écrit toujours en localStorage,
//     déclenchée côté navigateur après succès de Stripe (pas encore depuis
//     le webhook serveur, qui est prêt mais n'a rien à écrire tant que la
//     migration Supabase n'est pas faite).
//   - Toutes les règles applicatives (limite de séances, blocage par âge,
//     statut de paiement) sont vérifiées dans le navigateur : un visiteur
//     qui ouvre les DevTools peut modifier le localStorage et contourner
//     ces règles. Elles doivent être revalidées côté serveur en production.
//   - Le virement Interac reste, par nature, vérifié manuellement par
//     l'administration (aucune API bancaire automatisée).
// Avant la mise en production réelle : basculer les clés Stripe de test
// (sk_test_/pk_test_) vers les clés Live, et brancher le webhook sur une
// vraie base de données (Supabase) pour qu'il devienne la seule source de
// vérité du statut de paiement.
// ---------------------------------------------------------------------------
// =========================================================

const PO_Auth = (() => {
  const USERS_KEY        = 'po_demo_users';
  const SESSION_KEY      = 'po_demo_session';
  const APPOINTMENTS_KEY = 'po_demo_appointments';
  const TRANSACTIONS_KEY = 'po_demo_transactions';
  const PAYMENT_SETTINGS_KEY = 'po_demo_payment_settings';
  const AVAILABILITY_KEY = 'po_demo_availability';

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

  function _readPaymentSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(PAYMENT_SETTINGS_KEY));
      if (s) return s;
    } catch { /* ignore */ }
    return {
      taxesEnabled: false,
      tpsRate: 5,
      tvqRate: 9.975,
      interacEmail: 'pierreolivierdoucet.quantique@gmail.com'
    };
  }

  function _writePaymentSettings(s) {
    localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(s));
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
    // Suppression en cascade : client + toutes ses données liées
    const users = _readUsers().filter(u => u.id !== id);
    _writeUsers(users);

    // Rendez-vous
    const appts = _readAppointments().filter(a => a.clientId !== id);
    _writeAppointments(appts);

    // Transactions / paiements
    const txs = _readTransactions().filter(t => t.clientId !== id);
    _writeTransactions(txs);

    // Journal de notifications lié à ce client (emails/push)
    try {
      const NOTIF_LOG_KEY = 'po_demo_notif_log';
      const logs = JSON.parse(localStorage.getItem(NOTIF_LOG_KEY) || '[]');
      localStorage.setItem(NOTIF_LOG_KEY, JSON.stringify(logs.filter(l => l.to !== id && !String(l.body || '').includes(id))));
    } catch (_) { /* ignore */ }

    return { ok: true };
  }

  // ----- ADMIN + CLIENT: Calendar Manager / Appointments -----
  //
  // Modèle d'un rendez-vous :
  // { id, clientId, clientName, service, date (ISO 'YYYY-MM-DD'), time ('HH:MM'),
  //   duration (minutes), status ('confirmed' | 'pending' | 'cancelled' | 'done'),
  //   notes,
  //   source ('admin' | 'client') — qui a créé ce rendez-vous,
  //   blocked (bool) — true si c'est un blocage de créneau (vacances/indisponibilité)
  //   et non un vrai rendez-vous client,
  //   recurringGroupId (string|null) — identifiant commun à tous les rendez-vous
  //   générés par une même règle de récurrence, pour permettre leur suppression groupée }

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
      source: 'admin',
      blocked: false,
      recurringGroupId: null,
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

  // Supprime tous les rendez-vous/blocages partageant le même recurringGroupId.
  // Utilisé pour annuler une série récurrente en une seule action admin.
  function deleteAppointmentSeries(recurringGroupId) {
    if (!recurringGroupId) return { ok: false, error: 'Identifiant de série manquant.' };
    const appts = _readAppointments().filter(a => a.recurringGroupId !== recurringGroupId);
    _writeAppointments(appts);
    return { ok: true };
  }

  // Déplace un rendez-vous à une nouvelle date/heure (utilisé par le drag & drop admin).
  // Revalide que le nouveau créneau ne chevauche pas un rendez-vous existant.
  function moveAppointment(id, newDate, newTime) {
    const appts = _readAppointments();
    const idx = appts.findIndex(a => a.id === id);
    if (idx === -1) return { ok: false, error: 'Rendez-vous introuvable.' };
    const moving = appts[idx];
    const conflict = appts.find(a =>
      a.id !== id && a.date === newDate && a.status !== 'cancelled' &&
      _timeRangesOverlap(a.time, a.duration, newTime, moving.duration)
    );
    if (conflict) return { ok: false, error: 'Ce créneau chevauche un rendez-vous existant.' };
    appts[idx] = { ...moving, date: newDate, time: newTime };
    _writeAppointments(appts);
    return { ok: true, appointment: appts[idx] };
  }

  function _timeToMinutes(t) {
    const [h, m] = String(t).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function _timeRangesOverlap(timeA, durA, timeB, durB) {
    const startA = _timeToMinutes(timeA), endA = startA + (Number(durA) || 60);
    const startB = _timeToMinutes(timeB), endB = startB + (Number(durB) || 60);
    return startA < endB && startB < endA;
  }

  // ===========================================================
  // DISPONIBILITÉS / CALENDAR MANAGER — règles horaires, vacances, récurrence
  //
  // SIMULATION FRONTEND : ces règles ne sont vérifiées que dans ce navigateur.
  // Point de branchement futur : remplacer par une table "availability" côté
  // Supabase, avec revalidation serveur de chaque créneau au moment de la
  // réservation (pour éviter les doubles réservations entre deux appareils).
  //
  // Modèle de l'objet availability (un seul objet, clé unique) :
  // {
  //   weeklyHours: {
  //     'services-energetiques': { mon:[{start,end}], tue:[...], ... },
  //     'accompagnement':        { mon:[{start,end}], ... }
  //   },
  //   slotDurationMinutes: { 'services-energetiques': 60, 'accompagnement': 60 },
  //   vacations: [ { id, startDate, endDate, label } ],  // bloque tous les services
  //   holidays: [ { id, date, label, recurringYearly } ],  // jours fériés, bloque tous les services
  //   pauseSettings: {
  //     enabled: bool,
  //     durationMinutes: number,           // 5/10/15/20/30/45/60 ou valeur personnalisée
  //     mode: 'global' | 'perService' | 'perDay',
  //     perService: { 'services-energetiques': number, 'accompagnement': number },
  //     perDay: { mon: number, tue: number, ... }
  //   }
  // }
  // ===========================================================

  const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  function _defaultPauseSettings() {
    return {
      enabled: false,
      durationMinutes: 15,
      mode: 'global',
      perService: { 'services-energetiques': 15, 'accompagnement': 15 },
      perDay: { mon: 15, tue: 15, wed: 15, thu: 15, fri: 15, sat: 15, sun: 15 }
    };
  }

  function _defaultAvailability() {
    const businessHours = [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }];
    const weekdays = { mon: businessHours, tue: businessHours, wed: businessHours, thu: businessHours, fri: businessHours, sat: [], sun: [] };
    return {
      weeklyHours: {
        'services-energetiques': { ...weekdays },
        'accompagnement': { ...weekdays }
      },
      slotDurationMinutes: {
        'services-energetiques': 60,
        'accompagnement': 60
      },
      vacations: [],
      holidays: [],
      pauseSettings: _defaultPauseSettings()
    };
  }

  function _readAvailability() {
    try {
      const stored = JSON.parse(localStorage.getItem(AVAILABILITY_KEY));
      if (!stored) return _defaultAvailability();
      // Fusion défensive : si une clé de service manque (ex. après mise à jour),
      // on retombe sur les valeurs par défaut pour cette clé uniquement.
      const defaults = _defaultAvailability();
      return {
        weeklyHours: { ...defaults.weeklyHours, ...stored.weeklyHours },
        slotDurationMinutes: { ...defaults.slotDurationMinutes, ...stored.slotDurationMinutes },
        vacations: Array.isArray(stored.vacations) ? stored.vacations : [],
        holidays: Array.isArray(stored.holidays) ? stored.holidays : [],
        pauseSettings: {
          ...defaults.pauseSettings,
          ...(stored.pauseSettings || {}),
          perService: { ...defaults.pauseSettings.perService, ...((stored.pauseSettings || {}).perService || {}) },
          perDay: { ...defaults.pauseSettings.perDay, ...((stored.pauseSettings || {}).perDay || {}) }
        }
      };
    } catch {
      return _defaultAvailability();
    }
  }

  function _writeAvailability(av) {
    localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(av));
  }

  function getAvailability() {
    return _readAvailability();
  }

  // Écriture atomique de l'objet availability complet — utilisée par le
  // panneau Admin > Calendrier > Disponibilités, qui fonctionne en mode
  // brouillon (Save / Cancel) plutôt que d'écrire champ par champ.
  function replaceAvailability(nextAv) {
    const defaults = _defaultAvailability();
    const av = {
      weeklyHours: { ...defaults.weeklyHours, ...(nextAv.weeklyHours || {}) },
      slotDurationMinutes: { ...defaults.slotDurationMinutes, ...(nextAv.slotDurationMinutes || {}) },
      vacations: Array.isArray(nextAv.vacations) ? nextAv.vacations : [],
      holidays: Array.isArray(nextAv.holidays) ? nextAv.holidays : [],
      pauseSettings: {
        ...defaults.pauseSettings,
        ...(nextAv.pauseSettings || {}),
        perService: { ...defaults.pauseSettings.perService, ...((nextAv.pauseSettings || {}).perService || {}) },
        perDay: { ...defaults.pauseSettings.perDay, ...((nextAv.pauseSettings || {}).perDay || {}) }
      }
    };
    _writeAvailability(av);
    return { ok: true, availability: av };
  }

  function updateWeeklyHours(serviceId, dayKey, ranges) {
    if (!WEEKDAY_KEYS.includes(dayKey)) return { ok: false, error: 'Jour invalide.' };
    const av = _readAvailability();
    if (!av.weeklyHours[serviceId]) av.weeklyHours[serviceId] = {};
    av.weeklyHours[serviceId][dayKey] = ranges;
    _writeAvailability(av);
    return { ok: true, availability: av };
  }

  function setSlotDuration(serviceId, minutes) {
    const av = _readAvailability();
    av.slotDurationMinutes[serviceId] = Math.max(15, parseInt(minutes, 10) || 60);
    _writeAvailability(av);
    return { ok: true, availability: av };
  }

  function addVacation({ startDate, endDate, label }) {
    if (!startDate || !endDate) return { ok: false, error: 'Dates de vacances manquantes.' };
    const av = _readAvailability();
    const vacation = { id: 'vac_' + Date.now() + '_' + Math.floor(Math.random() * 1000), startDate, endDate, label: label || '' };
    av.vacations.push(vacation);
    _writeAvailability(av);
    return { ok: true, vacation };
  }

  function removeVacation(id) {
    const av = _readAvailability();
    av.vacations = av.vacations.filter(v => v.id !== id);
    _writeAvailability(av);
    return { ok: true };
  }

  function _dateIsOnVacation(dateStr, vacations) {
    return vacations.some(v => dateStr >= v.startDate && dateStr <= v.endDate);
  }

  // ----- Jours fériés -----
  // Distincts des vacances : une date unique, avec option de récurrence
  // annuelle (ex. Noël tombe le 25 décembre chaque année).
  function addHoliday({ date, label, recurringYearly }) {
    if (!date) return { ok: false, error: 'Date du jour férié manquante.' };
    const av = _readAvailability();
    const holiday = {
      id: 'hol_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      date, label: label || '', recurringYearly: !!recurringYearly
    };
    av.holidays.push(holiday);
    _writeAvailability(av);
    return { ok: true, holiday };
  }

  function removeHoliday(id) {
    const av = _readAvailability();
    av.holidays = av.holidays.filter(h => h.id !== id);
    _writeAvailability(av);
    return { ok: true };
  }

  function _dateIsHoliday(dateStr, holidays) {
    const [y, m, d] = dateStr.split('-');
    return holidays.some(h => {
      if (h.recurringYearly) {
        const [, hm, hd] = h.date.split('-');
        return hm === m && hd === d;
      }
      return h.date === dateStr;
    });
  }

  // ----- Réglages de pause entre rendez-vous -----
  // mode 'global'     : la même pause s'applique entre tous les rendez-vous.
  // mode 'perService' : la pause dépend du service du rendez-vous précédent.
  // mode 'perDay'      : la pause dépend du jour de la semaine.
  function getPauseSettings() {
    return _readAvailability().pauseSettings;
  }

  function updatePauseSettings(patch) {
    const av = _readAvailability();
    av.pauseSettings = {
      ...av.pauseSettings,
      ...patch,
      perService: { ...av.pauseSettings.perService, ...(patch.perService || {}) },
      perDay: { ...av.pauseSettings.perDay, ...(patch.perDay || {}) }
    };
    _writeAvailability(av);
    return { ok: true, pauseSettings: av.pauseSettings };
  }

  // Calcule la durée de pause (minutes) à respecter APRÈS un rendez-vous donné,
  // selon le mode actif. Retourne 0 si la pause est désactivée.
  function _pauseAfter(appt, pauseSettings, dayKey) {
    if (!pauseSettings.enabled) return 0;
    if (pauseSettings.mode === 'perService') {
      return Number(pauseSettings.perService[appt.serviceId] ?? pauseSettings.durationMinutes) || 0;
    }
    if (pauseSettings.mode === 'perDay') {
      return Number(pauseSettings.perDay[dayKey] ?? pauseSettings.durationMinutes) || 0;
    }
    return Number(pauseSettings.durationMinutes) || 0;
  }

  // Retourne les créneaux ('HH:MM') disponibles pour un service à une date donnée,
  // en excluant : les jours/heures hors plage horaire, les jours de vacances,
  // et les créneaux déjà occupés par un autre rendez-vous (confirmé, en attente,
  // ou un blocage manuel admin).
  function getAvailableSlots(serviceId, dateStr) {
    const av = _readAvailability();
    if (_dateIsOnVacation(dateStr, av.vacations)) return [];
    if (_dateIsHoliday(dateStr, av.holidays)) return [];

    const dayKey = WEEKDAY_KEYS[new Date(dateStr + 'T00:00:00').getDay()];
    const ranges = (av.weeklyHours[serviceId] && av.weeklyHours[serviceId][dayKey]) || [];
    if (!ranges.length) return [];

    const duration = av.slotDurationMinutes[serviceId] || 60;
    const existing = _readAppointments().filter(a => a.date === dateStr && a.status !== 'cancelled');
    const pauseSettings = av.pauseSettings;

    // Pour chaque rendez-vous existant, la pause configurée s'ajoute APRÈS lui :
    // on construit donc des intervalles "occupés" élargis (rdv + pause), que
    // les nouveaux créneaux ne doivent pas chevaucher.
    const occupiedRanges = existing.map(a => {
      const apptDayKey = WEEKDAY_KEYS[new Date(a.date + 'T00:00:00').getDay()];
      const pauseMinutes = _pauseAfter({ serviceId: a.serviceId || serviceId }, pauseSettings, apptDayKey);
      return { time: a.time, duration: (a.duration || duration) + pauseMinutes };
    });

    const slots = [];
    ranges.forEach(range => {
      let cursor = _timeToMinutes(range.start);
      const end = _timeToMinutes(range.end);
      while (cursor + duration <= end) {
        const timeStr = String(Math.floor(cursor / 60)).padStart(2, '0') + ':' + String(cursor % 60).padStart(2, '0');
        const taken = occupiedRanges.some(a => _timeRangesOverlap(a.time, a.duration, timeStr, duration));
        if (!taken) slots.push(timeStr);
        cursor += duration;
      }
    });

    // Si le jour demandé est aujourd'hui, on retire les créneaux déjà passés.
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dateStr === todayStr) {
      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
      return slots.filter(s => _timeToMinutes(s) > nowMinutes);
    }
    return slots;
  }

  // Indique si un service a au moins un créneau libre un jour donné — utilisé
  // pour afficher les pastilles "disponible" dans le mini-calendrier client.
  function hasAvailability(serviceId, dateStr) {
    return getAvailableSlots(serviceId, dateStr).length > 0;
  }

  // Crée une série de rendez-vous récurrents (admin uniquement). frequency:
  // 'weekly' | 'monthly'. Retourne la liste des rendez-vous créés ; ignore
  // silencieusement les occurrences qui tomberaient sur un créneau déjà pris.
  function createRecurringAppointments({ clientId, clientName, service, date, time, duration, status, frequency, occurrences }) {
    const groupId = 'rec_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const appts = _readAppointments();
    const created = [];
    const skipped = [];
    let cursor = new Date(date + 'T00:00:00');

    for (let i = 0; i < occurrences; i++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const conflict = appts.find(a =>
        a.date === dateStr && a.status !== 'cancelled' &&
        _timeRangesOverlap(a.time, a.duration, time, duration)
      );
      if (conflict) {
        skipped.push(dateStr);
      } else {
        const appt = {
          id: 'appt_' + Date.now() + '_' + Math.floor(Math.random() * 10000) + '_' + i,
          clientId, clientName, service, date: dateStr, time,
          duration, status: status || 'confirmed',
          source: 'admin', blocked: false, recurringGroupId: groupId
        };
        appts.push(appt);
        created.push(appt);
      }
      cursor = frequency === 'monthly'
        ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())
        : new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
    }

    _writeAppointments(appts);
    return { ok: true, created, skipped, recurringGroupId: groupId };
  }

  // Bloque un créneau ou une journée entière (indisponibilité admin ponctuelle,
  // distincte des vacances qui sont récurrentes/globales). Stocké comme un
  // rendez-vous "fantôme" avec blocked:true pour réutiliser tout l'affichage
  // calendrier existant sans dupliquer la logique de rendu.
  function blockTimeSlot({ date, time, duration, label }) {
    const appts = _readAppointments();
    const appt = {
      id: 'block_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      clientId: null,
      clientName: label || 'Indisponible',
      service: '—',
      date, time: time || '00:00', duration: duration || (time ? 60 : 1440),
      status: 'confirmed', source: 'admin', blocked: true, recurringGroupId: null
    };
    appts.push(appt);
    _writeAppointments(appts);
    return { ok: true, appointment: appt };
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
    // Vérification anti-doublon : un rdv ne peut avoir qu'une transaction active
    if (data.appointmentId) {
      const existing = transactions.find(t =>
        t.appointmentId === data.appointmentId &&
        t.status !== 'cancelled' && t.status !== 'refused'
      );
      if (existing) return { ok: false, error: 'Ce rendez-vous a déjà une transaction active.', transaction: existing };
    }
    const tx = {
      id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      // Données de base
      clientId:      data.clientId || '',
      clientName:    data.clientName || '',
      serviceId:     data.serviceId || '',
      service:       data.service || '',
      formulaId:     data.formulaId || '',
      formulaTitle:  data.formulaTitle || '',
      appointmentId: data.appointmentId || '',
      appointmentDate: data.appointmentDate || '',
      appointmentTime: data.appointmentTime || '',
      duration:      data.duration || '',
      // Montants
      amount:        Number(data.amount) || 0,
      tps:           Number(data.tps) || 0,
      tvq:           Number(data.tvq) || 0,
      total:         Number(data.total) || Number(data.amount) || 0,
      // Paiement
      method:        data.method || 'interac',  // 'interac' | 'stripe'
      status:        data.status || 'waiting',  // waiting | paid | refused | cancelled
      transactionReference: data.transactionReference || '',
      // Métadonnées
      createdAt:   new Date().toISOString(),
      confirmedAt: null,
      updatedAt:   new Date().toISOString()
    };
    transactions.push(tx);
    _writeTransactions(transactions);
    return { ok: true, transaction: tx };
  }

  // Confirmation manuelle d'un paiement (Interac par admin, ou Stripe simulé).
  // → met à jour le rdv associé en "confirmed"
  function confirmTransaction(id) {
    const transactions = _readTransactions();
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return { ok: false, error: 'Transaction introuvable.' };
    if (transactions[idx].status === 'paid') return { ok: true, transaction: transactions[idx] };
    transactions[idx].status = 'paid';
    transactions[idx].confirmedAt = new Date().toISOString();
    transactions[idx].updatedAt = new Date().toISOString();
    _writeTransactions(transactions);
    // Confirmer le rendez-vous associé
    const tx = transactions[idx];
    if (tx.appointmentId) {
      updateAppointment(tx.appointmentId, { status: 'confirmed' });
    }
    return { ok: true, transaction: tx };
  }

  function rejectTransaction(id) {
    const transactions = _readTransactions();
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return { ok: false, error: 'Transaction introuvable.' };
    transactions[idx].status = 'refused';
    transactions[idx].updatedAt = new Date().toISOString();
    _writeTransactions(transactions);
    // Repasser le rdv en "awaiting_confirmation" (nécessite un nouveau paiement)
    const tx = transactions[idx];
    if (tx.appointmentId) {
      updateAppointment(tx.appointmentId, { status: 'awaiting_confirmation' });
    }
    return { ok: true, transaction: tx };
  }

  function cancelTransaction(id) {
    const transactions = _readTransactions();
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return { ok: false, error: 'Transaction introuvable.' };
    transactions[idx].status = 'cancelled';
    transactions[idx].updatedAt = new Date().toISOString();
    _writeTransactions(transactions);
    const tx = transactions[idx];
    if (tx.appointmentId) {
      updateAppointment(tx.appointmentId, { status: 'cancelled' });
    }
    return { ok: true, transaction: tx };
  }

  // Suppression permanente d'une transaction (pour nettoyer les données de test).
  // Ne supprime PAS le rdv associé (il faut le supprimer séparément si besoin).
  function deleteTransaction(id) {
    const list = _readTransactions();
    if (!list.find(t => t.id === id)) return { ok: false, error: 'Transaction introuvable.' };
    _writeTransactions(list.filter(t => t.id !== id));
    return { ok: true };
  }

  // Suppression permanente d'une entrée du journal de notifications.
  // Clé alignée avec notifications-store.js : 'po_demo_notifications_log'
  function deleteNotificationLog(logId) {
    const NOTIF_LOG_KEY = 'po_demo_notifications_log';
    try {
      const logs = JSON.parse(localStorage.getItem(NOTIF_LOG_KEY) || '[]');
      const before = logs.length;
      const filtered = logs.filter(l => l.id !== logId);
      if (filtered.length === before) return { ok: false, error: 'Entrée introuvable.' };
      localStorage.setItem(NOTIF_LOG_KEY, JSON.stringify(filtered));
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // Purge complète des données de test/démo.
  // Clés alignées avec chaque store respectif :
  //   notifications-store.js → 'po_demo_notifications_log'
  //   care-session-store.js  → 'po_demo_care_sessions', 'po_demo_care_summaries'
  //   messenger-store.js     → 'po_demo_messages'
  // La configuration (tarifs, services, disponibilités, contenu) est préservée.
  function purgeAllTestData() {
    const users = _readUsers().filter(u => u.role === 'admin');
    _writeUsers(users);
    _writeAppointments([]);
    _writeTransactions([]);
    try { localStorage.setItem('po_demo_notifications_log', '[]'); } catch (_) {}
    try { localStorage.removeItem('po_demo_care_sessions'); } catch (_) {}
    try { localStorage.removeItem('po_demo_care_summaries'); } catch (_) {}
    try { localStorage.removeItem('po_demo_messages'); } catch (_) {}
    return { ok: true };
  }

  function getPaymentSettings() { return _readPaymentSettings(); }

  function updatePaymentSettings(data) {
    const current = _readPaymentSettings();
    const updated = Object.assign({}, current, data);
    _writePaymentSettings(updated);
    return { ok: true, settings: updated };
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
    deleteAppointmentSeries, moveAppointment,
    getAvailability, replaceAvailability, updateWeeklyHours, setSlotDuration,
    addVacation, removeVacation, getAvailableSlots, hasAvailability,
    addHoliday, removeHoliday, getPauseSettings, updatePauseSettings,
    createRecurringAppointments, blockTimeSlot,
    listTransactions, listTransactionsForClient,
    createTransaction, confirmTransaction, rejectTransaction,
    cancelTransaction, deleteTransaction,
    deleteNotificationLog, purgeAllTestData,
    getPaymentSettings, updatePaymentSettings,
    countDirectSessionsLast30Days, canBookDirectSession,
    blockClient, unblockClient
  };
})();
