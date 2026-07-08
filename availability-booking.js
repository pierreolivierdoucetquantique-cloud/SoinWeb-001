// =========================================================
// PIERRE-OLIVIER — availability-booking.js (v2 — backend réel)
//
// Parcours de réservation client pour "Soins Énergétiques" et
// "Accompagnement 1:1" : mini-calendrier mensuel + sélection d'un
// créneau libre, via le vrai serveur (server/availability-routes.js).
// La disponibilité est désormais partagée entre tous les appareils —
// deux clients ne peuvent plus réserver le même créneau en double
// (revalidé côté serveur au moment de la création du rendez-vous).
// =========================================================

document.addEventListener('DOMContentLoaded', async () => {

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

  // S'assure que la session + les tarifs sont chargés (redondant si déjà
  // fait par script.js, mais chaque écouteur DOMContentLoaded s'exécute
  // indépendamment — ne pas supposer l'ordre entre fichiers).
  if (PO_Auth.init) await PO_Auth.init();
  if (typeof PO_Content !== 'undefined' && PO_Content.refreshFormulas) await PO_Content.refreshFormulas();

  const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  let bookYear = new Date().getFullYear();
  let bookMonth = new Date().getMonth();
  let bookSelectedDate = null;
  let currentFormulaLabel = SERVICE_LABEL;
  let currentFormulaDuration = '';
  let currentFormulaId = '';
  let currentFormulaPrice = 0;
  let _monthAvailability = null; // { weeklyHours, vacations, holidays } — rechargé à chaque mois affiché

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
  // POINT D'ENTRÉE
  // ---------------------------------------------------------
  async function startBooking(formula) {
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
    if (typeof PO_Pricing !== 'undefined' && currentFormulaId) {
      const c = PO_Pricing.compute(currentFormulaId);
      currentFormulaPrice = c.price || (formula && formula.price) || 0;
    } else {
      currentFormulaPrice = (formula && formula.price) || 0;
    }
    const priceDisplay = currentFormulaPrice ? ' — ' + (typeof PO_Pricing !== 'undefined' ? PO_Pricing.formatCAD(currentFormulaPrice) : currentFormulaPrice + ' $ CAD') : '';
    document.getElementById('cal-booking-formula').textContent = currentFormulaDuration
      ? `${currentFormulaLabel} — ${currentFormulaDuration}${priceDisplay}`
      : `${currentFormulaLabel}${priceDisplay}`;

    hideNotice();
    bookSelectedDate = null;
    const now = new Date();
    bookYear = now.getFullYear();
    bookMonth = now.getMonth();
    veil.hidden = false;
    await renderBookingCalendar();
    renderSlotsPlaceholder();
  }

  document.getElementById('cta-button')?.addEventListener('click', async (e) => {
    if (PO_Auth.getCurrentUser()) {
      e.preventDefault();
      let defaultFormula = { title: SERVICE_LABEL, duration: '' };
      if (typeof PO_Content !== 'undefined' && SERVICE_ID) {
        const formulas = PO_Content.listFormulasForService(SERVICE_ID);
        if (formulas.length > 0) {
          defaultFormula = {
            id: formulas[0].id,
            title: formulas[0].title || SERVICE_LABEL,
            duration: formulas[0].duration || '',
            price: formulas[0].price || 0
          };
        }
      }
      await startBooking(defaultFormula);
    }
  });

  formulasContainer?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.cal-formula-btn');
    if (!btn) return;
    const fId = btn.dataset.formulaId || '';
    const livePrice = (typeof PO_Pricing !== 'undefined' && fId)
      ? PO_Pricing.compute(fId).price || parseFloat(btn.dataset.formulaPrice) || 0
      : parseFloat(btn.dataset.formulaPrice) || 0;
    await startBooking({
      id:       fId,
      title:    btn.dataset.formulaTitle,
      duration: btn.dataset.formulaDuration,
      price:    livePrice
    });
  });

  // ---------------------------------------------------------
  // MINI-CALENDRIER MENSUEL
  // ---------------------------------------------------------
  // Estimation rapide "ce jour a-t-il des heures configurées ?" à partir
  // des horaires hebdo/vacances/fériés déjà chargés pour le mois affiché
  // (ne vérifie pas les créneaux déjà pris — juste un indicateur visuel ;
  // la liste précise du jour sélectionné, elle, interroge le serveur).
  function _dayLooksAvailable(dateStr) {
    if (!_monthAvailability) return false;
    const onVacation = _monthAvailability.vacations.some(v => dateStr >= v.startDate && dateStr <= v.endDate);
    const isHoliday = _monthAvailability.holidays.some(h => h.date === dateStr);
    if (onVacation || isHoliday) return false;
    const dayKey = DAY_KEYS[new Date(dateStr + 'T00:00:00').getDay()];
    const ranges = (_monthAvailability.weeklyHours[SERVICE_ID] && _monthAvailability.weeklyHours[SERVICE_ID][dayKey]) || [];
    return ranges.length > 0;
  }

  async function renderBookingCalendar() {
    document.getElementById('cal-booking-label').textContent = `${MONTH_NAMES[bookMonth]} ${bookYear}`;
    const grid = document.getElementById('cal-booking-grid');
    const todayStr = new Date().toISOString().slice(0, 10);

    _monthAvailability = await PO_Auth.getAvailability();

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
      const hasSlots = !isPast && _dayLooksAvailable(dateStr);

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
      cell.addEventListener('click', async () => {
        bookSelectedDate = cell.dataset.date;
        await renderBookingCalendar();
        await renderSlotsForSelectedDate();
      });
    });
  }

  document.getElementById('cal-booking-prev').addEventListener('click', async () => {
    bookMonth--; if (bookMonth < 0) { bookMonth = 11; bookYear--; }
    await renderBookingCalendar();
  });
  document.getElementById('cal-booking-next').addEventListener('click', async () => {
    bookMonth++; if (bookMonth > 11) { bookMonth = 0; bookYear++; }
    await renderBookingCalendar();
  });

  // ---------------------------------------------------------
  // LISTE DES CRÉNEAUX DU JOUR SÉLECTIONNÉ
  // ---------------------------------------------------------
  function renderSlotsPlaceholder() {
    document.getElementById('cal-booking-slots-title').textContent = 'Sélectionnez d\'abord un jour';
    document.getElementById('cal-booking-slots-list').innerHTML =
      '<p class="empty-state">Les jours avec un point doré ont des créneaux disponibles.</p>';
  }

  async function renderSlotsForSelectedDate() {
    const title = document.getElementById('cal-booking-slots-title');
    const list = document.getElementById('cal-booking-slots-list');
    title.textContent = `Créneaux du ${formatDateLong(bookSelectedDate)}`;
    list.innerHTML = '<p class="empty-state">Chargement…</p>';

    const slots = await PO_Auth.getAvailableSlots(SERVICE_ID, bookSelectedDate);
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
  async function confirmSlot(btn) {
    hideNotice();
    const time = btn.dataset.slotTime;
    const user = PO_Auth.getCurrentUser();
    if (!user) {
      window.location.href = `connexion.html?redirect=${SERVICE_ID}`;
      return;
    }

    // Revalidation de dernière seconde — le serveur est la source de
    // vérité partagée, donc ce contrôle est maintenant fiable même si
    // un autre client a réservé ce créneau entre-temps depuis un autre appareil.
    const stillAvailableSlots = await PO_Auth.getAvailableSlots(SERVICE_ID, bookSelectedDate);
    if (!stillAvailableSlots.includes(time)) {
      showNotice('Ce créneau vient d\'être réservé. Veuillez en choisir un autre.', 'error');
      await renderSlotsForSelectedDate();
      await renderBookingCalendar();
      return;
    }

    document.querySelectorAll('.cal-slot-btn').forEach(b => { b.disabled = true; });
    btn.classList.add('cal-slot-btn--confirming');
    btn.textContent = 'Préparation du paiement…';

    const duration = 60; // durée standard des créneaux (voir server/db.js)

    const { appointment } = await PO_Auth.createAppointment({
      service:    SERVICE_LABEL,
      serviceId:  SERVICE_ID,
      date:       bookSelectedDate,
      time,
      duration,
      status:     'awaiting_confirmation',
      source:     'client'
    });

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

  document.getElementById('cal-booking-cancel').addEventListener('click', () => {
    veil.hidden = true;
  });

});
