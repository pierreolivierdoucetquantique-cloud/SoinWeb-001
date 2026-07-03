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
  const BIO_KEY = 'po_demo_bio';

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
        { id: 'f_sd_1', serviceId: 'soins-direct', title: 'Soin Direct', price: 88, duration: '60 min', description: 'Séance de soin énergétique direct, disponible immédiatement selon les disponibilités.', featured: true, order: 1 },
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

    // Seed biographie (migration douce : ne réinitialise pas si déjà existant)
    if (!_read(BIO_KEY)) {
      _write(BIO_KEY, {
        hero: {
          title: 'Mon histoire',
          subtitle: 'Guérisseur, accompagnateur du vivant, chercheur d\'âme'
        },
        photo: '',
        sections: [
          {
            id: 'section_1',
            type: 'intro',
            heading: 'Qui est Pierre-Olivier ?',
            content: "Je m'appelle Pierre-Olivier. Je suis guérisseur énergétique, accompagnateur spirituel et fondateur de Ntabou Aka Wé — ce lieu sacré que j'ai créé pour offrir à chacun·e un espace de transformation profonde.\n\nMon chemin n'a pas été linéaire. Il a été semé d'épreuves, de remises en question et d'éveils successifs qui m'ont conduit là où je suis aujourd'hui."
          },
          {
            id: 'section_2',
            type: 'text',
            heading: 'Mon parcours',
            content: "Depuis mon plus jeune âge, j'ai ressenti une connexion particulière avec le monde invisible — les énergies, les synchronicités, la présence de quelque chose de plus grand que ce que l'œil peut voir.\n\nAprès des années à explorer différentes traditions — chamanisme, médecine énergétique, psychologie transpersonnelle, soins somatiques — j'ai développé une approche qui m'est propre, tissée de tout ce que j'ai vécu et appris."
          },
          {
            id: 'section_3',
            type: 'text',
            heading: 'Les expériences qui m\'ont transformé',
            content: "Les moments les plus difficiles de ma vie ont été mes plus grands maîtres. À travers la maladie, la perte, et plusieurs périodes de désorientation profonde, j'ai appris à me tenir dans l'obscurité sans la fuir — et à en revenir transformé.\n\nCes traversées m'ont donné une compréhension viscérale de ce que vivent les personnes que j'accompagne aujourd'hui."
          },
          {
            id: 'section_4',
            type: 'quote',
            heading: '',
            content: "« Ce n'est pas en évitant nos blessures que nous guérissons, c'est en apprenant à les habiter avec présence et douceur. »"
          },
          {
            id: 'section_5',
            type: 'text',
            heading: 'Pourquoi j\'ai créé cette plateforme',
            content: "Ntabou Aka Wé est née d'un besoin profond : rendre accessible, dans un cadre sécurisant et respectueux, ce qui m'a moi-même permis de me reconstruire.\n\nJe voulais un lieu où les gens pourraient venir tels qu'ils sont — sans jugement, sans performance — et repartir avec quelque chose de réel."
          },
          {
            id: 'section_6',
            type: 'values',
            heading: 'Mes valeurs',
            content: "Authenticité · Bienveillance · Présence · Respect du rythme de chacun·e · Ancrage dans le corps · Ouverture à l'invisible"
          },
          {
            id: 'section_7',
            type: 'text',
            heading: 'Mon approche',
            content: "Mon travail est à la fois doux et direct. Je ne prétends pas avoir toutes les réponses — ce que j'offre, c'est un espace tenu avec soin, une présence attentive et des outils éprouvés pour vous aider à accéder à votre propre sagesse intérieure.\n\nChaque accompagnement est unique, adapté à ce que vous portez et à ce que vous cherchez."
          }
        ]
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

  // ===========================================================
  // CONTENT MANAGER — listes dynamiques (Étapes & FAQ)
  //
  // Permet d'ajouter, supprimer et réordonner librement les éléments de
  // ces deux listes, plutôt que d'être limité aux 3 éléments fixes d'origine.
  // Toutes les fonctions sont génériques : elles fonctionnent identiquement
  // pour "steps" et "faq" via le paramètre listKey.
  // ===========================================================

  function _getServicePageOrFail(content, serviceId) {
    if (!content.servicePages) content.servicePages = {};
    if (!content.servicePages[serviceId]) content.servicePages[serviceId] = {};
    return content.servicePages[serviceId];
  }

  function addStep(serviceId, step) {
    const content = getSiteContent();
    const page = _getServicePageOrFail(content, serviceId);
    if (!Array.isArray(page.steps)) page.steps = [];
    page.steps.push({ title: (step && step.title) || 'Nouvelle étape', text: (step && step.text) || '' });
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, steps: page.steps };
  }

  function removeStep(serviceId, index) {
    const content = getSiteContent();
    const page = _getServicePageOrFail(content, serviceId);
    if (!Array.isArray(page.steps) || !page.steps[index]) {
      return { ok: false, error: 'Étape introuvable.' };
    }
    page.steps.splice(index, 1);
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, steps: page.steps };
  }

  // direction : -1 pour monter, +1 pour descendre.
  function moveStep(serviceId, index, direction) {
    const content = getSiteContent();
    const page = _getServicePageOrFail(content, serviceId);
    const steps = page.steps;
    const target = index + direction;
    if (!Array.isArray(steps) || target < 0 || target >= steps.length) {
      return { ok: false, error: 'Déplacement impossible.' };
    }
    [steps[index], steps[target]] = [steps[target], steps[index]];
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, steps };
  }

  function addFaqItem(serviceId, faq) {
    const content = getSiteContent();
    const page = _getServicePageOrFail(content, serviceId);
    if (!Array.isArray(page.faq)) page.faq = [];
    page.faq.push({ question: (faq && faq.question) || 'Nouvelle question', answer: (faq && faq.answer) || '' });
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, faq: page.faq };
  }

  function removeFaqItem(serviceId, index) {
    const content = getSiteContent();
    const page = _getServicePageOrFail(content, serviceId);
    if (!Array.isArray(page.faq) || !page.faq[index]) {
      return { ok: false, error: 'Question introuvable.' };
    }
    page.faq.splice(index, 1);
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, faq: page.faq };
  }

  function moveFaqItem(serviceId, index, direction) {
    const content = getSiteContent();
    const page = _getServicePageOrFail(content, serviceId);
    const faq = page.faq;
    const target = index + direction;
    if (!Array.isArray(faq) || target < 0 || target >= faq.length) {
      return { ok: false, error: 'Déplacement impossible.' };
    }
    [faq[index], faq[target]] = [faq[target], faq[index]];
    _write(SITE_CONTENT_KEY, content);
    return { ok: true, faq };
  }

  // ----- BIOGRAPHIE -----
  function getBio() {
    return _read(BIO_KEY) || {};
  }

  function updateBioHero(data) {
    const bio = getBio();
    bio.hero = Object.assign({}, bio.hero, data);
    _write(BIO_KEY, bio);
    return { ok: true, hero: bio.hero };
  }

  function updateBioPhoto(photoDataUrl) {
    const bio = getBio();
    bio.photo = photoDataUrl || '';
    _write(BIO_KEY, bio);
    return { ok: true };
  }

  function addBioSection(type) {
    const bio = getBio();
    if (!Array.isArray(bio.sections)) bio.sections = [];
    const id = 'section_' + Date.now();
    const defaults = {
      intro: { heading: 'Nouvelle introduction', content: '' },
      text:  { heading: 'Nouvelle section', content: '' },
      quote: { heading: '', content: '« … »' },
      values:{ heading: 'Valeurs', content: '' },
      image: { heading: '', content: '', imageUrl: '' }
    };
    bio.sections.push({ id, type: type || 'text', ...(defaults[type] || defaults.text) });
    _write(BIO_KEY, bio);
    return { ok: true, sections: bio.sections };
  }

  function updateBioSection(id, data) {
    const bio = getBio();
    const idx = (bio.sections || []).findIndex(s => s.id === id);
    if (idx === -1) return { ok: false, error: 'Section introuvable.' };
    bio.sections[idx] = Object.assign({}, bio.sections[idx], data);
    _write(BIO_KEY, bio);
    return { ok: true, section: bio.sections[idx] };
  }

  function removeBioSection(id) {
    const bio = getBio();
    const before = (bio.sections || []).length;
    bio.sections = (bio.sections || []).filter(s => s.id !== id);
    if (bio.sections.length === before) return { ok: false, error: 'Section introuvable.' };
    _write(BIO_KEY, bio);
    return { ok: true };
  }

  function moveBioSection(id, direction) {
    const bio = getBio();
    const sections = bio.sections || [];
    const idx = sections.findIndex(s => s.id === id);
    const target = idx + direction;
    if (idx === -1 || target < 0 || target >= sections.length) return { ok: false, error: 'Déplacement impossible.' };
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    _write(BIO_KEY, bio);
    return { ok: true, sections };
  }

  // =========================================================
  // TEMPLATES EMAIL
  // =========================================================
  const EMAIL_TEMPLATES_KEY = 'po_cms_email_templates';

  const _defaultEmailTemplates = () => ({
    layout: {
      logoUrl: '',
      primaryColor: '#4a2563',
      accentColor: '#c9a54b',
      fontFamily: 'Georgia, serif',
      headerBg: '#100c14',
      bodyBg: '#ffffff',
      textColor: '#1a1320',
      footerText: 'Ntabou Aka Wé · Au service du vivant, en harmonie avec le tout.',
      signature: 'Pierre-Olivier\nNtabou Aka Wé'
    },
    templates: {
      appointment_confirmation: {
        label: 'Confirmation de rendez-vous',
        enabled: true,
        subject: 'Confirmation de votre rendez-vous — {{service}}',
        body: 'Bonjour {{first_name}},\n\nVotre rendez-vous pour le service «\u00a0{{service}}\u00a0» est confirmé.\n\nDate\u00a0: {{appointment_date}}\nHeure\u00a0: {{appointment_time}}\nDurée\u00a0: {{duration}}\n\nNous avons hâte de vous accueillir.\n\n{{signature}}'
      },
      appointment_reminder: {
        label: 'Rappel de rendez-vous',
        enabled: true,
        delayHours: 24,
        subject: 'Rappel — Votre rendez-vous {{service}} demain',
        body: 'Bonjour {{first_name}},\n\nVotre rendez-vous «\u00a0{{service}}\u00a0» approche\u00a0!\n\nDate\u00a0: {{appointment_date}}\nHeure\u00a0: {{appointment_time}}\n\nSi vous devez annuler ou modifier votre rendez-vous, veuillez nous contacter à l\'avance.\n\n{{signature}}'
      },
      appointment_cancelled: {
        label: 'Annulation de rendez-vous',
        enabled: true,
        subject: 'Annulation de votre rendez-vous',
        body: 'Bonjour {{first_name}},\n\nVotre rendez-vous «\u00a0{{service}}\u00a0» prévu le {{appointment_date}} à {{appointment_time}} a été annulé.\n\nN\'hésitez pas à prendre un nouveau rendez-vous depuis votre espace client.\n\n{{signature}}'
      },
      payment_received_interac: {
        label: 'Paiement Interac reçu',
        enabled: true,
        subject: 'Paiement reçu — {{service}}',
        body: 'Bonjour {{first_name}},\n\nNous avons bien reçu votre virement Interac de {{amount}} pour le service «\u00a0{{service}}\u00a0».\n\nVotre rendez-vous sera confirmé dès vérification.\nRéférence\u00a0: {{invoice_number}}\n\n{{signature}}'
      },
      payment_received_stripe: {
        label: 'Paiement carte reçu',
        enabled: true,
        subject: 'Paiement confirmé — {{service}}',
        body: 'Bonjour {{first_name}},\n\nVotre paiement de {{amount}} pour «\u00a0{{service}}\u00a0» a été traité avec succès.\n\nRéférence\u00a0: {{invoice_number}}\nMéthode\u00a0: Carte de crédit\n\nMerci de votre confiance.\n\n{{signature}}'
      },
      payment_failed: {
        label: 'Échec de paiement',
        enabled: true,
        subject: 'Problème avec votre paiement',
        body: 'Bonjour {{first_name}},\n\nNous n\'avons pas pu traiter votre paiement pour «\u00a0{{service}}\u00a0».\n\nVeuillez réessayer depuis votre espace client ou nous contacter.\n\n{{signature}}'
      },
      registration: {
        label: 'Création de compte',
        enabled: true,
        subject: 'Bienvenue sur Ntabou Aka Wé, {{first_name}}\u00a0!',
        body: 'Bonjour {{first_name}},\n\nVotre compte a été créé avec succès sur Ntabou Aka Wé.\n\nVous pouvez dès maintenant accéder à votre espace personnel et réserver vos soins.\n\nÀ bientôt,\n{{signature}}'
      },
      appointment_declined: {
        label: 'Rendez-vous refusé',
        enabled: true,
        subject: 'Votre demande de rendez-vous n\'a pas pu être confirmée',
        body: 'Bonjour {{first_name}},\n\nVotre demande de rendez-vous pour «\u00a0{{service}}\u00a0» du {{appointment_date}} à {{appointment_time}} n\'a malheureusement pas pu être confirmée.\n\nVeuillez choisir un autre créneau depuis votre espace client.\n\n{{signature}}'
      },
      appointment_rescheduled: {
        label: 'Rendez-vous replanifié',
        enabled: true,
        subject: 'Votre rendez-vous a été replanifié — {{service}}',
        body: 'Bonjour {{first_name}},\n\nVotre rendez-vous pour «\u00a0{{service}}\u00a0» a été déplacé au {{appointment_date}} à {{appointment_time}}.\n\nMerci de confirmer ce nouveau créneau dans votre espace client.\n\n{{signature}}'
      },
      care_session_summary: {
        label: 'Résumé de séance Soin Interactif',
        enabled: true,
        subject: 'Résumé de votre Soin Direct',
        body: 'Bonjour {{first_name}},\n\nVotre séance Soin Direct est terminée. Voici votre résumé.\n\nDurée\u00a0: {{duration}} minutes\n\nPrenez le temps d\'intégrer cette expérience dans les 11 prochains jours.\n\n{{signature}}'
      }
    }
  });

  function getEmailTemplates() {
    const stored = _read(EMAIL_TEMPLATES_KEY);
    if (stored) return stored;
    const defaults = _defaultEmailTemplates();
    _write(EMAIL_TEMPLATES_KEY, defaults);
    return defaults;
  }

  function updateEmailLayout(data) {
    const t = getEmailTemplates();
    t.layout = Object.assign({}, t.layout, data);
    _write(EMAIL_TEMPLATES_KEY, t);
    return { ok: true, layout: t.layout };
  }

  function updateEmailTemplate(key, data) {
    const t = getEmailTemplates();
    if (!t.templates[key]) return { ok: false, error: 'Template introuvable.' };
    t.templates[key] = Object.assign({}, t.templates[key], data);
    _write(EMAIL_TEMPLATES_KEY, t);
    return { ok: true, template: t.templates[key] };
  }

  // Résout les variables {{var}} dans un template avec un objet de données
  function renderEmailTemplate(key, vars) {
    const t = getEmailTemplates();
    const tpl = t.templates[key];
    if (!tpl) return null;
    const layout = t.layout;
    const allVars = Object.assign({ signature: layout.signature, company_name: 'Ntabou Aka Wé' }, vars);
    const resolve = (str) => (str || '').replace(/\{\{(\w+)\}\}/g, (_, k) => allVars[k] !== undefined ? allVars[k] : `{{${k}}}`);
    return {
      subject: resolve(tpl.subject),
      body: resolve(tpl.body),
      layout,
      enabled: tpl.enabled
    };
  }

  // =========================================================
  // AUTOMATISATIONS
  // =========================================================
  const AUTOMATIONS_KEY = 'po_cms_automations';

  const _defaultAutomations = () => ({
    appointment_created: { label: 'Rendez-vous créé', enabled: true, emailTemplate: 'appointment_confirmation', delayMinutes: 0, recipients: ['client', 'admin'] },
    appointment_confirmed: { label: 'Rendez-vous confirmé', enabled: true, emailTemplate: 'appointment_confirmation', delayMinutes: 0, recipients: ['client'] },
    appointment_cancelled: { label: 'Rendez-vous annulé', enabled: true, emailTemplate: 'appointment_cancelled', delayMinutes: 0, recipients: ['client'] },
    appointment_reminder_24h: { label: 'Rappel 24h avant', enabled: true, emailTemplate: 'appointment_reminder', delayMinutes: -1440, recipients: ['client'] },
    appointment_reminder_2h: { label: 'Rappel 2h avant', enabled: true, emailTemplate: 'appointment_reminder', delayMinutes: -120, recipients: ['client'] },
    appointment_declined: { label: 'Rendez-vous refusé', enabled: true, emailTemplate: 'appointment_declined', delayMinutes: 0, recipients: ['client'] },
    appointment_rescheduled: { label: 'Rendez-vous replanifié', enabled: true, emailTemplate: 'appointment_rescheduled', delayMinutes: 0, recipients: ['client'] },
    payment_interac: { label: 'Paiement Interac signalé', enabled: true, emailTemplate: 'payment_received_interac', delayMinutes: 0, recipients: ['client', 'admin'] },
    payment_stripe: { label: 'Paiement carte confirmé', enabled: true, emailTemplate: 'payment_received_stripe', delayMinutes: 0, recipients: ['client', 'admin'] },
    payment_failed: { label: 'Échec de paiement', enabled: true, emailTemplate: 'payment_failed', delayMinutes: 0, recipients: ['client'] },
    registration: { label: 'Création de compte client', enabled: true, emailTemplate: 'registration', delayMinutes: 0, recipients: ['client'] },
    care_completed: { label: 'Séance Soin Direct terminée', enabled: true, emailTemplate: 'care_session_summary', delayMinutes: 5, recipients: ['client'] }
  });

  function getAutomations() {
    const stored = _read(AUTOMATIONS_KEY);
    if (stored) return stored;
    const defaults = _defaultAutomations();
    _write(AUTOMATIONS_KEY, defaults);
    return defaults;
  }

  function updateAutomation(key, data) {
    const a = getAutomations();
    if (!a[key]) return { ok: false, error: 'Automatisation introuvable.' };
    a[key] = Object.assign({}, a[key], data);
    _write(AUTOMATIONS_KEY, a);
    return { ok: true, automation: a[key] };
  }

  // =========================================================
  // PARAMÈTRES DU SITE
  // =========================================================
  const SITE_SETTINGS_KEY = 'po_cms_site_settings';

  const _defaultSiteSettings = () => ({
    brand: {
      siteName: 'Ntabou Aka Wé',
      tagline: 'Au service du vivant, en harmonie avec le tout.',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#4a2563',
      accentColor: '#c9a54b',
      bgColor: '#0A0A0A'
    },
    contact: {
      email: 'pierreolivierdoucet.quantique@gmail.com',
      phone: '',
      address: '',
      city: 'Québec',
      province: 'Québec',
      country: 'Canada'
    },
    social: {
      facebook: '',
      instagram: '',
      youtube: '',
      tiktok: '',
      linkedin: ''
    },
    seo: {
      metaTitle: 'Ntabou Aka Wé — Soins Énergétiques',
      metaDescription: 'Accompagnement énergétique personnalisé avec Pierre-Olivier. Soins Énergétiques, Accompagnement 1:1, Soin Direct.',
      ogImage: ''
    },
    business: {
      timezone: 'America/Toronto',
      currency: 'CAD',
      bookingCancellationHours: 24,
      maxBookingsPerDay: 5,
      depositPercent: 40
    }
  });

  function getSiteSettings() {
    const stored = _read(SITE_SETTINGS_KEY);
    if (stored) {
      // Migration douce
      if (!stored.seo) stored.seo = _defaultSiteSettings().seo;
      if (!stored.business) stored.business = _defaultSiteSettings().business;
      return stored;
    }
    const defaults = _defaultSiteSettings();
    _write(SITE_SETTINGS_KEY, defaults);
    return defaults;
  }

  function updateSiteSettings(section, data) {
    const s = getSiteSettings();
    if (!s[section]) return { ok: false, error: 'Section introuvable.' };
    s[section] = Object.assign({}, s[section], data);
    _write(SITE_SETTINGS_KEY, s);
    return { ok: true, settings: s[section] };
  }

  // =========================================================
  // MÉDIATHÈQUE
  // =========================================================
  const MEDIA_KEY = 'po_cms_media';

  function getMedia() {
    return _read(MEDIA_KEY) || [];
  }

  function uploadMedia(data) {
    const list = getMedia();
    const item = {
      id: 'media_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
      name: data.name || 'image',
      type: data.type || 'image',
      url: data.url || '',       // dataUrl base64
      alt: data.alt || '',
      folder: data.folder || 'general',
      size: data.size || 0,
      createdAt: new Date().toISOString()
    };
    list.push(item);
    _write(MEDIA_KEY, list);
    return { ok: true, media: item };
  }

  function updateMedia(id, data) {
    const list = getMedia();
    const idx = list.findIndex(m => m.id === id);
    if (idx === -1) return { ok: false, error: 'Fichier introuvable.' };
    list[idx] = Object.assign({}, list[idx], data);
    _write(MEDIA_KEY, list);
    return { ok: true, media: list[idx] };
  }

  function deleteMedia(id) {
    const list = getMedia();
    const filtered = list.filter(m => m.id !== id);
    if (filtered.length === list.length) return { ok: false, error: 'Fichier introuvable.' };
    _write(MEDIA_KEY, filtered);
    return { ok: true };
  }

  // =========================================================
  // JOURNAL D'AUDIT
  // =========================================================
  const AUDIT_KEY = 'po_cms_audit_log';
  const MAX_AUDIT_ENTRIES = 500;

  function logAudit(action, module, oldValue, newValue) {
    const log = _read(AUDIT_KEY) || [];
    log.unshift({
      id: 'audit_' + Date.now(),
      action: action || 'update',
      module: module || 'inconnu',
      oldValue: oldValue !== undefined ? JSON.stringify(oldValue).slice(0, 200) : '',
      newValue: newValue !== undefined ? JSON.stringify(newValue).slice(0, 200) : '',
      adminId: 'admin',
      timestamp: new Date().toISOString()
    });
    if (log.length > MAX_AUDIT_ENTRIES) log.splice(MAX_AUDIT_ENTRIES);
    _write(AUDIT_KEY, log);
    return { ok: true };
  }

  function getAuditLog(limit) {
    const log = _read(AUDIT_KEY) || [];
    return limit ? log.slice(0, limit) : log;
  }

  function clearAuditLog() {
    _write(AUDIT_KEY, []);
    return { ok: true };
  }

  return {
    listServices, getService, updateService,
    listFormulas, listFormulasForService, saveFormula, deleteFormula,
    getSiteContent, updateThreshold, updateServicesIntro, updateServiceCard,
    updateBrand, updateSharedLabels,
    getServicePageContent, updateServicePageContent, updateServiceStep, updateServiceFaq,
    addStep, removeStep, moveStep,
    addFaqItem, removeFaqItem, moveFaqItem,
    getBio, updateBioHero, updateBioPhoto, addBioSection, updateBioSection, removeBioSection, moveBioSection,
    // Email templates
    getEmailTemplates, updateEmailLayout, updateEmailTemplate, renderEmailTemplate,
    // Automatisations
    getAutomations, updateAutomation,
    // Paramètres du site
    getSiteSettings, updateSiteSettings,
    // Médiathèque
    getMedia, uploadMedia, updateMedia, deleteMedia,
    // Journal d'audit
    logAudit, getAuditLog, clearAuditLog
  };
})();
