// =========================================================
// Ntabou Aka Wé — API — booking-guard.js
//
// Règles de disponibilité partagées entre availability-routes.js (calcul
// des créneaux affichés au client) et appointments-routes.js (validation
// serveur au moment de la création/replanification d'un rendez-vous).
//
// RÈGLE CENTRALE : un seul praticien tient l'agenda. Un rendez-vous ou un
// blocage occupe donc son temps pour TOUS les services à la fois — on ne
// filtre jamais les conflits par service_id. (Avant ce correctif, chaque
// service avait son propre calcul de disponibilité indépendant, ce qui
// permettait de réserver deux services différents au même moment.)
// =========================================================

const { db } = require('./db');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function toMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getDayKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return DAY_KEYS[d.getDay()];
}

// Jour entièrement fermé (vacances, jour férié, ou blocage pleine journée) —
// s'applique à tous les services.
function isDateClosed(date) {
  if (db.prepare('SELECT 1 FROM vacations WHERE ? BETWEEN start_date AND end_date').get(date)) return 'vacation';
  if (db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(date)) return 'holiday';
  if (db.prepare('SELECT 1 FROM blocked_slots WHERE date = ? AND time IS NULL').get(date)) return 'blocked';
  return null;
}

// Le créneau demandé tombe-t-il dans une plage d'ouverture configurée pour
// ce service, ce jour-là ?
function isWithinWeeklyHours({ serviceId, date, time, duration }) {
  const dayKey = getDayKey(date);
  const row = db.prepare('SELECT ranges_json FROM weekly_hours WHERE service_id = ? AND day_key = ?').get(serviceId, dayKey);
  const ranges = row ? JSON.parse(row.ranges_json) : [];
  if (!ranges.length) return false;
  const startMin = toMinutes(time);
  const endMin = startMin + (duration || 60);
  return ranges.some(r => startMin >= toMinutes(r.start) && endMin <= toMinutes(r.end));
}

// Existe-t-il déjà un rendez-vous (peu importe le service) ou un blocage
// ponctuel qui chevauche ce créneau ? Renvoie l'entrée en conflit, ou null.
function findOverlap({ date, time, duration, excludeApptId }) {
  const dur = duration || 60;
  const startMin = toMinutes(time);
  const endMin = startMin + dur;

  const apptRows = excludeApptId
    ? db.prepare(`
        SELECT id, time, duration, client_name, service FROM appointments
        WHERE date = ? AND status NOT IN ('cancelled', 'declined') AND id != ?
      `).all(date, excludeApptId)
    : db.prepare(`
        SELECT id, time, duration, client_name, service FROM appointments
        WHERE date = ? AND status NOT IN ('cancelled', 'declined')
      `).all(date);

  const blockRows = db.prepare('SELECT time, duration FROM blocked_slots WHERE date = ? AND time IS NOT NULL').all(date);

  for (const t of [...apptRows, ...blockRows]) {
    const tStart = toMinutes(t.time);
    const tEnd = tStart + (t.duration || dur);
    if (startMin < tEnd && endMin > tStart) return t;
  }
  return null;
}

module.exports = { DAY_KEYS, toMinutes, getDayKey, isDateClosed, isWithinWeeklyHours, findOverlap };
