// =========================================================
// PIERRE-OLIVIER — interactions
// =========================================================

// ----- FORMATAGE DES PRIX — délégué à PO_Pricing (pricing.js) -----
// poFormatPrice est conservé pour compatibilité avec le code existant ;
// il délègue maintenant à PO_Pricing.formatCAD si disponible, sinon
// applique la même logique inline en fallback.
function poFormatPrice(value) {
  if (typeof PO_Pricing !== 'undefined') return PO_Pricing.formatCAD(value);
  if (typeof value !== 'number' && typeof value !== 'string') return String(value);
  const trimmed = typeof value === 'string' ? value.trim() : value;
  const isPureNumber = typeof trimmed === 'number' || /^-?\d+([.,]\d+)?$/.test(trimmed);
  if (!isPureNumber) return String(value);
  const num = typeof trimmed === 'number' ? trimmed : parseFloat(trimmed.replace(',', '.'));
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('fr-CA', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' $ CAD';
}

// ----- POLITIQUE DE MOT DE PASSE (globale, réutilisée par inscription.html et profil.html) -----
// Règles : 8 caractères minimum, 1 majuscule, 1 chiffre.
function poValidatePassword(password) {
  const errors = [];
  if (!password || password.length < 8) errors.push('8 caractères minimum');
  if (!/[A-Z]/.test(password || '')) errors.push('1 lettre majuscule');
  if (!/[0-9]/.test(password || '')) errors.push('1 chiffre');
  return { valid: errors.length === 0, errors };
}

// Attache une validation en temps réel sur un champ mot de passe : affiche les règles
// manquantes dans l'élément d'erreur fourni, à chaque frappe.
function poAttachPasswordValidation(inputEl, errorEl) {
  if (!inputEl || !errorEl) return;
  const update = () => {
    const { valid, errors } = poValidatePassword(inputEl.value);
    if (!inputEl.value) {
      errorEl.textContent = '';
      inputEl.classList.remove('has-error');
    } else if (!valid) {
      errorEl.textContent = 'Manque : ' + errors.join(', ') + '.';
      inputEl.classList.add('has-error');
    } else {
      errorEl.textContent = '';
      inputEl.classList.remove('has-error');
    }
  };
  inputEl.addEventListener('input', update);
}

document.addEventListener('DOMContentLoaded', async () => {

  try {
    // Initialise la session + caches (utilisateur courant, tarifs, témoignages
    // approuvés) avant tout rendu qui en dépend plus bas dans ce fichier.
    if (typeof PO_Auth !== 'undefined' && PO_Auth.init) await PO_Auth.init();
    if (typeof PO_Content !== 'undefined' && PO_Content.refreshFormulas) await PO_Content.refreshFormulas();

    /* ---------- GESTION DES BOUTONS (Admin → Gestion des boutons) ----------
       Masque tout élément marqué data-button-id="..." dont le réglage est
       désactivé (bouton ET lien de menu associés), et empêche l'accès direct
       à la page cible : si CETTE page est elle-même gouvernée par un bouton
       désactivé (voir data-guard-button sur <body>), on renvoie vers l'accueil
       avant que le contenu ne soit visible. Le site étant hébergé en fichiers
       statiques (Render Static Site), il n'existe pas de routage serveur
       capable de renvoyer un vrai code HTTP 404 : cette redirection cliente
       immédiate est l'équivalent le plus proche réalisable dans cette
       architecture. */
    if (typeof PO_Content !== 'undefined' && PO_Content.getButtonSettings) {
      const buttonSettings = PO_Content.getButtonSettings();

      const guardButton = document.body.dataset.guardButton;
      if (guardButton && buttonSettings[guardButton] === false) {
        window.__poGuardRedirected = true; // utilisé par les tests (jsdom ne navigue pas réellement)
        window.location.replace('index.html');
        return; // stoppe toute exécution/rendu supplémentaire de cette page
      }

      document.querySelectorAll('[data-button-id]').forEach(el => {
        if (buttonSettings[el.dataset.buttonId] === false) el.remove();
      });
    }
  } catch (err) {
    // Ne jamais laisser la page bloquée invisible à cause d'une panne réseau
    // ou d'une erreur inattendue pendant la vérification des boutons.
    console.warn('[Guard boutons] Vérification échouée, affichage par défaut :', err.message);
  } finally {
    document.documentElement.classList.remove('po-guard-pending');
  }

  if (typeof PO_Testimonials !== 'undefined' && PO_Testimonials.refresh) await PO_Testimonials.refresh();

  /* ---------- THRESHOLD MODAL ---------- */
  const threshold   = document.getElementById('threshold');
  const acceptBox   = document.getElementById('threshold-accept');
  const enterBtn    = document.getElementById('threshold-enter');
  const STORAGE_KEY = 'po_sacred_threshold_accepted';

  const alreadyAccepted = sessionStorage.getItem(STORAGE_KEY) === 'true';

  if (alreadyAccepted) {
    threshold.setAttribute('data-closed', 'true');
  } else {
    document.body.classList.add('threshold-locked');
  }

  acceptBox?.addEventListener('change', () => {
    enterBtn.disabled = !acceptBox.checked;
  });

  enterBtn?.addEventListener('click', () => {
    if (enterBtn.disabled) return;
    sessionStorage.setItem(STORAGE_KEY, 'true');
    threshold.style.transition = 'opacity .6s ease';
    threshold.style.opacity = '0';
    setTimeout(() => {
      threshold.setAttribute('data-closed', 'true');
      document.body.classList.remove('threshold-locked');
    }, 600);
  });

  /* ---------- MOBILE NAV ---------- */
  const navToggle = document.getElementById('nav-toggle');
  const mobileNav  = document.getElementById('mobile-nav');

  navToggle?.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  mobileNav?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ---------- AMBIENT PARTICLES ---------- */
  const particleHost = document.getElementById('particles');
  const reduceMotion = (typeof window.matchMedia === 'function')
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  if (particleHost && !reduceMotion) {
    const COUNT = 26;
    for (let i = 0; i < COUNT; i++) {
      const p = document.createElement('span');
      const left = Math.random() * 100;
      const duration = 9 + Math.random() * 10;
      const delay = Math.random() * 12;
      const drift = (Math.random() * 60 - 30) + 'px';
      const size = 2 + Math.random() * 2.4;

      p.style.left = left + '%';
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.animationDuration = duration + 's';
      p.style.animationDelay = delay + 's';
      p.style.setProperty('--drift', drift);
      particleHost.appendChild(p);
    }
  }

  /* ---------- FAQ ACCORDION ---------- */
  function attachFaqAccordion(scopeEl) {
    const scope = scopeEl || document;
    scope.querySelectorAll('.faq-item').forEach(item => {
      const q = item.querySelector('.faq-item__q');
      const a = item.querySelector('.faq-item__a');
      q?.addEventListener('click', () => {
        const isOpen = item.getAttribute('data-open') === 'true';
        // close siblings within the same faq block
        item.closest('.faq')?.querySelectorAll('.faq-item').forEach(sib => {
          if (sib !== item) {
            sib.setAttribute('data-open', 'false');
            const sibA = sib.querySelector('.faq-item__a');
            if (sibA) sibA.style.maxHeight = null;
          }
        });
        if (isOpen) {
          item.setAttribute('data-open', 'false');
          a.style.maxHeight = null;
        } else {
          item.setAttribute('data-open', 'true');
          a.style.maxHeight = a.scrollHeight + 'px';
        }
      });
    });
  }
  attachFaqAccordion(); // FAQ statiques éventuelles (ex. page d'accueil) ; les FAQ
                         // générées dynamiquement plus bas rappellent cette fonction
                         // elles-mêmes une fois injectées dans le DOM.

  /* ---------- DYNAMIC SITE CONTENT (Content Manager) — homepage only ---------- */
  if (typeof PO_Content !== 'undefined' && document.getElementById('threshold-title')) {
    const site = PO_Content.getSiteContent();

    if (site.threshold) {
      const eb = document.getElementById('threshold-eyebrow');
      const tt = document.getElementById('threshold-title');
      const tx = document.getElementById('threshold-text-content');
      if (eb) eb.textContent = site.threshold.eyebrow;
      if (tt) tt.textContent = site.threshold.title;
      if (tx) tx.textContent = site.threshold.text;
    }

    const brandTaglineEl = document.getElementById('brand-tagline');
    if (brandTaglineEl && site.brand && site.brand.homeTagline) {
      brandTaglineEl.textContent = site.brand.homeTagline;
    }
  }

  /* ---------- DYNAMIC SERVICE INFO (Services Manager content) ---------- */
  const serviceTitleEl = document.getElementById('service-title');
  if (serviceTitleEl && typeof PO_Content !== 'undefined') {
    // Le serviceId est déjà exposé via le conteneur de formules sur la même page
    const container = document.getElementById('formulas-container');
    const serviceId = container ? container.dataset.serviceId : null;
    if (serviceId) {
      const service = PO_Content.getService(serviceId);
      if (service) {
        document.getElementById('service-rune').textContent = service.rune;
        serviceTitleEl.textContent = service.name;
        document.getElementById('service-tagline').textContent = service.tagline;
        document.body.setAttribute('data-accent', service.accent);
        document.title = document.title.replace(/^[^—]+—/, service.name + ' —');
      }

      /* ---- Contenu détaillé de la page de service (Content Manager) ---- */
      const site = PO_Content.getSiteContent();
      const page = PO_Content.getServicePageContent(serviceId);

      const introEl = document.getElementById('service-intro');
      if (introEl && page && page.intro) {
        introEl.innerHTML = String(page.intro).split(/\n\s*\n/).map(p => `<p>${escapeHtmlGlobal(p.trim())}</p>`).join('');
      }

      if (page) {
        const stepsContainer = document.getElementById('steps-container');
        if (stepsContainer && Array.isArray(page.steps)) {
          stepsContainer.innerHTML = page.steps.map((s) => {
            const eyebrowHtml = s.eyebrow ? `<p class="page-section__eyebrow">${escapeHtmlGlobal(s.eyebrow)}</p>` : '';
            const titleHtml = s.title ? `<h2 class="page-section__title">${escapeHtmlGlobal(s.title)}</h2>` : '';
            const introHtml = s.intro ? `<div class="se-prose" style="max-width:700px; margin:0 auto 32px;"><p>${escapeHtmlGlobal(s.intro)}</p></div>` : '';
            let bodyHtml = '';
            if (s.type === 'list') {
              const items = String(s.text || '').split('\n').map(t => t.trim()).filter(Boolean);
              bodyHtml = `<ul class="ac-list">${items.map(t => `
                <li class="ac-list__item"><span class="ac-list__dot" aria-hidden="true">✦</span><span>${escapeHtmlGlobal(t)}</span></li>
              `).join('')}</ul>`;
            } else {
              const paragraphs = String(s.text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
              bodyHtml = `<div class="se-prose">${paragraphs.map(p => `<p>${escapeHtmlGlobal(p)}</p>`).join('')}</div>`;
            }
            const outroHtml = s.outro ? `<div class="se-prose" style="max-width:700px; margin:28px auto 0;"><p style="font-style:italic;">${escapeHtmlGlobal(s.outro)}</p></div>` : '';
            return `<section class="page-section">${eyebrowHtml}${titleHtml}${introHtml}${bodyHtml}${outroHtml}</section>`;
          }).join('');
        }

        const ctaTitleEl = document.getElementById('cta-title');
        const ctaTextEl = document.getElementById('cta-text');
        const ctaButtonEl = document.getElementById('cta-button') || document.getElementById('bf-main-cta');
        if (ctaTitleEl && page.ctaTitle) ctaTitleEl.textContent = page.ctaTitle;
        if (ctaTextEl && page.ctaText) ctaTextEl.textContent = page.ctaText;
        if (ctaButtonEl && page.ctaButtonLabel) ctaButtonEl.textContent = page.ctaButtonLabel;

        const faqContainer = document.getElementById('faq-container');
        if (faqContainer && Array.isArray(page.faq)) {
          faqContainer.innerHTML = page.faq.map((f, i) => `
            <div class="faq-item" data-open="false" data-faq-index="${i}">
              <button class="faq-item__q"><span data-faq-question>${escapeHtmlGlobal(f.question)}</span><i>+</i></button>
              <div class="faq-item__a"><p data-faq-answer>${escapeHtmlGlobal(f.answer)}</p></div>
            </div>
          `).join('');
          attachFaqAccordion(faqContainer);
        }
      }

      if (site && site.sharedLabels) {
        const labels = site.sharedLabels;
        const formulesEyebrowEl = document.getElementById('formules-eyebrow');
        const formulesTitleEl = document.getElementById('formules-title');
        const faqEyebrowEl = document.getElementById('faq-eyebrow');
        const faqTitleEl = document.getElementById('faq-title');
        if (formulesEyebrowEl && labels.formulesEyebrow) formulesEyebrowEl.textContent = labels.formulesEyebrow;
        if (formulesTitleEl && labels.formulesTitle) formulesTitleEl.textContent = labels.formulesTitle;
        if (faqEyebrowEl && labels.faqEyebrow) faqEyebrowEl.textContent = labels.faqEyebrow;
        if (faqTitleEl && labels.faqTitle) faqTitleEl.textContent = labels.faqTitle;
      }
    }
  }

  /* ---------- DYNAMIC PRICING (Pricing Manager content) ---------- */
  const formulasContainer = document.getElementById('formulas-container');
  if (formulasContainer && typeof PO_Content !== 'undefined') {
    const serviceId = formulasContainer.dataset.serviceId;
    const redirectParam = serviceId; // les pages de service utilisent leur propre id comme paramètre ?redirect=

    function renderFormulas() {
      const formulas = PO_Content.listFormulasForService(serviceId);
      if (!formulas.length) {
        formulasContainer.innerHTML = '<p class="empty-state">Aucune formule disponible pour le moment.</p>';
        return;
      }
      formulasContainer.innerHTML = formulas.map(f => `
        <div class="formula-card ${f.featured ? 'formula-card--featured' : ''}">
          ${f.featured ? '<span class="formula-card__badge">Le plus choisi</span>' : ''}
          <h3>${escapeHtmlGlobal(f.title)}</h3>
          <div class="formula-card__meta">
            <span class="formula-card__price">${poFormatPrice(f.price)}</span>
            <span class="formula-card__duration">/ ${escapeHtmlGlobal(f.duration)}</span>
          </div>
          <p>${escapeHtmlGlobal(f.description)}</p>
          <span class="formula-card__note">Tarif d'exemple — modifiable</span>
          ${(serviceId === 'services-energetiques' || serviceId === 'accompagnement')
            ? `<button type="button" class="btn btn--accent cal-formula-btn" data-formula-id="${escapeHtmlGlobal(f.id)}" data-formula-title="${escapeHtmlGlobal(f.title)}" data-formula-price="${f.price}" data-formula-duration="${escapeHtmlGlobal(f.duration)}">Réserver</button>`
            : `<a href="connexion.html?redirect=${redirectParam}" class="btn btn--accent">Réserver</a>`
          }
        </div>
      `).join('');
    }
    renderFormulas();

    // Synchronisation temps réel : si l'admin modifie un tarif (même onglet),
    // rafraîchit automatiquement les cartes de formule sans rechargement de page.
    document.addEventListener('po:prices-updated', renderFormulas);
  }


  /* ---------- TÉMOIGNAGES ---------- */
  (function initTestimonials() {
    const section = document.getElementById('testimonials-section');
    const crownTrigger = document.getElementById('hero-crown-trigger');
    if (!section) return; // section absente sur cette page

    if (crownTrigger) {
      crownTrigger.addEventListener('click', () => {
        section.hidden = false;
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    const form = document.getElementById('testimonial-form');
    const loginCta = document.getElementById('testimonial-login-cta');
    const grid = document.getElementById('testimonials-grid');
    const emptyState = document.getElementById('testimonials-empty');
    const notice = document.getElementById('testimonial-form-notice');
    const starRating = document.getElementById('testi-star-rating');
    const textArea = document.getElementById('testi-text');
    const serviceSelect = document.getElementById('testi-service');

    function showNotice(msg, tone) {
      if (!notice) return;
      notice.hidden = false;
      notice.dataset.tone = tone || 'error';
      notice.textContent = msg;
    }
    function hideNotice() { if (notice) notice.hidden = true; }

    // ---- Composant étoiles ----
    function setStarValue(value) {
      if (!starRating) return;
      starRating.dataset.value = String(value);
      starRating.querySelectorAll('.star-rating__star').forEach(star => {
        const active = Number(star.dataset.star) <= value;
        star.classList.toggle('star-rating__star--active', active);
        star.setAttribute('aria-checked', String(Number(star.dataset.star) === value));
      });
    }
    if (starRating) {
      setStarValue(5);
      starRating.querySelectorAll('.star-rating__star').forEach(star => {
        star.addEventListener('click', () => setStarValue(Number(star.dataset.star)));
      });
    }

    // ---- Visibilité connecté / invité ----
    function refreshAuthGate() {
      const user = (typeof PO_Auth !== 'undefined') ? PO_Auth.getCurrentUser() : null;
      if (form) form.hidden = !user;
      if (loginCta) loginCta.hidden = !!user;
    }
    refreshAuthGate();

    // ---- Rendu des étoiles (lecture) ----
    function starsHTML(rating) {
      let h = '';
      for (let i = 1; i <= 5; i++) {
        h += `<span class="testimonial-card__star ${i <= rating ? 'testimonial-card__star--filled' : ''}" aria-hidden="true">★</span>`;
      }
      return h;
    }

    function renderTestimonials() {
      if (typeof PO_Testimonials === 'undefined') return;
      const approved = PO_Testimonials.listApproved();
      if (!approved.length) {
        grid.innerHTML = '';
        if (emptyState) emptyState.hidden = false;
        return;
      }
      if (emptyState) emptyState.hidden = true;
      grid.innerHTML = approved.map(t => `
        <article class="testimonial-card">
          <div class="testimonial-card__stars" aria-label="${t.rating} sur 5 étoiles">${starsHTML(t.rating)}</div>
          <p class="testimonial-card__text">${escapeHtmlGlobal(t.text)}</p>
          <div class="testimonial-card__meta">
            <span class="testimonial-card__name">${escapeHtmlGlobal(t.clientName)}</span>
            <span class="testimonial-card__service">${escapeHtmlGlobal(PO_Testimonials.serviceLabel(t.service))}</span>
            <time class="testimonial-card__date">${escapeHtmlGlobal(formatDateShortGlobal(t.date))}</time>
          </div>
        </article>
      `).join('');
    }
    renderTestimonials();
    document.addEventListener('po:testimonials-updated', renderTestimonials);

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideNotice();
      const user = (typeof PO_Auth !== 'undefined') ? PO_Auth.getCurrentUser() : null;
      if (!user) { refreshAuthGate(); return; }

      const result = await PO_Testimonials.submit({
        service: serviceSelect.value,
        text: textArea.value,
        rating: Number(starRating?.dataset.value || 5)
      });

      if (!result.ok) {
        showNotice(result.error, 'error');
        return;
      }
      showNotice('Merci ! Votre témoignage a été envoyé et sera visible après validation.', 'success');
      form.reset();
      setStarValue(5);
      setTimeout(hideNotice, 4000);
    });
  })();

  function formatDateShortGlobal(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function escapeHtmlGlobal(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }

  /* ---------- FOOTER YEAR ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

});
