// =========================================================
// PIERRE-OLIVIER — testimonials-store.js (v2 — backend réel)
//
// Appelle désormais le vrai serveur (server/testimonials-routes.js) au
// lieu de localStorage — les témoignages sont enfin partagés entre
// tous les appareils. Même pattern "cache + réseau" que auth.js :
// listApproved()/listAll() etc. lisent un cache local synchrone,
// rempli par refresh()/refreshAdmin() (à appeler après connexion et
// après chaque action de modération).
// =========================================================

const PO_Testimonials = (() => {
  const STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };

  const SERVICE_LABELS = {
    'services-energetiques': 'Soins Énergétiques',
    'soins-direct': 'Soins Direct',
    'accompagnement': 'Accompagnement 1:1'
  };
  function serviceLabel(serviceId) {
    return SERVICE_LABELS[serviceId] || String(serviceId || '');
  }

  let _approvedCache = [];
  let _allCache = []; // rempli uniquement côté admin

  async function refresh() {
    const res = await PO_Api.get('/api/testimonials');
    if (res.ok) _approvedCache = res.testimonials;
    return _approvedCache;
  }

  async function refreshAdmin() {
    const res = await PO_Api.get('/api/admin/testimonials');
    if (res.ok) _allCache = res.testimonials;
    return _allCache;
  }

  function listApproved() { return _approvedCache; }
  function listAll() { return _allCache; }
  function listPending() { return _allCache.filter(t => t.status === STATUS.PENDING); }
  function listByClient(clientId) { return _allCache.filter(t => t.clientId === clientId); }
  function getById(id) { return _allCache.find(t => t.id === id) || _approvedCache.find(t => t.id === id) || null; }

  async function submit({ service, text, rating }) {
    const res = await PO_Api.post('/api/testimonials', { service, text, rating });
    if (res.ok) {
      document.dispatchEvent(new CustomEvent('po:testimonials-updated', { bubbles: true }));
      return { ok: true, testimonial: res.testimonial };
    }
    return { ok: false, error: res.error };
  }

  function canClientEdit(id, clientId) {
    const t = getById(id);
    return !!t && t.clientId === clientId && t.status === STATUS.PENDING;
  }

  async function clientUpdate(id, patch) {
    const res = await PO_Api.put(`/api/testimonials/${id}`, patch);
    if (res.ok) document.dispatchEvent(new CustomEvent('po:testimonials-updated', { bubbles: true }));
    return res.ok ? { ok: true, testimonial: res.testimonial } : { ok: false, error: res.error };
  }

  async function clientDelete(id) {
    const res = await PO_Api.del(`/api/testimonials/${id}`);
    if (res.ok) document.dispatchEvent(new CustomEvent('po:testimonials-updated', { bubbles: true }));
    return res;
  }

  async function adminApprove(id) {
    const res = await PO_Api.put(`/api/admin/testimonials/${id}/approve`);
    if (res.ok) { await refreshAdmin(); await refresh(); document.dispatchEvent(new CustomEvent('po:testimonials-updated', { bubbles: true })); }
    return res;
  }
  async function adminReject(id) {
    const res = await PO_Api.put(`/api/admin/testimonials/${id}/reject`);
    if (res.ok) { await refreshAdmin(); await refresh(); document.dispatchEvent(new CustomEvent('po:testimonials-updated', { bubbles: true })); }
    return res;
  }
  async function adminUpdate(id, patch) {
    const res = await PO_Api.put(`/api/admin/testimonials/${id}`, patch);
    if (res.ok) await refreshAdmin();
    return res.ok ? { ok: true, testimonial: res.testimonial } : { ok: false, error: res.error };
  }
  async function adminDelete(id) {
    const res = await PO_Api.del(`/api/admin/testimonials/${id}`);
    if (res.ok) await refreshAdmin();
    return res;
  }

  return {
    STATUS, SERVICE_LABELS, serviceLabel,
    refresh, refreshAdmin,
    listAll, listApproved, listPending, listByClient, getById,
    submit, canClientEdit, clientUpdate, clientDelete,
    adminApprove, adminReject, adminUpdate, adminDelete
  };
})();
