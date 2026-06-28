// =========================================================
// PIERRE-OLIVIER — messenger-store.js
//
// SIMULATION FRONTEND UNIQUEMENT — stockage dans localStorage.
// Messagerie interne entre l'admin et chaque client. Une seule
// conversation par client (pas de fils multiples), conformément
// au brief (INTERNAL_MESSENGER : temps réel, statut vu, etc.).
//
// Point de branchement futur (backend réel) :
//   - Remplacer le stockage localStorage par une table "messages"
//     (Supabase) avec souscription realtime pour le push instantané
//   - SeenStatus -> mettre à jour un champ "seen_at" côté serveur
// =========================================================

const PO_Messenger = (() => {
  const MESSAGES_KEY = 'po_demo_messages';

  function _read() {
    try {
      return JSON.parse(localStorage.getItem(MESSAGES_KEY)) || [];
    } catch {
      return [];
    }
  }

  function _write(messages) {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  }

  // Modèle d'un message :
  // { id, clientId, sender ('client' | 'admin'), body, createdAt, seenByClient, seenByAdmin }

  function listConversation(clientId) {
    return _read()
      .filter(m => m.clientId === clientId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  // Liste tous les clients ayant échangé au moins un message, avec leur dernier message
  // et le nombre de messages non lus par l'admin.
  function listConversationsSummary() {
    const all = _read();
    const byClient = {};
    all.forEach(m => {
      if (!byClient[m.clientId]) byClient[m.clientId] = [];
      byClient[m.clientId].push(m);
    });
    return Object.keys(byClient).map(clientId => {
      const msgs = byClient[clientId].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const last = msgs[msgs.length - 1];
      const unreadByAdmin = msgs.filter(m => m.sender === 'client' && !m.seenByAdmin).length;
      return { clientId, lastMessage: last, unreadByAdmin, total: msgs.length };
    }).sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
  }

  function sendMessage({ clientId, sender, body }) {
    if (!body || !body.trim()) return { ok: false, error: 'Le message ne peut pas être vide.' };
    const messages = _read();
    const message = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      clientId,
      sender, // 'client' ou 'admin'
      body: body.trim(),
      createdAt: new Date().toISOString(),
      seenByClient: sender === 'client',
      seenByAdmin: sender === 'admin'
    };
    messages.push(message);
    _write(messages);
    return { ok: true, message };
  }

  // Marque comme lus tous les messages d'une conversation, du point de vue du lecteur donné
  function markConversationSeen(clientId, viewer) {
    const messages = _read();
    let changed = false;
    messages.forEach(m => {
      if (m.clientId !== clientId) return;
      if (viewer === 'admin' && m.sender === 'client' && !m.seenByAdmin) { m.seenByAdmin = true; changed = true; }
      if (viewer === 'client' && m.sender === 'admin' && !m.seenByClient) { m.seenByClient = true; changed = true; }
    });
    if (changed) _write(messages);
    return { ok: true };
  }

  function countUnreadForClient(clientId) {
    return _read().filter(m => m.clientId === clientId && m.sender === 'admin' && !m.seenByClient).length;
  }

  function countUnreadForAdmin() {
    return _read().filter(m => m.sender === 'client' && !m.seenByAdmin).length;
  }

  return {
    listConversation, listConversationsSummary, sendMessage,
    markConversationSeen, countUnreadForClient, countUnreadForAdmin
  };
})();
