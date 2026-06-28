// =========================================================
// PIERRE-OLIVIER — interactions
// =========================================================

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
  document.querySelectorAll('.faq-item').forEach(item => {
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
            <span class="formula-card__price">${f.price}€</span>
            <span class="formula-card__duration">/ ${escapeHtmlGlobal(f.duration)}</span>
          </div>
          <p>${escapeHtmlGlobal(f.description)}</p>
          <span class="formula-card__note">Tarif d'exemple — modifiable</span>
          <a href="connexion.html?redirect=${redirectParam}" class="btn btn--accent">Réserver</a>
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
