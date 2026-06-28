// =========================================================
// PIERRE-OLIVIER — admin.js
//
// Logique du panneau admin. S'appuie sur PO_Auth (auth.js) pour
// les données. SIMULATION FRONTEND — voir auth.js pour le détail
// des points de branchement vers un vrai backend.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- GARDE D'ACCÈS ---------- */
  if (!PO_Auth.isAdmin()) {
    window.location.href = 'connexion.html';
    return;
  }

  /* ---------- NAVIGATION ENTRE PANNEAUX ---------- */
  function showPanel(panelId) {
    document.querySelectorAll('.admin-nav button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.panel === panelId)));
    document.querySelectorAll('.admin-panel').forEach(p => p.removeAttribute('data-active'));
    const target = document.querySelector(`.admin-panel[data-panel="${panelId}"]`);
    if (target) target.setAttribute('data-active', 'true');

    if (panelId === 'dashboard') renderDashboard();
    if (panelId === 'clients') renderClients();
    if (panelId === 'calendar') renderCalendar();
    if (panelId === 'pricing') renderPricing();
    if (panelId === 'payments') renderPayments();
    if (panelId === 'services') renderServices();
    if (panelId === 'content') renderContent();
    if (panelId === 'messenger') renderMessenger();
    if (panelId === 'notifications') renderNotifications();
    if (panelId === 'analytics') renderAnalytics();
  }

  document.querySelectorAll('.admin-nav button[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => showPanel(btn.dataset.panel));
  });

  document.getElementById('admin-logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    PO_Auth.logout();
    window.location.href = 'index.html';
  });

  /* ---------- GENERIC CONFIRM MODAL ---------- */
  const confirmVeil  = document.getElementById('confirm-modal-veil');
  const confirmTitle = document.getElementById('confirm-modal-title');
  const confirmText  = document.getElementById('confirm-modal-text');
  const confirmOkBtn = document.getElementById('confirm-modal-ok');
  let _confirmCallback = null;

  function askConfirm(title, text, onConfirm) {
    confirmTitle.textContent = title;
    confirmText.textContent = text;
    _confirmCallback = onConfirm;
    confirmVeil.hidden = false;
  }
  document.getElementById('confirm-modal-cancel').addEventListener('click', () => { confirmVeil.hidden = true; });
  confirmOkBtn.addEventListener('click', () => {
    confirmVeil.hidden = true;
    if (_confirmCallback) _confirmCallback();
  });

  /* =========================================================
     DASHBOARD
  ========================================================= */
  function renderDashboard() {
    const clients = PO_Auth.listClients();
    const appts = PO_Auth.listAppointments();
    const todayStr = new Date().toISOString().slice(0, 10);

    const upcoming = appts.filter(a => a.date >= todayStr && a.status !== 'cancelled');
    const today = appts.filter(a => a.date === todayStr && a.status !== 'cancelled');
    const pending = appts.filter(a => a.status === 'pending');

    document.getElementById('stat-clients').textContent = clients.length;
    document.getElementById('stat-upcoming').textContent = upcoming.length;
    document.getElementById('stat-today').textContent = today.length;
    document.getElementById('stat-pending').textContent = pending.length;

    const list = document.getElementById('dashboard-upcoming-list');
    const sorted = [...upcoming].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6);
    if (!sorted.length) {
      list.innerHTML = '<p class="empty-state">Aucun rendez-vous à venir.</p>';
      return;
    }
    list.innerHTML = sorted.map(a => `
      <div class="appt-row">
        <span class="appt-row__date">${formatDateShort(a.date)} · ${a.time}</span>
        <span class="appt-row__info"><strong>${escapeHtml(a.clientName)}</strong><span>${escapeHtml(a.service)}</span></span>
        <span class="badge badge--${a.status}">${statusLabel(a.status)}</span>
      </div>
    `).join('');
  }

  /* =========================================================
     CLIENT MANAGER
  ========================================================= */
  let clientSearchTerm = '';
  let clientSortMode = 'recent';

  function renderClients() {
    const tbody = document.getElementById('clients-tbody');
    const emptyEl = document.getElementById('clients-empty');
    let clients = PO_Auth.listClients();
    const appts = PO_Auth.listAppointments();

    const countAppts = (clientId) => appts.filter(a => a.clientId === clientId).length;

    if (clientSearchTerm) {
      const term = clientSearchTerm.toLowerCase();
      clients = clients.filter(c =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
      );
    }

    if (clientSortMode === 'name') {
      clients = [...clients].sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
    } else if (clientSortMode === 'appointments') {
      clients = [...clients].sort((a, b) => countAppts(b.id) - countAppts(a.id));
    } else {
      clients = [...clients].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (!clients.length) {
      tbody.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    tbody.innerHTML = clients.map(c => `
      <tr data-client-id="${c.id}">
        <td>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</td>
        <td>${escapeHtml(c.email)}</td>
        <td>${c.age || '—'}</td>
        <td>${formatDateShort(c.createdAt.slice(0, 10))}</td>
        <td>${countAppts(c.id)}</td>
        <td><span class="badge badge--client">Client</span></td>
        <td>
          <div class="admin-row-actions">
            <button class="icon-btn" data-open-client="${c.id}" title="Voir le profil">⊙</button>
            <button class="icon-btn icon-btn--danger" data-delete-client="${c.id}" title="Supprimer">✕</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-open-client]').forEach(btn => {
      btn.addEventListener('click', () => openClientDrawer(btn.dataset.openClient));
    });
    tbody.querySelectorAll('[data-delete-client]').forEach(btn => {
      btn.addEventListener('click', () => {
        const client = clients.find(c => c.id === btn.dataset.deleteClient);
        askConfirm(
          'Supprimer ce client ?',
          `${client.firstName} ${client.lastName} et tous ses rendez-vous seront définitivement supprimés.`,
          () => { PO_Auth.deleteClientAsAdmin(client.id); renderClients(); }
        );
      });
    });
  }

  document.getElementById('client-search').addEventListener('input', (e) => {
    clientSearchTerm = e.target.value.trim();
    renderClients();
  });
  document.getElementById('client-sort').addEventListener('change', (e) => {
    clientSortMode = e.target.value;
    renderClients();
  });

  document.getElementById('client-export-csv').addEventListener('click', () => {
    const clients = PO_Auth.listClients();
    const header = 'Prénom,Nom,Email,Âge,Inscription\n';
    const rows = clients.map(c =>
      [c.firstName, c.lastName, c.email, c.age, c.createdAt.slice(0, 10)].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clients-ntabou-aka-we.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  /* ---- Client drawer ---- */
  const clientDrawerVeil = document.getElementById('client-drawer-veil');
  let _drawerClientId = null;

  function openClientDrawer(clientId) {
    const client = PO_Auth.listClients().find(c => c.id === clientId);
    if (!client) return;
    _drawerClientId = clientId;

    document.getElementById('drawer-client-name').textContent = `${client.firstName} ${client.lastName}`;
    document.getElementById('drawer-client-email').textContent = client.email;
    document.getElementById('drawer-client-age').textContent = client.age || '—';
    document.getElementById('drawer-client-phone').textContent = client.phone || '—';
    document.getElementById('drawer-client-date').textContent = formatDateShort(client.createdAt.slice(0, 10));

    const sessionCount = PO_Auth.countDirectSessionsLast30Days(client.id);
    document.getElementById('drawer-client-session-count').textContent = `${sessionCount} / 2`;

    const blockStatusEl = document.getElementById('drawer-client-block-status');
    const unblockSection = document.getElementById('drawer-unblock-section');
    if (client.blocked) {
      blockStatusEl.innerHTML = `<span class="badge badge--cancelled">Bloqué</span>`;
      unblockSection.hidden = false;
    } else {
      blockStatusEl.innerHTML = `<span class="badge badge--confirmed">Actif</span>`;
      unblockSection.hidden = true;
    }

    const appts = PO_Auth.listAppointmentsForClient(clientId).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const apptsEl = document.getElementById('drawer-client-appts');
    apptsEl.innerHTML = appts.length
      ? appts.map(a => `
          <div class="appt-row" style="margin-bottom:8px;">
            <span class="appt-row__date">${formatDateShort(a.date)} · ${a.time}</span>
            <span class="appt-row__info"><strong>${escapeHtml(a.service)}</strong></span>
            <span class="badge badge--${a.status}">${statusLabel(a.status)}</span>
          </div>
        `).join('')
      : '<p class="empty-state">Aucun rendez-vous.</p>';

    clientDrawerVeil.hidden = false;
  }

  document.getElementById('drawer-unblock-client')?.addEventListener('click', () => {
    if (!_drawerClientId) return;
    const client = PO_Auth.listClients().find(c => c.id === _drawerClientId);
    askConfirm(
      'Débloquer ce compte ?',
      `${client.firstName} ${client.lastName} pourra à nouveau se connecter et réserver.`,
      () => {
        PO_Auth.unblockClient(_drawerClientId);
        openClientDrawer(_drawerClientId);
        renderClients();
      }
    );
  });

  document.getElementById('client-drawer-close').addEventListener('click', () => { clientDrawerVeil.hidden = true; });
  document.getElementById('drawer-delete-client').addEventListener('click', () => {
    const client = PO_Auth.listClients().find(c => c.id === _drawerClientId);
    if (!client) return;
    askConfirm(
      'Supprimer ce client ?',
      `${client.firstName} ${client.lastName} et tous ses rendez-vous seront définitivement supprimés.`,
      () => {
        PO_Auth.deleteClientAsAdmin(client.id);
        clientDrawerVeil.hidden = true;
        renderClients();
      }
    );
  });

  /* =========================================================
     CALENDAR MANAGER
  ========================================================= */
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth(); // 0-indexed
  let selectedDate = new Date().toISOString().slice(0, 10);

  const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  function renderCalendar() {
    document.getElementById('cal-label').textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;
    const grid = document.getElementById('cal-grid');
    const appts = PO_Auth.listAppointments();
    const todayStr = new Date().toISOString().slice(0, 10);

    const firstOfMonth = new Date(calYear, calMonth, 1);
    const startWeekday = firstOfMonth.getDay(); // 0 = dimanche
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    let cells = '';
    for (let i = 0; i < startWeekday; i++) {
      cells += '<div class="cal-day cal-day--empty"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayAppts = appts.filter(a => a.date === dateStr && a.status !== 'cancelled');
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      cells += `
        <div class="cal-day ${isToday ? 'cal-day--today' : ''}" data-date="${dateStr}"
             style="${isSelected ? 'border-color:var(--gold); box-shadow:0 0 0 1px var(--gold) inset;' : ''}">
          <div class="cal-day__num">${d}</div>
          ${dayAppts.length ? `<div class="cal-day__count">${dayAppts.length} RDV</div>` : ''}
        </div>`;
    }
    grid.innerHTML = cells;

    grid.querySelectorAll('.cal-day[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        selectedDate = cell.dataset.date;
        renderCalendar();
        renderDayAppointments();
      });
    });

    renderDayAppointments();
  }

  function renderDayAppointments() {
    const title = document.getElementById('day-appts-title');
    const list = document.getElementById('day-appts-list');
    const appts = PO_Auth.listAppointments()
      .filter(a => a.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));

    title.textContent = `Rendez-vous du ${formatDateLong(selectedDate)}`;

    if (!appts.length) {
      list.innerHTML = '<p class="empty-state">Aucun rendez-vous ce jour-là.</p>';
      return;
    }

    list.innerHTML = appts.map(a => `
      <div class="day-appt-row">
        <span class="day-appt-row__time">${a.time}</span>
        <span class="day-appt-row__info">
          <strong>${escapeHtml(a.clientName)}</strong>
          <span>${escapeHtml(a.service)} · ${a.duration} min</span>
        </span>
        <span class="badge badge--${a.status}">${statusLabel(a.status)}</span>
        <div class="admin-row-actions">
          <button class="icon-btn" data-edit-appt="${a.id}" title="Modifier">✎</button>
          <button class="icon-btn icon-btn--danger" data-delete-appt="${a.id}" title="Supprimer">✕</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-edit-appt]').forEach(btn => {
      btn.addEventListener('click', () => openApptModal(btn.dataset.editAppt));
    });
    list.querySelectorAll('[data-delete-appt]').forEach(btn => {
      btn.addEventListener('click', () => {
        askConfirm('Supprimer ce rendez-vous ?', 'Cette action est irréversible.', () => {
          PO_Auth.deleteAppointment(btn.dataset.deleteAppt);
          renderCalendar();
        });
      });
    });
  }

  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });
  document.getElementById('cal-today-btn').addEventListener('click', () => {
    const now = new Date();
    calYear = now.getFullYear(); calMonth = now.getMonth();
    selectedDate = now.toISOString().slice(0, 10);
    renderCalendar();
  });

  /* ---- Appointment modal (create / edit) ---- */
  const apptModalVeil  = document.getElementById('appt-modal-veil');
  const apptModalTitle = document.getElementById('appt-modal-title');
  const apptForm       = document.getElementById('appt-form');
  const apptNotice     = document.getElementById('appt-modal-notice');

  function populateClientSelect() {
    const select = document.getElementById('appt-client');
    const clients = PO_Auth.listClients();
    select.innerHTML = clients.map(c => `<option value="${c.id}">${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</option>`).join('');
  }

  function openApptModal(apptId) {
    populateClientSelect();
    apptNotice.hidden = true;
    apptForm.reset();

    if (apptId) {
      const appt = PO_Auth.listAppointments().find(a => a.id === apptId);
      if (!appt) return;
      apptModalTitle.textContent = 'Modifier le rendez-vous';
      document.getElementById('appt-editing-id').value = appt.id;
      document.getElementById('appt-client').value = appt.clientId;
      document.getElementById('appt-service').value = appt.service;
      document.getElementById('appt-date').value = appt.date;
      document.getElementById('appt-time').value = appt.time;
      document.getElementById('appt-duration').value = appt.duration;
      document.getElementById('appt-status').value = appt.status;
    } else {
      apptModalTitle.textContent = 'Nouveau rendez-vous';
      document.getElementById('appt-editing-id').value = '';
      document.getElementById('appt-date').value = selectedDate;
    }
    apptModalVeil.hidden = false;
  }

  document.getElementById('open-new-appt').addEventListener('click', () => openApptModal(null));
  document.getElementById('appt-modal-cancel').addEventListener('click', () => { apptModalVeil.hidden = true; });

  apptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const clientId = document.getElementById('appt-client').value;
    const clients = PO_Auth.listClients();
    const client = clients.find(c => c.id === clientId);
    if (!client) {
      apptNotice.hidden = false;
      apptNotice.dataset.tone = 'error';
      apptNotice.textContent = 'Veuillez créer un client avant de planifier un rendez-vous.';
      return;
    }

    const data = {
      clientId,
      clientName: `${client.firstName} ${client.lastName}`,
      service: document.getElementById('appt-service').value,
      date: document.getElementById('appt-date').value,
      time: document.getElementById('appt-time').value,
      duration: parseInt(document.getElementById('appt-duration').value, 10) || 60,
      status: document.getElementById('appt-status').value
    };

    if (!data.date || !data.time) {
      apptNotice.hidden = false;
      apptNotice.dataset.tone = 'error';
      apptNotice.textContent = 'Veuillez renseigner une date et une heure.';
      return;
    }

    const editingId = document.getElementById('appt-editing-id').value;
    let previousStatus = null;
    if (editingId) {
      const existing = PO_Auth.listAppointments().find(a => a.id === editingId);
      previousStatus = existing ? existing.status : null;
      PO_Auth.updateAppointment(editingId, data);
    } else {
      PO_Auth.createAppointment(data);
    }

    if (typeof PO_Notifications !== 'undefined') {
      const dateLabel = formatDateShort(data.date);
      if (!editingId) {
        // Nouveau rendez-vous -> email de confirmation
        PO_Notifications.logEmail({
          type: 'appointment_confirmation',
          to: client.email,
          subject: 'Confirmation de votre rendez-vous',
          body: `Bonjour ${client.firstName},\n\nVotre rendez-vous "${data.service}" est confirmé pour le ${dateLabel} à ${data.time} (${data.duration} min).\n\nAu plaisir de vous accompagner.`
        });
        PO_Notifications.logPush({
          to: client.email,
          title: 'Rendez-vous confirmé',
          body: `${data.service} — ${dateLabel} à ${data.time}`
        });
      } else if (previousStatus !== 'cancelled' && data.status === 'cancelled') {
        // Le statut vient de passer à annulé -> email d'annulation
        PO_Notifications.logEmail({
          type: 'appointment_cancellation',
          to: client.email,
          subject: 'Annulation de votre rendez-vous',
          body: `Bonjour ${client.firstName},\n\nVotre rendez-vous "${data.service}" prévu le ${dateLabel} à ${data.time} a été annulé. N'hésitez pas à reprendre un nouveau créneau depuis votre espace personnel.`
        });
      }
    }

    apptModalVeil.hidden = true;
    selectedDate = data.date;
    renderCalendar();
  });

  /* =========================================================
     ANALYTICS
  ========================================================= */
  function renderAnalytics() {
    const clients = PO_Auth.listClients();
    const appts = PO_Auth.listAppointments();
    const services = PO_Content.listServices();

    // ----- Stats principales -----
    document.getElementById('an-stat-clients').textContent = clients.length;
    document.getElementById('an-stat-total-appts').textContent = appts.length;

    const cancelled = appts.filter(a => a.status === 'cancelled').length;
    const cancellationRate = appts.length ? Math.round((cancelled / appts.length) * 100) : 0;
    document.getElementById('an-stat-cancellation-rate').textContent = cancellationRate + '%';

    // Revenu estimé : pour chaque RDV confirmé ou terminé, prix moyen des formules du service concerné
    const revenueEligible = appts.filter(a => a.status === 'confirmed' || a.status === 'done');
    let totalRevenue = 0;
    revenueEligible.forEach(a => {
      const service = services.find(s => s.name === a.service);
      if (!service) return;
      const formulas = PO_Content.listFormulasForService(service.id);
      if (!formulas.length) return;
      const avgPrice = formulas.reduce((sum, f) => sum + f.price, 0) / formulas.length;
      totalRevenue += avgPrice;
    });
    document.getElementById('an-stat-revenue').textContent = Math.round(totalRevenue) + '€';

    // ----- Répartition par service -----
    const serviceBreakdown = document.getElementById('an-service-breakdown');
    const maxByService = Math.max(1, ...services.map(s => appts.filter(a => a.service === s.name).length));
    serviceBreakdown.innerHTML = services.map(s => {
      const count = appts.filter(a => a.service === s.name).length;
      const pct = Math.round((count / maxByService) * 100);
      return `
        <div class="an-bar-row">
          <div class="an-bar-row__top">
            <span class="an-bar-row__label">${escapeHtml(s.name)}</span>
            <span class="an-bar-row__value">${count} RDV</span>
          </div>
          <div class="an-bar-track"><div class="an-bar-fill an-bar-fill--${s.accent}" style="width:${pct}%;"></div></div>
        </div>
      `;
    }).join('');

    // ----- Répartition par statut -----
    const statusBreakdown = document.getElementById('an-status-breakdown');
    const statuses = [
      { key: 'confirmed', label: 'Confirmés' },
      { key: 'pending', label: 'En attente' },
      { key: 'done', label: 'Terminés' },
      { key: 'cancelled', label: 'Annulés' }
    ];
    const maxByStatus = Math.max(1, ...statuses.map(s => appts.filter(a => a.status === s.key).length));
    statusBreakdown.innerHTML = statuses.map(s => {
      const count = appts.filter(a => a.status === s.key).length;
      const pct = Math.round((count / maxByStatus) * 100);
      return `
        <div class="an-bar-row">
          <div class="an-bar-row__top">
            <span class="an-bar-row__label">${s.label}</span>
            <span class="an-bar-row__value">${count}</span>
          </div>
          <div class="an-bar-track"><div class="an-bar-fill an-bar-fill--${s.key}" style="width:${pct}%;"></div></div>
        </div>
      `;
    }).join('');

    // ----- Inscriptions par mois (6 derniers mois) -----
    const signupsChart = document.getElementById('an-signups-chart');
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('fr-FR', { month: 'short' }) });
    }
    const countsByMonth = months.map(m =>
      clients.filter(c => {
        const created = new Date(c.createdAt);
        return created.getFullYear() === m.year && created.getMonth() === m.month;
      }).length
    );
    const maxSignups = Math.max(1, ...countsByMonth);
    signupsChart.innerHTML = months.map((m, i) => {
      const heightPct = Math.max(4, Math.round((countsByMonth[i] / maxSignups) * 100));
      return `
        <div class="an-month-col">
          <span class="an-month-col__count">${countsByMonth[i] || ''}</span>
          <div class="an-month-col__bar" style="height:${heightPct}%;"></div>
          <span class="an-month-col__label">${m.label}</span>
        </div>
      `;
    }).join('');

    // ----- Clients les plus actifs -----
    const topClientsTbody = document.getElementById('an-top-clients-tbody');
    const withCounts = clients.map(c => ({
      client: c,
      count: appts.filter(a => a.clientId === c.id).length
    })).filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);

    if (!withCounts.length) {
      topClientsTbody.innerHTML = '<tr><td colspan="2" class="empty-state">Aucun rendez-vous enregistré pour le moment.</td></tr>';
    } else {
      topClientsTbody.innerHTML = withCounts.map(x => `
        <tr><td>${escapeHtml(x.client.firstName)} ${escapeHtml(x.client.lastName)}</td><td>${x.count}</td></tr>
      `).join('');
    }
  }

  /* =========================================================
     NOTIFICATIONS
  ========================================================= */
  const NOTIF_SETTING_LABELS = {
    registration: { label: 'Confirmation d\'inscription', desc: 'Envoyée à la création d\'un compte client.' },
    appointment_confirmation: { label: 'Confirmation de rendez-vous', desc: 'Envoyée à la création d\'un rendez-vous.' },
    appointment_reminder: { label: 'Rappel de rendez-vous', desc: 'Envoyé avant la date du rendez-vous.' },
    appointment_cancellation: { label: 'Annulation de rendez-vous', desc: 'Envoyée quand un rendez-vous est annulé.' },
    admin_message: { label: 'Nouveau message admin', desc: 'Envoyée quand vous écrivez à un client depuis la messagerie.' },
    password_reset: { label: 'Réinitialisation de mot de passe', desc: 'Envoyée lors d\'une demande de mot de passe oublié.' },
    pushEnabled: { label: 'Notifications push', desc: 'Notifications instantanées (hors email).' }
  };

  function renderNotifications() {
    const settings = PO_Notifications.getSettings();
    const listEl = document.getElementById('notif-settings-list');
    listEl.innerHTML = Object.keys(NOTIF_SETTING_LABELS).map(key => {
      const meta = NOTIF_SETTING_LABELS[key];
      const checked = settings[key] ? 'checked' : '';
      return `
        <div class="notif-setting-row">
          <div>
            <div class="notif-setting-row__label">${meta.label}</div>
            <div class="notif-setting-row__desc">${meta.desc}</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" data-setting="${key}" ${checked}>
            <span class="toggle-switch__track"></span>
          </label>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-setting]').forEach(input => {
      input.addEventListener('change', () => {
        PO_Notifications.updateSettings({ [input.dataset.setting]: input.checked });
      });
    });

    renderNotifLog();
  }

  function renderNotifLog() {
    const log = PO_Notifications.listLog();
    const tbody = document.getElementById('notif-log-tbody');
    const emptyEl = document.getElementById('notif-log-empty');

    if (!log.length) {
      tbody.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    tbody.innerHTML = log.map(entry => `
      <tr>
        <td>${formatDateTimeShort(entry.createdAt)}</td>
        <td><span class="badge ${entry.channel === 'email' ? 'badge--client' : 'badge--confirmed'}">${entry.channel === 'email' ? 'Email' : 'Push'}</span></td>
        <td>${escapeHtml(entry.typeLabel)}</td>
        <td>${escapeHtml(entry.to)}</td>
        <td>${escapeHtml(entry.subject)}</td>
        <td><span class="log-row-link" data-view-log="${entry.id}">Voir</span></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-view-log]').forEach(link => {
      link.addEventListener('click', () => openNotifDetail(link.dataset.viewLog));
    });
  }

  function openNotifDetail(logId) {
    const entry = PO_Notifications.listLog().find(e => e.id === logId);
    if (!entry) return;
    document.getElementById('notif-detail-subject').textContent = entry.subject;
    document.getElementById('notif-detail-meta').textContent =
      `${entry.typeLabel} · à ${entry.to} · ${formatDateTimeShort(entry.createdAt)}`;
    document.getElementById('notif-detail-body').textContent = entry.body;
    document.getElementById('notif-detail-veil').hidden = false;
  }

  document.getElementById('notif-detail-close').addEventListener('click', () => {
    document.getElementById('notif-detail-veil').hidden = true;
  });

  document.getElementById('notif-clear-log').addEventListener('click', () => {
    askConfirm('Vider le journal ?', 'Toutes les entrées du journal de notifications seront supprimées.', () => {
      PO_Notifications.clearLog();
      renderNotifLog();
    });
  });

  /* =========================================================
     MESSENGER
  ========================================================= */
  let _activeConversationClientId = null;

  function updateMessengerBadge() {
    const badge = document.getElementById('messenger-badge');
    const count = PO_Messenger.countUnreadForAdmin();
    badge.textContent = count;
    badge.hidden = count === 0;
  }

  function renderMessenger() {
    updateMessengerBadge();
    const listEl = document.getElementById('messenger-conv-list');
    const summary = PO_Messenger.listConversationsSummary();
    const clients = PO_Auth.listClients();

    if (!summary.length) {
      listEl.innerHTML = '<p class="empty-state" style="padding:20px;">Aucune conversation pour le moment.</p>';
      return;
    }

    listEl.innerHTML = summary.map(s => {
      const client = clients.find(c => c.id === s.clientId);
      const name = client ? `${client.firstName} ${client.lastName}` : 'Client supprimé';
      const isActive = s.clientId === _activeConversationClientId;
      return `
        <div class="messenger-list__item" data-client-id="${s.clientId}" data-active="${isActive}">
          <div class="messenger-list__item-top">
            <span class="messenger-list__name">${escapeHtml(name)}</span>
            ${s.unreadByAdmin ? '<span class="messenger-list__unread"></span>' : ''}
          </div>
          <span class="messenger-list__preview">${escapeHtml(s.lastMessage.body)}</span>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-client-id]').forEach(item => {
      item.addEventListener('click', () => openConversation(item.dataset.clientId));
    });

    // Si une conversation était déjà ouverte, la rafraîchir (sans perdre la sélection)
    if (_activeConversationClientId) {
      openConversation(_activeConversationClientId, { skipMarkSeen: false });
    }
  }

  function openConversation(clientId) {
    _activeConversationClientId = clientId;
    PO_Messenger.markConversationSeen(clientId, 'admin');

    const clients = PO_Auth.listClients();
    const client = clients.find(c => c.id === clientId);
    const name = client ? `${client.firstName} ${client.lastName}` : 'Client supprimé';

    document.querySelectorAll('.messenger-list__item').forEach(item => {
      item.setAttribute('data-active', String(item.dataset.clientId === clientId));
      if (item.dataset.clientId === clientId) {
        item.querySelector('.messenger-list__unread')?.remove();
      }
    });
    updateMessengerBadge();

    const thread = document.getElementById('messenger-thread');
    const messages = PO_Messenger.listConversation(clientId);

    thread.innerHTML = `
      <div class="messenger-thread__head">${escapeHtml(name)}</div>
      <div class="messenger-thread__messages" id="messenger-messages-list">
        ${messages.map(m => `
          <div class="messenger-bubble ${m.sender === 'admin' ? 'messenger-bubble--out' : 'messenger-bubble--in'}">
            ${escapeHtml(m.body)}
            <span class="messenger-bubble__time">${formatDateTimeShort(m.createdAt)}</span>
          </div>
        `).join('') || '<p class="empty-state">Aucun message encore.</p>'}
      </div>
      <form class="messenger-thread__form" id="messenger-send-form">
        <input type="text" id="messenger-input" placeholder="Écrire un message..." autocomplete="off">
        <button type="submit">Envoyer</button>
      </form>
    `;

    const messagesList = document.getElementById('messenger-messages-list');
    messagesList.scrollTop = messagesList.scrollHeight;

    document.getElementById('messenger-send-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('messenger-input');
      const body = input.value;
      if (!body.trim()) return;
      PO_Messenger.sendMessage({ clientId, sender: 'admin', body });

      if (typeof PO_Notifications !== 'undefined') {
        const allClients = PO_Auth.listClients();
        const targetClient = allClients.find(c => c.id === clientId);
        if (targetClient) {
          PO_Notifications.logEmail({
            type: 'admin_message',
            to: targetClient.email,
            subject: 'Nouveau message de Ntabou Aka Wé',
            body: `Bonjour ${targetClient.firstName},\n\nVous avez reçu un nouveau message :\n\n"${body.trim()}"\n\nConnectez-vous à votre espace personnel pour répondre.`
          });
        }
      }

      input.value = '';
      renderMessenger();
      openConversation(clientId);
    });
  }

  /* =========================================================
     CONTENT MANAGER
  ========================================================= */
  function renderContent() {
    const site = PO_Content.getSiteContent();

    if (site.threshold) {
      document.getElementById('cm-threshold-eyebrow').value = site.threshold.eyebrow || '';
      document.getElementById('cm-threshold-title').value = site.threshold.title || '';
      document.getElementById('cm-threshold-text').value = site.threshold.text || '';
    }

    if (site.brand) {
      document.getElementById('cm-brand-tagline').value = site.brand.homeTagline || '';
    }

    if (site.sharedLabels) {
      document.getElementById('cm-formules-eyebrow').value = site.sharedLabels.formulesEyebrow || '';
      document.getElementById('cm-formules-title').value = site.sharedLabels.formulesTitle || '';
      document.getElementById('cm-faq-eyebrow').value = site.sharedLabels.faqEyebrow || '';
      document.getElementById('cm-faq-title').value = site.sharedLabels.faqTitle || '';
    }

    renderServicePageForm();
  }

  document.getElementById('threshold-content-form').addEventListener('submit', (e) => {
    e.preventDefault();
    PO_Content.updateThreshold({
      eyebrow: document.getElementById('cm-threshold-eyebrow').value.trim(),
      title: document.getElementById('cm-threshold-title').value.trim(),
      text: document.getElementById('cm-threshold-text').value.trim()
    });
    const notice = document.getElementById('threshold-content-notice');
    notice.hidden = false;
    notice.dataset.tone = 'success';
    notice.textContent = 'Modal "Lieu Sacré" mis à jour.';
    setTimeout(() => { notice.hidden = true; }, 2500);
  });

  document.getElementById('brand-content-form').addEventListener('submit', (e) => {
    e.preventDefault();
    PO_Content.updateBrand({
      homeTagline: document.getElementById('cm-brand-tagline').value.trim()
    });
    const notice = document.getElementById('brand-content-notice');
    notice.hidden = false;
    notice.dataset.tone = 'success';
    notice.textContent = 'Texte de marque mis à jour.';
    setTimeout(() => { notice.hidden = true; }, 2500);
  });

  document.getElementById('shared-labels-form').addEventListener('submit', (e) => {
    e.preventDefault();
    PO_Content.updateSharedLabels({
      formulesEyebrow: document.getElementById('cm-formules-eyebrow').value.trim(),
      formulesTitle: document.getElementById('cm-formules-title').value.trim(),
      faqEyebrow: document.getElementById('cm-faq-eyebrow').value.trim(),
      faqTitle: document.getElementById('cm-faq-title').value.trim()
    });
    const notice = document.getElementById('shared-labels-notice');
    notice.hidden = false;
    notice.dataset.tone = 'success';
    notice.textContent = 'Libellés partagés mis à jour sur les 3 pages de service.';
    setTimeout(() => { notice.hidden = true; }, 2500);
  });

  /* ---- Contenu détaillé par page de service ---- */
  function renderServicePageForm() {
    const serviceId = document.getElementById('content-service-filter').value;
    const page = PO_Content.getServicePageContent(serviceId);
    if (!page) return;

    document.getElementById('cm-sp-intro').value = page.intro || '';
    document.getElementById('cm-sp-steps-eyebrow').value = page.stepsEyebrow || '';
    document.getElementById('cm-sp-steps-title').value = page.stepsTitle || '';

    for (let i = 0; i < 3; i++) {
      const step = (page.steps && page.steps[i]) || {};
      document.getElementById(`cm-sp-step${i}-title`).value = step.title || '';
      document.getElementById(`cm-sp-step${i}-text`).value = step.text || '';
    }

    document.getElementById('cm-sp-cta-title').value = page.ctaTitle || '';
    document.getElementById('cm-sp-cta-text').value = page.ctaText || '';
    document.getElementById('cm-sp-cta-button').value = page.ctaButtonLabel || '';

    for (let i = 0; i < 3; i++) {
      const faq = (page.faq && page.faq[i]) || {};
      document.getElementById(`cm-sp-faq${i}-q`).value = faq.question || '';
      document.getElementById(`cm-sp-faq${i}-a`).value = faq.answer || '';
    }
  }

  document.getElementById('content-service-filter').addEventListener('change', renderServicePageForm);

  document.getElementById('service-page-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const serviceId = document.getElementById('content-service-filter').value;

    const steps = [];
    for (let i = 0; i < 3; i++) {
      steps.push({
        title: document.getElementById(`cm-sp-step${i}-title`).value.trim(),
        text: document.getElementById(`cm-sp-step${i}-text`).value.trim()
      });
    }
    const faq = [];
    for (let i = 0; i < 3; i++) {
      faq.push({
        question: document.getElementById(`cm-sp-faq${i}-q`).value.trim(),
        answer: document.getElementById(`cm-sp-faq${i}-a`).value.trim()
      });
    }

    PO_Content.updateServicePageContent(serviceId, {
      intro: document.getElementById('cm-sp-intro').value.trim(),
      stepsEyebrow: document.getElementById('cm-sp-steps-eyebrow').value.trim(),
      stepsTitle: document.getElementById('cm-sp-steps-title').value.trim(),
      steps,
      ctaTitle: document.getElementById('cm-sp-cta-title').value.trim(),
      ctaText: document.getElementById('cm-sp-cta-text').value.trim(),
      ctaButtonLabel: document.getElementById('cm-sp-cta-button').value.trim(),
      faq
    });

    const notice = document.getElementById('service-page-notice');
    notice.hidden = false;
    notice.dataset.tone = 'success';
    notice.textContent = 'Page de service mise à jour. Visible sur cet appareil après rechargement de la page publique (simulation locale — voir le rappel en haut du panneau Paiements pour le détail des limites).';
    setTimeout(() => { notice.hidden = true; }, 3500);
  });

  /* =========================================================
     SERVICES MANAGER
  ========================================================= */
  const ACCENT_LABELS = { terre: 'Terre (vert)', feu: 'Feu (orange)', ether: 'Éther (bleu)' };

  function renderServices() {
    const container = document.getElementById('services-cards-container');
    const services = PO_Content.listServices();

    container.innerHTML = services.map(s => `
      <div class="service-edit-card" data-service-id="${s.id}">
        <div class="service-edit-card__head">
          <span class="service-edit-card__rune-preview">${s.rune}</span>
          <div>
            <h3>${escapeHtml(s.name)}</h3>
            <span>Page : ${s.id}.html</span>
          </div>
        </div>
        <form class="service-edit-form" data-service-id="${s.id}">
          <div class="service-edit-card__row">
            <div class="field">
              <label>Rune</label>
              <input type="text" class="svc-rune" value="${escapeHtml(s.rune)}" maxlength="2">
            </div>
            <div class="field">
              <label>Couleur</label>
              <select class="svc-accent">
                <option value="terre" ${s.accent === 'terre' ? 'selected' : ''}>Terre</option>
                <option value="feu" ${s.accent === 'feu' ? 'selected' : ''}>Feu</option>
                <option value="ether" ${s.accent === 'ether' ? 'selected' : ''}>Éther</option>
              </select>
            </div>
            <div class="field">
              <label>Nom du service</label>
              <input type="text" class="svc-name" value="${escapeHtml(s.name)}">
            </div>
          </div>
          <div class="field">
            <label>Présentation (affichée sous le titre)</label>
            <input type="text" class="svc-tagline" value="${escapeHtml(s.tagline)}">
          </div>
          <button type="submit" class="auth__submit service-edit-card__save" style="max-width:220px; margin-top:8px;">Enregistrer</button>
          <span class="field__error svc-saved-note" style="color:#5fd99c; margin-left:12px;"></span>
        </form>
      </div>
    `).join('');

    container.querySelectorAll('.service-edit-form').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const serviceId = form.dataset.serviceId;
        const patch = {
          rune: form.querySelector('.svc-rune').value.trim(),
          accent: form.querySelector('.svc-accent').value,
          name: form.querySelector('.svc-name').value.trim(),
          tagline: form.querySelector('.svc-tagline').value.trim()
        };
        PO_Content.updateService(serviceId, patch);
        const note = form.querySelector('.svc-saved-note');
        note.textContent = 'Enregistré ✓';
        setTimeout(() => { note.textContent = ''; }, 2000);
        // Met à jour l'aperçu (rune + nom dans l'en-tête de la carte) sans tout re-render
        const card = form.closest('.service-edit-card');
        card.querySelector('.service-edit-card__rune-preview').textContent = patch.rune;
        card.querySelector('.service-edit-card__head h3').textContent = patch.name;
      });
    });
  }

  /* =========================================================
     PRICING MANAGER
  ========================================================= */
  function renderPricing() {
    const serviceId = document.getElementById('pricing-service-filter').value;
    const formulas = PO_Content.listFormulasForService(serviceId);
    const tbody = document.getElementById('pricing-tbody');
    const emptyEl = document.getElementById('pricing-empty');

    if (!formulas.length) {
      tbody.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    tbody.innerHTML = formulas.map(f => `
      <tr>
        <td>${f.order}</td>
        <td>${escapeHtml(f.title)}</td>
        <td>${f.price}€</td>
        <td>${escapeHtml(f.duration)}</td>
        <td>${f.featured ? '<span class="badge badge--confirmed">Oui</span>' : '—'}</td>
        <td>
          <div class="admin-row-actions">
            <button class="icon-btn" data-edit-formula="${f.id}" title="Modifier">✎</button>
            <button class="icon-btn icon-btn--danger" data-delete-formula="${f.id}" title="Supprimer">✕</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit-formula]').forEach(btn => {
      btn.addEventListener('click', () => openFormulaModal(btn.dataset.editFormula));
    });
    tbody.querySelectorAll('[data-delete-formula]').forEach(btn => {
      btn.addEventListener('click', () => {
        const formula = formulas.find(f => f.id === btn.dataset.deleteFormula);
        askConfirm(
          'Supprimer cette formule ?',
          `"${formula.title}" ne sera plus visible sur la page publique du service.`,
          () => { PO_Content.deleteFormula(formula.id); renderPricing(); }
        );
      });
    });
  }

  document.getElementById('pricing-service-filter').addEventListener('change', renderPricing);

  /* ---- Formula modal (create / edit) ---- */
  const formulaModalVeil  = document.getElementById('formula-modal-veil');
  const formulaModalTitle = document.getElementById('formula-modal-title');
  const formulaForm       = document.getElementById('formula-form');
  const formulaNotice     = document.getElementById('formula-modal-notice');

  function openFormulaModal(formulaId) {
    formulaNotice.hidden = true;
    formulaForm.reset();
    const currentServiceId = document.getElementById('pricing-service-filter').value;
    document.getElementById('formula-service-id').value = currentServiceId;

    if (formulaId) {
      const formula = PO_Content.listFormulas().find(f => f.id === formulaId);
      if (!formula) return;
      formulaModalTitle.textContent = 'Modifier la formule';
      document.getElementById('formula-editing-id').value = formula.id;
      document.getElementById('formula-title').value = formula.title;
      document.getElementById('formula-price').value = formula.price;
      document.getElementById('formula-duration').value = formula.duration;
      document.getElementById('formula-description').value = formula.description;
      document.getElementById('formula-featured').checked = Boolean(formula.featured);
    } else {
      formulaModalTitle.textContent = 'Nouvelle formule';
      document.getElementById('formula-editing-id').value = '';
    }
    formulaModalVeil.hidden = false;
  }

  document.getElementById('open-new-formula').addEventListener('click', () => openFormulaModal(null));
  document.getElementById('formula-modal-cancel').addEventListener('click', () => { formulaModalVeil.hidden = true; });

  formulaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('formula-title').value.trim();
    const price = parseFloat(document.getElementById('formula-price').value);
    const duration = document.getElementById('formula-duration').value.trim();
    const description = document.getElementById('formula-description').value.trim();
    const featured = document.getElementById('formula-featured').checked;
    const editingId = document.getElementById('formula-editing-id').value;
    const serviceId = document.getElementById('formula-service-id').value;

    if (!title || isNaN(price) || !duration || !description) {
      formulaNotice.hidden = false;
      formulaNotice.dataset.tone = 'error';
      formulaNotice.textContent = 'Veuillez remplir tous les champs.';
      return;
    }

    const payload = { title, price, duration, description, featured, serviceId };
    if (editingId) payload.id = editingId;

    PO_Content.saveFormula(payload);
    formulaModalVeil.hidden = true;
    renderPricing();
  });

  /* =========================================================
     PAIEMENTS (SIMULATION) — voir l'avertissement en haut de auth.js
  ========================================================= */
  let paymentsSearchTerm = '';
  let paymentsStatusFilter = '';

  function paymentStatusLabel(status) {
    if (status === 'pending_admin') return 'En attente de confirmation';
    if (status === 'confirmed') return 'Confirmé';
    if (status === 'cancelled') return 'Annulé';
    return status;
  }
  function paymentStatusBadgeClass(status) {
    if (status === 'pending_admin') return 'badge--pending';
    if (status === 'confirmed') return 'badge--confirmed';
    if (status === 'cancelled') return 'badge--cancelled';
    return 'badge--done';
  }
  function paymentMethodLabel(method) {
    return method === 'card' ? 'Carte (démo)' : 'Interac';
  }

  function updatePaymentsBadge() {
    const pendingCount = PO_Auth.listTransactions().filter(t => t.status === 'pending_admin').length;
    const badge = document.getElementById('payments-badge');
    if (pendingCount > 0) {
      badge.hidden = false;
      badge.textContent = String(pendingCount);
    } else {
      badge.hidden = true;
    }
  }

  function renderPayments() {
    let transactions = [...PO_Auth.listTransactions()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const tbody = document.getElementById('payments-tbody');
    const emptyEl = document.getElementById('payments-empty');

    if (paymentsSearchTerm) {
      const term = paymentsSearchTerm.toLowerCase();
      transactions = transactions.filter(t => (t.clientName || '').toLowerCase().includes(term));
    }
    if (paymentsStatusFilter) {
      transactions = transactions.filter(t => t.status === paymentsStatusFilter);
    }

    updatePaymentsBadge();

    if (!transactions.length) {
      tbody.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    tbody.innerHTML = transactions.map(t => `
      <tr>
        <td>${escapeHtml(t.clientName || '—')}</td>
        <td>${escapeHtml(t.formulaTitle || '—')}</td>
        <td>${escapeHtml(String(t.amount ?? '—'))}</td>
        <td>${paymentMethodLabel(t.method)}</td>
        <td><span class="badge ${paymentStatusBadgeClass(t.status)}">${paymentStatusLabel(t.status)}</span></td>
        <td>${formatDateShort(t.createdAt.slice(0, 10))}</td>
        <td>
          <div class="admin-row-actions">
            ${t.status === 'pending_admin' ? `<button class="icon-btn" data-confirm-tx="${t.id}" title="Confirmer la réception">✓</button>` : ''}
            ${t.status === 'pending_admin' ? `<button class="icon-btn icon-btn--danger" data-cancel-tx="${t.id}" title="Annuler">✕</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-confirm-tx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tx = transactions.find(t => t.id === btn.dataset.confirmTx);
        askConfirm(
          'Confirmer ce virement Interac ?',
          `Le client ${tx.clientName} obtiendra l'accès à sa séance "${tx.formulaTitle}".`,
          () => { PO_Auth.confirmTransaction(tx.id); renderPayments(); }
        );
      });
    });
    tbody.querySelectorAll('[data-cancel-tx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tx = transactions.find(t => t.id === btn.dataset.cancelTx);
        askConfirm(
          'Annuler cette transaction ?',
          `La transaction de ${tx.clientName} sera marquée comme annulée.`,
          () => { PO_Auth.cancelTransaction(tx.id); renderPayments(); }
        );
      });
    });
  }

  document.getElementById('payments-search')?.addEventListener('input', (e) => {
    paymentsSearchTerm = e.target.value.trim();
    renderPayments();
  });
  document.getElementById('payments-status-filter')?.addEventListener('change', (e) => {
    paymentsStatusFilter = e.target.value;
    renderPayments();
  });
  document.getElementById('payments-export-csv')?.addEventListener('click', () => {
    const transactions = PO_Auth.listTransactions();
    const header = 'Client,Formule,Montant,Méthode,Statut,Date\n';
    const rows = transactions.map(t =>
      [t.clientName, t.formulaTitle, t.amount, paymentMethodLabel(t.method), paymentStatusLabel(t.status), t.createdAt.slice(0, 10)]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paiements-ntabou-aka-we.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  /* =========================================================
     HELPERS
  ========================================================= */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }

  function statusLabel(status) {
    return { confirmed: 'Confirmé', pending: 'En attente', cancelled: 'Annulé', done: 'Terminé' }[status] || status;
  }

  function formatDateShort(isoDate) {
    if (!isoDate) return '—';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }

  function formatDateLong(isoDate) {
    const date = new Date(isoDate + 'T00:00:00');
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatDateTimeShort(isoDateTime) {
    const date = new Date(isoDateTime);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' +
           date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- INITIAL RENDER ---------- */
  renderDashboard();
  updateMessengerBadge();
  updatePaymentsBadge();
});
