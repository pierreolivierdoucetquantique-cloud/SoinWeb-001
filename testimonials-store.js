// =========================================================
// PIERRE-OLIVIER — testimonials-store.js
//
// SIMULATION FRONTEND UNIQUEMENT — voir l'avertissement complet
// en haut de auth.js. Résumé :
//   - Les données sont stockées dans localStorage, propres à cet
//     appareil/navigateur (pas de synchronisation multi-appareil).
//   - La validation d'autorisation (un client ne peut modifier que
//     ses propres témoignages en attente ; seul l'admin peut
//     approuver/rejeter) est appliquée ici côté client, mais devra
//     être revalidée côté serveur avant toute mise en production.
//
// Workflow : pending → approved (visible publiquement) | rejected (masqué).
// =========================================================

const PO_Testimonials = (() => {
  const KEY = 'po_demo_testimonials';

  const STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };

  function _read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function _write(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    document.dispatchEvent(new CustomEvent('po:testimonials-updated', { bubbles: true }));
  }

  // Sanitisation défensive : retire toute balise HTML des champs texte
  // libres, en plus de l'échappement systématique à l'affichage
  // (escapeHtml). Empêche l'injection HTML/JS même si un champ
  // textuel était un jour inséré sans passer par escapeHtml.
  function _sanitizeText(str, maxLen) {
    const s = String(str ?? '').replace(/<[^>]*>/g, '').trim();
    return maxLen ? s.slice(0, maxLen) : s;
  }

  function _clampRating(r) {
    const n = Math.round(Number(r));
    if (Number.isNaN(n)) return 5;
    return Math.min(5, Math.max(1, n));
  }

  function _genId() {
    return 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function listAll() {
    return _read().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function listApproved() {
    return listAll().filter(t => t.status === STATUS.APPROVED);
  }

  function listPending() {
    return listAll().filter(t => t.status === STATUS.PENDING);
  }

  function listByClient(clientId) {
    return listAll().filter(t => t.clientId === clientId);
  }

  function getById(id) {
    return _read().find(t => t.id === id) || null;
  }

  // ---- Libellés de service partagés avec le reste du site ----
  const SERVICE_LABELS = {
    'services-energetiques': 'Soins Énergétiques',
    'soins-direct': 'Soins Direct',
    'accompagnement': 'Accompagnement 1:1'
  };
  function serviceLabel(serviceId) {
    return SERVICE_LABELS[serviceId] || _sanitizeText(serviceId, 60);
  }

  // ---- Soumission (client authentifié uniquement — vérifié par l'appelant) ----
  function submit({ clientId, clientName, service, text, rating, date }) {
    if (!clientId) return { ok: false, error: 'Utilisateur non authentifié.' };
    const cleanText = _sanitizeText(text, 1000);
    if (!cleanText || cleanText.length < 10) {
      return { ok: false, error: 'Le témoignage doit contenir au moins 10 caractères.' };
    }
    if (!service || !SERVICE_LABELS[service]) {
      return { ok: false, error: 'Service invalide.' };
    }
    const list = _read();
    const testimonial = {
      id: _genId(),
      clientId,
      clientName: _sanitizeText(clientName, 120),
      service,
      text: cleanText,
      rating: _clampRating(rating),
      date: date || new Date().toISOString().slice(0, 10),
      status: STATUS.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    list.push(testimonial);
    _write(list);
    return { ok: true, testimonial };
  }

  // Un client ne peut modifier que son propre témoignage, et seulement
  // tant qu'il est encore en attente de modération.
  function canClientEdit(id, clientId) {
    const t = getById(id);
    return !!t && t.clientId === clientId && t.status === STATUS.PENDING;
  }

  function clientUpdate(id, clientId, patch) {
    if (!canClientEdit(id, clientId)) {
      return { ok: false, error: 'Ce témoignage ne peut plus être modifié.' };
    }
    const list = _read();
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) return { ok: false, error: 'Témoignage introuvable.' };
    const next = { ...list[idx] };
    if (patch.text !== undefined) {
      const cleanText = _sanitizeText(patch.text, 1000);
      if (!cleanText || cleanText.length < 10) {
        return { ok: false, error: 'Le témoignage doit contenir au moins 10 caractères.' };
      }
      next.text = cleanText;
    }
    if (patch.rating !== undefined) next.rating = _clampRating(patch.rating);
    if (patch.service !== undefined && SERVICE_LABELS[patch.service]) next.service = patch.service;
    next.updatedAt = Date.now();
    list[idx] = next;
    _write(list);
    return { ok: true, testimonial: next };
  }

  function clientDelete(id, clientId) {
    const t = getById(id);
    if (!t || t.clientId !== clientId) return { ok: false, error: 'Non autorisé.' };
    const list = _read().filter(x => x.id !== id);
    _write(list);
    return { ok: true };
  }

  // ---- Modération admin (autorisation admin vérifiée par l'appelant) ----
  function adminApprove(id) {
    return _adminSetStatus(id, STATUS.APPROVED);
  }
  function adminReject(id) {
    return _adminSetStatus(id, STATUS.REJECTED);
  }
  function _adminSetStatus(id, status) {
    const list = _read();
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) return { ok: false, error: 'Témoignage introuvable.' };
    list[idx].status = status;
    list[idx].updatedAt = Date.now();
    _write(list);
    return { ok: true, testimonial: list[idx] };
  }

  function adminUpdate(id, patch) {
    const list = _read();
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) return { ok: false, error: 'Témoignage introuvable.' };
    const next = { ...list[idx] };
    if (patch.text !== undefined) next.text = _sanitizeText(patch.text, 1000);
    if (patch.rating !== undefined) next.rating = _clampRating(patch.rating);
    if (patch.clientName !== undefined) next.clientName = _sanitizeText(patch.clientName, 120);
    if (patch.service !== undefined && SERVICE_LABELS[patch.service]) next.service = patch.service;
    if (patch.status !== undefined && Object.values(STATUS).includes(patch.status)) next.status = patch.status;
    next.updatedAt = Date.now();
    list[idx] = next;
    _write(list);
    return { ok: true, testimonial: next };
  }

  function adminDelete(id) {
    const list = _read().filter(t => t.id !== id);
    _write(list);
    return { ok: true };
  }

  return {
    STATUS, SERVICE_LABELS, serviceLabel,
    listAll, listApproved, listPending, listByClient, getById,
    submit, canClientEdit, clientUpdate, clientDelete,
    adminApprove, adminReject, adminUpdate, adminDelete
  };
})();
