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

  /* ---------- SAISIE HEURE 24H (aucune logique AM/PM, jamais) ----------
     Remplace le rendu natif <input type="time"> (qui peut afficher
     AM/PM selon la locale du système/navigateur) par un champ texte
     auto-formaté HH:mm, universel quel que soit l'appareil. */
  function _attach24hTimeInput(el) {
    if (!el || el.dataset.po24hBound) return;
    el.dataset.po24hBound = 'true';

    function clamp(str) {
      // Ne garde que les chiffres, max 4 (HHmm).
      let digits = str.replace(/\D/g, '').slice(0, 4);
      if (digits.length === 0) return '';
      let hh = digits.slice(0, 2);
      let mm = digits.slice(2, 4);
      if (hh.length === 2) {
        let h = parseInt(hh, 10);
        if (h > 23) hh = '23';
      }
      if (mm.length === 2) {
        let m = parseInt(mm, 10);
        if (m > 59) mm = '59';
      }
      return mm.length > 0 ? `${hh}:${mm}` : hh;
    }

    el.addEventListener('input', () => {
      const pos = el.selectionStart;
      const before = el.value;
      el.value = clamp(el.value);
      if (el.value.length > before.length) el.setSelectionRange(el.value.length, el.value.length);
      else if (pos != null) el.setSelectionRange(pos, pos);
    });

    el.addEventListener('blur', () => {
      if (!el.value) return;
      let digits = el.value.replace(/\D/g, '').slice(0, 4);
      let hh = digits.slice(0, 2).padStart(2, '0');
      let mm = (digits.slice(2, 4) || '0').padEnd(2, '0');
      let h = Math.min(23, parseInt(hh, 10) || 0);
      let m = Math.min(59, parseInt(mm, 10) || 0);
      el.value = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    });

    el.addEventListener('keypress', (e) => {
      // Autorise uniquement les chiffres (le ':' est ajouté automatiquement).
      if (!/[0-9]/.test(e.key)) e.preventDefault();
    });
  }
  document.querySelectorAll('.po-time-input').forEach(_attach24hTimeInput);

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
    if (panelId === 'testimonials') renderTestimonialsAdmin();
    if (panelId === 'services') renderServices();
    if (panelId === 'content') renderContent();
    if (panelId === 'messenger') renderMessenger();
    if (panelId === 'notifications') renderNotifications();
    if (panelId === 'analytics') renderAnalytics();
    if (panelId === 'email-templates') renderEmailTemplates();
    if (panelId === 'automations') renderAutomations();
    if (panelId === 'site-settings') renderSiteSettings();
    if (panelId === 'media') renderMediaGrid();
    if (panelId === 'audit') renderAuditLog();
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

    const upcoming = appts.filter(a => a.date >= todayStr && a.status !== 'cancelled' && a.status !== 'declined');
    const today = appts.filter(a => a.date === todayStr && a.status !== 'cancelled' && a.status !== 'declined');
    const pending = appts.filter(a => a.status === 'pending' || a.status === 'awaiting_confirmation');

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
        <td>${PO_Photo.avatarHTML(c, 32)}</td>
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
    document.getElementById('drawer-client-avatar').innerHTML = PO_Photo.avatarHTML(client, 56);
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
  let calView = 'month'; // 'month' | 'week' | 'day'

  const TIMELINE_START_HOUR = 7;
  const TIMELINE_END_HOUR = 21;
  const HOUR_HEIGHT = 48; // px par heure dans les vues Semaine / Jour

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

  function renderMonthView() {
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
  }

  /* ---- Vue Semaine ---- */
  function _weekStart(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - d.getDay()); // recule jusqu'au dimanche
    return d;
  }

  function _hourLabelsHTML() {
    let html = '';
    for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) {
      const top = (h - TIMELINE_START_HOUR) * HOUR_HEIGHT;
      html += `<span class="cal-week__hour-label" style="top:${top}px;">${String(h).padStart(2, '0')}:00</span>`;
    }
    return html;
  }

  // Construit le bloc HTML positionné d'un rendez-vous dans une timeline horaire.
  // Hors plage horaire affichée (TIMELINE_START_HOUR–TIMELINE_END_HOUR), le rendez-vous
  // est silencieusement omis de la timeline (il reste visible dans la liste du jour en dessous).
  function _timelineApptHTML(a, clientsById) {
    const startMin = _timeToMinutesAdmin(a.time);
    const rangeStart = TIMELINE_START_HOUR * 60, rangeEnd = TIMELINE_END_HOUR * 60;
    if (startMin < rangeStart || startMin >= rangeEnd) return '';
    const duration = a.blocked ? Math.min(a.duration || 60, rangeEnd - startMin) : (a.duration || 60);
    const top = ((startMin - rangeStart) / 60) * HOUR_HEIGHT;
    const height = Math.max(22, (duration / 60) * HOUR_HEIGHT - 2);
    const tone = a.blocked ? 'blocked' : a.status;
    const label = a.blocked ? (a.clientName || 'Bloqué') : escapeHtml(a.clientName);
    const client = clientsById && clientsById[a.clientId];
    const avatarHtml = (!a.blocked && client) ? PO_Photo.avatarHTML(client, 18) : '';
    const showService = height >= 36 && !a.blocked;
    const endMin = startMin + duration;
    const endLabel = String(Math.floor(endMin / 60)).padStart(2, '0') + ':' + String(endMin % 60).padStart(2, '0');
    return `
      <div class="cal-timeline-appt cal-timeline-appt--${tone}" style="top:${top}px; height:${height}px;"
           draggable="${a.blocked ? 'false' : 'true'}" data-tl-appt="${a.id}" tabindex="0" role="button"
           aria-label="${a.time}–${endLabel} ${label}${a.blocked ? '' : ' · ' + escapeHtml(a.service)}">
        <div class="cal-timeline-appt__header">
          ${avatarHtml}
          <strong>${a.time}–${endLabel}</strong>
        </div>
        <span class="cal-timeline-appt__name">${label}</span>
        ${showService ? `<span class="cal-timeline-appt__service">${escapeHtml(a.service)}</span>` : ''}
      </div>`;
  }

  function _timeToMinutesAdmin(t) {
    const [h, m] = String(t).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  // Retourne le HTML de la ligne rouge "heure courante" positionnée dans la timeline.
  // N'affiche rien si l'heure courante est hors de la plage visible.
  function _nowIndicatorHTML() {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const rangeStart = TIMELINE_START_HOUR * 60, rangeEnd = TIMELINE_END_HOUR * 60;
    if (nowMin < rangeStart || nowMin > rangeEnd) return '';
    const top = ((nowMin - rangeStart) / 60) * HOUR_HEIGHT;
    return `<div class="cal-now-indicator" style="top:${top}px;" aria-hidden="true"></div>`;
  }

  // Fait défiler la vue timeline pour montrer l'heure courante (ou 08:00 par défaut).
  function _scrollToCurrentTime(container) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const rangeStart = TIMELINE_START_HOUR * 60;
    const targetMin = Math.max(rangeStart, nowMin - 60); // 1h avant pour avoir du contexte
    const scrollTop = ((targetMin - rangeStart) / 60) * HOUR_HEIGHT;
    requestAnimationFrame(() => {
      const scrollParent = container.closest('.calsub-panel, [data-calsub-panel]') || container.parentElement;
      if (scrollParent) scrollParent.scrollTop = scrollTop;
    });
  }

  function _wireTimelineInteractions(container) {
    container.querySelectorAll('[data-tl-appt]').forEach(el => {
      el.addEventListener('click', () => openApptModal(el.dataset.tlAppt));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openApptModal(el.dataset.tlAppt); }
      });
      el.addEventListener('dragstart', (e) => {
        draggedApptId = el.dataset.tlAppt;
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => { draggedApptId = null; });
    });

    container.querySelectorAll('[data-tl-col]').forEach(col => {
      col.addEventListener('dragover', (e) => {
        if (!draggedApptId) return;
        e.preventDefault();
        col.classList.add(col.dataset.tlColDragoverClass);
      });
      col.addEventListener('dragleave', () => col.classList.remove(col.dataset.tlColDragoverClass));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove(col.dataset.tlColDragoverClass);
        if (!draggedApptId) return;
        const rect = col.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const totalMinutes = TIMELINE_START_HOUR * 60 + (offsetY / HOUR_HEIGHT) * 60;
        const snapped = Math.round(totalMinutes / 15) * 15;
        const clamped = Math.min(TIMELINE_END_HOUR * 60 - 15, Math.max(TIMELINE_START_HOUR * 60, snapped));
        const newTime = String(Math.floor(clamped / 60)).padStart(2, '0') + ':' + String(clamped % 60).padStart(2, '0');
        const targetDate = col.dataset.tlCol;
        const result = PO_Auth.moveAppointment(draggedApptId, targetDate, newTime);
        if (!result.ok) {
          showToast(result.error || 'Impossible de déplacer ce rendez-vous.', 'error');
        } else {
          showToast(`Rendez-vous déplacé au ${formatDateShort(targetDate)} à ${newTime}.`, 'success');
        }
        draggedApptId = null;
        renderCalendar();
      });
    });
  }

  function renderWeekView() {
    const start = _weekStart(selectedDate);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    const end = days[6];
    document.getElementById('cal-label').textContent =
      `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;

    const todayStr = new Date().toISOString().slice(0, 10);
    const appts = PO_Auth.listAppointments();
    const clientsById = {};
    PO_Auth.listClients().forEach(c => { clientsById[c.id] = c; });
    const totalHeight = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * HOUR_HEIGHT;
    const DOW_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const nowIndicatorHtml = _nowIndicatorHTML();

    let headHtml = '<div class="cal-week__corner"></div>';
    let colsHtml = '';
    days.forEach(d => {
      const dateStr = d.toISOString().slice(0, 10);
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      headHtml += `
        <div class="cal-week__head ${isToday ? 'cal-week__head--today' : ''} ${isSelected ? 'cal-week__head--selected' : ''}" data-week-head="${dateStr}" tabindex="0" role="button" aria-label="${DOW_SHORT[d.getDay()]} ${d.getDate()}">
          <div class="cal-week__head-dow">${DOW_SHORT[d.getDay()]}</div>
          <div class="cal-week__head-num">${d.getDate()}</div>
        </div>`;
      const dayAppts = appts.filter(a => a.date === dateStr && a.status !== 'cancelled' && a.status !== 'declined');
      const blocksHtml = dayAppts.map(a => _timelineApptHTML(a, clientsById)).join('');
      colsHtml += `<div class="cal-week__col" data-tl-col="${dateStr}" data-tl-col-dragover-class="cal-week__col--dragover" style="height:${totalHeight}px; --cal-hour-h:${HOUR_HEIGHT}px;">${isToday ? nowIndicatorHtml : ''}${blocksHtml}</div>`;
    });

    const grid = document.getElementById('cal-week-grid');
    grid.innerHTML = headHtml +
      `<div class="cal-week__hours" style="height:${totalHeight}px;">${_hourLabelsHTML()}</div>` +
      colsHtml;

    grid.querySelectorAll('[data-week-head]').forEach(head => {
      const select = () => { selectedDate = head.dataset.weekHead; renderCalendar(); };
      head.addEventListener('click', select);
      head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
    });

    // Double-clic sur une colonne vide → pré-remplit date+heure dans le modal de création
    grid.querySelectorAll('[data-tl-col]').forEach(col => {
      col.addEventListener('dblclick', (e) => {
        if (e.target.closest('[data-tl-appt]')) return;
        const rect = col.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const totalMin = TIMELINE_START_HOUR * 60 + (offsetY / HOUR_HEIGHT) * 60;
        const snapped = Math.round(totalMin / 15) * 15;
        const clamped = Math.min(TIMELINE_END_HOUR * 60 - 15, Math.max(TIMELINE_START_HOUR * 60, snapped));
        const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
        const mm = String(clamped % 60).padStart(2, '0');
        selectedDate = col.dataset.tlCol;
        openApptModal(null, { date: col.dataset.tlCol, time: `${hh}:${mm}` });
      });
    });

    _wireTimelineInteractions(grid);
    _scrollToCurrentTime(grid);
  }

  /* ---- Vue Jour ---- */
  function renderDayView() {
    document.getElementById('cal-label').textContent = formatDateLong(selectedDate);

    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = selectedDate === todayStr;
    const appts = PO_Auth.listAppointments().filter(a => a.date === selectedDate && a.status !== 'cancelled' && a.status !== 'declined');
    const clientsById = {};
    PO_Auth.listClients().forEach(c => { clientsById[c.id] = c; });
    const totalHeight = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * HOUR_HEIGHT;
    const blocksHtml = appts.map(a => _timelineApptHTML(a, clientsById)).join('');
    const nowHtml = isToday ? _nowIndicatorHTML() : '';

    const grid = document.getElementById('cal-day-timeline-grid');
    grid.innerHTML =
      `<div class="cal-day-timeline__hours" style="height:${totalHeight}px;">${_hourLabelsHTML().replace(/cal-week__hour-label/g, 'cal-day-timeline__hour-label')}</div>` +
      `<div class="cal-day-timeline__col" data-tl-col="${selectedDate}" data-tl-col-dragover-class="cal-day-timeline__col--dragover" style="height:${totalHeight}px; --cal-hour-h:${HOUR_HEIGHT}px;">${nowHtml}${blocksHtml}</div>`;

    // Double-clic sur zone vide → pré-remplit l'heure dans le modal de création
    const col = grid.querySelector('[data-tl-col]');
    col.addEventListener('dblclick', (e) => {
      if (e.target.closest('[data-tl-appt]')) return;
      const rect = col.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const totalMin = TIMELINE_START_HOUR * 60 + (offsetY / HOUR_HEIGHT) * 60;
      const snapped = Math.round(totalMin / 15) * 15;
      const clamped = Math.min(TIMELINE_END_HOUR * 60 - 15, Math.max(TIMELINE_START_HOUR * 60, snapped));
      const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
      const mm = String(clamped % 60).padStart(2, '0');
      openApptModal(null, { date: selectedDate, time: `${hh}:${mm}` });
    });

    _wireTimelineInteractions(grid);
    _scrollToCurrentTime(grid);
  }

  // ---- Dispatcher : bascule entre les vues Mois / Semaine / Jour ----
  function renderCalendar() {
    document.getElementById('cal-view-month').hidden = calView !== 'month';
    document.getElementById('cal-view-week').hidden = calView !== 'week';
    document.getElementById('cal-view-day').hidden = calView !== 'day';
    document.getElementById('cal-hint').textContent = calView === 'month'
      ? "Glissez-déposez un rendez-vous sur un autre jour pour le déplacer."
      : "Glissez-déposez un rendez-vous pour changer son jour et son heure.";

    if (calView === 'month') renderMonthView();
    else if (calView === 'week') renderWeekView();
    else renderDayView();

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

  // Centralise l'envoi (simulé) de notification email/push à chaque transition
  // de statut d'un rendez-vous, pour TASK_004/TASK_006/TASK_012 : un email est
  // journalisé pour chaque changement de statut, quelle que soit l'action qui
  // l'a déclenché (modal d'édition ou boutons d'action rapide).
  function notifyAppointmentStatusChange(appt, newStatus, previousStatus) {
    if (typeof PO_Notifications === 'undefined' || !appt.clientId || newStatus === previousStatus) return;
    const client = PO_Auth.listClients().find(c => c.id === appt.clientId);
    if (!client) return;
    const dateLabel = formatDateShort(appt.date);

    const messages = {
      confirmed: {
        type: 'appointment_confirmation',
        subject: 'Confirmation de votre rendez-vous',
        body: `Bonjour ${client.firstName},\n\nVotre rendez-vous "${appt.service}" est confirmé pour le ${dateLabel} à ${appt.time} (${appt.duration} min).\n\nAu plaisir de vous accompagner.`
      },
      declined: {
        type: 'appointment_declined',
        subject: 'Votre demande de rendez-vous a été refusée',
        body: `Bonjour ${client.firstName},\n\nVotre demande de rendez-vous "${appt.service}" prévue le ${dateLabel} à ${appt.time} n'a malheureusement pas pu être confirmée. N'hésitez pas à choisir un autre créneau depuis votre espace personnel.`
      },
      rescheduled: {
        type: 'appointment_rescheduled',
        subject: 'Votre rendez-vous a été replanifié',
        body: `Bonjour ${client.firstName},\n\nVotre rendez-vous "${appt.service}" a été déplacé au ${dateLabel} à ${appt.time}. Merci de vérifier ce nouveau créneau dans votre espace personnel.`
      },
      awaiting_confirmation: {
        type: 'appointment_awaiting_confirmation',
        subject: 'Votre demande de replanification est en attente',
        body: `Bonjour ${client.firstName},\n\nVotre demande concernant le rendez-vous "${appt.service}" du ${dateLabel} à ${appt.time} est en attente de confirmation de notre part. Nous revenons vers vous rapidement.`
      },
      cancelled: {
        type: 'appointment_cancellation',
        subject: 'Annulation de votre rendez-vous',
        body: `Bonjour ${client.firstName},\n\nVotre rendez-vous "${appt.service}" prévu le ${dateLabel} à ${appt.time} a été annulé. N'hésitez pas à reprendre un nouveau créneau depuis votre espace personnel.`
      },
      completed: {
        type: 'appointment_completed',
        subject: 'Votre rendez-vous est terminé — merci !',
        body: `Bonjour ${client.firstName},\n\nVotre rendez-vous "${appt.service}" du ${dateLabel} à ${appt.time} est maintenant marqué comme terminé. Merci de votre confiance.`
      }
    };

    const m = messages[newStatus];
    if (!m) return;
    PO_Notifications.logEmail({ type: m.type, to: client.email, subject: m.subject, body: m.body });
    PO_Notifications.logPush({ to: client.email, title: m.subject, body: `${appt.service} — ${dateLabel} à ${appt.time}` });

    // Envoi du VRAI courriel via PO_EmailService (Resend) — voir email-service.js.
    // Le journal local ci-dessus reste utile pour l'historique visible dans
    // Admin → Notifications, mais ne remplace plus l'envoi réel.
    if (typeof PO_EmailService !== 'undefined') {
      const emailPayload = { client, appointment: appt };
      const sendFns = {
        confirmed: PO_EmailService.appointmentConfirmation,
        declined: PO_EmailService.appointmentDeclined,
        rescheduled: PO_EmailService.appointmentRescheduled,
        cancelled: PO_EmailService.appointmentCancelled
      };
      if (sendFns[newStatus]) {
        sendFns[newStatus](emailPayload).then(result => {
          if (!result.ok && !result.simulated) {
            console.warn(`[Email] Échec de l'envoi (${newStatus}) pour ${client.email} :`, result.error);
          }
        });
      } else {
        // Statuts sans modèle dédié (awaiting_confirmation, completed) :
        // repli sur un envoi personnalisé avec le même sujet/corps déjà préparés.
        PO_EmailService.custom({ to: client.email, subject: m.subject, body: m.body });
      }
    }
  }

  // Applique un nouveau statut à un rendez-vous depuis un bouton d'action
  // rapide (liste du jour), avec notification automatique.
  function quickSetAppointmentStatus(apptId, newStatus) {
    const appt = PO_Auth.listAppointments().find(a => a.id === apptId);
    if (!appt) return;
    const previousStatus = appt.status;
    const result = PO_Auth.updateAppointment(apptId, { status: newStatus });
    if (!result.ok) {
      showToast(result.error || 'Action impossible.', 'error');
      return;
    }
    notifyAppointmentStatusChange(result.appointment, newStatus, previousStatus);
    renderCalendar();
  }

  function renderDayAppointments() {
    const title = document.getElementById('day-appts-title');
    const list = document.getElementById('day-appts-list');
    const appts = PO_Auth.listAppointments()
      .filter(a => a.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
    const clientsById = {};
    PO_Auth.listClients().forEach(c => { clientsById[c.id] = c; });

    title.textContent = `Rendez-vous du ${formatDateLong(selectedDate)}`;

    if (!appts.length) {
      list.innerHTML = '<p class="empty-state">Aucun rendez-vous ce jour-là.</p>';
      return;
    }

    list.innerHTML = appts.map(a => {
      const client = clientsById[a.clientId];
      return `
      <div class="day-appt-row">
        <span class="day-appt-row__time">${a.time}</span>
        ${a.blocked ? '' : `<span class="day-appt-row__avatar">${PO_Photo.avatarHTML(client || { firstName: a.clientName, lastName: '' }, 30)}</span>`}
        <span class="day-appt-row__info">
          <strong>${escapeHtml(a.clientName)}</strong>
          <span>${escapeHtml(a.service)}${a.blocked ? '' : ' · ' + a.duration + ' min'}${a.recurringGroupId ? ' · série récurrente' : ''}</span>
        </span>
        ${a.blocked
          ? '<span class="badge badge--cancelled">Bloqué</span>'
          : `<span class="badge badge--${a.status}">${statusLabel(a.status)}</span>`}
        <div class="admin-row-actions">
          ${!a.blocked && (a.status === 'pending' || a.status === 'awaiting_confirmation')
            ? `<button class="icon-btn" data-quick-status="${a.id}" data-new-status="confirmed" title="Accepter" aria-label="Accepter le rendez-vous de ${escapeHtml(a.clientName)}">✓</button>
               <button class="icon-btn icon-btn--danger" data-quick-status="${a.id}" data-new-status="declined" title="Refuser" aria-label="Refuser le rendez-vous de ${escapeHtml(a.clientName)}">✕</button>`
            : ''}
          ${!a.blocked && a.status === 'confirmed'
            ? `<button class="icon-btn" data-quick-status="${a.id}" data-new-status="completed" title="Marquer terminé" aria-label="Marquer terminé le rendez-vous de ${escapeHtml(a.clientName)}">●</button>`
            : ''}
          ${a.blocked ? '' : `<button class="icon-btn" data-edit-appt="${a.id}" title="Modifier / replanifier" aria-label="Modifier le rendez-vous de ${escapeHtml(a.clientName)} à ${a.time}">✎</button>`}
          ${!a.blocked && a.status !== 'cancelled'
            ? `<button class="icon-btn icon-btn--danger" data-quick-status="${a.id}" data-new-status="cancelled" title="Annuler" aria-label="Annuler le rendez-vous de ${escapeHtml(a.clientName)}">⊘</button>`
            : ''}
          ${a.recurringGroupId
            ? `<button class="icon-btn icon-btn--danger" data-delete-series="${a.recurringGroupId}" title="Supprimer toute la série" aria-label="Supprimer toute la série de rendez-vous récurrents de ${escapeHtml(a.clientName)}">⌫</button>`
            : ''}
          <button class="icon-btn icon-btn--danger" data-delete-appt="${a.id}" title="Supprimer" aria-label="Supprimer le rendez-vous de ${escapeHtml(a.clientName)} à ${a.time}">✕</button>
        </div>
      </div>
    `;
    }).join('');

    list.querySelectorAll('[data-quick-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        const newStatus = btn.dataset.newStatus;
        const labels = { confirmed: 'accepter', declined: 'refuser', completed: 'marquer terminé', cancelled: 'annuler' };
        askConfirm(`Confirmer : ${labels[newStatus] || newStatus} ce rendez-vous ?`, '', () => {
          quickSetAppointmentStatus(btn.dataset.quickStatus, newStatus);
        });
      });
    });
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

  // Bascule de vue : Mois / Semaine / Jour
  document.querySelectorAll('[data-calview]').forEach(btn => {
    btn.addEventListener('click', () => {
      calView = btn.dataset.calview;
      document.querySelectorAll('[data-calview]').forEach(b => {
        b.setAttribute('aria-selected', String(b === btn));
      });
      renderCalendar();
    });
  });

  document.getElementById('cal-prev').addEventListener('click', () => {
    if (calView === 'month') {
      calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    } else if (calView === 'week') {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      selectedDate = d.toISOString().slice(0, 10);
      calYear = d.getFullYear(); calMonth = d.getMonth();
    } else {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      selectedDate = d.toISOString().slice(0, 10);
      calYear = d.getFullYear(); calMonth = d.getMonth();
    }
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    if (calView === 'month') {
      calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    } else if (calView === 'week') {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      selectedDate = d.toISOString().slice(0, 10);
      calYear = d.getFullYear(); calMonth = d.getMonth();
    } else {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      selectedDate = d.toISOString().slice(0, 10);
      calYear = d.getFullYear(); calMonth = d.getMonth();
    }
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

  function openApptModal(apptId, prefill) {
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
      document.getElementById('appt-date').value = (prefill && prefill.date) || selectedDate;
      if (prefill && prefill.time) document.getElementById('appt-time').value = prefill.time;
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
        if (typeof PO_EmailService !== 'undefined' && result.created[0]) {
          PO_EmailService.appointmentConfirmation({ client, appointment: result.created[0] });
        }
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
    let previousDateTime = null;
    if (editingId) {
      const existing = PO_Auth.listAppointments().find(a => a.id === editingId);
      previousStatus = existing ? existing.status : null;
      previousDateTime = existing ? existing.date + ' ' + existing.time : null;
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
        if (typeof PO_EmailService !== 'undefined') {
          PO_EmailService.appointmentConfirmation({ client, appointment: data });
        }
      } else {
        const newDateTime = data.date + ' ' + data.time;
        const dateTimeChanged = previousDateTime !== null && previousDateTime !== newDateTime;
        if (dateTimeChanged && data.status !== 'cancelled' && data.status !== 'declined') {
          // La date/heure a changé sur un rendez-vous existant -> traité comme une replanification,
          // peu importe le statut choisi par ailleurs dans le formulaire.
          notifyAppointmentStatusChange({ ...data, clientId: client.id }, 'rescheduled', 'rescheduled-trigger');
        } else if (previousStatus !== data.status) {
          notifyAppointmentStatusChange({ ...data, clientId: client.id }, data.status, previousStatus);
        }
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
          <input type="text" class="po-time-input" inputmode="numeric" placeholder="HH:mm" maxlength="5" autocomplete="off" value="${r.start}" data-range-field="start" aria-label="Heure de début (24h), plage ${i + 1} de ${WEEKDAY_LABELS[dayKey]}">
          <span>—</span>
          <input type="text" class="po-time-input" inputmode="numeric" placeholder="HH:mm" maxlength="5" autocomplete="off" value="${r.end}" data-range-field="end" aria-label="Heure de fin (24h), plage ${i + 1} de ${WEEKDAY_LABELS[dayKey]}">
          <button type="button" data-remove-range title="Retirer cette plage" aria-label="Retirer la plage ${r.start} – ${r.end} de ${WEEKDAY_LABELS[dayKey]}">✕</button>
        </span>`).join('');
      return `
        <div class="weekly-hours-row ${!ranges.length ? 'weekly-hours-row--closed' : ''}" data-day-row="${dayKey}">
          <span class="weekly-hours-row__day">${WEEKDAY_LABELS[dayKey]}</span>
          <span class="weekly-hours-row__ranges">${rangesHtml}</span>
          <button type="button" class="weekly-hours-row__add" data-add-range="${dayKey}">+ Ajouter une plage</button>
        </div>`;
    }).join('');
    grid.querySelectorAll('.po-time-input').forEach(_attach24hTimeInput);

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
    // Revenu encaissé : somme des vraies transactions payées (prix réels au moment de l'achat).
    // Si aucune transaction n'existe encore, on estime via les prix moyens des formules.
    const paidTxs = PO_Auth.listTransactions().filter(t => t.status === 'paid' || t.status === 'confirmed' || t.status === 'completed');
    let totalRevenue = 0;
    if (paidTxs.length > 0) {
      paidTxs.forEach(t => { totalRevenue += parseFloat(t.total || t.amount || 0); });
    } else {
      // Fallback : estimation via les rdv confirmés + prix moyen des formules
      const revenueEligible = appts.filter(a => a.status === 'confirmed' || a.status === 'completed' || a.status === 'done');
      revenueEligible.forEach(a => {
        const service = services.find(s => s.name === a.service);
        if (!service) return;
        const formulas = PO_Content.listFormulasForService(service.id);
        if (!formulas.length) return;
        totalRevenue += formulas.reduce((sum, f) => sum + f.price, 0) / formulas.length;
      });
    }
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
      { key: 'awaiting_confirmation', label: 'Attente confirmation' },
      { key: 'rescheduled', label: 'Replanifiés' },
      { key: 'completed', label: 'Terminés' },
      { key: 'declined', label: 'Refusés' },
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
    appointment_confirmation: { label: 'Confirmation de rendez-vous', desc: 'Envoyée quand un rendez-vous est confirmé.' },
    appointment_reminder: { label: 'Rappel de rendez-vous', desc: 'Envoyé avant la date du rendez-vous.' },
    appointment_awaiting_confirmation: { label: 'Replanification en attente', desc: 'Envoyée quand une replanification attend votre confirmation.' },
    appointment_rescheduled: { label: 'Rendez-vous replanifié', desc: 'Envoyée quand un rendez-vous est déplacé à une nouvelle date.' },
    appointment_declined: { label: 'Rendez-vous refusé', desc: 'Envoyée quand un rendez-vous est refusé.' },
    appointment_completed: { label: 'Rendez-vous terminé', desc: 'Envoyée quand un rendez-vous est marqué terminé.' },
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
        <td>
          <div class="admin-row-actions">
            <span class="log-row-link" data-view-log="${entry.id}">Voir</span>
            <button class="icon-btn icon-btn--danger" data-delete-log="${entry.id}" title="Supprimer cette entrée" aria-label="Supprimer cette notification du journal">🗑</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-view-log]').forEach(link => {
      link.addEventListener('click', () => openNotifDetail(link.dataset.viewLog));
    });

    tbody.querySelectorAll('[data-delete-log]').forEach(btn => {
      btn.addEventListener('click', () => {
        const res = PO_Auth.deleteNotificationLog(btn.dataset.deleteLog);
        if (res.ok) renderNotifLog();
        else showToast(res.error || 'Erreur lors de la suppression.', 'error');
      });
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

  /* ---------- Rappels de rendez-vous (déclenchement manuel) ----------
     Envoie un vrai courriel de rappel (Resend) pour chaque rendez-vous
     confirmé prévu demain n'ayant pas déjà reçu de rappel. Un vrai système
     de rappel automatique (sans clic) nécessite une tâche planifiée
     côté serveur avec accès à une base de données réelle — voir
     PLAN-MIGRATION-SUPABASE.md. Tant que les rendez-vous vivent uniquement
     dans le localStorage du navigateur, seul un déclenchement manuel depuis
     ce panneau (ouvert dans un navigateur) peut fonctionner. */
  document.getElementById('send-reminders-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('send-reminders-btn');
    const resultEl = document.getElementById('send-reminders-result');
    btn.disabled = true;
    resultEl.textContent = 'Envoi en cours…';

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const targets = PO_Auth.listAppointments().filter(a =>
      a.date === tomorrowStr &&
      a.status === 'confirmed' &&
      !a.blocked &&
      !a.reminderSentAt
    );

    if (!targets.length) {
      resultEl.textContent = 'Aucun rappel à envoyer pour demain.';
      btn.disabled = false;
      return;
    }

    let sent = 0;
    let failed = 0;
    for (const appt of targets) {
      const client = PO_Auth.listClients().find(c => c.id === appt.clientId);
      if (!client) continue;
      let ok = true;
      if (typeof PO_EmailService !== 'undefined') {
        const result = await PO_EmailService.appointmentReminder({ client, appointment: appt });
        ok = result.ok || result.simulated;
      }
      if (ok) {
        PO_Auth.updateAppointment(appt.id, { reminderSentAt: new Date().toISOString() });
        if (typeof PO_Notifications !== 'undefined') {
          PO_Notifications.logEmail({
            type: 'appointment_reminder',
            to: client.email,
            subject: 'Rappel de votre rendez-vous demain',
            body: `Bonjour ${client.firstName},\n\nPetit rappel : votre rendez-vous "${appt.service}" est prévu demain à ${appt.time}.\n\nAu plaisir de vous accompagner.`
          });
        }
        sent++;
      } else {
        failed++;
      }
    }

    resultEl.textContent = failed
      ? `${sent} rappel(s) envoyé(s), ${failed} échec(s).`
      : `${sent} rappel(s) envoyé(s) avec succès.`;
    btn.disabled = false;
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
            <button class="icon-btn icon-btn--danger messenger-delete-conv" data-delete-conv="${s.clientId}" title="Supprimer cette conversation" aria-label="Supprimer la conversation avec ${escapeHtml(name)}">🗑</button>
          </div>
          <span class="messenger-list__preview">${escapeHtml(previewText)}</span>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-client-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.messenger-delete-conv')) return;
        openConversation(item.dataset.clientId);
      });
    });

    listEl.querySelectorAll('.messenger-delete-conv').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const clientId = btn.dataset.deleteConv;
        const client = PO_Auth.listClients().find(c => c.id === clientId);
        const name = client ? `${client.firstName} ${client.lastName}` : 'ce client';
        askConfirm(
          `🗑 Supprimer la conversation avec ${escapeHtml(name)} ?`,
          'Tous les messages de cette conversation seront définitivement effacés. Cette action est irréversible.',
          () => {
            PO_Messenger.deleteConversation(clientId);
            if (_activeConversationClientId === clientId) _activeConversationClientId = null;
            showToast('Conversation supprimée.', 'success');
            renderMessenger();
            updateMessengerBadge();
          }
        );
      });
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
     CMS BIOGRAPHIE — Présentation de Pierre-Olivier
  ========================================================= */
  const BIO_TYPE_LABELS = {
    intro: 'Introduction',
    text: 'Section texte',
    quote: 'Citation',
    values: 'Valeurs (séparées par ·)',
    image: 'Image'
  };

  function renderBioCMS() {
    const bio = PO_Content.getBio();

    // En-tête
    if (bio.hero) {
      document.getElementById('bio-hero-title').value = bio.hero.title || '';
      document.getElementById('bio-hero-subtitle').value = bio.hero.subtitle || '';
    }

    // Photo
    const previewEl = document.getElementById('bio-photo-preview');
    const deleteBtn = document.getElementById('bio-photo-delete-btn');
    if (bio.photo) {
      previewEl.innerHTML = `<img src="${bio.photo}" alt="Photo biographie" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`;
      deleteBtn.hidden = false;
    } else {
      previewEl.innerHTML = PO_Photo.avatarHTML({ firstName: 'Pierre', lastName: 'Olivier' }, 80);
      deleteBtn.hidden = true;
    }

    // Sections
    const container = document.getElementById('bio-cms-sections');
    container.innerHTML = (bio.sections || []).map((s, idx) => `
      <div class="cm-block-item" data-bio-section-id="${s.id}">
        <div class="cm-block-item__handle" aria-hidden="true">⠿</div>
        <div class="cm-block-item__fields">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <select class="bio-section-type" data-sid="${s.id}" style="flex:0 0 180px;">
              ${Object.entries(BIO_TYPE_LABELS).map(([v,l]) => `<option value="${v}" ${s.type===v?'selected':''}>${l}</option>`).join('')}
            </select>
            <input type="text" class="bio-section-heading" data-sid="${s.id}" placeholder="Titre de la section (optionnel)" value="${escapeHtml(s.heading||'')}">
          </div>
          <textarea class="bio-section-content" data-sid="${s.id}" rows="4" placeholder="${s.type==='image' ? 'URL de l\'image' : 'Contenu…'}">${escapeHtml(s.type==='image' ? (s.imageUrl||'') : (s.content||''))}</textarea>
        </div>
        <div class="cm-block-item__controls" style="display:flex;flex-direction:column;gap:4px;">
          <button type="button" class="icon-btn bio-section-up" data-sid="${s.id}" title="Monter" ${idx===0?'disabled':''}>↑</button>
          <button type="button" class="icon-btn bio-section-down" data-sid="${s.id}" title="Descendre" ${idx===(bio.sections.length-1)?'disabled':''}>↓</button>
          <button type="button" class="icon-btn icon-btn--danger bio-section-remove" data-sid="${s.id}" title="Supprimer">✕</button>
        </div>
      </div>
    `).join('');

    // Listeners
    container.querySelectorAll('.bio-section-up').forEach(btn => {
      btn.addEventListener('click', () => {
        PO_Content.moveBioSection(btn.dataset.sid, -1);
        renderBioCMS();
      });
    });
    container.querySelectorAll('.bio-section-down').forEach(btn => {
      btn.addEventListener('click', () => {
        PO_Content.moveBioSection(btn.dataset.sid, 1);
        renderBioCMS();
      });
    });
    container.querySelectorAll('.bio-section-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        askConfirm('Supprimer cette section ?', '', () => {
          PO_Content.removeBioSection(btn.dataset.sid);
          renderBioCMS();
        });
      });
    });
  }

  function saveBioCMS() {
    const notice = document.getElementById('bio-cms-notice');
    // En-tête
    PO_Content.updateBioHero({
      title: document.getElementById('bio-hero-title').value,
      subtitle: document.getElementById('bio-hero-subtitle').value
    });
    // Sections
    document.querySelectorAll('[data-bio-section-id]').forEach(el => {
      const sid = el.dataset.bioSectionId;
      const type = el.querySelector('.bio-section-type').value;
      const heading = el.querySelector('.bio-section-heading').value;
      const rawContent = el.querySelector('.bio-section-content').value;
      const data = type === 'image'
        ? { type, heading, imageUrl: rawContent, content: '' }
        : { type, heading, content: rawContent };
      PO_Content.updateBioSection(sid, data);
    });
    notice.hidden = false;
    notice.dataset.tone = 'success';
    notice.textContent = 'Modifications enregistrées. Rechargez la page histoire.html pour les voir.';
    setTimeout(() => { notice.hidden = true; }, 3500);
  }

  document.getElementById('bio-add-section').addEventListener('click', () => {
    PO_Content.addBioSection('text');
    renderBioCMS();
  });
  document.getElementById('bio-save-btn').addEventListener('click', saveBioCMS);

  // Photo biographie
  document.getElementById('bio-photo-upload-btn').addEventListener('click', () => {
    document.getElementById('bio-photo-file').click();
  });
  document.getElementById('bio-photo-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const check = PO_Photo.validateFile(file);
    if (!check.ok) { showToast(check.error, 'error'); return; }
    PO_Photo.openCropper(file, {
      onSave: (dataUrl) => {
        PO_Content.updateBioPhoto(dataUrl);
        renderBioCMS();
        showToast('Photo mise à jour.', 'success');
      }
    });
  });
  document.getElementById('bio-photo-delete-btn').addEventListener('click', () => {
    askConfirm('Supprimer la photo de la page biographie ?', '', () => {
      PO_Content.updateBioPhoto('');
      renderBioCMS();
    });
  });

  // Init CMS bio quand l'onglet Contenu est ouvert
  renderBioCMS();

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
    if (typeof PO_Pricing !== 'undefined') PO_Pricing.syncAll();
    closeModal(formulaModalVeil);
    renderPricing();
  });

  /* =========================================================
     PAIEMENTS (SIMULATION) — voir l'avertissement en haut de auth.js
  ========================================================= */
  let paymentsSearchTerm = '';
  let paymentsStatusFilter = '';
  let paymentsMethodFilter = '';

  function paymentStatusLabel(status) {
    return { waiting:'En attente', pending_admin:'En attente', paid:'Payé', confirmed:'Payé', refused:'Refusé', cancelled:'Annulé' }[status] || status;
  }
  function paymentStatusBadgeClass(status) {
    return { waiting:'badge--pending', pending_admin:'badge--pending', paid:'badge--confirmed', confirmed:'badge--confirmed', refused:'badge--declined', cancelled:'badge--cancelled' }[status] || 'badge--done';
  }
  function paymentMethodLabel(method) {
    return { interac:'Interac', stripe:'Stripe', card:'Carte' }[method] || (method || '—');
  }

  function fmtCAD(n) {
    const v = parseFloat(n) || 0;
    return v.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0$\u00a0CAD';
  }

  function updatePaymentsBadge() {
    const pendingCount = PO_Auth.listTransactions().filter(t => t.status === 'waiting' || t.status === 'pending_admin').length;
    const badge = document.getElementById('payments-badge');
    badge.hidden = pendingCount === 0;
    badge.textContent = String(pendingCount);
  }

  // Même serveur API que PO_EmailService / PO_StripePayment — voir email-service.js.
  const STRIPE_API_BASE_URL = 'https://ntabou-aka-we-api.onrender.com';
  let _stripeModeChecked = false;
  function checkStripeMode() {
    const el = document.getElementById('stripe-mode-indicator');
    if (!el) return;
    fetch(`${STRIPE_API_BASE_URL}/api/stripe-config`, { signal: AbortSignal.timeout(6000) })
      .then(r => r.json())
      .then(data => {
        if (!data.ok || !data.publishableKey) {
          el.textContent = 'Mode Stripe : non configuré';
          el.style.color = '#f0a06b';
          return;
        }
        const isTest = data.publishableKey.startsWith('pk_test_');
        el.textContent = isTest ? 'Mode Stripe : TEST (aucun argent réel)' : 'Mode Stripe : RÉEL (paiements réels)';
        el.style.color = isTest ? '#e3c98a' : '#1fa56a';
      })
      .catch(() => {
        el.textContent = 'Mode Stripe : serveur injoignable';
        el.style.color = '#f0a06b';
      });
  }

  function renderPayments() {
    if (!_stripeModeChecked) { _stripeModeChecked = true; checkStripeMode(); }
    let transactions = [...PO_Auth.listTransactions()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const tbody = document.getElementById('payments-tbody');
    const emptyEl = document.getElementById('payments-empty');

    if (paymentsSearchTerm) {
      const term = paymentsSearchTerm.toLowerCase();
      transactions = transactions.filter(t => (t.clientName || '').toLowerCase().includes(term) || (t.service || '').toLowerCase().includes(term));
    }
    if (paymentsStatusFilter) {
      transactions = transactions.filter(t => t.status === paymentsStatusFilter || (paymentsStatusFilter === 'waiting' && t.status === 'pending_admin'));
    }
    if (paymentsMethodFilter) {
      transactions = transactions.filter(t => t.method === paymentsMethodFilter);
    }

    updatePaymentsBadge();

    if (!transactions.length) {
      tbody.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    tbody.innerHTML = transactions.map(t => {
      const isWaiting = t.status === 'waiting' || t.status === 'pending_admin';
      const total = t.total || t.amount || 0;
      const dateLabel = t.appointmentDate ? formatDateShort(t.appointmentDate) + ' ' + (t.appointmentTime || '') : '—';
      return `
      <tr>
        <td>${escapeHtml(t.clientName || '—')}</td>
        <td>
          <div>${escapeHtml(t.service || '—')}</div>
          ${t.formulaTitle ? `<div style="font-size:.78rem;color:var(--ink-dim);">${escapeHtml(t.formulaTitle)}</div>` : ''}
        </td>
        <td style="font-size:.82rem;">${dateLabel}</td>
        <td>${fmtCAD(total)}${t.tps ? `<br><span style="font-size:.72rem;color:var(--ink-dim);">TPS ${fmtCAD(t.tps)} · TVQ ${fmtCAD(t.tvq)}</span>` : ''}</td>
        <td>${paymentMethodLabel(t.method)}</td>
        <td><span class="badge ${paymentStatusBadgeClass(t.status)}">${paymentStatusLabel(t.status)}</span></td>
        <td>
          <div style="font-size:.78rem;">${formatDateShort(t.createdAt.slice(0, 10))}</div>
          ${t.confirmedAt ? `<div style="font-size:.72rem;color:var(--ink-dim);">Confirmé&nbsp;: ${formatDateShort(t.confirmedAt.slice(0,10))}</div>` : ''}
        </td>
        <td>
          <div class="admin-row-actions">
            ${isWaiting ? `
              <button class="icon-btn" data-confirm-tx="${t.id}" title="Confirmer ce paiement" aria-label="Confirmer le paiement de ${escapeHtml(t.clientName || 'ce client')}">✓</button>
              <button class="icon-btn icon-btn--danger" data-refuse-tx="${t.id}" title="Refuser ce paiement" aria-label="Refuser le paiement de ${escapeHtml(t.clientName || 'ce client')}">✕</button>
            ` : ''}
            ${!isWaiting && t.status !== 'cancelled' ? `<button class="icon-btn icon-btn--danger" data-cancel-tx="${t.id}" title="Annuler" aria-label="Annuler la transaction">⊘</button>` : ''}
            <button class="icon-btn icon-btn--danger" data-delete-tx="${t.id}" title="Supprimer définitivement" aria-label="Supprimer définitivement la transaction de ${escapeHtml(t.clientName || 'ce client')}">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-confirm-tx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tx = transactions.find(t => t.id === btn.dataset.confirmTx);
        askConfirm(
          `Confirmer la réception du paiement ${paymentMethodLabel(tx.method)} ?`,
          `${escapeHtml(tx.clientName)} — ${fmtCAD(tx.total || tx.amount || 0)}. Le rendez-vous sera confirmé automatiquement.`,
          () => {
            const res = PO_Auth.confirmTransaction(tx.id);
            if (res.ok && typeof PO_Notifications !== 'undefined') {
              const client = PO_Auth.listClients().find(c => c.id === tx.clientId);
              if (client) {
                PO_Notifications.logEmail({
                  type: 'appointment_confirmation',
                  to: client.email,
                  subject: 'Votre paiement a été confirmé — rendez-vous confirmé',
                  body: `Bonjour ${client.firstName},\n\nNous avons bien reçu votre paiement de ${fmtCAD(tx.total || tx.amount || 0)} pour votre rendez-vous "${tx.service || tx.formulaTitle}"${tx.appointmentDate ? ' du ' + formatDateShort(tx.appointmentDate) + ' à ' + tx.appointmentTime : ''}.\n\nVotre rendez-vous est maintenant confirmé.\n\nRéférence : ${tx.id}`
                });
                if (typeof PO_EmailService !== 'undefined') {
                  PO_EmailService.paymentConfirmed({ client, transaction: tx });
                }
              }
            }
            renderPayments();
            renderCalendar();
          }
        );
      });
    });

    tbody.querySelectorAll('[data-refuse-tx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tx = transactions.find(t => t.id === btn.dataset.refuseTx);
        askConfirm(
          'Refuser ce paiement ?',
          `Le paiement de ${escapeHtml(tx.clientName || 'ce client')} sera refusé et le rendez-vous repassera en attente de paiement.`,
          () => {
            const res = PO_Auth.rejectTransaction(tx.id);
            if (res.ok && typeof PO_Notifications !== 'undefined') {
              const client = PO_Auth.listClients().find(c => c.id === tx.clientId);
              if (client) {
                PO_Notifications.logEmail({
                  type: 'appointment_declined',
                  to: client.email,
                  subject: 'Votre paiement n\'a pas pu être vérifié',
                  body: `Bonjour ${client.firstName},\n\nNous n'avons pas pu vérifier votre paiement pour le rendez-vous "${tx.service || tx.formulaTitle}". Veuillez nous contacter pour régulariser la situation.\n\nRéférence : ${tx.id}`
                });
                if (typeof PO_EmailService !== 'undefined') {
                  PO_EmailService.paymentRefused({ client, transaction: tx });
                }
              }
            }
            renderPayments();
            renderCalendar();
          }
        );
      });
    });

    tbody.querySelectorAll('[data-cancel-tx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tx = transactions.find(t => t.id === btn.dataset.cancelTx);
        askConfirm(
          'Annuler cette transaction ?',
          `La transaction de ${escapeHtml(tx.clientName || 'ce client')} sera annulée.`,
          () => { PO_Auth.cancelTransaction(tx.id); renderPayments(); renderCalendar(); }
        );
      });
    });

    tbody.querySelectorAll('[data-delete-tx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tx = transactions.find(t => t.id === btn.dataset.deleteTx);
        askConfirm(
          '🗑 Supprimer définitivement cette transaction ?',
          `Cette action supprimera permanently la transaction de ${escapeHtml(tx.clientName || 'ce client')} (${fmtCAD(tx.total || tx.amount || 0)}). Cette opération est irréversible.`,
          () => {
            PO_Auth.deleteTransaction(tx.id);
            showToast('Transaction supprimée.', 'success');
            renderPayments();
            renderDashboard();
          }
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
  document.getElementById('payments-method-filter')?.addEventListener('change', (e) => {
    paymentsMethodFilter = e.target.value;
    renderPayments();
  });
  document.getElementById('payments-export-csv')?.addEventListener('click', () => {
    const transactions = PO_Auth.listTransactions();
    const header = 'Client,Service,Formule,Date RDV,Heure,Montant HT,TPS,TVQ,Total,Méthode,Statut,Date création,Date confirmation,Référence\n';
    const rows = transactions.map(t =>
      [t.clientName, t.service, t.formulaTitle, t.appointmentDate, t.appointmentTime, t.amount, t.tps||0, t.tvq||0, t.total||t.amount, paymentMethodLabel(t.method), paymentStatusLabel(t.status), t.createdAt.slice(0,10), t.confirmedAt ? t.confirmedAt.slice(0,10) : '', t.transactionReference||t.id]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'paiements-ntabou-aka-we.csv'; a.click();
    URL.revokeObjectURL(url);
  });

  // Paramètres de paiement
  (function initPaySettings() {
    const s = PO_Auth.getPaymentSettings();
    document.getElementById('pay-interac-email').value = s.interacEmail || '';
    document.getElementById('pay-taxes-enabled').checked = !!s.taxesEnabled;
    document.getElementById('pay-tps-rate').value = s.tpsRate ?? 5;
    document.getElementById('pay-tvq-rate').value = s.tvqRate ?? 9.975;
    document.getElementById('pay-tax-rates').hidden = !s.taxesEnabled;
  })();

  document.getElementById('pay-taxes-enabled')?.addEventListener('change', (e) => {
    document.getElementById('pay-tax-rates').hidden = !e.target.checked;
  });

  document.getElementById('pay-settings-save')?.addEventListener('click', () => {
    PO_Auth.updatePaymentSettings({
      interacEmail: document.getElementById('pay-interac-email').value.trim(),
      taxesEnabled: document.getElementById('pay-taxes-enabled').checked,
      tpsRate: parseFloat(document.getElementById('pay-tps-rate').value) || 5,
      tvqRate: parseFloat(document.getElementById('pay-tvq-rate').value) || 9.975
    });
    const notice = document.getElementById('pay-settings-notice');
    notice.hidden = false; notice.dataset.tone = 'success';
    notice.textContent = 'Paramètres de paiement enregistrés.';
    setTimeout(() => { notice.hidden = true; }, 3000);
  });

  /* =========================================================
     PURGE GLOBALE — nettoyer les données de test
  ========================================================= */
  document.getElementById('dashboard-purge-btn')?.addEventListener('click', () => {
    askConfirm(
      '🗑 Purger toutes les données de test ?',
      'Cette action supprimera définitivement : tous les clients (hors compte admin), tous les rendez-vous, toutes les transactions, toutes les conversations et tout le journal de notifications. La configuration (tarifs, services, disponibilités, contenu) sera préservée. Cette opération est irréversible.',
      () => {
        PO_Auth.purgeAllTestData();
        if (typeof PO_Care !== 'undefined') PO_Care.purgeAllSessions();
        if (typeof PO_Messenger !== 'undefined') PO_Messenger.purgeAllConversations();
        showToast('Données de test supprimées. L\'interface va se rafraîchir.', 'success');
        // Rafraîchir tous les modules
        setTimeout(() => {
          renderDashboard();
          renderClients();
          renderCalendar();
          renderPayments();
          if (typeof renderNotifLog === 'function') renderNotifLog();
          if (typeof renderCareSummaries === 'function') renderCareSummaries();
          if (typeof renderMessenger === 'function') renderMessenger();
        }, 400);
      }
    );
  });

  /* =========================================================
     SOIN INTERACTIF (SIMULATION) — voir l'avertissement complet
     dans care-session-store.js.
  ========================================================= */
  const CARE_TYPE_LABELS = {
    texte: 'Texte', respiration: 'Respiration guidée', questionnaire: 'Questionnaire',
    visualisation: 'Visualisation', pause: 'Intégration silencieuse'
  };

  // Prix du Soin Interactif : dérivé en direct du module Tarifs
  // (formule "soins-direct") — source unique de vérité, plus aucune
  // valeur de prix indépendante n'est stockée dans la config du soin.
  function _soinsDirectFormulaPrice() {
    if (typeof PO_Content === 'undefined') return 0;
    const formulas = PO_Content.listFormulasForService ? PO_Content.listFormulasForService('soins-direct') : [];
    return formulas.length ? (formulas[0].price || 0) : 0;
  }

  function renderCare() {
    if (typeof PO_Care === 'undefined') return;
    const cfg = PO_Care.getConfig();
    document.getElementById('care-cfg-title').value = cfg.title || '';
    const livePrice = _soinsDirectFormulaPrice();
    document.getElementById('care-cfg-price').value =
      (typeof PO_Pricing !== 'undefined' ? PO_Pricing.formatCAD(livePrice) : livePrice);
    document.getElementById('care-cfg-duration').value = cfg.durationMinutes ?? '';
    renderCareStepsList();
    renderCareSummaries();
  }

  document.getElementById('care-cfg-price-goto-tarifs')?.addEventListener('click', () => {
    showPanel('pricing');
  });
  document.addEventListener('po:prices-updated', () => {
    if (document.getElementById('care-cfg-price')) renderCare();
  });

  document.getElementById('care-settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    PO_Care.updateConfig({
      title: document.getElementById('care-cfg-title').value.trim(),
      durationMinutes: Number(document.getElementById('care-cfg-duration').value) || 40
    });
    const notice = document.getElementById('care-settings-notice');
    notice.hidden = false;
    notice.dataset.tone = 'success';
    notice.textContent = 'Réglages enregistrés.';
    setTimeout(() => { notice.hidden = true; }, 3500);
    renderCare();
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
        <td>
          <div class="admin-row-actions">
            <button class="icon-btn" data-care-pdf="${s.id}" title="Télécharger le PDF" aria-label="Télécharger le PDF de la séance de ${escapeHtml(s.clientName || 'ce client')} du ${formatDateShort(s.completedAt.slice(0, 10))}">⇩</button>
            <button class="icon-btn icon-btn--danger" data-delete-care="${s.id}" title="Supprimer cette séance" aria-label="Supprimer la séance de ${escapeHtml(s.clientName || 'ce client')}">🗑</button>
          </div>
        </td>
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

    tbody.querySelectorAll('[data-delete-care]').forEach(btn => {
      btn.addEventListener('click', () => {
        askConfirm(
          '🗑 Supprimer cette séance ?',
          'Le résumé de séance sera supprimé définitivement. Le PDF ne sera plus accessible depuis l\'administration.',
          () => {
            PO_Care.deleteSummary(btn.dataset.deleteCare);
            showToast('Séance supprimée.', 'success');
            renderCareSummaries();
          }
        );
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
    return {
      pending: 'En attente',
      awaiting_confirmation: 'Attente confirmation',
      confirmed: 'Confirmé',
      declined: 'Refusé',
      rescheduled: 'Replanifié',
      cancelled: 'Annulé',
      completed: 'Terminé',
      done: 'Terminé' // alias rétrocompatible pour les rendez-vous créés avant ce changement
    }[status] || status;
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

  /* =========================================================
     TEMPLATES EMAIL
  ========================================================= */
  const EMAIL_VARS = [
    { key: '{{first_name}}', label: 'Prénom' },
    { key: '{{last_name}}', label: 'Nom' },
    { key: '{{client_name}}', label: 'Nom complet' },
    { key: '{{service}}', label: 'Service' },
    { key: '{{appointment_date}}', label: 'Date du rdv' },
    { key: '{{appointment_time}}', label: 'Heure du rdv' },
    { key: '{{duration}}', label: 'Durée' },
    { key: '{{amount}}', label: 'Montant' },
    { key: '{{invoice_number}}', label: 'N° transaction' },
    { key: '{{payment_method}}', label: 'Méthode de paiement' },
    { key: '{{company_name}}', label: 'Nom du site' },
    { key: '{{signature}}', label: 'Signature' }
  ];

  function renderEmailTemplates() {
    // Variables
    const varsEl = document.getElementById('et-vars-list');
    if (varsEl) {
      varsEl.innerHTML = EMAIL_VARS.map(v =>
        `<span title="${v.label}" style="padding:4px 10px; background:rgba(201,165,75,.1); border:1px solid rgba(201,165,75,.25); border-radius:20px; font-size:.78rem; color:var(--gold-soft); cursor:pointer; user-select:all;" onclick="navigator.clipboard.writeText('${v.key}').then(()=>showToast('${v.key} copié', 'success'))">${v.key}</span>`
      ).join('');
    }

    const tpl = PO_Content.getEmailTemplates();

    // Layout
    document.getElementById('et-signature').value = tpl.layout.signature || '';
    document.getElementById('et-footer-text').value = tpl.layout.footerText || '';
    document.getElementById('et-primary-color').value = tpl.layout.primaryColor || '#4a2563';
    document.getElementById('et-accent-color').value = tpl.layout.accentColor || '#c9a54b';

    // Template select
    const sel = document.getElementById('et-template-select');
    sel.innerHTML = Object.entries(tpl.templates).map(([k, v]) =>
      `<option value="${k}">${v.label}</option>`
    ).join('');
    loadEmailTemplate(sel.value);
  }

  function loadEmailTemplate(key) {
    const tpl = PO_Content.getEmailTemplates();
    const t = tpl.templates[key];
    if (!t) return;
    document.getElementById('et-template-enabled').checked = !!t.enabled;
    document.getElementById('et-template-subject').value = t.subject || '';
    document.getElementById('et-template-body').value = t.body || '';
    document.getElementById('et-preview-card').hidden = true;
  }

  document.getElementById('et-api-health')?.addEventListener('click', async () => {
    const n = document.getElementById('et-api-status');
    n.hidden = false; n.dataset.tone = 'pending'; n.textContent = 'Vérification en cours…';
    const result = await PO_EmailService.healthCheck();
    n.dataset.tone = result.ok ? 'success' : 'error';
    n.textContent = result.ok
      ? `✅ Serveur connecté — Resend : ${result.resend} — Expéditeur : ${result.from}`
      : `❌ Serveur inaccessible — ${result.error || 'Vérifiez que le service API est déployé sur Render.'}`;
  });

  document.getElementById('et-api-test-send')?.addEventListener('click', async () => {
    const n = document.getElementById('et-api-status');
    n.hidden = false; n.dataset.tone = 'pending'; n.textContent = 'Envoi du test en cours…';
    const result = await PO_EmailService.testEmail();
    n.dataset.tone = result.ok ? 'success' : 'error';
    n.textContent = result.ok
      ? `✅ Email de test envoyé ! Vérifiez votre boîte mail admin.`
      : `❌ Échec : ${result.error}`;
  });

  document.getElementById('et-template-select')?.addEventListener('change', (e) => {
    loadEmailTemplate(e.target.value);
  });

  document.getElementById('et-layout-save')?.addEventListener('click', () => {
    const data = {
      signature: document.getElementById('et-signature').value,
      footerText: document.getElementById('et-footer-text').value,
      primaryColor: document.getElementById('et-primary-color').value,
      accentColor: document.getElementById('et-accent-color').value
    };
    PO_Content.updateEmailLayout(data);
    PO_Content.logAudit('update', 'email-templates', 'layout', data);
    showToast('Mise en page enregistrée.', 'success');
  });

  document.getElementById('et-template-save')?.addEventListener('click', () => {
    const key = document.getElementById('et-template-select').value;
    const data = {
      enabled: document.getElementById('et-template-enabled').checked,
      subject: document.getElementById('et-template-subject').value,
      body: document.getElementById('et-template-body').value
    };
    PO_Content.updateEmailTemplate(key, data);
    PO_Content.logAudit('update', 'email-templates', key, data);
    showToast('Template enregistré.', 'success');
  });

  document.getElementById('et-template-preview')?.addEventListener('click', () => {
    const key = document.getElementById('et-template-select').value;
    const subject = document.getElementById('et-template-subject').value;
    const body = document.getElementById('et-template-body').value;
    const previewVars = {
      first_name: 'Marie', last_name: 'Tremblay', client_name: 'Marie Tremblay',
      service: 'Soins Énergétiques', appointment_date: '15 septembre 2026',
      appointment_time: '10:00', duration: '75', amount: '90,00 $ CAD',
      invoice_number: 'tx_1234', payment_method: 'Interac',
      company_name: 'Ntabou Aka Wé',
      signature: PO_Content.getEmailTemplates().layout.signature || 'Pierre-Olivier\nNtabou Aka Wé'
    };
    const resolve = (str) => (str || '').replace(/\{\{(\w+)\}\}/g, (_, k) => previewVars[k] !== undefined ? previewVars[k] : `{{${k}}}`);
    document.getElementById('et-preview-subject-label').textContent = 'Sujet : ' + resolve(subject);
    document.getElementById('et-preview-body').textContent = resolve(body);
    document.getElementById('et-preview-card').hidden = false;
  });

  document.getElementById('et-preview-close')?.addEventListener('click', () => {
    document.getElementById('et-preview-card').hidden = true;
  });

  /* =========================================================
     AUTOMATISATIONS
  ========================================================= */
  function renderAutomations() {
    const automations = PO_Content.getAutomations();
    const tpls = PO_Content.getEmailTemplates().templates;
    const container = document.getElementById('automations-list');
    if (!container) return;
    container.innerHTML = Object.entries(automations).map(([key, a]) => `
      <div class="account-card" style="padding:18px 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div>
            <strong>${escapeHtml(a.label)}</strong>
            <span class="muted-note" style="margin-left:10px; font-size:.78rem;">${key}</span>
          </div>
          <div class="field--checkbox" style="margin:0;">
            <input type="checkbox" id="auto-${key}" ${a.enabled ? 'checked' : ''} data-auto-key="${key}">
            <label for="auto-${key}" style="font-size:.84rem;">${a.enabled ? 'Activé' : 'Désactivé'}</label>
          </div>
        </div>
        <div class="field-row" style="margin-top:12px;">
          <div class="field">
            <label>Template email</label>
            <select data-auto-tpl="${key}">
              ${Object.entries(tpls).map(([k,t]) => `<option value="${k}" ${a.emailTemplate===k?'selected':''}>${t.label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Délai (minutes, négatif = avant)</label>
            <input type="number" data-auto-delay="${key}" value="${a.delayMinutes || 0}">
          </div>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" style="margin-top:8px;" data-auto-save="${key}">Enregistrer</button>
      </div>
    `).join('');

    container.querySelectorAll('[data-auto-save]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.autoSave;
        const enabled = container.querySelector(`#auto-${key}`)?.checked;
        const emailTemplate = container.querySelector(`[data-auto-tpl="${key}"]`)?.value;
        const delayMinutes = parseInt(container.querySelector(`[data-auto-delay="${key}"]`)?.value) || 0;
        PO_Content.updateAutomation(key, { enabled, emailTemplate, delayMinutes });
        PO_Content.logAudit('update', 'automations', key, { enabled, emailTemplate, delayMinutes });
        showToast('Automatisation enregistrée.', 'success');
        renderAutomations();
      });
    });
  }

  /* =========================================================
     PARAMÈTRES DU SITE
  ========================================================= */
  function renderSiteSettings() {
    const s = PO_Content.getSiteSettings();

    // Brand
    document.getElementById('ss-site-name').value = s.brand.siteName || '';
    document.getElementById('ss-tagline').value    = s.brand.tagline  || '';
    document.getElementById('ss-primary-color').value = s.brand.primaryColor || '#4a2563';
    document.getElementById('ss-accent-color').value  = s.brand.accentColor  || '#c9a54b';
    document.getElementById('ss-bg-color').value      = s.brand.bgColor      || '#0A0A0A';

    // Contact
    document.getElementById('ss-email').value    = s.contact.email    || '';
    document.getElementById('ss-phone').value    = s.contact.phone    || '';
    document.getElementById('ss-city').value     = s.contact.city     || '';
    document.getElementById('ss-province').value = s.contact.province || '';

    // Social
    document.getElementById('ss-facebook').value  = s.social.facebook  || '';
    document.getElementById('ss-instagram').value = s.social.instagram || '';
    document.getElementById('ss-youtube').value   = s.social.youtube   || '';
    document.getElementById('ss-tiktok').value    = s.social.tiktok    || '';

    // SEO
    document.getElementById('ss-meta-title').value = s.seo.metaTitle       || '';
    document.getElementById('ss-meta-desc').value  = s.seo.metaDescription || '';

    // Business
    document.getElementById('ss-cancel-hours').value    = s.business.bookingCancellationHours ?? 24;
    document.getElementById('ss-max-bookings-day').value = s.business.maxBookingsPerDay ?? 5;
    document.getElementById('ss-deposit-pct').value     = s.business.depositPercent ?? 40;
    document.getElementById('ss-currency').value        = s.business.currency  || 'CAD';
    document.getElementById('ss-timezone').value        = s.business.timezone  || 'America/Toronto';
  }

  function ssSaveSection(section, data, noticeId) {
    PO_Content.updateSiteSettings(section, data);
    PO_Content.logAudit('update', 'site-settings', section, data);
    const n = document.getElementById(noticeId);
    n.hidden = false; n.dataset.tone = 'success'; n.textContent = 'Enregistré.';
    setTimeout(() => { n.hidden = true; }, 3000);
  }

  document.getElementById('ss-brand-save')?.addEventListener('click', () => {
    ssSaveSection('brand', {
      siteName: document.getElementById('ss-site-name').value,
      tagline:  document.getElementById('ss-tagline').value,
      primaryColor: document.getElementById('ss-primary-color').value,
      accentColor:  document.getElementById('ss-accent-color').value,
      bgColor:      document.getElementById('ss-bg-color').value
    }, 'ss-brand-notice');
    // Appliquer les couleurs en direct via CSS variables
    const root = document.documentElement;
    root.style.setProperty('--violet', document.getElementById('ss-primary-color').value);
    root.style.setProperty('--gold', document.getElementById('ss-accent-color').value);
  });

  document.getElementById('ss-contact-save')?.addEventListener('click', () => {
    ssSaveSection('contact', {
      email: document.getElementById('ss-email').value,
      phone: document.getElementById('ss-phone').value,
      city:  document.getElementById('ss-city').value,
      province: document.getElementById('ss-province').value
    }, 'ss-contact-notice');
  });

  document.getElementById('ss-social-save')?.addEventListener('click', () => {
    ssSaveSection('social', {
      facebook: document.getElementById('ss-facebook').value,
      instagram: document.getElementById('ss-instagram').value,
      youtube: document.getElementById('ss-youtube').value,
      tiktok: document.getElementById('ss-tiktok').value
    }, 'ss-social-notice');
  });

  document.getElementById('ss-seo-save')?.addEventListener('click', () => {
    const title = document.getElementById('ss-meta-title').value;
    const desc  = document.getElementById('ss-meta-desc').value;
    ssSaveSection('seo', { metaTitle: title, metaDescription: desc }, 'ss-seo-notice');
    // Appliquer le meta title en direct
    document.title = title || document.title;
  });

  document.getElementById('ss-business-save')?.addEventListener('click', () => {
    ssSaveSection('business', {
      bookingCancellationHours: parseInt(document.getElementById('ss-cancel-hours').value) || 24,
      maxBookingsPerDay:        parseInt(document.getElementById('ss-max-bookings-day').value) || 5,
      depositPercent:           parseInt(document.getElementById('ss-deposit-pct').value) || 40,
      currency:  document.getElementById('ss-currency').value,
      timezone:  document.getElementById('ss-timezone').value
    }, 'ss-business-notice');
  });

  /* =========================================================
     MÉDIATHÈQUE
  ========================================================= */
  let mediaSearchTerm = '';
  let mediaFolderFilter = '';
  let mediaSelectedId = null;

  function renderMediaGrid() {
    let list = PO_Content.getMedia();
    if (mediaSearchTerm) list = list.filter(m => m.name.toLowerCase().includes(mediaSearchTerm.toLowerCase()));
    if (mediaFolderFilter) list = list.filter(m => m.folder === mediaFolderFilter);

    const grid = document.getElementById('media-grid');
    const empty = document.getElementById('media-empty');
    if (!list.length) { grid.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;

    grid.innerHTML = list.map(m => `
      <div class="media-card" data-media-id="${m.id}" tabindex="0" role="button" aria-label="${escapeHtml(m.name)}">
        <div class="media-card__thumb">
          <img src="${m.url}" alt="${escapeHtml(m.alt || m.name)}" loading="lazy">
        </div>
        <div class="media-card__name">${escapeHtml(m.name)}</div>
        <div class="media-card__folder">${escapeHtml(m.folder)}</div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-media-id]').forEach(card => {
      card.addEventListener('click', () => openMediaDetail(card.dataset.mediaId));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openMediaDetail(card.dataset.mediaId); });
    });
  }

  function openMediaDetail(id) {
    const m = PO_Content.getMedia().find(x => x.id === id);
    if (!m) return;
    mediaSelectedId = id;
    document.getElementById('media-detail-img').src = m.url;
    document.getElementById('media-detail-name').value = m.name;
    document.getElementById('media-detail-alt').value = m.alt || '';
    document.getElementById('media-detail-folder').value = m.folder || 'general';
    document.getElementById('media-detail-url').textContent = m.url.startsWith('data:') ? '(Image base64 — référencer via la médiathèque)' : m.url;
    openModal(document.getElementById('media-detail-veil'));
  }

  document.getElementById('media-detail-close')?.addEventListener('click', () => closeModal(document.getElementById('media-detail-veil')));

  document.getElementById('media-detail-save')?.addEventListener('click', () => {
    if (!mediaSelectedId) return;
    const data = {
      name:   document.getElementById('media-detail-name').value.trim(),
      alt:    document.getElementById('media-detail-alt').value.trim(),
      folder: document.getElementById('media-detail-folder').value
    };
    PO_Content.updateMedia(mediaSelectedId, data);
    PO_Content.logAudit('update', 'media', mediaSelectedId, data);
    showToast('Fichier mis à jour.', 'success');
    closeModal(document.getElementById('media-detail-veil'));
    renderMediaGrid();
  });

  document.getElementById('media-detail-delete')?.addEventListener('click', () => {
    if (!mediaSelectedId) return;
    askConfirm('Supprimer ce fichier de la médiathèque ?', 'Cette action est irréversible.', () => {
      PO_Content.deleteMedia(mediaSelectedId);
      PO_Content.logAudit('delete', 'media', mediaSelectedId, null);
      showToast('Fichier supprimé.', 'success');
      closeModal(document.getElementById('media-detail-veil'));
      mediaSelectedId = null;
      renderMediaGrid();
    });
  });

  document.getElementById('media-upload-btn')?.addEventListener('click', () => {
    document.getElementById('media-file-input').click();
  });

  document.getElementById('media-file-input')?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    let done = 0;
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        PO_Content.uploadMedia({
          name: file.name.replace(/\.[^.]+$/, ''),
          type: 'image',
          url: ev.target.result,
          alt: '',
          folder: 'general',
          size: file.size
        });
        PO_Content.logAudit('create', 'media', null, file.name);
        done++;
        if (done === files.length) {
          showToast(`${done} fichier(s) ajouté(s).`, 'success');
          renderMediaGrid();
        }
      };
      reader.readAsDataURL(file);
    });
  });

  document.getElementById('media-search')?.addEventListener('input', (e) => {
    mediaSearchTerm = e.target.value.trim();
    renderMediaGrid();
  });

  document.getElementById('media-folder-filter')?.addEventListener('change', (e) => {
    mediaFolderFilter = e.target.value;
    renderMediaGrid();
  });

  /* =========================================================
     JOURNAL D'AUDIT
  ========================================================= */
  let auditSearchTerm = '';
  let auditModuleFilter = '';

  function renderAuditLog() {
    let log = PO_Content.getAuditLog(200);
    if (auditSearchTerm) {
      const term = auditSearchTerm.toLowerCase();
      log = log.filter(e => (e.module + e.action + e.newValue + e.oldValue).toLowerCase().includes(term));
    }
    if (auditModuleFilter) log = log.filter(e => e.module === auditModuleFilter);

    const tbody = document.getElementById('audit-tbody');
    const empty = document.getElementById('audit-empty');
    if (!log.length) { tbody.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;

    tbody.innerHTML = log.map(e => `
      <tr>
        <td style="white-space:nowrap; font-size:.78rem;">${new Date(e.timestamp).toLocaleString('fr-CA')}</td>
        <td><span class="badge badge--client">${escapeHtml(e.module)}</span></td>
        <td>${escapeHtml(e.action)}</td>
        <td style="font-size:.76rem; max-width:180px; overflow:hidden; text-overflow:ellipsis; color:var(--ink-dim);">${escapeHtml(e.oldValue || '—')}</td>
        <td style="font-size:.76rem; max-width:180px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(e.newValue || '—')}</td>
      </tr>
    `).join('');
  }

  document.getElementById('audit-search')?.addEventListener('input', (e) => {
    auditSearchTerm = e.target.value.trim();
    renderAuditLog();
  });
  document.getElementById('audit-module-filter')?.addEventListener('change', (e) => {
    auditModuleFilter = e.target.value;
    renderAuditLog();
  });
  document.getElementById('audit-clear-btn')?.addEventListener('click', () => {
    askConfirm('Vider le journal d\'audit ?', 'Toutes les entrées seront supprimées définitivement.', () => {
      PO_Content.clearAuditLog();
      showToast('Journal vidé.', 'success');
      renderAuditLog();
    });
  });

  /* ---------- Initialisation des nouveaux panneaux au clic ---------- */
  const _origActivatePanel = typeof activatePanel !== 'undefined' ? activatePanel : null;

  /* =========================================================
     TÉMOIGNAGES — Modération
  ========================================================= */
  let _testiStatusFilter = 'pending';

  function updateTestimonialsBadge() {
    const badge = document.getElementById('testimonials-badge');
    if (!badge || typeof PO_Testimonials === 'undefined') return;
    const count = PO_Testimonials.listPending().length;
    badge.hidden = count === 0;
    badge.textContent = String(count);
  }

  function _testiStatusLabel(status) {
    return { pending: 'En attente', approved: 'Approuvé', rejected: 'Rejeté' }[status] || status;
  }
  function _testiStatusBadgeClass(status) {
    return { pending: 'badge--pending', approved: 'badge--confirmed', rejected: 'badge--declined' }[status] || 'badge--done';
  }

  function renderTestimonialsAdmin() {
    if (typeof PO_Testimonials === 'undefined') return;
    updateTestimonialsBadge();

    let list = PO_Testimonials.listAll();
    if (_testiStatusFilter !== 'all') {
      list = list.filter(t => t.status === _testiStatusFilter);
    }

    const tbody = document.getElementById('testi-tbody');
    const emptyEl = document.getElementById('testi-empty');
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    tbody.innerHTML = list.map(t => `
      <tr data-testi-id="${escapeHtml(t.id)}">
        <td>${escapeHtml(t.clientName)}</td>
        <td>${escapeHtml(PO_Testimonials.serviceLabel(t.service))}</td>
        <td>${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</td>
        <td>${escapeHtml(formatDateShort(t.date))}</td>
        <td style="max-width:280px; white-space:normal;">${escapeHtml(t.text)}</td>
        <td><span class="badge ${_testiStatusBadgeClass(t.status)}">${_testiStatusLabel(t.status)}</span></td>
        <td>
          <div class="admin-row-actions">
            ${t.status !== 'approved' ? `<button type="button" class="icon-btn" data-testi-approve="${escapeHtml(t.id)}" title="Approuver" aria-label="Approuver le témoignage de ${escapeHtml(t.clientName)}">✓</button>` : ''}
            ${t.status !== 'rejected' ? `<button type="button" class="icon-btn icon-btn--danger" data-testi-reject="${escapeHtml(t.id)}" title="Rejeter" aria-label="Rejeter le témoignage de ${escapeHtml(t.clientName)}">✕</button>` : ''}
            <button type="button" class="icon-btn" data-testi-edit="${escapeHtml(t.id)}" title="Modifier" aria-label="Modifier le témoignage de ${escapeHtml(t.clientName)}">✎</button>
            <button type="button" class="icon-btn icon-btn--danger" data-testi-delete="${escapeHtml(t.id)}" title="Supprimer" aria-label="Supprimer le témoignage de ${escapeHtml(t.clientName)}">🗑</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-testi-approve]').forEach(btn => {
      btn.addEventListener('click', () => {
        PO_Testimonials.adminApprove(btn.dataset.testiApprove);
        showToast('Témoignage approuvé et publié.', 'success');
        renderTestimonialsAdmin();
      });
    });
    tbody.querySelectorAll('[data-testi-reject]').forEach(btn => {
      btn.addEventListener('click', () => {
        PO_Testimonials.adminReject(btn.dataset.testiReject);
        showToast('Témoignage rejeté.', 'success');
        renderTestimonialsAdmin();
      });
    });
    tbody.querySelectorAll('[data-testi-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        askConfirm('Supprimer ce témoignage ?', 'Cette action est irréversible.', () => {
          PO_Testimonials.adminDelete(btn.dataset.testiDelete);
          renderTestimonialsAdmin();
        });
      });
    });
    tbody.querySelectorAll('[data-testi-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = PO_Testimonials.getById(btn.dataset.testiEdit);
        if (!t) return;
        const newText = window.prompt('Modifier le texte du témoignage :', t.text);
        if (newText === null) return;
        PO_Testimonials.adminUpdate(t.id, { text: newText });
        showToast('Témoignage mis à jour.', 'success');
        renderTestimonialsAdmin();
      });
    });
  }

  document.querySelectorAll('#testi-status-tabs [data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      _testiStatusFilter = btn.dataset.status;
      document.querySelectorAll('#testi-status-tabs [data-status]').forEach(b => {
        b.setAttribute('aria-selected', String(b === btn));
      });
      renderTestimonialsAdmin();
    });
  });

  document.addEventListener('po:testimonials-updated', () => {
    updateTestimonialsBadge();
    if (document.querySelector('.admin-panel[data-panel="testimonials"][data-active="true"]')) {
      renderTestimonialsAdmin();
    }
  });

  /* ---------- INITIAL RENDER ---------- */
  renderDashboard();
  updateMessengerBadge();
  updatePaymentsBadge();
  updateTestimonialsBadge();
});
