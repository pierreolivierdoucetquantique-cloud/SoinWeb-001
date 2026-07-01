// =========================================================
// PIERRE-OLIVIER — interactions
// =========================================================

// ----- FORMATAGE DES PRIX (CAD, convention québécoise) -----
// Toujours afficher les montants au format "88,00 $ CAD" : virgule décimale,
// symbole $ après le nombre, suffixe CAD. N'accepte qu'un nombre, ou une
// chaîne représentant intégralement un nombre (espaces de bord tolérés,
// virgule ou point comme séparateur décimal). Toute autre valeur — texte
// libre comme "3×75 min", ou déjà un montant formaté — est retournée telle
// quelle plutôt que d'être mal interprétée par un parsing trop permissif.
function poFormatPrice(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return String(value);
  const trimmed = typeof value === 'string' ? value.trim() : value;
  const isPureNumber = typeof trimmed === 'number' || /^-?\d+([.,]\d+)?$/.test(trimmed);
  if (!isPureNumber) return String(value);
  const num = typeof trimmed === 'number' ? trimmed : parseFloat(trimmed.replace(',', '.'));
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $ CAD';
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

document.addEventListener('DOMContentLoaded', () => {

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
      if (introEl && page && page.intro) introEl.textContent = page.intro;

      if (page) {
        const stepsEyebrowEl = document.getElementById('steps-eyebrow');
        const stepsTitleEl = document.getElementById('steps-title');
        if (stepsEyebrowEl && page.stepsEyebrow) stepsEyebrowEl.textContent = page.stepsEyebrow;
        if (stepsTitleEl && page.stepsTitle) stepsTitleEl.textContent = page.stepsTitle;

        const stepsContainer = document.getElementById('steps-container');
        if (stepsContainer && Array.isArray(page.steps)) {
          const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
          stepsContainer.innerHTML = page.steps.map((s, i) => `
            <div class="step" data-step-index="${i}">
              <p class="step__num">${ROMAN[i] || (i + 1)}.</p>
              <h3 data-step-title>${escapeHtmlGlobal(s.title)}</h3>
              <p data-step-text>${escapeHtmlGlobal(s.text)}</p>
            </div>
          `).join('');
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
          ${serviceId === 'soins-direct'
            ? `<button type="button" class="btn btn--accent bf-formula-btn" data-formula-title="${escapeHtmlGlobal(f.title)}" data-formula-price="${poFormatPrice(f.price)}" data-formula-duration="${escapeHtmlGlobal(f.duration)}">Réserver</button>`
            : (serviceId === 'services-energetiques' || serviceId === 'accompagnement')
              ? `<button type="button" class="btn btn--accent cal-formula-btn" data-formula-title="${escapeHtmlGlobal(f.title)}" data-formula-duration="${escapeHtmlGlobal(f.duration)}">Réserver</button>`
              : `<a href="connexion.html?redirect=${redirectParam}" class="btn btn--accent">Réserver</a>`
          }
        </div>
      `).join('');
    }
    renderFormulas();
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
