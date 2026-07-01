// =========================================================
// PIERRE-OLIVIER — availability-booking.js
//
// Parcours de réservation client pour les services "Soins Énergétiques"
// et "Accompagnement 1:1" : mini-calendrier mensuel + sélection d'un
// créneau libre, en s'appuyant sur PO_Auth.getAvailableSlots() (auth.js).
//
// SIMULATION FRONTEND UNIQUEMENT — voir l'avertissement complet en haut
// de auth.js. Résumé :
//   - Le rendez-vous créé ici a le statut "pending" : il attend une
//     confirmation manuelle de l'administration depuis le Calendrier admin.
//   - La disponibilité affichée vient de localStorage sur cet appareil ;
//     si deux clients réservent au même moment depuis deux appareils
//     différents sur le même créneau, rien ne les empêche tous les deux
//     ici. Une vraie protection contre ce conflit demande un backend
//     (ex. Supabase) qui verrouille le créneau au moment de l'écriture.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {

  const veil = document.getElementById('cal-booking-veil');
  if (!veil) return; // élément présent uniquement sur services-energetiques.html / accompagnement.html

  const formulasContainer = document.getElementById('formulas-container');
  const SERVICE_ID = formulasContainer ? formulasContainer.dataset.serviceId : null;
  const SERVICE_LABELS = {
    'services-energetiques': 'Soins Énergétiques',
    'accompagnement': 'Accompagnement 1:1'
  };
  const SERVICE_LABEL = SERVICE_LABELS[SERVICE_ID] || SERVICE_ID;

  if (!SERVICE_ID || typeof PO_Auth === 'undefined') return;

  const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  let bookYear = new Date().getFullYear();
  let bookMonth = new Date().getMonth();
  let bookSelectedDate = null;
  let currentFormulaLabel = SERVICE_LABEL;
  let currentFormulaDuration = '';
  let currentFormulaId = '';
  let currentFormulaPrice = 0;
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }

  function formatDateLong(isoDate) {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatDateShort(isoDate) {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function showNotice(msg, tone) {
    const notice = document.getElementById('cal-booking-notice');
    notice.hidden = false;
    notice.dataset.tone = tone || 'error';
    notice.textContent = msg;
  }
  function hideNotice() {
    document.getElementById('cal-booking-notice').hidden = true;
  }

  // ---------------------------------------------------------
  // POINT D'ENTRÉE — déclenché par le CTA principal et les boutons
  // "Réserver" des cartes de formule.
  // ---------------------------------------------------------
  function startBooking(formula) {
    const user = PO_Auth.getCurrentUser();
    if (!user) {
      window.location.href = `connexion.html?redirect=${SERVICE_ID}`;
      return;
    }
    if (user.blocked) {
      window.location.href = 'connexion.html';
      return;
    }
    currentFormulaLabel    = (formula && formula.title) || SERVICE_LABEL;
    currentFormulaDuration = (formula && formula.duration) || '';
    currentFormulaId       = (formula && formula.id) || '';
    currentFormulaPrice    = (formula && formula.price) || 0;
    document.getElementById('cal-booking-formula').textContent = currentFormulaDuration
      ? `${currentFormulaLabel} — ${currentFormulaDuration}`
      : currentFormulaLabel;

    hideNotice();
    bookSelectedDate = null;
    const now = new Date();
    bookYear = now.getFullYear();
    bookMonth = now.getMonth();
    renderBookingCalendar();
    renderSlotsPlaceholder();
    veil.hidden = false;
  }

  document.getElementById('cta-button')?.addEventListener('click', (e) => {
    // On n'intercepte le clic que si un client est déjà connecté : sinon on
    // laisse le comportement existant (lien <a> vers la page de connexion).
    if (PO_Auth.getCurrentUser()) {
      e.preventDefault();
      startBooking({ title: SERVICE_LABEL, duration: '' });
    }
  });

  formulasContainer?.addEventListener('click', (e) => {
    const btn = e.target.closest('.cal-formula-btn');
    if (!btn) return;
    startBooking({ title: btn.dataset.formulaTitle, duration: btn.dataset.formulaDuration });
  });

  // ---------------------------------------------------------
  // MINI-CALENDRIER MENSUEL
  // ---------------------------------------------------------
  function renderBookingCalendar() {
    document.getElementById('cal-booking-label').textContent = `${MONTH_NAMES[bookMonth]} ${bookYear}`;
    const grid = document.getElementById('cal-booking-grid');
    const todayStr = new Date().toISOString().slice(0, 10);

    const firstOfMonth = new Date(bookYear, bookMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(bookYear, bookMonth + 1, 0).getDate();

    let cells = '';
    for (let i = 0; i < startWeekday; i++) {
      cells += '<div class="cal-day cal-day--empty"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${bookYear}-${String(bookMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === bookSelectedDate;
      const hasSlots = !isPast && PO_Auth.hasAvailability(SERVICE_ID, dateStr);

      cells += `
        <div class="cal-day ${isToday ? 'cal-day--today' : ''} ${hasSlots ? 'cal-day--has-slots' : 'cal-day--no-slots'}"
             data-date="${dateStr}" data-has-slots="${hasSlots}"
             style="${isSelected ? 'border-color:var(--gold); box-shadow:0 0 0 1px var(--gold) inset;' : ''}">
          <div class="cal-day__num">${d}</div>
          ${hasSlots ? '<div class="cal-day__avail-dot"></div>' : ''}
        </div>`;
    }
    grid.innerHTML = cells;

    grid.querySelectorAll('.cal-day[data-has-slots="true"]').forEach(cell => {
      cell.addEventListener('click', () => {
        bookSelectedDate = cell.dataset.date;
        renderBookingCalendar();
        renderSlotsForSelectedDate();
      });
    });
  }

  document.getElementById('cal-booking-prev').addEventListener('click', () => {
    bookMonth--; if (bookMonth < 0) { bookMonth = 11; bookYear--; }
    renderBookingCalendar();
  });
  document.getElementById('cal-booking-next').addEventListener('click', () => {
    bookMonth++; if (bookMonth > 11) { bookMonth = 0; bookYear++; }
    renderBookingCalendar();
  });

  // ---------------------------------------------------------
  // LISTE DES CRÉNEAUX DU JOUR SÉLECTIONNÉ
  // ---------------------------------------------------------
  function renderSlotsPlaceholder() {
    document.getElementById('cal-booking-slots-title').textContent = 'Sélectionnez d\'abord un jour';
    document.getElementById('cal-booking-slots-list').innerHTML =
      '<p class="empty-state">Les jours avec un point doré ont des créneaux disponibles.</p>';
  }

  function renderSlotsForSelectedDate() {
    const title = document.getElementById('cal-booking-slots-title');
    const list = document.getElementById('cal-booking-slots-list');
    title.textContent = `Créneaux du ${formatDateLong(bookSelectedDate)}`;

    const slots = PO_Auth.getAvailableSlots(SERVICE_ID, bookSelectedDate);
    if (!slots.length) {
      list.innerHTML = '<p class="empty-state">Plus aucun créneau libre ce jour-là.</p>';
      return;
    }

    list.innerHTML = `<div class="cal-booking__slots-grid">${
      slots.map(s => `<button type="button" class="cal-slot-btn" data-slot-time="${s}">${s}</button>`).join('')
    }</div>`;

    list.querySelectorAll('[data-slot-time]').forEach(btn => {
      btn.addEventListener('click', () => confirmSlot(btn));
    });
  }

  // ---------------------------------------------------------
  // CONFIRMATION DE LA RÉSERVATION
  // ---------------------------------------------------------
  // WORKFLOW PAIEMENT : au lieu de créer directement un rdv confirmé,
  // on crée un rdv en statut "awaiting_confirmation" (paiement requis)
  // et on redirige vers la page de paiement dédiée avec les paramètres
  // en sessionStorage. Le rdv ne sera confirmé qu'après validation du paiement.
  // ---------------------------------------------------------
  function confirmSlot(btn) {
    hideNotice();
    const time = btn.dataset.slotTime;
    const user = PO_Auth.getCurrentUser();
    if (!user) {
      window.location.href = `connexion.html?redirect=${SERVICE_ID}`;
      return;
    }

    // Revalidation de dernière seconde
    const stillAvailable = PO_Auth.getAvailableSlots(SERVICE_ID, bookSelectedDate).includes(time);
    if (!stillAvailable) {
      showNotice('Ce créneau vient d\'être réservé. Veuillez en choisir un autre.', 'error');
      renderSlotsForSelectedDate();
      renderBookingCalendar();
      return;
    }

    document.querySelectorAll('.cal-slot-btn').forEach(b => { b.disabled = true; });
    btn.classList.add('cal-slot-btn--confirming');
    btn.textContent = 'Préparation du paiement…';

    const av = PO_Auth.getAvailability();
    const duration = av.slotDurationMinutes[SERVICE_ID] || 60;

    // Créer le rdv en statut awaiting_confirmation (paiement en attente)
    const { appointment } = PO_Auth.createAppointment({
      clientId:   user.id,
      clientName: `${user.firstName} ${user.lastName}`,
      service:    SERVICE_LABEL,
      serviceId:  SERVICE_ID,
      date:       bookSelectedDate,
      time,
      duration,
      status:     'awaiting_confirmation',
      source:     'client'
    });

    // Stocker les données de paiement en sessionStorage pour la page de paiement
    const paymentData = {
      appointmentId:   appointment.id,
      serviceId:       SERVICE_ID,
      serviceLabel:    SERVICE_LABEL,
      formulaId:       currentFormulaId,
      formulaLabel:    currentFormulaLabel,
      formulaDuration: currentFormulaDuration,
      formulaPrice:    currentFormulaPrice,
      date:            bookSelectedDate,
      time,
      duration,
      clientId:        user.id,
      clientName:      `${user.firstName} ${user.lastName}`,
      clientEmail:     user.email
    };
    sessionStorage.setItem('po_pending_payment', JSON.stringify(paymentData));

    setTimeout(() => {
      window.location.href = 'paiement-rdv.html';
    }, 350);
  }

  // Petite confirmation visuelle (gardée pour compatibilité)
  function showPostBookingToast(appointment) {
    const toast = document.createElement('div');
    toast.className = 'auth__notice';
    toast.dataset.tone = 'success';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:500;max-width:340px;';
    toast.textContent = `Paiement reçu. Rendez-vous réservé pour le ${formatDateShort(appointment.date)} à ${appointment.time}.`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  document.getElementById('cal-booking-cancel').addEventListener('click', () => {
    veil.hidden = true;
  });

});
