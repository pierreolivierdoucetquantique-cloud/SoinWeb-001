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
        brand: {
          homeTagline: 'Bienvenue dans mon univers'
        },
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
        },
        // Libellés partagés par les 3 pages de service (identiques partout,
        // donc réglés une seule fois plutôt que dupliqués 3 fois).
        sharedLabels: {
          formulesEyebrow: 'Formules',
          formulesTitle: 'Choisissez votre accompagnement',
          faqEyebrow: 'Questions fréquentes',
          faqTitle: 'Avant de réserver'
        },
        // Contenu détaillé propre à chaque page de service.
        servicePages: {
          'services-energetiques': {
            intro: "Le soin énergétique s'adresse à votre corps subtil — cette dimension de vous qui ne se voit pas mais se ressent : tensions persistantes, fatigue diffuse, sentiment d'être « encombré » sans cause apparente. La séance se déroule à distance ou en présence, dans le respect de votre rythme et de ce qui est prêt à se libérer en vous.",
            stepsEyebrow: 'Comment se déroule la séance',
            stepsTitle: 'Trois temps simples',
            steps: [
              { title: 'Accueil & intention', text: "Un échange bref pour poser votre intention et ce qui vous amène à consulter aujourd'hui." },
              { title: 'Le soin', text: 'Vous vous installez confortablement ; le travail énergétique se fait en silence, à votre écoute.' },
              { title: 'Retour & intégration', text: "Un temps d'échange pour nommer ce qui s'est passé et accompagner l'intégration les jours suivants." }
            ],
            ctaTitle: 'Prêt·e à libérer ce qui est figé ?',
            ctaText: 'Connectez-vous pour choisir un créneau dans le calendrier en temps réel.',
            ctaButtonLabel: 'Prendre rendez-vous',
            faq: [
              { question: 'Le soin se fait-il à distance ou en présence ?', answer: "Les deux sont possibles selon la formule choisie et vos préférences. L'efficacité du soin énergétique n'est pas liée à la distance physique." },
              { question: 'Que puis-je ressentir pendant la séance ?', answer: "Les ressentis varient d'une personne à l'autre : chaleur, picotements, relâchement, parfois rien de perceptible sur l'instant. Chaque expérience est valable." },
              { question: 'Combien de séances sont nécessaires ?', answer: 'Cela dépend de votre situation. Une séance découverte permet déjà d\'évaluer ensemble le rythme le plus adapté à vos besoins.' }
            ]
          },
          'soins-direct': {
            intro: "Contrairement au travail énergétique à distance, le soin direct se pratique en votre présence. C'est une approche concrète et incarnée, pour les situations qui demandent un accompagnement immédiat : douleur localisée, tension physique, besoin d'un appui rapide avant un moment important de votre vie.",
            stepsEyebrow: 'Comment se déroule la séance',
            stepsTitle: 'Trois temps simples',
            steps: [
              { title: 'Échange initial', text: 'Vous exprimez ce qui vous amène ; ensemble, on cible précisément la zone ou la situation à traiter.' },
              { title: 'Le soin en présence', text: 'Un travail direct et concret, adapté à votre besoin du moment, en pleine conscience de votre confort.' },
              { title: 'Conseils de suivi', text: 'Des recommandations simples pour prolonger les effets de la séance dans les jours qui suivent.' }
            ],
            ctaTitle: "Une attention concrète, dès aujourd'hui",
            ctaText: 'Connectez-vous pour choisir un créneau dans le calendrier en temps réel.',
            ctaButtonLabel: 'Prendre rendez-vous',
            faq: [
              { question: 'En quoi le soin direct diffère-t-il du soin énergétique ?', answer: 'Le soin direct se pratique exclusivement en présence et cible une problématique concrète et immédiate, plutôt qu\'un travail plus large sur les champs subtils.' },
              { question: 'Faut-il préparer quelque chose avant la séance ?', answer: 'Non, il suffit de venir tel que vous êtes. Portez simplement une tenue confortable.' },
              { question: 'Où se déroulent les séances ?', answer: "L'adresse exacte vous est communiquée après confirmation de votre rendez-vous depuis votre espace client." }
            ]
          },
          'accompagnement': {
            intro: "Certaines transformations ne se jouent pas en une séance isolée, mais dans la continuité d'une relation de confiance suivie dans le temps. L'accompagnement 1:1 propose un espace régulier, entièrement dédié à votre cheminement, où chaque rendez-vous s'appuie sur le précédent pour construire une progression cohérente.",
            stepsEyebrow: "Comment se déroule l'accompagnement",
            stepsTitle: 'Trois temps simples',
            steps: [
              { title: 'Séance de cadrage', text: 'On clarifie ensemble votre intention profonde et on définit le rythme de suivi le plus adapté.' },
              { title: 'Suivi régulier', text: "Des rendez-vous espacés dans le temps, chacun prenant appui sur les avancées du précédent." },
              { title: 'Bilan & ajustement', text: "Des points d'étape réguliers pour ajuster l'accompagnement à votre évolution réelle." }
            ],
            ctaTitle: 'Engagez un chemin suivi dans le temps',
            ctaText: 'Connectez-vous pour planifier votre première séance de cadrage.',
            ctaButtonLabel: 'Prendre rendez-vous',
            faq: [
              { question: 'Quel est le rythme idéal entre les séances ?', answer: 'Cela se définit ensemble lors de la séance de cadrage, généralement entre deux et quatre semaines selon votre cheminement.' },
              { question: 'Puis-je arrêter le suivi en cours de route ?', answer: "Oui, l'accompagnement reste toujours à votre rythme et vous pouvez l'interrompre librement depuis votre espace client." },
              { question: 'Les séances de suivi se font-elles à distance ?', answer: 'Oui, la plupart des rendez-vous de suivi peuvent se faire à distance, selon ce qui vous convient le mieux.' }
            ]
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

  function updateBrand(patch) {
    const content = getSiteContent();
    content.brand = { ...content.brand, ...patch };
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, brand: content.brand };
  }

  function updateSharedLabels(patch) {
    const content = getSiteContent();
    content.sharedLabels = { ...content.sharedLabels, ...patch };
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, sharedLabels: content.sharedLabels };
  }

  function getServicePageContent(serviceId) {
    const content = getSiteContent();
    return (content.servicePages && content.servicePages[serviceId]) || null;
  }

  function updateServicePageContent(serviceId, patch) {
    const content = getSiteContent();
    if (!content.servicePages) content.servicePages = {};
    content.servicePages[serviceId] = { ...content.servicePages[serviceId], ...patch };
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, page: content.servicePages[serviceId] };
  }

  // Met à jour un step (étape "Comment se déroule") par index (0, 1 ou 2).
  function updateServiceStep(serviceId, index, patch) {
    const content = getSiteContent();
    if (!content.servicePages || !content.servicePages[serviceId]) {
      return { ok: false, error: 'Page de service introuvable.' };
    }
    const page = content.servicePages[serviceId];
    if (!page.steps || !page.steps[index]) {
      return { ok: false, error: 'Étape introuvable.' };
    }
    page.steps[index] = { ...page.steps[index], ...patch };
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, step: page.steps[index] };
  }

  // Met à jour une question FAQ par index (0, 1 ou 2).
  function updateServiceFaq(serviceId, index, patch) {
    const content = getSiteContent();
    if (!content.servicePages || !content.servicePages[serviceId]) {
      return { ok: false, error: 'Page de service introuvable.' };
    }
    const page = content.servicePages[serviceId];
    if (!page.faq || !page.faq[index]) {
      return { ok: false, error: 'Question introuvable.' };
    }
    page.faq[index] = { ...page.faq[index], ...patch };
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, faq: page.faq[index] };
  }

  return {
    listServices, getService, updateService,
    listFormulas, listFormulasForService, saveFormula, deleteFormula,
    getSiteContent, updateThreshold, updateServicesIntro, updateServiceCard,
    updateBrand, updateSharedLabels,
    getServicePageContent, updateServicePageContent, updateServiceStep, updateServiceFaq
  };
})();
