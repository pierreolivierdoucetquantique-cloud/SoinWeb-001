// =========================================================
// PIERRE-OLIVIER — content-store.js
//
// SIMULATION FRONTEND UNIQUEMENT — stockage dans localStorage.
// Centralise le contenu éditable depuis l'admin (Services Manager,
// Pricing Manager) et lu dynamiquement par les pages publiques de
// service, pour que les modifications admin soient visibles en
// temps réel (au rechargement de la page publique).
//
// Point de branchement futur (backend réel) :
//   - Remplacer PO_Content.listServices()/updateService() par des
//     appels au Services Manager / table "services" (Supabase)
//   - Remplacer PO_Content.listFormulas()/saveFormula()/deleteFormula()
//     par des appels au Pricing Manager / table "pricing"
// =========================================================

const PO_Content = (() => {
  const SERVICES_KEY = 'po_demo_services';
  const FORMULAS_KEY = 'po_demo_formulas';
  const SITE_CONTENT_KEY = 'po_demo_site_content';

  function _read(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
      return null;
    }
  }

  function _write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ----- SEED: contenu identique à ce qui était codé en dur dans les pages publiques -----
  function _seed() {
    if (!_read(SERVICES_KEY)) {
      _write(SERVICES_KEY, [
        {
          id: 'services-energetiques',
          name: 'Soins Énergétiques',
          tagline: "Un rééquilibrage en douceur des champs subtils du corps, pour libérer ce qui est figé et retrouver une circulation fluide de votre énergie vitale.",
          rune: '🜃',
          accent: 'terre'
        },
        {
          id: 'soins-direct',
          name: 'Soins Direct',
          tagline: "Une séance en présence, ancrée et immédiate, pour traiter ce qui demande une attention concrète, ici et maintenant.",
          rune: '🜂',
          accent: 'feu'
        },
        {
          id: 'accompagnement',
          name: 'Accompagnement 1:1',
          tagline: "Un chemin suivi dans le temps, à votre rythme, pour intégrer durablement les transformations engagées.",
          rune: '🜄',
          accent: 'ether'
        }
      ]);
    }

    if (!_read(FORMULAS_KEY)) {
      _write(FORMULAS_KEY, [
        // Soins Énergétiques
        { id: 'f_se_1', serviceId: 'services-energetiques', title: 'Séance découverte', price: 60, duration: '45 min', description: 'Une première séance pour ressentir le soin et identifier vos besoins prioritaires.', featured: false, order: 1 },
        { id: 'f_se_2', serviceId: 'services-energetiques', title: 'Séance complète', price: 90, duration: '75 min', description: 'Le format recommandé pour un travail en profondeur sur les blocages identifiés.', featured: true, order: 2 },
        { id: 'f_se_3', serviceId: 'services-energetiques', title: 'Forfait 3 séances', price: 240, duration: '3×75 min', description: 'Pour un suivi rapproché, avec un espacement adapté entre chaque rendez-vous.', featured: false, order: 3 },
        // Soins Direct
        { id: 'f_sd_1', serviceId: 'soins-direct', title: 'Séance ciblée', price: 70, duration: '45 min', description: 'Pour une situation précise et localisée demandant une attention immédiate.', featured: false, order: 1 },
        { id: 'f_sd_2', serviceId: 'soins-direct', title: 'Séance complète', price: 100, duration: '75 min', description: "Le format recommandé pour traiter en profondeur ce qui se présente aujourd'hui.", featured: true, order: 2 },
        { id: 'f_sd_3', serviceId: 'soins-direct', title: "Séance d'urgence", price: 120, duration: '60 min', description: 'Une disponibilité rapide lorsque la situation demande un accompagnement sans délai.', featured: false, order: 3 },
        // Accompagnement 1:1
        { id: 'f_ac_1', serviceId: 'accompagnement', title: 'Séance de cadrage', price: 80, duration: '60 min', description: 'Le premier rendez-vous, pour poser les bases de votre accompagnement personnalisé.', featured: false, order: 1 },
        { id: 'f_ac_2', serviceId: 'accompagnement', title: 'Suivi sur 3 mois', price: 450, duration: '6 séances', description: 'Un rythme bimensuel pour ancrer durablement votre transformation sur le moyen terme.', featured: true, order: 2 },
        { id: 'f_ac_3', serviceId: 'accompagnement', title: 'Suivi sur 6 mois', price: 800, duration: '12 séances', description: 'Pour un cheminement long, avec un accompagnement continu et un suivi approfondi.', featured: false, order: 3 }
      ]);
    }

    if (!_read(SITE_CONTENT_KEY)) {
      _write(SITE_CONTENT_KEY, {
        threshold: {
          eyebrow: "Avant d'entrer",
          title: 'Lieu Sacré',
          text: "En entrant ici vous acceptez de respecter ce lieu, les membres, d'être à l'écoute de vous-même, d'agir avec bienveillance et authenticité."
        },
        servicesIntro: {
          eyebrow: 'Au service du vivant, en harmonie avec le tout',
          title: "Trois voies d'accompagnement"
        },
        serviceCards: {
          'services-energetiques': {
            cardTitle: 'Soins Énergétiques',
            cardDescription: 'Rééquilibrage des champs subtils, libération des blocages et reconnexion à votre vitalité naturelle.'
          },
          'soins-direct': {
            cardTitle: 'Soins Direct',
            cardDescription: 'Une séance en présence, ancrée et immédiate, pour traiter ce qui demande une attention concrète.'
          },
          'accompagnement': {
            cardTitle: 'Accompagnement 1:1',
            cardDescription: 'Un chemin suivi dans le temps, à votre rythme, pour intégrer durablement les transformations.'
          }
        }
      });
    }
  }
  _seed();

  // ----- SERVICES -----

  function listServices() {
    return _read(SERVICES_KEY) || [];
  }

  function getService(id) {
    return listServices().find(s => s.id === id) || null;
  }

  function updateService(id, patch) {
    const services = listServices();
    const idx = services.findIndex(s => s.id === id);
    if (idx === -1) return { ok: false, error: 'Service introuvable.' };
    services[idx] = { ...services[idx], ...patch };
    _write(SERVICES_KEY, services);
    return { ok: true, service: services[idx] };
  }

  // ----- FORMULAS (Pricing Manager) -----

  function listFormulas() {
    return _read(FORMULAS_KEY) || [];
  }

  function listFormulasForService(serviceId) {
    return listFormulas()
      .filter(f => f.serviceId === serviceId)
      .sort((a, b) => a.order - b.order);
  }

  function saveFormula(formula) {
    const formulas = listFormulas();
    let savedFormula;
    if (formula.id) {
      const idx = formulas.findIndex(f => f.id === formula.id);
      if (idx === -1) return { ok: false, error: 'Formule introuvable.' };
      formulas[idx] = { ...formulas[idx], ...formula };
      savedFormula = formulas[idx];
    } else {
      const sameService = formulas.filter(f => f.serviceId === formula.serviceId);
      formula.id = 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      formula.order = sameService.length ? Math.max(...sameService.map(f => f.order)) + 1 : 1;
      formulas.push(formula);
      savedFormula = formula;
    }
    _write(FORMULAS_KEY, formulas);
    return { ok: true, formula: savedFormula };
  }

  function deleteFormula(id) {
    const formulas = listFormulas().filter(f => f.id !== id);
    _write(FORMULAS_KEY, formulas);
    return { ok: true };
  }

  // ----- SITE CONTENT (Content Manager) -----

  function getSiteContent() {
    return _read(SITE_CONTENT_KEY) || {};
  }

  function updateThreshold(patch) {
    const content = getSiteContent();
    content.threshold = { ...content.threshold, ...patch };
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, threshold: content.threshold };
  }

  function updateServicesIntro(patch) {
    const content = getSiteContent();
    content.servicesIntro = { ...content.servicesIntro, ...patch };
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, servicesIntro: content.servicesIntro };
  }

  function updateServiceCard(serviceId, patch) {
    const content = getSiteContent();
    if (!content.serviceCards) content.serviceCards = {};
    content.serviceCards[serviceId] = { ...content.serviceCards[serviceId], ...patch };
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, card: content.serviceCards[serviceId] };
  }

  return {
    listServices, getService, updateService,
    listFormulas, listFormulasForService, saveFormula, deleteFormula,
    getSiteContent, updateThreshold, updateServicesIntro, updateServiceCard
  };
})();
