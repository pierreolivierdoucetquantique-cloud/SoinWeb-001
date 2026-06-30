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
    if (panelId === 'care') renderCare();
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

  /* =========================================================
     ACCESSIBILITÉ — moteur générique pour modales / drawer
     ---------------------------------------------------------
     openModal(veilEl)  : affiche le panneau, déplace le focus sur son
     premier élément interactif, piège le Tab à l'intérieur (focus trap),
     ferme sur Échap, et restitue le focus à l'élément qui avait le focus
     avant l'ouverture. Tous les .modal-veil / .drawer-veil du panneau
     admin passent par ces deux fonctions plutôt que de manipuler
     directement `.hidden`.
  ========================================================= */
  const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let lastFocusedBeforeModal = null;
  let activeModalKeydownHandler = null;

  function _isVisible(el) {
    // offsetParent n'est pas fiable dans tous les environnements (ex. jsdom, où
    // il n'existe pas de moteur de layout réel) : on vérifie plutôt qu'aucun
    // ancêtre n'est masqué via `hidden` ou `display:none`.
    let node = el;
    while (node && node !== document.body) {
      if (node.hidden) return false;
      if (node.style && node.style.display === 'none') return false;
      node = node.parentElement;
    }
    return true;
  }

  function _trapFocus(e, containerEl) {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(containerEl.querySelectorAll(FOCUSABLE_SELECTOR)).filter(_isVisible);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openModal(veilEl, opts) {
    opts = opts || {};
    lastFocusedBeforeModal = document.activeElement;
    veilEl.hidden = false;

    const box = veilEl.querySelector('.modal-box, .drawer') || veilEl;
    const focusTarget = (opts.focusSelector && box.querySelector(opts.focusSelector)) ||
      box.querySelector(FOCUSABLE_SELECTOR);
    if (focusTarget) focusTarget.focus();

    activeModalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal(veilEl, opts);
      } else {
        _trapFocus(e, box);
      }
    };
    document.addEventListener('keydown', activeModalKeydownHandler);
  }

  function closeModal(veilEl, opts) {
    opts = opts || {};
    veilEl.hidden = true;
    if (activeModalKeydownHandler) {
      document.removeEventListener('keydown', activeModalKeydownHandler);
      activeModalKeydownHandler = null;
    }
    if (typeof opts.onClose === 'function') opts.onClose();
    if (lastFocusedBeforeModal && document.body.contains(lastFocusedBeforeModal)) {
      lastFocusedBeforeModal.focus();
    }
    lastFocusedBeforeModal = null;
  }


  const confirmVeil  = document.getElementById('confirm-modal-veil');
  const confirmTitle = document.getElementById('confirm-modal-title');
  const confirmText  = document.getElementById('confirm-modal-text');
  const confirmOkBtn = document.getElementById('confirm-modal-ok');
  let _confirmCallback = null;

  function askConfirm(title, text, onConfirm) {
    confirmTitle.textContent = title;
    confirmText.textContent = text;
    _confirmCallback = onConfirm;
    openModal(confirmVeil);
  }
  document.getElementById('confirm-modal-cancel').addEventListener('click', () => { closeModal(confirmVeil); });
  confirmOkBtn.addEventListener('click', () => {
    closeModal(confirmVeil);
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
            <button class="icon-btn" data-open-client="${c.id}" title="Voir le profil" aria-label="Voir le profil de ${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}">⊙</button>
            <button class="icon-btn icon-btn--danger" data-delete-client="${c.id}" title="Supprimer" aria-label="Supprimer le client ${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}">✕</button>
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

    openModal(clientDrawerVeil, { focusSelector: '#client-drawer-close' });
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

  document.getElementById('client-drawer-close').addEventListener('click', () => { closeModal(clientDrawerVeil); });
  document.getElementById('drawer-delete-client').addEventListener('click', () => {
    const client = PO_Auth.listClients().find(c => c.id === _drawerClientId);
    if (!client) return;
    askConfirm(
      'Supprimer ce client ?',
      `${client.firstName} ${client.lastName} et tous ses rendez-vous seront définitivement supprimés.`,
      () => {
        PO_Auth.deleteClientAsAdmin(client.id);
        closeModal(clientDrawerVeil);
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
  let draggedApptId = null;

  const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const WEEKDAY_LABELS = { mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche' };
  const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  /* ---- Sous-onglets Calendrier / Disponibilités ---- */
  const calsubButtons = Array.from(document.querySelectorAll('[data-calsub]'));
  function activateCalsub(btn) {
    calsubButtons.forEach(b => {
      const active = b === btn;
      b.setAttribute('aria-selected', String(active));
      b.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('[data-calsub-panel]').forEach(p => {
      const active = p.dataset.calsubPanel === btn.dataset.calsub;
      p.hidden = !active;
      p.setAttribute('data-calsub-active', String(active));
    });
    if (btn.dataset.calsub === 'availability') renderAvailabilityPanel();
  }
  calsubButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => activateCalsub(btn));
    // Navigation clavier standard d'un tablist : flèches gauche/droite déplacent
    // le focus ET activent l'onglet (pattern "automatic activation" WAI-ARIA).
    btn.addEventListener('keydown', (e) => {
      let targetIndex = null;
      if (e.key === 'ArrowRight') targetIndex = (index + 1) % calsubButtons.length;
      else if (e.key === 'ArrowLeft') targetIndex = (index - 1 + calsubButtons.length) % calsubButtons.length;
      else return;
      e.preventDefault();
      const target = calsubButtons[targetIndex];
      target.focus();
      activateCalsub(target);
    });
  });

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
      cells += '<div class="cal-day cal-day--empty" aria-hidden="true"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayAppts = appts.filter(a => a.date === dateStr && a.status !== 'cancelled');
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;

      const chips = dayAppts.slice(0, 3).map(a => {
        const tone = a.blocked ? 'blocked' : a.status;
        const label = a.blocked ? (a.clientName || 'Bloqué') : `${a.time} ${a.clientName}`;
        return `<span class="day-appt-chip day-appt-chip--${tone}" tabindex="0" role="button" draggable="${a.blocked ? 'false' : 'true'}" data-chip-appt="${a.id}" title="${escapeHtml(label)}" aria-label="${a.blocked ? 'Créneau bloqué' : 'Rendez-vous'} : ${escapeHtml(label)}, voir les détails">${escapeHtml(label)}</span>`;
      }).join('');
      const extra = dayAppts.length > 3 ? `<span class="cal-day__count">+${dayAppts.length - 3}</span>` : '';

      const dayLabel = `${d} ${MONTH_NAMES[calMonth]} ${calYear}` +
        (isToday ? ', aujourd\'hui' : '') +
        (dayAppts.length ? `, ${dayAppts.length} rendez-vous` : ', aucun rendez-vous');

      cells += `
        <div class="cal-day ${isToday ? 'cal-day--today' : ''}" data-date="${dateStr}"
             tabindex="0" role="button" aria-pressed="${isSelected}" aria-label="${dayLabel}"
             style="${isSelected ? 'border-color:var(--gold); box-shadow:0 0 0 1px var(--gold) inset;' : ''}">
          <div class="cal-day__num">${d}</div>
          ${chips}
          ${extra}
        </div>`;
    }
    grid.innerHTML = cells;

    const dayCells = Array.from(grid.querySelectorAll('.cal-day[data-date]'));

    function selectCell(cell) {
      selectedDate = cell.dataset.date;
      renderCalendar();
      renderDayAppointments();
      // Après le re-rendu, la cellule équivalente reprend le focus pour ne pas
      // perdre la position de navigation clavier.
      const refreshed = document.querySelector(`.cal-day[data-date="${selectedDate}"]`);
      if (refreshed) refreshed.focus();
    }

    dayCells.forEach((cell, index) => {
      cell.addEventListener('click', (e) => {
        if (e.target.closest('[data-chip-appt]')) return; // un clic sur une puce ne change pas le jour sélectionné
        selectCell(cell);
      });

      // ---- Navigation clavier : flèches (grille 7 colonnes), Entrée/Espace pour sélectionner ----
      cell.addEventListener('keydown', (e) => {
        const cols = 7;
        let targetIndex = null;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectCell(cell);
          return;
        } else if (e.key === 'ArrowRight') targetIndex = index + 1;
        else if (e.key === 'ArrowLeft') targetIndex = index - 1;
        else if (e.key === 'ArrowDown') targetIndex = index + cols;
        else if (e.key === 'ArrowUp') targetIndex = index - cols;
        else return;

        e.preventDefault();
        if (targetIndex >= 0 && targetIndex < dayCells.length) {
          dayCells[targetIndex].focus();
        }
      });

      // ---- Drag & drop : déplacer un rendez-vous d'un jour à l'autre ----
      cell.addEventListener('dragover', (e) => {
        if (!draggedApptId) return;
        e.preventDefault();
        cell.classList.add('cal-day--dragover');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('cal-day--dragover'));
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('cal-day--dragover');
        if (!draggedApptId) return;
        const targetDate = cell.dataset.date;
        const appt = PO_Auth.listAppointments().find(a => a.id === draggedApptId);
        if (!appt) return;
        const result = PO_Auth.moveAppointment(draggedApptId, targetDate, appt.time);
        if (!result.ok) {
          showToast(result.error || 'Impossible de déplacer ce rendez-vous.', 'error');
        } else {
          showToast(`Rendez-vous déplacé au ${formatDateShort(targetDate)}.`, 'success');
        }
        draggedApptId = null;
        renderCalendar();
      });
    });

    grid.querySelectorAll('[data-chip-appt]').forEach(chip => {
      chip.addEventListener('dragstart', (e) => {
        draggedApptId = chip.dataset.chipAppt;
        e.dataTransfer.effectAllowed = 'move';
      });
      chip.addEventListener('dragend', () => { draggedApptId = null; });
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        openApptModal(chip.dataset.chipAppt);
      });
      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          openApptModal(chip.dataset.chipAppt);
        }
      });
    });

    renderDayAppointments();
  }

  // Petite notification éphémère, réutilisée pour les retours du drag & drop.
  // role="status" + aria-live="polite" : annoncée par les lecteurs d'écran
  // sans interrompre ce que l'utilisateur est en train de faire.
  function showToast(message, tone) {
    const existing = document.getElementById('admin-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.className = 'auth__notice';
    toast.dataset.tone = tone || 'success';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '500';
    toast.style.maxWidth = '320px';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
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
          <span>${escapeHtml(a.service)}${a.blocked ? '' : ' · ' + a.duration + ' min'}${a.recurringGroupId ? ' · série récurrente' : ''}</span>
        </span>
        ${a.blocked
          ? '<span class="badge badge--cancelled">Bloqué</span>'
          : `<span class="badge badge--${a.status}">${statusLabel(a.status)}</span>`}
        <div class="admin-row-actions">
          ${a.blocked ? '' : `<button class="icon-btn" data-edit-appt="${a.id}" title="Modifier" aria-label="Modifier le rendez-vous de ${escapeHtml(a.clientName)} à ${a.time}">✎</button>`}
          ${a.recurringGroupId
            ? `<button class="icon-btn icon-btn--danger" data-delete-series="${a.recurringGroupId}" title="Supprimer toute la série" aria-label="Supprimer toute la série de rendez-vous récurrents de ${escapeHtml(a.clientName)}">⌫</button>`
            : ''}
          <button class="icon-btn icon-btn--danger" data-delete-appt="${a.id}" title="Supprimer" aria-label="Supprimer le rendez-vous de ${escapeHtml(a.clientName)} à ${a.time}">✕</button>
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
    list.querySelectorAll('[data-delete-series]').forEach(btn => {
      btn.addEventListener('click', () => {
        askConfirm('Supprimer toute la série récurrente ?', 'Toutes les occurrences liées à cette série seront supprimées. Cette action est irréversible.', () => {
          PO_Auth.deleteAppointmentSeries(btn.dataset.deleteSeries);
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
  const apptRecurringToggle  = document.getElementById('appt-recurring-toggle');
  const apptRecurringOptions = document.getElementById('appt-recurring-options');
  const apptRecurringField   = document.getElementById('appt-recurring-field');

  apptRecurringToggle.addEventListener('change', () => {
    apptRecurringOptions.hidden = !apptRecurringToggle.checked;
  });

  function populateClientSelect() {
    const select = document.getElementById('appt-client');
    const clients = PO_Auth.listClients();
    select.innerHTML = clients.map(c => `<option value="${c.id}">${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</option>`).join('');
  }

  function openApptModal(apptId) {
    populateClientSelect();
    apptNotice.hidden = true;
    apptForm.reset();
    apptRecurringToggle.checked = false;
    apptRecurringOptions.hidden = true;

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
      // La récurrence ne se définit qu'à la création, pas en modification.
      apptRecurringField.hidden = true;
    } else {
      apptModalTitle.textContent = 'Nouveau rendez-vous';
      document.getElementById('appt-editing-id').value = '';
      document.getElementById('appt-date').value = selectedDate;
      apptRecurringField.hidden = false;
    }
    openModal(apptModalVeil);
  }

  document.getElementById('open-new-appt').addEventListener('click', () => openApptModal(null));
  document.getElementById('appt-modal-cancel').addEventListener('click', () => { closeModal(apptModalVeil); });

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
    const isRecurring = !editingId && apptRecurringToggle.checked;

    if (isRecurring) {
      const frequency = document.getElementById('appt-recurring-frequency').value;
      const occurrences = Math.min(52, Math.max(2, parseInt(document.getElementById('appt-recurring-count').value, 10) || 4));
      const result = PO_Auth.createRecurringAppointments({ ...data, frequency, occurrences });

      if (typeof PO_Notifications !== 'undefined' && result.created.length) {
        PO_Notifications.logEmail({
          type: 'appointment_confirmation',
          to: client.email,
          subject: 'Confirmation de votre série de rendez-vous',
          body: `Bonjour ${client.firstName},\n\nVotre série de rendez-vous "${data.service}" est confirmée : ${result.created.length} séance(s) à partir du ${formatDateShort(data.date)} à ${data.time}.\n\nAu plaisir de vous accompagner.`
        });
      }

      closeModal(apptModalVeil);
      selectedDate = data.date;
      renderCalendar();

      if (result.skipped.length) {
        showToast(`${result.created.length} rendez-vous créés, ${result.skipped.length} ignorés (créneau déjà occupé).`, 'error');
      } else {
        showToast(`${result.created.length} rendez-vous récurrents créés.`, 'success');
      }
      return;
    }

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

    closeModal(apptModalVeil);
    selectedDate = data.date;
    renderCalendar();
  });

  /* ---- Modal : bloquer un créneau ---- */
  const blockModalVeil = document.getElementById('block-modal-veil');
  const blockForm      = document.getElementById('block-form');
  const blockNotice     = document.getElementById('block-modal-notice');

  document.getElementById('open-block-modal').addEventListener('click', () => {
    blockForm.reset();
    blockNotice.hidden = true;
    document.getElementById('block-date').value = selectedDate;
    openModal(blockModalVeil);
  });
  document.getElementById('block-modal-cancel').addEventListener('click', () => { closeModal(blockModalVeil); });

  blockForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('block-date').value;
    if (!date) {
      blockNotice.hidden = false;
      blockNotice.dataset.tone = 'error';
      blockNotice.textContent = 'Veuillez choisir une date.';
      return;
    }
    PO_Auth.blockTimeSlot({
      date,
      time: document.getElementById('block-time').value,
      duration: parseInt(document.getElementById('block-duration').value, 10) || 60,
      label: document.getElementById('block-label').value
    });
    closeModal(blockModalVeil);
    selectedDate = date;
    renderCalendar();
    showToast('Créneau bloqué.', 'success');
  });

  /* ---- Modal : vacances ---- */
  const vacationModalVeil = document.getElementById('vacation-modal-veil');
  const vacationForm      = document.getElementById('vacation-form');
  const vacationNotice    = document.getElementById('vacation-modal-notice');

  document.getElementById('open-vacation-modal').addEventListener('click', () => {
    vacationForm.reset();
    vacationNotice.hidden = true;
    openModal(vacationModalVeil);
  });
  document.getElementById('vacation-modal-cancel').addEventListener('click', () => { closeModal(vacationModalVeil); });

  vacationForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const startDate = document.getElementById('vacation-start').value;
    const endDate = document.getElementById('vacation-end').value;
    if (!startDate || !endDate || endDate < startDate) {
      vacationNotice.hidden = false;
      vacationNotice.dataset.tone = 'error';
      vacationNotice.textContent = 'Veuillez renseigner une période valide (date de fin après la date de début).';
      return;
    }
    PO_Auth.addVacation({ startDate, endDate, label: document.getElementById('vacation-label').value });
    closeModal(vacationModalVeil);
    renderCalendar();
    renderAvailabilityPanel();
    showToast('Période de vacances ajoutée.', 'success');
  });

  /* =========================================================
     DISPONIBILITÉS (sous-onglet du Calendrier)
     ---------------------------------------------------------
     Mode brouillon : à l'entrée sur l'onglet, on clone l'objet
     availability complet dans `draftAvailability`. Tous les contrôles
     lisent/écrivent dans ce clone uniquement. La barre Save/Cancel
     apparaît dès que le clone diverge de l'état sauvegardé ; Save
     écrit le clone d'un coup via PO_Auth.replaceAvailability(),
     Cancel (avec confirmation) recharge depuis le storage.
  ========================================================= */
  let draftAvailability = null;
  let savedAvailabilitySnapshot = null;

  function _cloneAv(av) { return JSON.parse(JSON.stringify(av)); }

  function enterAvailabilityDraft() {
    const av = PO_Auth.getAvailability();
    savedAvailabilitySnapshot = JSON.stringify(av);
    draftAvailability = _cloneAv(av);
  }

  function isAvailabilityDirty() {
    return JSON.stringify(draftAvailability) !== savedAvailabilitySnapshot;
  }

  function refreshDraftBar() {
    document.getElementById('avail-draft-bar').hidden = !isAvailabilityDirty();
  }

  function renderAvailabilityPanel() {
    if (!draftAvailability) enterAvailabilityDraft();
    const serviceId = document.getElementById('avail-service-select').value;
    const av = draftAvailability;

    document.getElementById('avail-slot-duration').value = av.slotDurationMinutes[serviceId] || 60;

    const grid = document.getElementById('weekly-hours-grid');
    grid.innerHTML = WEEKDAY_ORDER.map(dayKey => {
      const ranges = (av.weeklyHours[serviceId] && av.weeklyHours[serviceId][dayKey]) || [];
      const rangesHtml = ranges.map((r, i) => `
        <span class="weekly-hours-range" data-day="${dayKey}" data-index="${i}">
          <input type="time" value="${r.start}" data-range-field="start" aria-label="Heure de début, plage ${i + 1} de ${WEEKDAY_LABELS[dayKey]}">
          <span>—</span>
          <input type="time" value="${r.end}" data-range-field="end" aria-label="Heure de fin, plage ${i + 1} de ${WEEKDAY_LABELS[dayKey]}">
          <button type="button" data-remove-range title="Retirer cette plage" aria-label="Retirer la plage ${r.start} – ${r.end} de ${WEEKDAY_LABELS[dayKey]}">✕</button>
        </span>`).join('');
      return `
        <div class="weekly-hours-row ${!ranges.length ? 'weekly-hours-row--closed' : ''}" data-day-row="${dayKey}">
          <span class="weekly-hours-row__day">${WEEKDAY_LABELS[dayKey]}</span>
          <span class="weekly-hours-row__ranges">${rangesHtml}</span>
          <button type="button" class="weekly-hours-row__add" data-add-range="${dayKey}">+ Ajouter une plage</button>
        </div>`;
    }).join('');

    function collectRanges(dayKey) {
      const row = grid.querySelector(`[data-day-row="${dayKey}"]`);
      return Array.from(row.querySelectorAll('.weekly-hours-range')).map(rangeEl => ({
        start: rangeEl.querySelector('[data-range-field="start"]').value,
        end: rangeEl.querySelector('[data-range-field="end"]').value
      })).filter(r => r.start && r.end && r.end > r.start);
    }

    grid.querySelectorAll('[data-range-field]').forEach(input => {
      input.addEventListener('change', () => {
        const dayKey = input.closest('.weekly-hours-range').dataset.day;
        if (!av.weeklyHours[serviceId]) av.weeklyHours[serviceId] = {};
        av.weeklyHours[serviceId][dayKey] = collectRanges(dayKey);
        refreshDraftBar();
      });
    });
    grid.querySelectorAll('[data-remove-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rangeEl = btn.closest('.weekly-hours-range');
        const dayKey = rangeEl.dataset.day;
        rangeEl.remove();
        if (!av.weeklyHours[serviceId]) av.weeklyHours[serviceId] = {};
        av.weeklyHours[serviceId][dayKey] = collectRanges(dayKey);
        refreshDraftBar();
        renderAvailabilityPanel();
      });
    });
    grid.querySelectorAll('[data-add-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dayKey = btn.dataset.addRange;
        if (!av.weeklyHours[serviceId]) av.weeklyHours[serviceId] = {};
        const current = av.weeklyHours[serviceId][dayKey] || [];
        av.weeklyHours[serviceId][dayKey] = [...current, { start: '09:00', end: '12:00' }];
        refreshDraftBar();
        renderAvailabilityPanel();
      });
    });

    renderVacationsList();
    renderHolidaysList();
    renderPausePanel();
    refreshDraftBar();
  }

  function renderVacationsList() {
    const av = draftAvailability;
    const list = document.getElementById('vacations-list');
    if (!av.vacations.length) {
      list.innerHTML = '<p class="empty-state">Aucune période de vacances enregistrée.</p>';
      return;
    }
    const sorted = [...av.vacations].sort((a, b) => a.startDate.localeCompare(b.startDate));
    list.innerHTML = sorted.map(v => `
      <div class="vacation-row">
        <span class="vacation-row__dates">${formatDateShort(v.startDate)} → ${formatDateShort(v.endDate)}</span>
        <span class="vacation-row__label">${escapeHtml(v.label || '—')}</span>
        <button class="icon-btn icon-btn--danger" data-remove-vacation="${v.id}" title="Supprimer" aria-label="Supprimer la période de vacances du ${formatDateShort(v.startDate)} au ${formatDateShort(v.endDate)}">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('[data-remove-vacation]').forEach(btn => {
      btn.addEventListener('click', () => {
        draftAvailability.vacations = draftAvailability.vacations.filter(v => v.id !== btn.dataset.removeVacation);
        refreshDraftBar();
        renderAvailabilityPanel();
      });
    });
  }

  function renderHolidaysList() {
    const av = draftAvailability;
    const list = document.getElementById('holidays-list');
    if (!av.holidays.length) {
      list.innerHTML = '<p class="empty-state">Aucun jour férié enregistré.</p>';
      return;
    }
    const sorted = [...av.holidays].sort((a, b) => a.date.localeCompare(b.date));
    list.innerHTML = sorted.map(h => `
      <div class="holiday-row">
        <span class="holiday-row__date">${formatDateShort(h.date)}</span>
        <span class="holiday-row__label">${escapeHtml(h.label || '—')}</span>
        ${h.recurringYearly ? '<span class="holiday-row__badge">Chaque année</span>' : ''}
        <button class="icon-btn icon-btn--danger" data-remove-holiday="${h.id}" title="Supprimer" aria-label="Supprimer le jour férié du ${formatDateShort(h.date)}${h.label ? ' (' + escapeHtml(h.label) + ')' : ''}">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('[data-remove-holiday]').forEach(btn => {
      btn.addEventListener('click', () => {
        draftAvailability.holidays = draftAvailability.holidays.filter(h => h.id !== btn.dataset.removeHoliday);
        refreshDraftBar();
        renderAvailabilityPanel();
      });
    });
  }

  function renderPausePanel() {
    const ps = draftAvailability.pauseSettings;
    document.getElementById('pause-enabled').checked = ps.enabled;
    document.getElementById('pause-config-body').style.opacity = ps.enabled ? '1' : '.45';
    document.getElementById('pause-config-body').style.pointerEvents = ps.enabled ? 'auto' : 'none';

    const presets = ['5', '10', '15', '20', '30', '45', '60'];
    const isPreset = presets.includes(String(ps.durationMinutes));
    document.getElementById('pause-duration-preset').value = isPreset ? String(ps.durationMinutes) : 'custom';
    document.getElementById('pause-duration-custom-field').hidden = isPreset;
    document.getElementById('pause-duration-custom').value = ps.durationMinutes;

    document.getElementById('pause-mode').value = ps.mode;

    const perServiceGrid = document.getElementById('pause-per-service-grid');
    const perDayGrid = document.getElementById('pause-per-day-grid');
    perServiceGrid.hidden = ps.mode !== 'perService';
    perDayGrid.hidden = ps.mode !== 'perDay';

    const serviceLabels = { 'services-energetiques': 'Soins Énergétiques', 'accompagnement': 'Accompagnement 1:1' };
    perServiceGrid.innerHTML = Object.keys(serviceLabels).map(id => `
      <div class="pause-mini-row">
        <span class="pause-mini-row__label">${serviceLabels[id]}</span>
        <input type="number" min="0" step="5" value="${ps.perService[id] ?? ps.durationMinutes}" data-pause-service="${id}" aria-label="Durée de pause en minutes pour ${serviceLabels[id]}">
      </div>`).join('');
    perServiceGrid.querySelectorAll('[data-pause-service]').forEach(input => {
      input.addEventListener('change', () => {
        draftAvailability.pauseSettings.perService[input.dataset.pauseService] = Math.max(0, parseInt(input.value, 10) || 0);
        refreshDraftBar();
      });
    });

    perDayGrid.innerHTML = WEEKDAY_ORDER.map(dayKey => `
      <div class="pause-mini-row">
        <span class="pause-mini-row__label">${WEEKDAY_LABELS[dayKey]}</span>
        <input type="number" min="0" step="5" value="${ps.perDay[dayKey] ?? ps.durationMinutes}" data-pause-day="${dayKey}" aria-label="Durée de pause en minutes pour ${WEEKDAY_LABELS[dayKey]}">
      </div>`).join('');
    perDayGrid.querySelectorAll('[data-pause-day]').forEach(input => {
      input.addEventListener('change', () => {
        draftAvailability.pauseSettings.perDay[input.dataset.pauseDay] = Math.max(0, parseInt(input.value, 10) || 0);
        refreshDraftBar();
      });
    });
  }

  document.getElementById('avail-service-select').addEventListener('change', renderAvailabilityPanel);
  document.getElementById('avail-slot-duration').addEventListener('change', (e) => {
    const serviceId = document.getElementById('avail-service-select').value;
    draftAvailability.slotDurationMinutes[serviceId] = Math.max(15, parseInt(e.target.value, 10) || 60);
    refreshDraftBar();
  });

  // ----- Modale Jour férié -----
  const holidayModalVeil = document.getElementById('holiday-modal-veil');
  const holidayForm = document.getElementById('holiday-form');
  const holidayNotice = document.getElementById('holiday-modal-notice');
  document.getElementById('open-holiday-modal').addEventListener('click', () => {
    holidayForm.reset();
    holidayNotice.hidden = true;
    openModal(holidayModalVeil);
  });
  document.getElementById('holiday-modal-cancel').addEventListener('click', () => { closeModal(holidayModalVeil); });
  holidayForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('holiday-date').value;
    const label = document.getElementById('holiday-label').value.trim();
    const recurringYearly = document.getElementById('holiday-recurring').checked;
    if (!date) {
      holidayNotice.hidden = false;
      holidayNotice.textContent = 'Veuillez choisir une date.';
      return;
    }
    if (!draftAvailability) enterAvailabilityDraft();
    draftAvailability.holidays.push({
      id: 'hol_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      date, label, recurringYearly
    });
    closeModal(holidayModalVeil);
    refreshDraftBar();
    renderAvailabilityPanel();
  });

  // ----- Réglages de pause : listeners globaux -----
  document.getElementById('pause-enabled').addEventListener('change', (e) => {
    draftAvailability.pauseSettings.enabled = e.target.checked;
    refreshDraftBar();
    renderPausePanel();
  });
  document.getElementById('pause-duration-preset').addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      document.getElementById('pause-duration-custom-field').hidden = false;
      draftAvailability.pauseSettings.durationMinutes = parseInt(document.getElementById('pause-duration-custom').value, 10) || 15;
    } else {
      document.getElementById('pause-duration-custom-field').hidden = true;
      draftAvailability.pauseSettings.durationMinutes = parseInt(e.target.value, 10);
    }
    refreshDraftBar();
  });
  document.getElementById('pause-duration-custom').addEventListener('change', (e) => {
    draftAvailability.pauseSettings.durationMinutes = Math.max(1, parseInt(e.target.value, 10) || 1);
    refreshDraftBar();
  });
  document.getElementById('pause-mode').addEventListener('change', (e) => {
    draftAvailability.pauseSettings.mode = e.target.value;
    refreshDraftBar();
    renderPausePanel();
  });

  // ----- Barre de brouillon : Save / Cancel -----
  document.getElementById('avail-draft-save').addEventListener('click', () => {
    const result = PO_Auth.replaceAvailability(draftAvailability);
    if (result.ok) {
      enterAvailabilityDraft();
      refreshDraftBar();
      renderCalendar();
      showToast('Modifications du calendrier enregistrées.', 'success');
    } else {
      showToast(result.error || "Impossible d'enregistrer les modifications.", 'error');
    }
  });
  document.getElementById('avail-draft-cancel').addEventListener('click', () => {
    if (!isAvailabilityDirty()) return;
    if (!confirm('Annuler les modifications non enregistrées ?')) return;
    enterAvailabilityDraft();
    refreshDraftBar();
    renderAvailabilityPanel();
    showToast('Modifications annulées.', 'success');
  });

  // Avertit avant de quitter la page s'il reste des modifications non enregistrées.
  window.addEventListener('beforeunload', (e) => {
    if (draftAvailability && isAvailabilityDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
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
    document.getElementById('an-stat-revenue').textContent = formatPrice(totalRevenue);

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
    openModal(document.getElementById('notif-detail-veil'), { focusSelector: '#notif-detail-close' });
  }

  document.getElementById('notif-detail-close').addEventListener('click', () => {
    closeModal(document.getElementById('notif-detail-veil'));
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

  let _pendingAttachment = null; // pièce jointe en attente d'envoi pour la conversation ouverte
  let _messengerPollTimer = null;
  let _lastRenderedMessageCount = {}; // clientId -> nombre de messages au dernier rendu, pour ne réafficher le thread que si quelque chose a changé

  function renderMessenger() {
    updateMessengerBadge();
    renderConversationList();
    startMessengerPolling();
  }

  function renderConversationList() {
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
      const previewText = s.lastMessage.body || (s.lastMessage.attachment ? '📎 ' + s.lastMessage.attachment.name : '');
      return `
        <div class="messenger-list__item" data-client-id="${s.clientId}" data-active="${isActive}">
          <div class="messenger-list__item-top">
            <span class="messenger-list__name">${escapeHtml(name)}</span>
            ${s.unreadByAdmin ? '<span class="messenger-list__unread"></span>' : ''}
          </div>
          <span class="messenger-list__preview">${escapeHtml(previewText)}</span>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-client-id]').forEach(item => {
      item.addEventListener('click', () => openConversation(item.dataset.clientId));
    });
  }

  // Sondage léger : revérifie périodiquement s'il y a de nouveaux messages ou
  // un signal de frappe, et rafraîchit l'affichage seulement si nécessaire.
  // SIMULATION FRONTEND : ceci ne capte que les changements écrits dans LE
  // MÊME navigateur (ex. un autre onglet ouvert sur profil.html). Un vrai
  // temps réel entre deux appareils différents demanderait un canal serveur
  // (ex. Supabase Realtime / WebSocket).
  function startMessengerPolling() {
    stopMessengerPolling();
    _messengerPollTimer = setInterval(() => {
      const panel = document.querySelector('.admin-panel[data-panel="messenger"]');
      if (!panel || panel.getAttribute('data-active') !== 'true') { stopMessengerPolling(); return; }

      const summary = PO_Messenger.listConversationsSummary();
      const totalMessages = summary.reduce((sum, s) => sum + s.total, 0);
      if (totalMessages !== _lastRenderedMessageCount.__total) {
        _lastRenderedMessageCount.__total = totalMessages;
        renderConversationList();
        updateMessengerBadge();
      }

      if (_activeConversationClientId) {
        refreshActiveThreadIfChanged();
        refreshTypingIndicator();
      }
    }, 1500);
  }

  function stopMessengerPolling() {
    if (_messengerPollTimer) { clearInterval(_messengerPollTimer); _messengerPollTimer = null; }
  }

  function refreshActiveThreadIfChanged() {
    const clientId = _activeConversationClientId;
    const messages = PO_Messenger.listConversation(clientId);
    if (_lastRenderedMessageCount[clientId] === messages.length) return;
    _lastRenderedMessageCount[clientId] = messages.length;
    PO_Messenger.markConversationSeen(clientId, 'admin');
    renderThreadMessages(clientId, messages);
  }

  function refreshTypingIndicator() {
    const el = document.getElementById('messenger-typing-indicator');
    if (!el) return;
    const clientId = _activeConversationClientId;
    el.innerHTML = PO_Messenger.isTyping(clientId, 'client')
      ? '<span class="messenger-typing__dots"><span></span><span></span><span></span></span> en train d\'écrire...'
      : '';
  }

  function renderThreadMessages(clientId, messages) {
    const list = document.getElementById('messenger-messages-list');
    if (!list) return;
    const wasNearBottom = (list.scrollHeight - list.scrollTop - list.clientHeight) < 60;
    list.innerHTML = messages.map(m => renderMessageBubble(m, 'admin')).join('') || '<p class="empty-state">Aucun message encore.</p>';
    if (wasNearBottom) list.scrollTop = list.scrollHeight;
  }

  // Rend une bulle de message, avec sa pièce jointe éventuelle (image affichée
  // en aperçu, autre fichier affiché comme lien de téléchargement "data:").
  function renderMessageBubble(m, viewerRole) {
    const outgoing = m.sender === viewerRole;
    const attachmentHtml = m.attachment ? renderAttachmentHtml(m.attachment) : '';
    return `
      <div class="messenger-bubble ${outgoing ? 'messenger-bubble--out' : 'messenger-bubble--in'}">
        ${m.body ? escapeHtml(m.body) : ''}
        ${attachmentHtml}
        <span class="messenger-bubble__time">${formatDateTimeShort(m.createdAt)}</span>
      </div>
    `;
  }

  function renderAttachmentHtml(attachment) {
    const isImage = (attachment.type || '').startsWith('image/');
    if (isImage) {
      return `<span class="messenger-bubble__attachment"><img src="${attachment.dataUrl}" alt="${escapeHtml(attachment.name)}"></span>`;
    }
    const icon = (attachment.type || '').includes('pdf') ? '📄' : '📎';
    return `<span class="messenger-bubble__attachment"><a class="messenger-bubble__attachment-file" href="${attachment.dataUrl}" download="${escapeHtml(attachment.name)}"><i>${icon}</i>${escapeHtml(attachment.name)}</a></span>`;
  }

  function openConversation(clientId) {
    _activeConversationClientId = clientId;
    _pendingAttachment = null;
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
    _lastRenderedMessageCount[clientId] = messages.length;

    thread.innerHTML = `
      <div class="messenger-thread__head">${escapeHtml(name)}</div>
      <div class="messenger-thread__messages" id="messenger-messages-list">
        ${messages.map(m => renderMessageBubble(m, 'admin')).join('') || '<p class="empty-state">Aucun message encore.</p>'}
      </div>
      <div class="messenger-typing" id="messenger-typing-indicator"></div>
      <div id="messenger-attachment-preview"></div>
      <form class="messenger-thread__form" id="messenger-send-form">
        <button type="button" class="messenger-attach-btn" id="messenger-attach-btn" title="Joindre une image ou un fichier">📎</button>
        <input type="file" id="messenger-file-input" accept="image/*,application/pdf" hidden>
        <input type="text" id="messenger-input" placeholder="Écrire un message..." autocomplete="off">
        <button type="submit">Envoyer</button>
      </form>
    `;

    const messagesList = document.getElementById('messenger-messages-list');
    messagesList.scrollTop = messagesList.scrollHeight;

    const messengerInput = document.getElementById('messenger-input');
    const fileInput = document.getElementById('messenger-file-input');

    document.getElementById('messenger-attach-btn').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        showToast('Fichier trop volumineux (limite 4 Mo en simulation locale).', 'error');
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        _pendingAttachment = { name: file.name, type: file.type, size: file.size, dataUrl: reader.result };
        renderAttachmentPreview();
      };
      reader.readAsDataURL(file);
    });

    function renderAttachmentPreview() {
      const previewEl = document.getElementById('messenger-attachment-preview');
      if (!_pendingAttachment) { previewEl.innerHTML = ''; return; }
      const isImage = (_pendingAttachment.type || '').startsWith('image/');
      previewEl.innerHTML = `
        <div class="messenger-attachment-preview">
          ${isImage
            ? `<img src="${_pendingAttachment.dataUrl}" alt="">`
            : `<span class="messenger-attachment-preview__icon">📄</span>`}
          <span class="messenger-attachment-preview__name">${escapeHtml(_pendingAttachment.name)}</span>
          <button type="button" class="messenger-attachment-preview__remove" id="messenger-attachment-remove">✕</button>
        </div>
      `;
      document.getElementById('messenger-attachment-remove').addEventListener('click', () => {
        _pendingAttachment = null;
        fileInput.value = '';
        renderAttachmentPreview();
      });
    }

    // ---- Indicateur de frappe : signale à l'autre partie qu'on écrit ----
    let typingTimeout = null;
    messengerInput.addEventListener('input', () => {
      PO_Messenger.setTyping(clientId, 'admin');
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => PO_Messenger.clearTyping(clientId, 'admin'), 2000);
    });

    document.getElementById('messenger-send-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const body = messengerInput.value;
      if (!body.trim() && !_pendingAttachment) return;

      const result = PO_Messenger.sendMessage({ clientId, sender: 'admin', body, attachment: _pendingAttachment });
      if (!result.ok) {
        showToast(result.error, 'error');
        return;
      }

      PO_Messenger.clearTyping(clientId, 'admin');
      clearTimeout(typingTimeout);

      if (typeof PO_Notifications !== 'undefined') {
        const allClients = PO_Auth.listClients();
        const targetClient = allClients.find(c => c.id === clientId);
        if (targetClient) {
          PO_Notifications.logEmail({
            type: 'admin_message',
            to: targetClient.email,
            subject: 'Nouveau message de Ntabou Aka Wé',
            body: `Bonjour ${targetClient.firstName},\n\nVous avez reçu un nouveau message${_pendingAttachment ? ' avec une pièce jointe' : ''} :\n\n"${body.trim() || '(pièce jointe)'}"\n\nConnectez-vous à votre espace personnel pour répondre.`
          });
        }
      }

      messengerInput.value = '';
      _pendingAttachment = null;
      fileInput.value = '';
      renderAttachmentPreview();
      renderConversationList();
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

    document.getElementById('cm-sp-cta-title').value = page.ctaTitle || '';
    document.getElementById('cm-sp-cta-text').value = page.ctaText || '';
    document.getElementById('cm-sp-cta-button').value = page.ctaButtonLabel || '';

    renderStepsList();
    renderFaqList();
  }

  document.getElementById('content-service-filter').addEventListener('change', renderServicePageForm);

  document.getElementById('service-page-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const serviceId = document.getElementById('content-service-filter').value;

    PO_Content.updateServicePageContent(serviceId, {
      intro: document.getElementById('cm-sp-intro').value.trim(),
      stepsEyebrow: document.getElementById('cm-sp-steps-eyebrow').value.trim(),
      stepsTitle: document.getElementById('cm-sp-steps-title').value.trim(),
      ctaTitle: document.getElementById('cm-sp-cta-title').value.trim(),
      ctaText: document.getElementById('cm-sp-cta-text').value.trim(),
      ctaButtonLabel: document.getElementById('cm-sp-cta-button').value.trim()
    });

    const notice = document.getElementById('service-page-notice');
    notice.hidden = false;
    notice.dataset.tone = 'success';
    notice.textContent = 'Page de service mise à jour. Visible sur cet appareil après rechargement de la page publique (simulation locale — voir le rappel en haut du panneau Paiements pour le détail des limites).';
    setTimeout(() => { notice.hidden = true; }, 3500);
  });

  /* ---- Étapes ("Comment se déroule") — liste dynamique ---- */
  function renderStepsList() {
    const serviceId = document.getElementById('content-service-filter').value;
    const page = PO_Content.getServicePageContent(serviceId) || {};
    const steps = Array.isArray(page.steps) ? page.steps : [];
    const list = document.getElementById('cm-steps-list');

    if (!steps.length) {
      list.innerHTML = '<p class="cm-block-empty">Aucune étape pour le moment. Utilisez "+ Ajouter une étape".</p>';
      return;
    }

    list.innerHTML = steps.map((s, i) => `
      <div class="cm-block-item" data-step-row="${i}">
        <div class="cm-block-item__order">
          <button type="button" data-step-up="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">↑</button>
          <button type="button" data-step-down="${i}" ${i === steps.length - 1 ? 'disabled' : ''} title="Descendre">↓</button>
        </div>
        <div class="cm-block-item__fields">
          <input type="text" data-step-field="title" data-step-idx="${i}" value="${escapeHtml(s.title)}" placeholder="Titre de l'étape">
          <textarea rows="2" data-step-field="text" data-step-idx="${i}" placeholder="Texte de l'étape">${escapeHtml(s.text)}</textarea>
        </div>
        <button type="button" class="cm-block-item__remove" data-step-remove="${i}" title="Supprimer cette étape">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-step-field]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = Number(input.dataset.stepIdx);
        const field = input.dataset.stepField;
        PO_Content.updateServiceStep(serviceId, idx, { [field]: input.value.trim() });
      });
    });
    list.querySelectorAll('[data-step-up]').forEach(btn => {
      btn.addEventListener('click', () => {
        PO_Content.moveStep(serviceId, Number(btn.dataset.stepUp), -1);
        renderStepsList();
      });
    });
    list.querySelectorAll('[data-step-down]').forEach(btn => {
      btn.addEventListener('click', () => {
        PO_Content.moveStep(serviceId, Number(btn.dataset.stepDown), 1);
        renderStepsList();
      });
    });
    list.querySelectorAll('[data-step-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        askConfirm('Supprimer cette étape ?', 'Elle disparaîtra de la page publique après rechargement.', () => {
          PO_Content.removeStep(serviceId, Number(btn.dataset.stepRemove));
          renderStepsList();
        });
      });
    });
  }

  document.getElementById('cm-add-step').addEventListener('click', () => {
    const serviceId = document.getElementById('content-service-filter').value;
    PO_Content.addStep(serviceId, { title: 'Nouvelle étape', text: '' });
    renderStepsList();
  });

  /* ---- FAQ — liste dynamique ---- */
  function renderFaqList() {
    const serviceId = document.getElementById('content-service-filter').value;
    const page = PO_Content.getServicePageContent(serviceId) || {};
    const faq = Array.isArray(page.faq) ? page.faq : [];
    const list = document.getElementById('cm-faq-list');

    if (!faq.length) {
      list.innerHTML = '<p class="cm-block-empty">Aucune question pour le moment. Utilisez "+ Ajouter une question".</p>';
      return;
    }

    list.innerHTML = faq.map((f, i) => `
      <div class="cm-block-item" data-faq-row="${i}">
        <div class="cm-block-item__order">
          <button type="button" data-faq-up="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">↑</button>
          <button type="button" data-faq-down="${i}" ${i === faq.length - 1 ? 'disabled' : ''} title="Descendre">↓</button>
        </div>
        <div class="cm-block-item__fields">
          <input type="text" data-faqitem-field="question" data-faqitem-idx="${i}" value="${escapeHtml(f.question)}" placeholder="Question">
          <textarea rows="2" data-faqitem-field="answer" data-faqitem-idx="${i}" placeholder="Réponse">${escapeHtml(f.answer)}</textarea>
        </div>
        <button type="button" class="cm-block-item__remove" data-faqitem-remove="${i}" title="Supprimer cette question">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-faqitem-field]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = Number(input.dataset.faqitemIdx);
        const field = input.dataset.faqitemField;
        PO_Content.updateServiceFaq(serviceId, idx, { [field]: input.value.trim() });
      });
    });
    list.querySelectorAll('[data-faq-up]').forEach(btn => {
      btn.addEventListener('click', () => {
        PO_Content.moveFaqItem(serviceId, Number(btn.dataset.faqUp), -1);
        renderFaqList();
      });
    });
    list.querySelectorAll('[data-faq-down]').forEach(btn => {
      btn.addEventListener('click', () => {
        PO_Content.moveFaqItem(serviceId, Number(btn.dataset.faqDown), 1);
        renderFaqList();
      });
    });
    list.querySelectorAll('[data-faqitem-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        askConfirm('Supprimer cette question ?', 'Elle disparaîtra de la page publique après rechargement.', () => {
          PO_Content.removeFaqItem(serviceId, Number(btn.dataset.faqitemRemove));
          renderFaqList();
        });
      });
    });
  }

  document.getElementById('cm-add-faq').addEventListener('click', () => {
    const serviceId = document.getElementById('content-service-filter').value;
    PO_Content.addFaqItem(serviceId, { question: 'Nouvelle question', answer: '' });
    renderFaqList();
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
        <td>${formatPrice(f.price)}</td>
        <td>${escapeHtml(f.duration)}</td>
        <td>${f.featured ? '<span class="badge badge--confirmed">Oui</span>' : '—'}</td>
        <td>
          <div class="admin-row-actions">
            <button class="icon-btn" data-edit-formula="${f.id}" title="Modifier" aria-label="Modifier la formule ${escapeHtml(f.title)}">✎</button>
            <button class="icon-btn icon-btn--danger" data-delete-formula="${f.id}" title="Supprimer" aria-label="Supprimer la formule ${escapeHtml(f.title)}">✕</button>
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
    openModal(formulaModalVeil);
  }

  document.getElementById('open-new-formula').addEventListener('click', () => openFormulaModal(null));
  document.getElementById('formula-modal-cancel').addEventListener('click', () => { closeModal(formulaModalVeil); });

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
    closeModal(formulaModalVeil);
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
            ${t.status === 'pending_admin' ? `<button class="icon-btn" data-confirm-tx="${t.id}" title="Confirmer la réception" aria-label="Confirmer la réception du paiement de ${escapeHtml(t.clientName || 'ce client')}">✓</button>` : ''}
            ${t.status === 'pending_admin' ? `<button class="icon-btn icon-btn--danger" data-cancel-tx="${t.id}" title="Annuler" aria-label="Annuler la transaction de ${escapeHtml(t.clientName || 'ce client')}">✕</button>` : ''}
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
     SOIN INTERACTIF (SIMULATION) — voir l'avertissement complet
     dans care-session-store.js.
  ========================================================= */
  const CARE_TYPE_LABELS = {
    texte: 'Texte', respiration: 'Respiration guidée', questionnaire: 'Questionnaire',
    visualisation: 'Visualisation', pause: 'Intégration silencieuse'
  };

  function renderCare() {
    if (typeof PO_Care === 'undefined') return;
    const cfg = PO_Care.getConfig();
    document.getElementById('care-cfg-title').value = cfg.title || '';
    document.getElementById('care-cfg-price').value = cfg.price ?? '';
    document.getElementById('care-cfg-duration').value = cfg.durationMinutes ?? '';
    renderCareStepsList();
    renderCareSummaries();
  }

  document.getElementById('care-settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    PO_Care.updateConfig({
      title: document.getElementById('care-cfg-title').value.trim(),
      price: Number(document.getElementById('care-cfg-price').value) || 0,
      durationMinutes: Number(document.getElementById('care-cfg-duration').value) || 40
    });
    const notice = document.getElementById('care-settings-notice');
    notice.hidden = false;
    notice.dataset.tone = 'success';
    notice.textContent = 'Réglages enregistrés. Le prix affiché sur "Soins Direct" reste cependant géré par le module Tarifs — pensez à l\'aligner si besoin.';
    setTimeout(() => { notice.hidden = true; }, 3500);
  });

  function renderCareStepsList() {
    const cfg = PO_Care.getConfig();
    const steps = cfg.steps || [];
    const list = document.getElementById('care-steps-list');

    if (!steps.length) {
      list.innerHTML = '<p class="cm-block-empty">Aucune étape pour le moment. Utilisez "+ Ajouter une étape".</p>';
      return;
    }

    const typeOptions = Object.keys(CARE_TYPE_LABELS)
      .map(k => `<option value="${k}">${CARE_TYPE_LABELS[k]}</option>`).join('');

    list.innerHTML = steps.map((s, i) => `
      <div class="cm-block-item" data-care-step-row="${i}">
        <div class="cm-block-item__order">
          <button type="button" data-care-step-up="${s.id}" ${i === 0 ? 'disabled' : ''} title="Monter">↑</button>
          <button type="button" data-care-step-down="${s.id}" ${i === steps.length - 1 ? 'disabled' : ''} title="Descendre">↓</button>
        </div>
        <div class="cm-block-item__fields">
          <select data-care-step-field="type" data-care-step-id="${s.id}">${typeOptions}</select>
          <input type="text" data-care-step-field="title" data-care-step-id="${s.id}" value="${escapeHtml(s.title)}" placeholder="Titre de l'étape">
          <textarea rows="2" data-care-step-field="body" data-care-step-id="${s.id}" placeholder="Texte affiché au client">${escapeHtml(s.body)}</textarea>
          ${(s.type === 'respiration' || s.type === 'visualisation' || s.type === 'pause') ? `
            <div class="field" style="max-width:200px;">
              <label>Durée du minuteur (secondes)</label>
              <input type="number" min="5" step="5" data-care-step-field="durationSeconds" data-care-step-id="${s.id}" value="${s.durationSeconds || 60}">
            </div>` : ''}
          ${s.type === 'questionnaire' ? `
            <div class="field">
              <label>Question</label>
              <input type="text" data-care-step-field="question" data-care-step-id="${s.id}" value="${escapeHtml(s.question || '')}">
            </div>
            <div class="field">
              <label>Options de réponse (une par ligne)</label>
              <textarea rows="3" data-care-step-field="options" data-care-step-id="${s.id}">${escapeHtml((s.options || []).join('\n'))}</textarea>
            </div>` : ''}
        </div>
        <button type="button" class="cm-block-item__remove" data-care-step-remove="${s.id}" title="Supprimer cette étape">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('select[data-care-step-field="type"]').forEach(sel => {
      sel.value = steps.find(s => s.id === sel.dataset.careStepId)?.type || 'texte';
      sel.addEventListener('change', () => {
        PO_Care.saveStep({ id: sel.dataset.careStepId, type: sel.value });
        renderCareStepsList();
      });
    });
    list.querySelectorAll('[data-care-step-field]:not(select)').forEach(input => {
      input.addEventListener('change', () => {
        const field = input.dataset.careStepField;
        let value = input.value;
        if (field === 'durationSeconds') value = Number(value) || 60;
        if (field === 'options') value = value.split('\n').map(v => v.trim()).filter(Boolean);
        PO_Care.saveStep({ id: input.dataset.careStepId, [field]: value });
      });
    });
    list.querySelectorAll('[data-care-step-up]').forEach(btn => {
      btn.addEventListener('click', () => {
        PO_Care.moveStep(btn.dataset.careStepUp, -1);
        renderCareStepsList();
      });
    });
    list.querySelectorAll('[data-care-step-down]').forEach(btn => {
      btn.addEventListener('click', () => {
        PO_Care.moveStep(btn.dataset.careStepDown, 1);
        renderCareStepsList();
      });
    });
    list.querySelectorAll('[data-care-step-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        askConfirm('Supprimer cette étape ?', 'Elle disparaîtra de la séance pour les prochains clients.', () => {
          PO_Care.removeStep(btn.dataset.careStepRemove);
          renderCareStepsList();
        });
      });
    });
  }

  document.getElementById('care-add-step')?.addEventListener('click', () => {
    PO_Care.saveStep({ type: 'texte', title: 'Nouvelle étape', body: '' });
    renderCareStepsList();
  });

  function renderCareSummaries() {
    const summaries = PO_Care.listAllSummaries();
    const tbody = document.getElementById('care-summaries-tbody');
    const emptyEl = document.getElementById('care-summaries-empty');

    if (!summaries.length) {
      tbody.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    tbody.innerHTML = summaries.map(s => `
      <tr>
        <td>${escapeHtml(s.clientName || '—')}</td>
        <td>${formatDateShort(s.completedAt.slice(0, 10))}</td>
        <td>${s.durationMinutes} min</td>
        <td>${escapeHtml(s.transactionId || '—')}</td>
        <td><button class="icon-btn" data-care-pdf="${s.id}" title="Télécharger le PDF" aria-label="Télécharger le PDF de la séance de ${escapeHtml(s.clientName || 'ce client')} du ${formatDateShort(s.completedAt.slice(0, 10))}">⇩</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-care-pdf]').forEach(btn => {
      btn.addEventListener('click', () => {
        const summary = PO_Care.getSummary(btn.dataset.carePdf);
        if (summary && typeof PO_CarePdf !== 'undefined') {
          PO_CarePdf.generate(summary, PO_Care.getConfig().title);
        }
      });
    });
  }

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

  // Formatage des prix en CAD (convention québécoise) : "88,00 $ CAD".
  // N'accepte qu'un nombre, ou une chaîne représentant intégralement un
  // nombre ; toute autre valeur (texte libre, montant déjà formaté) est
  // retournée telle quelle plutôt que mal interprétée par un parsing trop
  // permissif (ex. "3×75 min" ne doit jamais devenir un prix en CAD).
  function formatPrice(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value !== 'number' && typeof value !== 'string') return String(value);
    const trimmed = typeof value === 'string' ? value.trim() : value;
    const isPureNumber = typeof trimmed === 'number' || /^-?\d+([.,]\d+)?$/.test(trimmed);
    if (!isPureNumber) return String(value);
    const num = typeof trimmed === 'number' ? trimmed : parseFloat(trimmed.replace(',', '.'));
    if (Number.isNaN(num)) return String(value);
    return num.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $ CAD';
  }

  /* ---------- INITIAL RENDER ---------- */
  renderDashboard();
  updateMessengerBadge();
  updatePaymentsBadge();
});
