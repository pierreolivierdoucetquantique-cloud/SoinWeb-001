// =========================================================
// PIERRE-OLIVIER — auth.js (v2 — backend réel)
//
// Ce module appelle désormais le VRAI serveur (server/, base SQLite
// partagée) au lieu de localStorage. Les données sont donc enfin
// partagées entre tous les appareils/navigateurs.
//
// PATTERN "cache + réseau" : pour éviter de réécrire chaque page en
// asynchrone, les fonctions de LECTURE (getCurrentUser, listAppointments,
// etc.) restent synchrones et lisent un cache local en mémoire. Ce cache
// est rempli par PO_Auth.init() (à appeler une fois au chargement de
// chaque page, avant le reste du script) et rafraîchi automatiquement
// après chaque écriture (createAppointment, login, etc.).
// Les fonctions d'ÉCRITURE retournent une Promise (à utiliser avec
// await) — c'est la partie qui a changé par rapport à l'ancienne
// version localStorage.
// =========================================================

const PO_Auth = (() => {
  let _cache = {
    currentUser: null,
    appointments: [],
    transactions: [],
    clients: [],
    paymentSettings: { taxesEnabled: false, tpsRate: 5, tvqRate: 9.975, interacEmail: 'pierreolivierdoucet.quantique@gmail.com' }
  };

  async function _refreshAppointments() {
    const res = await PO_Api.get('/api/appointments');
    if (res.ok) _cache.appointments = res.appointments;
    return res;
  }
  async function _refreshTransactions() {
    const res = await PO_Api.get('/api/transactions');
    if (res.ok) _cache.transactions = res.transactions;
    return res;
  }
  async function _refreshPaymentSettings() {
    const res = await PO_Api.get('/api/payment-settings');
    if (res.ok) _cache.paymentSettings = res.settings;
    return res;
  }

  /**
   * À appeler une fois au chargement de chaque page (avant le reste du
   * script). Récupère la session active (si le jeton en sessionStorage
   * est encore valide) et pré-charge les données utiles.
   */
  async function init() {
    const me = await PO_Api.get('/api/auth/me');
    _cache.currentUser = (me.ok && me.user) ? me.user : null;
    await _refreshPaymentSettings();
    if (_cache.currentUser) {
      await _refreshAppointments();
      await _refreshTransactions();
      if (_cache.currentUser.role === 'admin') await refreshClients();
    }
    return _cache.currentUser;
  }

  // ---- Compte / session ----
  async function createAccount({ firstName, lastName, email, age, password }) {
    const res = await PO_Api.post('/api/auth/register', { firstName, lastName, email, age, password });
    if (res.ok) { PO_Api.setToken(res.token); _cache.currentUser = res.user; }
    return res.ok ? { ok: true, user: res.user } : { ok: false, error: res.error };
  }

  async function login({ email, password }) {
    const res = await PO_Api.post('/api/auth/login', { email, password });
    if (res.ok) { PO_Api.setToken(res.token); _cache.currentUser = res.user; }
    return res.ok ? { ok: true, user: res.user } : { ok: false, error: res.error };
  }

  async function logout() {
    await PO_Api.post('/api/auth/logout');
    PO_Api.clearToken();
    _cache.currentUser = null;
    _cache.appointments = [];
    _cache.transactions = [];
  }

  function getCurrentUser() { return _cache.currentUser; }
  function isAdmin() { return !!(_cache.currentUser && _cache.currentUser.role === 'admin'); }

  async function updateProfile(id, patch) {
    const res = await PO_Api.put('/api/auth/me', patch);
    if (res.ok) _cache.currentUser = res.user;
    return res.ok ? { ok: true, user: res.user } : { ok: false, error: res.error };
  }

  async function deleteAccount(id) {
    const res = await PO_Api.del('/api/auth/me');
    if (res.ok) { PO_Api.clearToken(); _cache.currentUser = null; }
    return res;
  }

  // Changement de mot de passe depuis le profil — distinct de la
  // réinitialisation par lien (voir requestPasswordReset). Le mot de passe
  // actuel est vérifié côté serveur (seul endroit qui peut comparer le hash).
  async function changePassword(currentPassword, newPassword) {
    return PO_Api.put('/api/auth/change-password', { currentPassword, newPassword });
  }

  // ---- Mot de passe oublié ----
  async function requestPasswordReset(email) {
    const res = await PO_Api.post('/api/auth/forgot-password', { email });
    return res;
  }
  async function verifyResetToken(email, token) {
    return PO_Api.post('/api/auth/verify-reset-token', { email, token });
  }
  async function resetPasswordWithToken(email, token, newPassword) {
    return PO_Api.post('/api/auth/reset-password', { email, token, newPassword });
  }

  // ---- Admin : clients ----
  function listClients() { return _cache.clients; }
  async function refreshClients() {
    const res = await PO_Api.get('/api/admin/clients');
    if (res.ok) _cache.clients = res.clients;
    return _cache.clients;
  }
  async function blockClient(clientId, reason) {
    const res = await PO_Api.put(`/api/admin/clients/${clientId}/block`, { blocked: true, reason });
    if (res.ok) await refreshClients();
    return res;
  }
  async function unblockClient(clientId) {
    const res = await PO_Api.put(`/api/admin/clients/${clientId}/block`, { blocked: false, reason: '' });
    if (res.ok) await refreshClients();
    return res;
  }
  async function deleteClientAsAdmin(id) {
    const res = await PO_Api.del(`/api/admin/clients/${id}`);
    if (res.ok) await refreshClients();
    return res;
  }

  // ---- Rendez-vous ----
  function listAppointments() { return _cache.appointments; }
  function listAppointmentsForClient(clientId) { return _cache.appointments.filter(a => a.clientId === clientId); }

  async function createAppointment(data) {
    const isAdminCreate = isAdmin() && data.clientId && data.clientId !== _cache.currentUser.id;
    const res = isAdminCreate
      ? await PO_Api.post('/api/admin/appointments', data)
      : await PO_Api.post('/api/appointments', data);
    if (res.ok) await _refreshAppointments();
    return res.ok ? { ok: true, appointment: res.appointment } : { ok: false, error: res.error };
  }

  async function updateAppointment(id, patch) {
    const res = await PO_Api.put(`/api/appointments/${id}`, patch);
    if (res.ok) await _refreshAppointments();
    return res.ok ? { ok: true, appointment: res.appointment } : { ok: false, error: res.error };
  }

  async function deleteAppointment(id) {
    const res = await PO_Api.del(`/api/appointments/${id}`);
    if (res.ok) await _refreshAppointments();
    return res;
  }

  async function deleteAppointmentSeries(recurringGroupId) {
    const toDelete = _cache.appointments.filter(a => a.recurringGroupId === recurringGroupId);
    for (const a of toDelete) await PO_Api.del(`/api/appointments/${a.id}`);
    await _refreshAppointments();
    return { ok: true };
  }

  async function moveAppointment(id, newDate, newTime) {
    const res = await PO_Api.put(`/api/appointments/${id}`, { date: newDate, time: newTime });
    if (res.ok) await _refreshAppointments();
    return res.ok ? { ok: true, appointment: res.appointment } : { ok: false, error: res.error };
  }

  async function createRecurringAppointments({ clientId, clientName, service, serviceId, date, time, duration, status, frequency, occurrences }) {
    const groupId = 'rec_' + Date.now();
    const created = [];
    const stepDays = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 30;
    let cursor = new Date(date + 'T00:00:00');
    for (let i = 0; i < (occurrences || 1); i++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const res = await PO_Api.post('/api/admin/appointments', {
        clientId, clientName, service, serviceId: serviceId || service, date: dateStr, time, duration, status: status || 'confirmed'
      });
      if (res.ok) created.push(res.appointment);
      cursor.setDate(cursor.getDate() + stepDays);
    }
    await _refreshAppointments();
    // NOTE : cette version simplifiée ne détecte pas encore les conflits de
    // créneaux avant de créer chaque occurrence (contrairement à l'ancienne
    // version localStorage) — `skipped` reste donc toujours vide pour
    // l'instant. Limitation connue, à corriger lors d'une prochaine passe.
    return { ok: true, created, skipped: [] };
  }

  async function blockTimeSlot({ date, time, duration, label }) {
    const res = await PO_Api.post('/api/admin/appointments', {
      service: label || 'Bloqué', serviceId: 'blocked', date, time, duration,
      status: 'confirmed', blocked: true, blockLabel: label || 'Créneau bloqué'
    });
    if (res.ok) await _refreshAppointments();
    return res.ok ? { ok: true, appointment: res.appointment } : { ok: false, error: res.error };
  }

  // ---- Transactions / paiements ----
  function listTransactions() { return _cache.transactions; }
  function listTransactionsForClient(clientId) { return _cache.transactions.filter(t => t.clientId === clientId); }

  async function createTransaction(data) {
    const res = await PO_Api.post('/api/transactions', data);
    if (res.ok) await _refreshTransactions();
    return res.ok ? { ok: true, transaction: res.transaction } : { ok: false, error: res.error };
  }

  async function confirmTransaction(id) {
    const res = await PO_Api.put(`/api/admin/transactions/${id}/confirm`);
    if (res.ok) { await _refreshTransactions(); await _refreshAppointments(); }
    return res;
  }
  async function rejectTransaction(id) {
    const res = await PO_Api.put(`/api/admin/transactions/${id}/reject`);
    if (res.ok) await _refreshTransactions();
    return res;
  }
  async function cancelTransaction(id) {
    const res = await PO_Api.put(`/api/admin/transactions/${id}/reject`);
    if (res.ok) await _refreshTransactions();
    return res;
  }
  async function deleteTransaction(id) {
    // Pas de route de suppression dédiée — un rejet équivaut à l'annuler.
    return rejectTransaction(id);
  }

  function getPaymentSettings() { return _cache.paymentSettings; }
  async function updatePaymentSettings(patch) {
    const res = await PO_Api.put('/api/admin/payment-settings', patch);
    if (res.ok) await _refreshPaymentSettings();
    return res;
  }

  // ---- Disponibilités (déléguées à l'API — voir server/availability-routes.js) ----
  async function getAvailableSlots(serviceId, dateStr, slotDuration) {
    const res = await PO_Api.get(`/api/availability/slots?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(dateStr)}&slotDuration=${slotDuration || 60}`);
    return res.ok ? res.slots : [];
  }
  async function hasAvailability(serviceId, dateStr) {
    const slots = await getAvailableSlots(serviceId, dateStr);
    return slots.length > 0;
  }
  async function getAvailability() {
    const [hours, vacations, holidays] = await Promise.all([
      PO_Api.get('/api/availability/weekly-hours'),
      PO_Api.get('/api/availability/vacations'),
      PO_Api.get('/api/availability/holidays')
    ]);
    return {
      weeklyHours: hours.ok ? hours.weeklyHours : {},
      vacations: vacations.ok ? vacations.vacations : [],
      holidays: holidays.ok ? holidays.holidays : [],
      // Durée de créneau fixe (60 min) pour tous les services dans cette
      // version — la personnalisation par service n'a pas encore été
      // portée côté serveur (simplification connue, voir server/db.js).
      slotDurationMinutes: { 'services-energetiques': 60, 'soins-direct': 60, 'accompagnement': 60 }
    };
  }
  async function updateWeeklyHours(serviceId, dayKey, ranges) {
    return PO_Api.put('/api/admin/availability/weekly-hours', { serviceId, dayKey, ranges });
  }
  async function addVacation({ startDate, endDate, label }) {
    return PO_Api.post('/api/admin/availability/vacations', { startDate, endDate, label });
  }
  async function removeVacation(id) {
    return PO_Api.del(`/api/admin/availability/vacations/${id}`);
  }
  async function addHoliday({ date, label }) {
    return PO_Api.post('/api/admin/availability/holidays', { date, label });
  }
  async function removeHoliday(id) {
    return PO_Api.del(`/api/admin/availability/holidays/${id}`);
  }
  // Sauvegarde en bloc du mode brouillon de l'éditeur d'horaires admin.
  // Ne couvre que les horaires hebdomadaires (vacances/fériés ont leurs
  // propres routes dédiées, déjà appelées immédiatement à leur création).
  async function replaceAvailability(nextAv) {
    if (!nextAv || !nextAv.weeklyHours) return { ok: true };
    return PO_Api.put('/api/admin/availability/weekly-hours-bulk', { weeklyHours: nextAv.weeklyHours });
  }

  // ---- Soins Direct : limite de 2 séances / 30 jours ----
  function countDirectSessionsLast30Days(clientId) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return _cache.transactions.filter(t =>
      t.clientId === clientId && t.serviceId === 'soins-direct' &&
      (t.status === 'paid' || t.status === 'confirmed') &&
      new Date(t.createdAt).getTime() >= cutoff
    ).length;
  }
  function canBookDirectSession(clientId) {
    return countDirectSessionsLast30Days(clientId) < 2;
  }

  // ---- Notifications (journal local restant côté client — voir notifications-store.js) ----
  function deleteNotificationLog(logId) {
    if (typeof PO_Notifications !== 'undefined') PO_Notifications.deleteLogEntry?.(logId);
    return { ok: true };
  }

  async function purgeAllTestData() {
    // Suppression en masse réservée à l'admin — supprime tous les clients
    // (cascade : rendez-vous, transactions, témoignages).
    const clients = await listClients();
    for (const c of clients) await PO_Api.del(`/api/admin/clients/${c.id}`);
    await _refreshAppointments();
    await _refreshTransactions();
    return { ok: true };
  }

  return {
    init,
    createAccount, login, logout, getCurrentUser, isAdmin,
    updateProfile, deleteAccount, changePassword, requestPasswordReset, verifyResetToken, resetPasswordWithToken,
    listClients, refreshClients, deleteClientAsAdmin, blockClient, unblockClient,
    listAppointments, listAppointmentsForClient, createAppointment, updateAppointment,
    deleteAppointment, deleteAppointmentSeries, moveAppointment, createRecurringAppointments, blockTimeSlot,
    listTransactions, listTransactionsForClient, createTransaction, refreshTransactions: _refreshTransactions,
    confirmTransaction, rejectTransaction, cancelTransaction, deleteTransaction,
    getPaymentSettings, updatePaymentSettings,
    getAvailableSlots, hasAvailability, getAvailability, updateWeeklyHours,
    addVacation, removeVacation, addHoliday, removeHoliday, replaceAvailability,
    countDirectSessionsLast30Days, canBookDirectSession,
    deleteNotificationLog, purgeAllTestData
  };
})();
