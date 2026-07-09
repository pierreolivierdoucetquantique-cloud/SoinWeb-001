// =========================================================
// PIERRE-OLIVIER — content-store.js
//
// Contenu éditable depuis l'admin (Services, Contenu, Bio, Templates
// Email, Automatisations, Paramètres, Médiathèque, Journal d'audit) —
// backend réel (server/content-routes.js, table site_content). Cache
// local en mémoire alimenté par le serveur au chargement de chaque page
// (voir refreshContent()/refreshFormulas()) ; les écritures persistent
// vers le serveur en arrière-plan, comme pour les tarifs (voir plus bas).
// =========================================================

const PO_Content = (() => {
  const SERVICES_KEY = 'po_demo_services';
  const SITE_CONTENT_KEY = 'po_demo_site_content';
  const BIO_KEY = 'po_demo_bio';

  // ----- CACHE + RÉSEAU (server/content-routes.js) -----
  // Même pattern que les formules (voir plus bas) : lecture synchrone du
  // cache local, écriture qui met à jour le cache immédiatement puis
  // persiste vers le serveur en arrière-plan. Tant que refreshContent()
  // n'a pas encore résolu une première fois, on ne pousse rien vers le
  // serveur (évite d'écraser des données réelles par des valeurs par
  // défaut avant que le premier chargement n'ait eu lieu).
  let _contentCache = {};
  let _contentLoaded = false;
  let _contentLoadPromise = null;

  function _read(key) {
    return _contentCache[key] !== undefined ? _contentCache[key] : null;
  }

  function _write(key, value) {
    _contentCache[key] = value;
    if (!_contentLoaded) return;
    PO_Api.put(`/api/admin/content/${encodeURIComponent(key)}`, { value }).then(res => {
      if (!res.ok) console.warn(`[PO_Content] Échec de sauvegarde serveur pour "${key}" :`, res.error);
    });
  }

  // ----- Valeurs par défaut (identiques à ce qui était codé en dur dans
  // les pages publiques), utilisées uniquement pour amorcer le serveur au
  // tout premier chargement — jamais pour écraser du contenu déjà réel. -----
  function _defaultServices() {
    return [
      {
        id: 'services-energetiques',
        name: 'Soins Énergétiques',
        tagline: "Un rééquilibrage en douceur des champs subtils du corps, pour libérer ce qui est figé et retrouver une circulation fluide de votre énergie vitale.",
        rune: '🜃',
        accent: 'terre'
      },
      {
        id: 'accompagnement',
        name: 'Accompagnement 1:1',
        tagline: "Un chemin suivi dans le temps, à votre rythme, pour intégrer durablement les transformations engagées.",
        rune: '🜄',
        accent: 'ether'
      }
    ];
  }

  function _defaultSiteContent() {
    return {
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
          intro: "Le soin énergétique vise à harmoniser les différents plans de votre être afin de favoriser une meilleure circulation de votre énergie vitale. Il accompagne les personnes qui ressentent une fatigue persistante, des blocages émotionnels, un déséquilibre intérieur ou le besoin de retrouver un état de mieux-être.\n\nChaque accompagnement est personnalisé et respecte votre rythme, vos besoins ainsi que le processus qui vous est propre.",
          steps: [
            {
              eyebrow: 'Avant le soin',
              title: 'Une rencontre préparatoire avant le soin',
              type: 'text',
              intro: '',
              text: "Le rendez-vous réservé dans le calendrier ne correspond pas au soin énergétique lui-même.\n\nIl s'agit d'une rencontre préparatoire d'une durée de 30 minutes, réalisée afin de faire connaissance, d'échanger sur votre situation actuelle, de répondre à vos questions et de déterminer les objectifs de votre accompagnement.\n\nCette rencontre permet également de vous expliquer le déroulement complet du processus, les recommandations à suivre avant et après le soin ainsi que les informations importantes à connaître afin que celui-ci se déroule dans les meilleures conditions.\n\nÀ la suite de cette rencontre préparatoire, la date et la période du soin énergétique vous seront communiquées personnellement, en fonction des besoins observés et de la planification établie.",
              outro: ''
            },
            {
              eyebrow: 'Comment se déroule la séance',
              title: 'Déroulement du soin énergétique',
              type: 'text',
              intro: '',
              text: "Les soins énergétiques sont réalisés durant la nuit, pendant votre période naturelle de sommeil.\n\nCet horaire est volontaire et fait partie intégrante de l'approche proposée. Pendant le repos, le corps et l'esprit sont généralement plus réceptifs au processus énergétique, favorisant un état de détente propice au travail effectué.\n\nVous n'avez donc aucune action particulière à réaliser au moment du soin, sinon de respecter les recommandations qui vous auront été transmises lors de la rencontre préparatoire.",
              outro: ''
            },
            {
              eyebrow: 'Intégration',
              title: 'Après le soin',
              type: 'text',
              intro: '',
              text: "À la suite du soin énergétique, une période d'intégration peut être observée. Chaque personne réagit différemment selon son vécu et son propre processus.\n\nAu besoin, un suivi pourra être proposé afin de répondre à vos questions et de vous accompagner dans l'intégration de votre expérience.",
              outro: ''
            }
          ],
          ctaTitle: 'Réservez votre rencontre préparatoire',
          ctaText: "Connectez-vous à votre espace client afin de réserver votre rencontre préparatoire de 30 minutes à l'aide du calendrier en temps réel.",
          ctaButtonLabel: 'Prendre rendez-vous',
          faq: [
            { question: 'Le soin se fait-il à distance ou en présence ?', answer: "Les deux sont possibles selon la formule choisie et vos préférences. L'efficacité du soin énergétique n'est pas liée à la distance physique." },
            { question: 'Que puis-je ressentir pendant la séance ?', answer: "Les ressentis varient d'une personne à l'autre : chaleur, picotements, relâchement, parfois rien de perceptible sur l'instant. Chaque expérience est valable." },
            { question: 'Combien de séances sont nécessaires ?', answer: 'Cela dépend de votre situation. Une séance découverte permet déjà d\'évaluer ensemble le rythme le plus adapté à vos besoins.' }
          ]
        },
        'accompagnement': {
          intro: "Certaines transformations ne se vivent pas en une seule rencontre. Elles demandent du temps, de l'écoute, des prises de conscience et un accompagnement adapté à votre réalité.\n\nL'accompagnement 1:1 est un espace entièrement consacré à votre cheminement personnel. Il s'agit d'une rencontre privilégiée où vous pouvez vous exprimer librement, poser vos questions, partager vos expériences et recevoir un accompagnement personnalisé dans un climat de confiance, de respect et de bienveillance.\n\nJ'ai choisi d'offrir ce service parce que je constate que de plus en plus de personnes vivent un éveil de conscience ou traversent une période de transformation profonde. Ces changements peuvent parfois être déstabilisants et s'accompagner d'un sentiment de solitude, d'incompréhension ou de perte de repères. Il devient alors précieux d'avoir quelqu'un avec qui échanger afin de retrouver de la clarté et poursuivre son chemin avec davantage de confiance.",
          steps: [
            {
              eyebrow: 'Ce que cet espace peut vous offrir',
              title: 'À quoi peut servir cet accompagnement ?',
              type: 'list',
              intro: 'Chaque personne arrive avec son propre vécu et ses propres besoins. Cet espace peut notamment vous permettre de :',
              text: "Être écouté avec une présence attentive et sans jugement.\nObtenir des compréhensions sur des situations qui vous habitent depuis longtemps.\nTraverser une période de changement ou d'éveil de conscience avec davantage de sérénité.\nDécouvrir, développer ou mieux comprendre vos aptitudes et vos dons naturels.\nApprendre à reconnaître ce qui vous anime profondément et à l'exprimer pleinement.\nDépasser certains blocages ou certaines peurs qui ralentissent votre évolution.\nRecevoir des pistes de réflexion, des outils et des clés concrètes pour poursuivre votre cheminement.",
              outro: 'Chaque séance est unique et s\'adapte entièrement à ce que vous vivez au moment de notre rencontre.'
            },
            {
              eyebrow: "Comment se déroule l'accompagnement",
              title: 'Déroulement de la séance',
              type: 'text',
              intro: '',
              text: "Les séances d'accompagnement durent 75 minutes.\n\nNous échangeons librement sur les sujets qui sont importants pour vous. Qu'il s'agisse de votre développement personnel, de votre parcours spirituel, de vos questionnements, de vos défis actuels ou simplement de votre besoin d'être entendu, cet espace est le vôtre.\n\nÀ travers mon expérience de vie, mon parcours personnel et les connaissances que j'ai acquises au fil des années, je vous partage des compréhensions, des perspectives nouvelles et des clés qui pourront vous aider à avancer avec davantage de confiance, de discernement et d'autonomie.\n\nL'objectif n'est pas de vous dire quel chemin emprunter, mais de vous aider à mieux comprendre le vôtre et à développer les ressources qui sont déjà présentes en vous.",
              outro: ''
            },
            {
              eyebrow: 'Flexibilité',
              title: 'Un accompagnement dans la durée',
              type: 'text',
              intro: '',
              text: "Chaque rencontre s'appuie naturellement sur les précédentes afin de favoriser une évolution cohérente et durable. Vous êtes libre de réserver une seule séance ou d'entreprendre un suivi régulier selon vos besoins et votre rythme.",
              outro: ''
            }
          ],
          ctaTitle: 'Réservez votre première rencontre',
          ctaText: "Connectez-vous à votre espace client afin de planifier votre première séance d'accompagnement de 75 minutes à l'aide du calendrier en temps réel.",
          ctaButtonLabel: 'Prendre rendez-vous',
          faq: [
            { question: 'Quel est le rythme idéal entre les séances ?', answer: 'Cela se définit ensemble lors de la séance de cadrage, généralement entre deux et quatre semaines selon votre cheminement.' },
            { question: 'Puis-je arrêter le suivi en cours de route ?', answer: "Oui, l'accompagnement reste toujours à votre rythme et vous pouvez l'interrompre librement depuis votre espace client." },
            { question: 'Les séances de suivi se font-elles à distance ?', answer: 'Oui, la plupart des rendez-vous de suivi peuvent se faire à distance, selon ce qui vous convient le mieux.' }
          ]
        }
      }
    };
  }

  function _defaultBio() {
    return {
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
    };
  }

  // N'amorce que ce qui est réellement absent — jamais du contenu déjà
  // sauvegardé (migration douce). Important : "po_demo_site_content" est un
  // objet unique qui regroupe PLUSIEURS sections indépendantes (threshold,
  // brand, sharedLabels, servicePages, ...). Une vérification au niveau de
  // la clé entière ne suffit pas : si cette clé existe déjà côté serveur
  // (ex. parce que "threshold" ou "brand" a été modifié un jour) mais que
  // "servicePages" n'a lui-même jamais été rempli, un simple "la clé existe
  // donc je ne touche à rien" laisserait les descriptions des pages de
  // service définitivement vides. On amorce donc chaque sous-partie
  // manquante indépendamment, sans jamais écraser ce qui existe déjà.
  function _seedMissingKeys() {
    const canPersist = typeof PO_Auth !== 'undefined' && PO_Auth.isAdmin && PO_Auth.isAdmin();
    if (!_read(SERVICES_KEY)) { const v = _defaultServices(); if (canPersist) _write(SERVICES_KEY, v); else _contentCache[SERVICES_KEY] = v; }

    const defaults = _defaultSiteContent();
    let content = _read(SITE_CONTENT_KEY);
    if (!content) {
      content = {};
      _contentCache[SITE_CONTENT_KEY] = content;
    }
    let changed = false;
    // Sections de premier niveau simples : amorcées si absentes.
    ['brand', 'threshold', 'servicesIntro', 'serviceCards', 'sharedLabels'].forEach(key => {
      if (!content[key]) { content[key] = defaults[key]; changed = true; }
    });
    // servicePages : amorcé PAGE PAR PAGE, pour ne jamais laisser une page
    // de service sans contenu même si l'objet servicePages existe déjà
    // partiellement (ex. seule l'autre page avait été configurée).
    if (!content.servicePages) content.servicePages = {};
    Object.keys(defaults.servicePages).forEach(serviceId => {
      const page = content.servicePages[serviceId];
      // Une page est considérée incomplète (donc réamorcée) si elle est
      // absente, ou si elle n'a ni intro ni sections — c'est-à-dire si
      // rien ne s'afficherait sur la page publique.
      const looksEmpty = !page || (!page.intro && (!Array.isArray(page.steps) || page.steps.length === 0));
      if (looksEmpty) {
        content.servicePages[serviceId] = defaults.servicePages[serviceId];
        changed = true;
      }
    });
    if (changed) {
      if (canPersist) _write(SITE_CONTENT_KEY, content); else _contentCache[SITE_CONTENT_KEY] = content;
    }

    // BIO : même logique défensive — si la clé existe déjà mais sans
    // aucune section, rien ne s'afficherait sur la page "Mon histoire".
    const defaultBio = _defaultBio();
    let bio = _read(BIO_KEY);
    if (!bio) { bio = {}; }
    let bioChanged = false;
    if (!bio.hero || !bio.hero.title) { bio.hero = defaultBio.hero; bioChanged = true; }
    if (!Array.isArray(bio.sections) || bio.sections.length === 0) { bio.sections = defaultBio.sections; bioChanged = true; }
    if (bioChanged || !_read(BIO_KEY)) {
      if (canPersist) _write(BIO_KEY, bio); else _contentCache[BIO_KEY] = bio;
    }
  }

  // Charge tout le contenu partagé depuis le serveur (une seule fois par
  // page). Appelée automatiquement par refreshFormulas() (déjà appelée par
  // toutes les pages au chargement) — voir plus bas.
  async function refreshContent() {
    if (_contentLoadPromise) return _contentLoadPromise;
    _contentLoadPromise = (async () => {
      const res = await PO_Api.get('/api/content');
      if (res.ok && res.content) _contentCache = res.content;
      _contentLoaded = true;
      _seedMissingKeys();
    })();
    return _contentLoadPromise;
  }

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

  // ----- TARIFS (FORMULES) — backend réel (server/pricing-routes.js) -----
  // Même pattern "cache + réseau" que auth.js : listFormulas()/
  // listFormulasForService() restent synchrones (lecture du cache),
  // saveFormula()/deleteFormula() sont désormais asynchrones (await).
  // Appeler PO_Content.refreshFormulas() au chargement de chaque page qui
  // affiche des prix (déjà fait via PO_Auth.init() sur les pages concernées).
  let _formulasCache = [];

  async function refreshFormulas() {
    const [res] = await Promise.all([PO_Api.get('/api/formulas'), refreshContent()]);
    if (res.ok) _formulasCache = res.formulas;
    return _formulasCache;
  }

  function listFormulas() {
    return _formulasCache;
  }

  function listFormulasForService(serviceId) {
    return listFormulas()
      .filter(f => f.serviceId === serviceId)
      .sort((a, b) => a.order - b.order);
  }

  async function saveFormula(formula) {
    const res = formula.id
      ? await PO_Api.put(`/api/admin/formulas/${formula.id}`, formula)
      : await PO_Api.post('/api/admin/formulas', formula);
    if (res.ok) {
      await refreshFormulas();
      document.dispatchEvent(new CustomEvent('po:prices-updated', { bubbles: true }));
      return { ok: true, formula: res.formula };
    }
    return { ok: false, error: res.error };
  }

  async function deleteFormula(id) {
    const res = await PO_Api.del(`/api/admin/formulas/${id}`);
    if (res.ok) {
      await refreshFormulas();
      document.dispatchEvent(new CustomEvent('po:prices-updated', { bubbles: true }));
    }
    return res;
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
    page.steps.push({
      eyebrow: (step && step.eyebrow) || '',
      title: (step && step.title) || 'Nouvelle section',
      type: (step && step.type) || 'text',
      intro: (step && step.intro) || '',
      text: (step && step.text) || '',
      outro: (step && step.outro) || ''
    });
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
    registration: { label: 'Création de compte client', enabled: true, emailTemplate: 'registration', delayMinutes: 0, recipients: ['client'] }
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
      metaDescription: 'Accompagnement énergétique personnalisé avec Pierre-Olivier. Soins Énergétiques, Accompagnement 1:1.',
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
  // =========================================================
  // GESTION DES BOUTONS DE LA PAGE D'ACCUEIL
  // =========================================================
  const BUTTON_SETTINGS_KEY = 'po_button_settings';

  const _defaultButtonSettings = () => ({
    connexion: true,
    energetiques: true,
    accompagnement: true,
    inscription: true,
    histoire: true,
    temoignages: true,
    contact: true
  });

  function getButtonSettings() {
    const stored = _read(BUTTON_SETTINGS_KEY);
    // Object.assign avec les valeurs par défaut en premier : migration douce
    // si un nouveau bouton bascule est ajouté plus tard sans réinitialiser
    // les préférences déjà enregistrées.
    if (stored) return Object.assign(_defaultButtonSettings(), stored);
    const defaults = _defaultButtonSettings();
    const canPersist = typeof PO_Auth !== 'undefined' && PO_Auth.isAdmin && PO_Auth.isAdmin();
    if (canPersist) _write(BUTTON_SETTINGS_KEY, defaults);
    else _contentCache[BUTTON_SETTINGS_KEY] = defaults;
    return defaults;
  }

  function updateButtonSetting(key, enabled) {
    const s = getButtonSettings();
    if (!(key in s)) return { ok: false, error: 'Bouton introuvable.' };
    s[key] = !!enabled;
    _write(BUTTON_SETTINGS_KEY, s);
    return { ok: true, settings: s };
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
    listFormulas, listFormulasForService, saveFormula, deleteFormula, refreshFormulas, refreshContent,
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
    // Gestion des boutons (page d'accueil)
    getButtonSettings, updateButtonSetting,
    // Médiathèque
    getMedia, uploadMedia, updateMedia, deleteMedia,
    // Journal d'audit
    logAudit, getAuditLog, clearAuditLog
  };
})();
