/**
 * Reference locale. The other two are typed `typeof fr`, so this file defines the contract: adding a key here makes
 * `tsc` fail on `en.ts` and `zh.ts` until they are translated.
 *
 * Above all NO `as const`: each value would become its own literal type, and any translation would then be refused as
 * not being the French string.
 *
 * Quotes and spaces belong to the translation, not the code: French wants « ... » with non-breaking spaces, English
 * "...", Chinese has no space before its units. No component must add them.
 */
export default {
  app: {
    /**
     * Product name. Lowercase in the three languages, it is not a typo: the capitals of `NAME` (App.ts) are a
     * logotype, not the name. A proper name is not translated either. `title` serves as `document.title`. See also
     * the <title> of index.html, which is static.
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
     * SINGULAR, like the three others: a grid title names what a click sets, not the number of thumbnails offered.
     * The plural stays on the rail, which names the tab and not the choice (`rail.animations`).
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
   * Export bar of the Customize tab. Menu labels are ACTIONS and not format names: "Download the PNG" is understood
   * without knowing what a PNG is, "PNG · 1024 px" asks a question that is not the user's.
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
    /** Name of the key as engraved on the language's keyboard. */
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
    /** Ruler tick: tight, the figure is already small. */
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
