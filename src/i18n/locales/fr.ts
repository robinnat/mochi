/**
 * Locale de reference. Les deux autres sont typees `typeof fr`, donc c'est ce
 * fichier qui definit le contrat : y ajouter une cle fait echouer `tsc` sur
 * `en.ts` et `zh.ts` jusqu'a ce qu'elles soient traduites.
 *
 * Surtout PAS de `as const` : chaque valeur deviendrait son propre type
 * litteral, et toute traduction serait alors refusee comme n'etant pas la
 * chaine francaise.
 *
 * Les guillemets et les espaces font partie de la traduction, pas du code : le
 * francais veut « ... » avec espaces insecables, l'anglais "...", le chinois
 * n'a pas d'espace avant ses unites. Aucun composant ne doit les ajouter.
 */
export default {
  app: {
    /**
     * Nom du produit. En minuscules dans les trois langues, ce n'est pas une
     * coquille : les capitales de `NAME` (App.ts) sont un logotype, pas le nom.
     * Un nom propre ne se traduit pas non plus. `title` sert de `document.title`.
     * Voir aussi le <title> de index.html, qui est statique.
     */
    name: 'mochis',
    title: 'Mochis, avatar animé',
    botAria: 'Avatar mochi animé',
    no3d: 'La 3D demande WebGL'
  },

  gallery: {
    back: 'Retour au lecteur'
  },

  rail: {
    nav: 'Sections',
    customize: 'Personnaliser',
    animations: 'Animations',
    settings: 'Réglages'
  },

  panel: {
    /**
     * Au SINGULIER, comme les trois autres : un titre de grille nomme ce qu'un
     * clic pose, pas le nombre de vignettes proposees. Le pluriel reste au rail,
     * qui nomme l'onglet et non le choix (`rail.animations`).
     */
    animations: 'Animation',
    shape: 'Forme',
    expression: 'Expression',
    color: 'Couleur',
    style: 'Style',
    pixelSize: 'Taille des pixels',
    outline: 'Contour cartoon'
  },

  /**
   * Barre d'export de l'onglet Personnaliser. Les libelles du menu sont des
   * ACTIONS et pas des noms de format : « Télécharger le PNG » se comprend sans
   * savoir ce qu'est un PNG, « PNG · 1024 px » demande de trancher une question
   * qui n'est pas celle de l'utilisateur.
   */
  export: {
    action: 'Exporter en PNG',
    more: 'Autres formats',
    png: 'Télécharger le PNG',
    svg: 'Télécharger le SVG',
    gif: 'Télécharger le GIF animé',
    cycleDetail: 'La vidéo est plus légère et plus fluide ; le GIF passe partout.',
    cycleFormat: 'Format',
    cycle_mp4: 'Vidéo MP4',
    cycle_mp4_help: 'Léger et fluide, fond obligatoire',
    cycle_gif: 'GIF animé',
    cycle_gif_help: 'Lu partout, plus lourd',
    cycleProgress: 'Export en cours…',
    cycleRetry: 'Réessayer',
    gifTitle: 'Télécharger le GIF animé',
    gifDetail:
      "Le GIF ne gère la transparence qu'en tout ou rien : sans fond, le contour de la boule est un peu dur.",
    gifBackground: 'Fond',
    background_white: 'Fond blanc',
    background_white_help: 'Contour lisse, à poser sur du clair',
    background_transparent: 'Fond transparent',
    background_transparent_help: "S'adapte à tout fond, contour un peu dur",
    gifConfirm: 'Télécharger',
    copy: "Copier l'image",
    copySvg: 'Copier le SVG',
    done: 'Exporté',
    copied: 'Copié',
    failed: "Échec de l'export"
  },

  preview: {
    exit: "Quitter l'aperçu",
    /** Nom de la touche tel qu'il est grave sur le clavier de la langue. */
    key: 'Échap'
  },

  timeline: {
    play: 'Lancer la lecture',
    pause: 'Arrêter la lecture',
    addAnimation: 'Ajouter une animation',
    preview: 'Aperçu',
    export: 'Exporter le montage',
    zoom: 'Zoom de la piste',
    blockAria: '{state}, {duration}',
    blockDurationAria: 'Durée de {state}, {duration}',
    blockRemoveAria: 'Retirer {state}'
  },

  dialog: {
    cancel: 'Annuler',
    nameCreateTitle: 'Nouveau cycle',
    nameRenameTitle: 'Renommer le cycle',
    nameField: 'Nom du cycle',
    nameCreate: 'Créer',
    nameRename: 'Renommer',
    removeTitle: 'Supprimer « {name} » ?',
    removeDetail:
      'Ce montage sera perdu, avec son animation. | Ce montage sera perdu, avec ses {n} animations.',
    removeConfirm: 'Supprimer'
  },

  cycles: {
    defaultName: 'Cycle par défaut',
    newName: 'Mon cycle',
    menuNew: 'Nouveau cycle',
    menuRenameAria: 'Renommer {name}',
    menuRemoveAria: 'Supprimer {name}'
  },

  units: {
    seconds: '{n} s',
    /** Graduation de la règle : serré, le chiffre est déjà petit. */
    secondsShort: '{n}s'
  },

  settings: {
    title: 'Réglages',
    language: 'Langue',
    github: 'Voir le projet sur GitHub',
    githubAria: 'Le dépôt du projet sur GitHub, dans un nouvel onglet'
  },

  states: {
    idle: 'Repos',
    thinking: 'Réflexion',
    wink: "Clin d'œil",
    wide: 'Yeux écarquillés',
    sleep: 'Veille',
    swirl: 'Tourbillon'
  },

  styles: {
    '3d': 'Doux',
    flat3d: 'Plat',
    pixel3d: 'Pixel'
  },

  pixelSizes: {
    large: 'Gros',
    medium: 'Moyens',
    end: 'Fins'
  },

  shapes: {
    circle: 'Cercle',
    pebble: 'Galet',
    squircle: 'Squircle',
    capsule: 'Capsule',
    triangle: 'Triangle',
    hexagon: 'Hexagone',
    cloud: 'Nuage',
    drop: 'Goutte',
    star: 'Étoile',
    flower: 'Fleur',
    egg: 'Œuf',
    heart: 'Cœur'
  },

  colors: {
    ink: 'Encre',
    cream: 'Crème',
    brown: 'Brun',
    red: 'Tomate',
    coral: 'Corail',
    orange: 'Orange',
    amber: 'Jaune vif',
    lime: 'Citron vert',
    apple: 'Pomme',
    green: 'Émeraude',
    turquoise: 'Turquoise',
    sky: 'Ciel',
    blue: 'Bleu roi',
    violet: 'Violet',
    magenta: 'Magenta',
    pink: 'Rose',
    cherry: 'Cerise',
    grey: 'Gris'
  },

  expressions: {
    neutral: 'Neutre',
    attentive: 'Attentif',
    surprised: 'Surpris',
    excited: 'Excité',
    happy: 'Heureux',
    laughing: 'Hilare',
    angry: 'En colère',
    sad: 'Triste',
    scared: 'Effrayé',
    suspicious: 'Méfiant',
    confused: 'Confus',
    curious: 'Curieux',
    proud: 'Fier',
    shy: 'Timide',
    unimpressed: 'Blasé',
    sleepy: 'Somnolent'
  }
}
