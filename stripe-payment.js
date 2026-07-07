// =========================================================
// Ntabou Aka Wé — stripe-payment.js
//
// Intégration Stripe RÉELLE (test ou réel selon les clés configurées sur le
// serveur — voir isTestMode()) via Stripe Elements.
// Le formulaire de carte (numéro, expiration, CVC) est rendu et géré
// entièrement par Stripe.js dans un iframe sécurisé — aucune donnée de
// carte ne transite par notre serveur ni par ce fichier.
//
// Nécessite, chargés AVANT ce fichier dans la page HTML :
//   <script src="https://js.stripe.com/v3/"></script>
//
// Nécessite le serveur API (voir /server-stripe/stripe-routes.js) avec
// les routes /api/stripe-config et /api/create-payment-intent actives.
//
// CONFIGURATION :
//   Changer API_BASE_URL vers l'URL de ton service API Render
//   (même valeur que dans email-service.js).
// =========================================================

const PO_StripePayment = (() => {

  // ⬇️ CHANGER CETTE URL vers ton service API Render après déploiement
  //    (même serveur que PO_EmailService — les routes Stripe s'y ajoutent)
  const API_BASE_URL = 'https://soinweb-001.onrender.com';

  let _stripe = null;
  let _elements = null;
  let _cardElement = null;
  let _publishableKey = null;
  let _initError = null;

  /**
   * Charge la clé publiable depuis le serveur et initialise Stripe.js.
   * À appeler une fois, avant mountCardElement().
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async function init() {
    if (_stripe) return { ok: true };
    if (typeof Stripe === 'undefined') {
      _initError = 'Stripe.js n\'est pas chargé (vérifiez la balise <script src="https://js.stripe.com/v3/">).';
      return { ok: false, error: _initError };
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/stripe-config`, {
        signal: AbortSignal.timeout(8000)
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.publishableKey) {
        _initError = 'Configuration Stripe indisponible sur le serveur (clé publiable manquante).';
        return { ok: false, error: _initError };
      }
      _publishableKey = data.publishableKey;
      _stripe = Stripe(_publishableKey);
      _elements = _stripe.elements();
      return { ok: true };
    } catch (err) {
      _initError = 'Impossible de contacter le serveur de paiement : ' + err.message;
      return { ok: false, error: _initError };
    }
  }

  /**
   * Indique si Stripe fonctionne actuellement en mode TEST (clé pk_test_...)
   * ou en mode réel (clé pk_live_...). Déterminé dynamiquement à partir de la
   * clé publiable réellement reçue du serveur — jamais codé en dur — pour que
   * l'interface reste toujours honnête, quelles que soient les clés
   * configurées sur Render à un moment donné.
   * @returns {boolean|null} true = mode test, false = mode réel, null = inconnu (init() pas encore appelé)
   */
  function isTestMode() {
    if (!_publishableKey) return null;
    return _publishableKey.startsWith('pk_test_');
  }

  /**
   * Monte le champ de carte Stripe (Card Element) dans le conteneur donné.
   * À appeler après init(). Idempotent (ne remonte pas si déjà monté).
   * @param {string} containerId - id de l'élément DOM cible
   * @param {object} [style] - style personnalisé Stripe Elements (couleurs, police)
   */
  function mountCardElement(containerId, style) {
    if (!_elements) return { ok: false, error: 'Stripe non initialisé — appeler init() d\'abord.' };
    if (_cardElement) return { ok: true }; // déjà monté

    _cardElement = _elements.create('card', {
      hidePostalCode: true,
      style: style || {
        base: {
          color: '#f3eee6',
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: '15px',
          '::placeholder': { color: 'rgba(243,238,230,.35)' }
        },
        invalid: { color: '#f0a06b' }
      }
    });
    _cardElement.mount('#' + containerId);
    return { ok: true };
  }

  /**
   * Crée le PaymentIntent côté serveur puis confirme le paiement avec les
   * informations de carte saisies dans le Card Element monté.
   * @param {object} params
   * @param {number} params.amount - montant en dollars CAD (ex. 88.00)
   * @param {string} [params.currency='cad']
   * @param {object} [params.metadata] - infos de contexte (appointmentId, etc.)
   * @param {string} [params.cardholderName]
   * @returns {Promise<{ok: boolean, paymentIntent?: object, error?: string}>}
   */
  async function pay({ amount, currency, metadata, cardholderName }) {
    if (!_stripe || !_cardElement) {
      return { ok: false, error: 'Le formulaire de carte n\'est pas prêt. Rechargez la page.' };
    }
    if (!amount || amount <= 0) {
      return { ok: false, error: 'Montant invalide.' };
    }

    // 1. Crée le PaymentIntent côté serveur (clé secrète jamais exposée).
    let clientSecret;
    try {
      const response = await fetch(`${API_BASE_URL}/api/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency: currency || 'cad', metadata: metadata || {} }),
        signal: AbortSignal.timeout(15000)
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.clientSecret) {
        return { ok: false, error: data.error || 'Impossible de créer le paiement côté serveur.' };
      }
      clientSecret = data.clientSecret;
    } catch (err) {
      return { ok: false, error: 'Serveur de paiement indisponible : ' + err.message };
    }

    // 2. Confirme le paiement directement avec Stripe (les données de carte
    //    voyagent uniquement entre le navigateur et Stripe, jamais par notre serveur).
    try {
      const result = await _stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: _cardElement,
          billing_details: cardholderName ? { name: cardholderName } : undefined
        }
      });
      if (result.error) {
        return { ok: false, error: result.error.message };
      }
      if (result.paymentIntent.status !== 'succeeded') {
        return { ok: false, error: `Paiement non finalisé (statut : ${result.paymentIntent.status}).` };
      }
      return { ok: true, paymentIntent: result.paymentIntent };
    } catch (err) {
      return { ok: false, error: 'Erreur lors de la confirmation du paiement : ' + err.message };
    }
  }

  function isReady() { return !!(_stripe && _cardElement); }
  function getLastError() { return _initError; }

  return { init, mountCardElement, pay, isReady, getLastError, isTestMode };
})();
