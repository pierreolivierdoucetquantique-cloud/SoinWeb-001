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
  const TYPING_KEY = 'po_demo_messenger_typing';

  // Durée de vie d'un signal de frappe : si rien n'est reçu depuis ce délai,
  // on considère que la personne a arrêté d'écrire (évite un indicateur figé
  // si l'autre fenêtre se ferme sans déclencher l'événement d'arrêt).
  const TYPING_TTL_MS = 4000;

  // Taille maximale d'une pièce jointe en base64 (≈ 4 Mo de fichier source ;
  // l'encodage base64 gonfle la taille d'environ 33%). Au-delà, localStorage
  // (limité à quelques Mo par origine) saturerait rapidement.
  const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

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
  // { id, clientId, sender ('client' | 'admin'), body, createdAt, seenByClient, seenByAdmin,
  //   attachment: { name, type, size, dataUrl } | null }

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

  function sendMessage({ clientId, sender, body, attachment }) {
    const hasText = body && body.trim();
    const hasAttachment = attachment && attachment.dataUrl;
    if (!hasText && !hasAttachment) {
      return { ok: false, error: 'Le message ne peut pas être vide.' };
    }
    if (hasAttachment) {
      const approxBytes = Math.ceil((attachment.dataUrl.length * 3) / 4);
      if (approxBytes > MAX_ATTACHMENT_BYTES) {
        return { ok: false, error: 'Fichier trop volumineux (limite 4 Mo en simulation locale).' };
      }
    }
    const messages = _read();
    const message = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      clientId,
      sender, // 'client' ou 'admin'
      body: hasText ? body.trim() : '',
      createdAt: new Date().toISOString(),
      seenByClient: sender === 'client',
      seenByAdmin: sender === 'admin',
      attachment: hasAttachment ? {
        name: attachment.name || 'fichier',
        type: attachment.type || 'application/octet-stream',
        size: attachment.size || 0,
        dataUrl: attachment.dataUrl
      } : null
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

  // ===========================================================
  // INDICATEUR DE FRAPPE
  //
  // SIMULATION FRONTEND : un signal "X est en train d'écrire" est écrit en
  // localStorage avec un horodatage, et expire automatiquement après
  // TYPING_TTL_MS s'il n'est pas renouvelé ou explicitement effacé. Ceci ne
  // fonctionne qu'entre deux onglets/fenêtres du MÊME navigateur (ex. l'admin
  // et le client testés sur le même poste) : localStorage n'est pas partagé
  // entre deux appareils différents. Une vraie synchronisation multi-appareil
  // demanderait un canal temps réel côté serveur (ex. Supabase Realtime).
  // ===========================================================

  function _readTyping() {
    try {
      return JSON.parse(localStorage.getItem(TYPING_KEY)) || {};
    } catch {
      return {};
    }
  }

  function _writeTyping(typing) {
    localStorage.setItem(TYPING_KEY, JSON.stringify(typing));
  }

  // viewer : 'admin' ou 'client' — qui est en train d'écrire.
  function setTyping(clientId, viewer) {
    const typing = _readTyping();
    if (!typing[clientId]) typing[clientId] = {};
    typing[clientId][viewer] = Date.now();
    _writeTyping(typing);
  }

  function clearTyping(clientId, viewer) {
    const typing = _readTyping();
    if (typing[clientId]) {
      delete typing[clientId][viewer];
      _writeTyping(typing);
    }
  }

  // Indique si "viewer" (admin ou client) est actuellement en train d'écrire
  // dans la conversation donnée, en tenant compte de l'expiration du signal.
  function isTyping(clientId, viewer) {
    const typing = _readTyping();
    const ts = typing[clientId] && typing[clientId][viewer];
    if (!ts) return false;
    return (Date.now() - ts) < TYPING_TTL_MS;
  }

  return {
    listConversation, listConversationsSummary, sendMessage,
    markConversationSeen, countUnreadForClient, countUnreadForAdmin,
    setTyping, clearTyping, isTyping,
    deleteConversation, purgeAllConversations
  };

  function deleteConversation(clientId) {
    if (!clientId) return { ok: false, error: 'clientId requis.' };
    try {
      // Les messages sont stockés comme un tableau plat (voir _read/_write ci-dessus)
      const all = _read();
      const filtered = all.filter(m => m.clientId !== clientId);
      _write(filtered);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  function purgeAllConversations() {
    try {
      _write([]);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }
})();
