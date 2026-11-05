<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, triggerRef, watch } from 'vue'
import { BotEngine, type BotFrame } from '@/bot/engine'
import { clamp, easings } from '@/bot/math'
import { t } from '@/i18n'
import { lookTarget, TURN_TIME, type GazeScript } from '@/ui/gaze'
import {
  DEFAULT_EXPRESSION,
  EXPRESSION_BY_ID
} from '@/bot/expressions'
import {
  COLOR_BY_ID,
  DEFAULT_COLOR,
  DEFAULT_SHAPE,
  SHAPE_BY_ID,
  mixHex
} from '@/bot/skins'
import { blockAt, defaultCycle, offsetOf, type Block } from '@/bot/cycles'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { STATE_BY_ID, type StateId } from '@/bot/states'
import { dessinPorte, porteSvg, type PorteId } from '@/bot/portes'
import { ACCESSOIRE_BY_ID, ancreDuCorps, type AccessoireId } from '@/bot/accessoires'
import { composer, type Geste } from '@/bot/gestes'
import { Humeurs, REACTION_DE_EVENEMENT, doitRedessiner, moodDe, type ReactionId } from '@/bot/humeurs'
import { pixellise, pixellisePrims } from '@/ui/pixel'
import { DOUCEUR_DEFAUT, RENDU_3D_DEFAUT, type Douceur, type Rendu3d } from '@/ui/trois/rendu3d'
import { type Theme } from '@/ui/trois/theme'
import { themeCourant } from '@/ui/trois/themeCourant'
import type { Selection } from '@/bot/emplacements'
import {
  contourCourant,
  est3d,
  estVraie3d,
  matiere3dDe,
  grillePixel,
  pixelEffectif,
  renduEffectif,
  teintes3d,
  type RenduId,
  type TaillePixelId
} from '@/ui/rendu'

const props = withDefaults(
  defineProps<{
    size?: number
    /** identifiant de forme du personnalisateur */
    shape?: string
    /** identifiant de couleur du personnalisateur */
    color?: string
    /** identifiant d'expression de repos du personnalisateur */
    expression?: string
    /** couleur du fond, utilisee pour la brume de profondeur des particules */
    paper?: string
    /** theme de la 3D : `light` ou `dark` (les yeux deviennent noirs) ; absent, le theme courant (`themeCourant`, clair par defaut) */
    theme?: Theme
    /** accessoires par emplacements (tete, yeux, visage, bas, dos), 3D seulement ; voir `src/bot/emplacements.ts` */
    accessoires?: Selection | null
    /**
     * Fige le rendu a cette date (en secondes depuis le debut de l'etat).
     * Le moteur etant une fonction pure du temps, on obtient une image
     * reproductible au pixel pres, sans boucle d'animation : utile pour une
     * planche d'etats, une vignette de personnalisateur ou un test.
     */
    frozenAt?: number
    /**
     * Montage joue par le lecteur : une suite d'etats, chacun tenu la duree de
     * son bloc. Par defaut, le cycle releve sur la video.
     */
    cycle?: Block[]
    /**
     * Le regard suit le pointeur. Hors de portee des vignettes figees, qui n'ont
     * pas de boucle d'animation : les brancher reveillerait autant de boucles
     * qu'il y a de cases.
     */
    follow?: boolean
    /**
     * Regard scripte de l'arrivee : evalue a chaque image avec le temps ecoule
     * depuis qu'il a ete pose. Independant de `follow`, qui vise le pointeur —
     * ici c'est le script qui decide de tout, y compris de sa duree.
     */
    gaze?: GazeScript | null
    /**
     * Style de rendu : original, pixel art, 3D argile ou 3D bulle. Seul le DESSIN
     * change, le moteur rend la meme image. Absent, le bot suit le reglage courant
     * (`renduCourant`), ce qui evite de descendre la prop dans chaque vignette ; les
     * exports le passent toujours explicitement.
     */
    rendu?: RenduId
    /** Taille des pixels du pixel art ; absente, le reglage courant. */
    pixel?: TaillePixelId
    /**
     * Matiere de la vraie 3D (`rendu` = 3d seulement) : `realiste` ou une variante
     * « 3D flat » (`toon`, `toon-contour`, `lowpoly`, `aplat`). Absente : le defaut (`doux`, douceur `marque`).
     */
    rendu3d?: Rendu3d
    /** Reglage de la matiere `doux` : `leger` (defaut) ou `marque`. Ignore par les autres matieres. */
    douceur?: Douceur
    /** Contour cartoon de la vraie 3D ; absent, le reglage courant (`contourCourant`). */
    contour?: boolean
    /** Petit reflet doux en haut a gauche de la matiere 3D `doux` (defaut : oui). */
    reflet?: boolean
    /** Ombre portee au sol sous le corps, en 3D (defaut : oui). */
    ombre?: boolean
    /**
     * Angle du corps autour de l'axe vertical, en radians (vraie 3D seulement). 0 = de face.
     * Les yeux sont peints sur la face avant : de dos, il n'y en a plus.
     */
    yaw?: number
    /**
     * Geste (`src/bot/gestes.ts`) : petits ecarts ajoutes a la pose, fonction du temps de la
     * scene. Absent, l'image est identique a celle d'avant.
     */
    geste?: ((t: number) => Geste) | null
    /**
     * Accessoire de metier (`src/bot/accessoires.ts`) dessine devant le corps, avec le geste qui
     * va avec (sauf si `geste` est passe). Sans effet en pixel art.
     */
    accessoire?: AccessoireId | null
    /**
     * Accessoire PORTE (`src/bot/portes.ts`) : lunettes, chapeau, noeud, couronne, casque. Pose
     * sur le corps et recalcule a chaque image, il suit le corps, les yeux et l'humeur dans tous
     * les rendus (en 3D : volumes fixes au maillage, lunettes peintes sur le visage).
     */
    porte?: PorteId | null
    /**
     * Humeur de travail jouee en boucle (`src/bot/humeurs.ts`) : `repos`, `reflechit`, `travaille`,
     * `attend`, `termine`, `bloque`, `dort` (ou les noms d'etats `idle`, `thinking`, `sleep`...).
     * Elle remplace le montage (`cycle`) : le bot reste sur son etat de repos et ne change que de
     * visage et de corps. Absente, rien ne change. Se pilote aussi par `setMood(id)`.
     */
    mood?: string | null
    /**
     * Reactions a l'utilisateur, branchees sur les evenements pointeur de l'avatar : survol (le regard
     * suit), tap (sursaut), double tap (rire), appui long (rougit), secousse ou tour rapide (etourdi).
     * `false` les coupe. Sans effet sur une vignette figee (`frozenAt`).
     */
    interactions?: boolean
    /** Salut a l'apparition (`coucou`), joue une fois au montage. */
    coucou?: boolean
    /**
     * Ordinateur portable 3D du mood `travaille` (vu de dos, devant le corps) : affiche par defaut des que le mood est
     * `travaille`, il pousse et rétrécit en douceur a l'entree et a la sortie. `false` le masque. 3D seulement.
     */
    ordinateur?: boolean
    /**
     * Plafond d'images par seconde de la boucle (tableau de bord : 12). Absent : une image par image du
     * navigateur. L'horloge, elle, ne ralentit pas : seul le nombre de redessins baisse.
     */
    fps?: number
    /** Texte alternatif ; absent, le libelle traduit de l'application. */
    label?: string
  }>(),
  {
    size: 320,
    shape: DEFAULT_SHAPE,
    color: DEFAULT_COLOR,
    expression: DEFAULT_EXPRESSION,
    paper: '#f9f9f9',
    theme: undefined,
    accessoires: null,
    frozenAt: undefined,
    cycle: () => defaultCycle().blocks,
    follow: false,
    gaze: null,
    rendu: undefined,
    pixel: undefined,
    rendu3d: RENDU_3D_DEFAUT,
    douceur: DOUCEUR_DEFAUT,
    contour: undefined,
    reflet: true,
    ombre: true,
    yaw: 0,
    geste: null,
    accessoire: null,
    porte: null,
    mood: null,
    interactions: true,
    coucou: false,
    ordinateur: true,
    fps: undefined,
    label: undefined
  }
)

/**
 * Le curseur de lecture est un **index de bloc**, pas un etat : un montage peut
 * jouer deux fois le meme etat, et il faut alors savoir dans lequel des deux on
 * se trouve. `state` suit le bloc courant — c'est une sortie, l'exterieur pilote
 * la lecture par `block`.
 */
const block = defineModel<number>('block', { default: 0 })
const state = defineModel<StateId>('state', { default: 'idle' })
const playing = defineModel<boolean>('playing', { default: false })
/** Temps ecoule dans le bloc courant, pour la tete de lecture de la timeline. */
const elapsed = defineModel<number>('elapsed', { default: 0 })

// Le repere vient de `src/bot/` : c'est lui qui definit ce que le moteur rend, le
// composant n'en est qu'un client. Les noms courts restent, ils sont partout dans le
// gabarit.
const R = RAYON
const VB = DEMI_VIEWBOX

const shapeRadii = computed(() => SHAPE_BY_ID.get(props.shape)?.radii ?? null)
const ink = computed(() => COLOR_BY_ID.get(props.color)?.hex ?? '#0a0a0c')
const expression = computed(() => EXPRESSION_BY_ID.get(props.expression) ?? null)

/* ------------------------------------------------------------- style de rendu */

const rendu = computed(() => renduEffectif(props.rendu))
const contourEffectif = computed(() => props.contour ?? contourCourant.value)
const grille = computed(() => grillePixel(pixelEffectif(props.pixel)))
/**
 * Teintes du volume, ou null hors 3D. La vraie 3D prend celles de l'argile : c'est sa
 * matiere, et c'est aussi son dessin de secours (avant le chargement de Three.js, sans
 * WebGL, dans un export).
 */
const t3d = computed(() => {
  const r = rendu.value
  if (est3d(r)) return teintes3d(ink.value, r)
  return estVraie3d(r) ? teintes3d(ink.value, 'argile') : null
})
const argile = computed(() => rendu.value === 'argile' || estVraie3d(rendu.value))

const engine = new BotEngine(R, state.value, shapeRadii.value, expression.value)
const frame = shallowRef<BotFrame>(engine.sample(props.frozenAt ?? 0))
const uid = Math.random().toString(36).slice(2, 8)
const maskId = `bot-mask-${uid}`

/* ------------------------------------------------- geste et accessoire */

/** Date de scene de l'image courante : l'accessoire est une fonction du temps. */
const temps = ref(props.frozenAt ?? 0)
const acc = computed(() => (props.accessoire ? (ACCESSOIRE_BY_ID.get(props.accessoire) ?? null) : null))
/** Point d'appui de l'objet, lu une fois sur une image au repos de la forme. */
const ancre = computed(() =>
  acc.value ? ancreDuCorps(new BotEngine(R, 'idle', shapeRadii.value, null).sample(1).bodyPath) : undefined
)
/* ------------------------------------------------- humeurs et reactions */

/** Mouvement reduit : les humeurs deviennent des images fixes (le visage reste, le corps ne bouge plus). */
const reduit = ref(false)
const humeurs = new Humeurs(moodDe(props.mood), { base: expression.value })
const humeurActive = computed(() => moodDe(props.mood) !== null)

const gesteBase = (t: number): Geste | undefined =>
  // un geste choisi ET un accessoire de metier se composent : le corps fait les deux, l'objet le suit
  props.geste
    ? acc.value
      ? composer(props.geste(t), acc.value.geste(t, { ancre: ancre.value }))
      : props.geste(t)
    : acc.value
      ? acc.value.geste(t, { ancre: ancre.value })
      : undefined
/** Le geste du bot : celui d'avant, plus la couche des humeurs et des reactions quand elle est active. */
const gesteA = (t: number): Geste | undefined => {
  const b = gesteBase(t)
  const h = humeurs.sample(t)
  return h ? (b ? composer(b, h) : h) : b
}
/**
 * Quand un geste deplace le corps (saut, ecrasement), l'objet de metier le suit : on le decale
 * de l'ecart entre le point d'appui de l'image courante et celui de repos. Sans geste, le corps
 * ne bouge pas et l'objet s'adapte lui-meme (inchange).
 */
const objetDecalage = computed(() => {
  if (!acc.value || !props.geste || !ancre.value || vraie3d.value) return ''
  const a = ancreDuCorps(frame.value.bodyPath)
  return `translate(${Math.round((a.x - ancre.value.x) * 10) / 10} ${Math.round((a.y - ancre.value.y) * 10) / 10})`
})
const objetSvg = computed(() => {
  const a = acc.value
  if (!a) return ''
  const c = teintes3d(ink.value, 'argile')
  return a.dessin(temps.value, {
    uid: `${uid}-o-`,
    corps: { clair: c.clair, base: c.base, ombre: c.ombre },
    papier: props.paper,
    simple: props.size < 64,
    ancre: ancre.value
  })
})

/**
 * L'image courante en pixel art : re-pixellisee a chaque image du moteur, ce qui garde le
 * morphing fluide. `null` hors pixel art, ou quand le navigateur n'a pas de canvas : le
 * gabarit retombe alors sur le rendu original plutot que de ne rien montrer.
 */
const pixels = computed(() =>
  rendu.value === 'pixel' ? pixellise(frame.value, ink.value, props.paper, grille.value) : null
)

/**
 * Accessoire porte, recalcule sur l'image courante. En vraie 3D il devient un volume (voir
 * `scene3d.ts`) : le calque SVG ne sert alors qu'au repli sans WebGL, et au pixel art, ou les
 * memes chemins sont rasterises sur la grille.
 */
const PORTE_2D = false
const porteTexte = computed(() => {
  // les accessoires portes ne sont exposes qu'en 3D ; le calque 2D reste en attente (repli sans WebGL)
  if (!props.porte || pixels.value || vraie3d.value || !PORTE_2D) return ''
  return porteSvg(props.porte, frame.value)
})
const portePixels = computed(() =>
  PORTE_2D && props.porte && rendu.value === 'pixel' ? pixellisePrims(dessinPorte(props.porte, frame.value), grille.value) : null
)

let raf = 0
let nextAt = Infinity
let last = 0
let clock = 0
/** Date d'horloge a laquelle le bloc courant a commence. */
let blockStart = 0

/**
 * Pose le bloc `i` : etat, moteur, et date de fin. Appele aussi bien par la
 * boucle que par le watcher, d'ou l'absence d'effet de bord sur `block` — c'est
 * l'appelant qui decide s'il deplace le curseur.
 */
function apply(i: number, from = 0) {
  const b = props.cycle[i]
  if (!b) {
    nextAt = Infinity
    return
  }
  blockStart = clock - from
  elapsed.value = from
  // une humeur remplace le montage : le bot reste sur son etat de repos, seuls visage et corps bougent
  const etat = humeurActive.value ? 'idle' : b.state
  state.value = etat
  engine.setState(etat, clock)
  nextAt = playing.value && !humeurActive.value ? blockStart + b.duration : Infinity
}

/** Deplace le curseur et recale le moteur dans la foulee, sans passer par le watcher. */
function goToBlock(i: number) {
  block.value = i
  apply(i)
}

/**
 * Deplacement de la tete de lecture depuis la timeline : on tombe au milieu d'un
 * bloc, pas a son debut. L'offset transite par une variable plutot que par un
 * appel direct a `apply` : changer `block` declenchera le watcher, qui doit
 * poser la meme date que nous — sinon il remettrait le bloc a zero juste apres.
 */
let pendingOffset = 0

function seek(index: number, offset = 0) {
  if (block.value === index) {
    apply(index, offset)
    return
  }
  pendingOffset = offset
  block.value = index
}

/**
 * Rend le MONTAGE a la date absolue `t`, sans horloge. C'est ce qui permet de
 * capturer un cycle entier hors ecran, image par image et plus vite que le temps
 * reel.
 *
 * Pourquoi une methode a part, et pas `frozenAt` : `frozenAt` fige le temps DANS
 * l'etat courant, il ne parcourt pas les blocs. Et passer par `seek` ne suffirait
 * pas — `apply` cale le moteur sur `clock`, qui n'avance que dans la boucle et
 * reste donc a zero en mode fige. Tous les changements d'etat s'enregistreraient
 * a l'instant 0, et les fondus aux jointures de blocs seraient faux.
 *
 * D'ou le `setState` a l'offset ABSOLU du bloc : le moteur date ainsi la
 * transition la ou elle a vraiment lieu dans le cycle, et `sample(t)` retombe sur
 * la meme image que la lecture temps reel aurait produite.
 */
let dernierBloc = -1

function rendAt(t: number) {
  const blocs = props.cycle
  if (!blocs.length) return
  const { index } = blockAt(blocs, t)
  if (index !== dernierBloc) {
    const b = blocs[index]!
    state.value = b.state
    /*
     * Un RETOUR EN ARRIERE repart sans historique, la ou une avancee normale garde l'etat
     * quitte pour le fondre. Sans cette distinction, rejouer l'image 0 apres une passe
     * complete datait le premier etat a l'instant 0 avec le DERNIER en etat precedent, et
     * rendait donc la pose de celui-la : l'export GIF, qui fait deux passes, s'ouvrait sur
     * une boule sans yeux. Le lecteur est ainsi idempotent, et une passe peut etre rejouee
     * autant de fois qu'on veut.
     */
    if (index < dernierBloc) engine.reset(b.state, offsetOf(blocs, index))
    else engine.setState(b.state, offsetOf(blocs, index))
    dernierBloc = index
  }
  temps.value = t
  frame.value = engine.sample(t, gesteA(t))
  triggerRef(frame)
}

/** Change d'humeur (`null` coupe la couche). Glisse de l'une a l'autre sans saut. */
function setMood(id: string | null) {
  humeurs.setMood(id, clock)
  // le montage reprend la main des qu'il n'y a plus d'humeur
  apply(block.value, elapsed.value)
  redrawFrozen()
}
/** Joue une reaction (`sursaut`, `rigole`, `rougit`, `etourdi`, `coucou`) puis rend la main a l'humeur. */
function react(id: ReactionId | string) {
  if (!humeurs.react(id, clock)) return false
  redrawFrozen()
  return true
}
/** Fin d'une reaction tenue (appui long). */
function relacher() {
  humeurs.relacher(clock)
}
/** Regard du survol, hors evenement : `nx`, `ny` de -1 a 1 (droite et bas positifs), `null` pour lacher. */
function regarder(cible: { nx: number; ny: number } | null) {
  humeurs.regarder(cible, clock)
}

defineExpose({ seek, rendAt, setMood, react, relacher, regarder })

/* -------------------------------------------------------------- vraie 3D */

/**
 * Le module WebGL n'est charge que si le style 3D est choisi, par `import()` : Three.js
 * ne pese rien sur les autres styles. Partage par toutes les instances (le module est
 * en cache apres le premier chargement, et il tient un seul contexte WebGL).
 */
type Module3d = typeof import('@/ui/trois/scene3d')
const m3d = shallowRef<Module3d | null>(null)
const toile = ref<HTMLCanvasElement | null>(null)
const vraie3d = computed(() => estVraie3d(rendu.value) && m3d.value !== null)
/** Cote du canvas en pixels physiques : net sur un ecran Retina, borne a 2x. */
const pxToile = computed(() =>
  rendu.value === 'pixel3d'
    ? grille.value
    : Math.round(props.size * Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
)

watch(
  rendu,
  async (r) => {
    if (!estVraie3d(r) || m3d.value) return
    try {
      const m = await import('@/ui/trois/scene3d')
      // sans WebGL on garde l'argile SVG, qui est deja a l'ecran
      if (m.webglDisponible()) m3d.value = m
    } catch {
      // module introuvable ou contexte refuse : meme repli
    }
  },
  { immediate: true }
)

/** Les points de `thinking` restent a plat devant le corps : ils s'effacent quand il se tourne. */
const decorAlpha = computed(() => (vraie3d.value && props.yaw ? Math.max(0, Math.cos(props.yaw)) ** 3 : 1))

/* ------------------------------------------------- ordinateur du mood « travaille » */

/** Progression de l'apparition de l'ordinateur (0 = absent, 1 = en place) et son sens. */
let ordiK = 0
let ordiVers = 0
const ordiVoulu = () => props.ordinateur !== false && humeurs.mood === 'travaille'
/** Fait avancer la progression de `dt` secondes (0,45 s pour un trajet complet) ; `net` : saute au but. */
function avancerOrdi(dt: number, net = false) {
  const cible = ordiVoulu() ? 1 : 0
  if (cible !== ordiVers) ordiVers = cible
  ordiK = net ? cible : Math.min(1, Math.max(0, ordiK + Math.sign(cible - ordiK) * Math.min(Math.abs(cible - ordiK), dt / 0.45)))
  humeurs.regardOrdi = tourOrdi()
}
/** Tournee 3/4 vers l'ordinateur : le corps pivote d'un peu moins de 20 degres, le regard va vers lui. */
function tourOrdi(): number {
  return ordiVers >= 1 ? Math.min(1, ordiK * 1.2) : ordiK * ordiK * (3 - 2 * ordiK)
}
/** Echelle dessinee : pousse avec un leger rebond (~106 %), rétrécit en douceur. */
function ordiEchelle(): number {
  const k = ordiK
  if (k <= 0) return 0
  if (ordiVers >= 1 || k >= 1) {
    const c1 = 1.2
    return 1 + (c1 + 1) * (k - 1) ** 3 + c1 * (k - 1) ** 2
  }
  return k * k * (3 - 2 * k)
}

const themeEff = computed<Theme>(() => props.theme ?? themeCourant.value)

const rendu3dEff = computed<Rendu3d>(() => matiere3dDe(rendu.value, props.rendu3d))

function dessiner3d() {
  const m = m3d.value
  if (!vraie3d.value || !m || !toile.value) return
  m.rendreAvatar(toile.value, frame.value, ink.value, props.paper, rendu3dEff.value, contourEffectif.value, props.douceur, props.reflet, props.shape, props.yaw + 0.3 * tourOrdi(), props.porte, props.accessoires ?? {}, undefined, themeEff.value, undefined, ordiEchelle(), props.ombre)
}

// `frame` est un shallowRef relance par `triggerRef` : le watcher suit chaque image
watch([frame, vraie3d, toile, ink, pxToile, rendu3dEff, () => props.douceur, () => props.reflet, () => props.yaw, () => props.porte, themeEff, () => props.accessoires, () => props.ombre, () => contourEffectif.value], dessiner3d, { flush: 'post' })

/* ------------------------------------------------------- regard qui suit */

const svg = ref<SVGSVGElement | null>(null)

/** Derniere position connue du pointeur, en coordonnees client. */
let pointer: { x: number; y: number } | null = null
/** true = une cible est posee sur le moteur, donc il y a de quoi relacher. */
let aiming = false
/** Date d'horloge a laquelle le demi-tour a commence. */
let turnSince = 0

function onPointerMove(event: PointerEvent) {
  // Le tactile n'a pas de curseur qui traine : un doigt leve laisserait le
  // regard fige sur le dernier point touche, ce qui se lit comme un bug.
  if (event.pointerType === 'touch') return
  pointer = { x: event.clientX, y: event.clientY }
}

function onPointerLeave() {
  pointer = null
}

function release() {
  if (!aiming) return
  // meme duree qu'a l'aller : la tete revient pendant que la boule redescend
  engine.setLook(null, clock, TURN_TIME)
  aiming = false
}

/**
 * Vise le pointeur. Ne fait que la part DOM du travail — mesurer ou est la boule
 * et ou est le curseur — la regle de regard elle-meme etant dans `@/ui/gaze`.
 *
 * Le rectangle est relu a chaque image plutot que memorise : l'avatar glisse et
 * grandit pendant la transition de vue, un centre garde en cache ferait viser a
 * cote pendant tout le mouvement. La normalisation se fait sur la demi-fenetre et
 * non sur la taille de l'avatar : le regard doit saturer quand le curseur atteint
 * le bord de l'ecran, quelle que soit la place que la boule occupe.
 */
function aim() {
  // Le regard ne se pilote que sur les etats a VISAGE DE REPOS. Ailleurs la pose
  // du regard EST l'animation relevee — le tourbillon, par lequel s'ouvre la vue,
  // fait deja filer les yeux autour de la sphere — et s'y superposer la
  // brouillerait.
  if (!STATE_BY_ID.get(state.value)?.baseFace) {
    release()
    return
  }
  const box = svg.value?.getBoundingClientRect()
  /*
   * Une boite sans surface : il n'y a rien a viser, et surtout la normalisation
   * ci-dessous deviendrait `0 / 0`, donc `NaN`. Or le moteur GARDE la derniere
   * cible : un seul NaN pose une fois y reste pour toujours, et le bot ne se
   * repose plus jamais. Ca arrive pour de vrai quand le volet du navigateur est
   * masque — `getBoundingClientRect` rend alors des zeros.
   */
  if (!box || box.width === 0 || box.height === 0) return
  // le tour part a l'entree dans la vue, en meme temps que les anneaux
  if (!aiming) turnSince = clock
  const demiLargeur = Math.max(1, window.innerWidth / 2)
  const demiHauteur = Math.max(1, window.innerHeight / 2)
  engine.setLook(
    lookTarget({
      nx: pointer ? clamp((pointer.x - (box.left + box.width / 2)) / demiLargeur, -1, 1) : 0,
      ny: pointer ? clamp((pointer.y - (box.top + box.height / 2)) / demiHauteur, -1, 1) : 0,
      tour: easings.easeOutQuint(clamp((clock - turnSince) / TURN_TIME)),
      pointer: pointer !== null
    }),
    clock
  )
  aiming = true
}

/* ------------------------------------------------- regard d'arrivee */

/** Date d'horloge a laquelle le script de regard a ete pose. */
let gazeSince = 0
/** true = un script tourne, donc il y a de quoi relacher. */
let scripted = false

/**
 * Rattrapage court, la ou le suivi du pointeur prend celui du moteur : le script
 * EST l'animation, et laisser le moteur en lisser une seconde par-dessus
 * retarderait son depart d'un quart de seconde — un script qui commence par
 * regarder au loin verrait ses yeux partir de la pose, y revenir, puis repartir.
 *
 * Non nul quand meme : a zero, `lookAtTime` divise zero par zero a l'image ou la
 * cible est posee, et un `NaN` s'installe dans le moteur pour de bon.
 */
const SCRIPT_MORPH = 1 / 60

/**
 * Le script decide de tout, y compris de sa duree : on ne fait que lui donner le
 * temps ecoule. La regle elle-meme est dans `@/ui/gaze`, comme celle du suivi.
 */
function scriptedGaze(run: GazeScript) {
  engine.setLook(run(clock - gazeSince), clock, SCRIPT_MORPH)
}

/**
 * Depart et relachement du script. `immediate` parce que la page s'ouvre DEJA en
 * arrivee — c'est meme son seul usage — et le relachement parce qu'un script
 * coupe avant sa fin (bloc raccourci, changement de vue) laisserait sinon les
 * yeux figes la ou il s'est arrete : le moteur GARDE la derniere cible.
 */
watch(
  () => props.gaze,
  (run) => {
    if (run) {
      gazeSince = clock
      scripted = true
      /*
       * Valeur de depart posee DATEE D'UN RATTRAPAGE PLUS TOT, pour qu'elle soit
       * deja pleinement appliquee a la premiere image.
       *
       * Sans ca, le moteur rend la premiere image avec le regard neutre et la
       * seconde avec celui du script : les yeux sautent d'un coup entre les deux.
       * Discret pour un script qui commence au repos, spectaculaire pour un qui
       * commence en regardant au loin — 127 px d'un coup sur une boule de 100 de
       * rayon, ce qui est exactement le defaut que ces scripts corrigent.
       */
      engine.setLook(run(0), clock - SCRIPT_MORPH, SCRIPT_MORPH)
      return
    }
    if (!scripted) return
    engine.setLook(null, clock)
    scripted = false
  },
  { immediate: true }
)

/* ------------------------------------------------- reactions a l'utilisateur */

const TAP_MAX = 320 // ms : au-dela, ce n'est plus un tap
const DOUBLE_MAX = 380 // ms entre deux taps
const APPUI_LONG = 450 // ms avant que l'appui devienne « rougit »
const DEPLACEMENT_MAX = 10 // px : au-dela on glisse (tourner la vue), ni tap ni appui long

// seulement la vraie 3D (le composant 3D), jamais une vignette figee, et pas quand le suivi de la fenetre a deja la main
const interactif = computed(() => props.interactions && props.frozenAt === undefined && estVraie3d(rendu.value) && !props.follow)
let appui: { x: number; y: number; t: number; minuteur: number; long: boolean } | null = null
let dernierTap = -1e9
/** inversions de sens du glisse, pour reconnaitre une secousse */
let secousse: { sens: number; t: number }[] = []
let dernierDx = 0
/** rotation cumulee recente de la vue 3D (`yaw`), pour reconnaitre « tourne vite » */
let tours: { t: number; d: number }[] = []
let yawPrec = props.yaw

function normalise(e: PointerEvent): { nx: number; ny: number } | null {
  const box = svg.value?.getBoundingClientRect()
  if (!box || box.width === 0 || box.height === 0) return null
  // le regard sature un peu au-dela de l'avatar : le curseur n'a pas besoin d'etre dessus pour etre suivi
  return {
    nx: clamp((e.clientX - (box.left + box.width / 2)) / (box.width * 0.6), -1, 1),
    ny: clamp((e.clientY - (box.top + box.height / 2)) / (box.height * 0.6), -1, 1)
  }
}

function onSurvol(e: PointerEvent) {
  if (!interactif.value || reduit.value) return
  const c = normalise(e)
  if (c) humeurs.regarder(c, clock)
}
function onQuitte() {
  if (!interactif.value) return
  humeurs.regarder(null, clock)
}

function onAppui(e: PointerEvent) {
  if (!interactif.value || (e.button !== undefined && e.button > 0)) return
  onSurvol(e)
  clearTimeout(appui?.minuteur)
  appui = {
    x: e.clientX,
    y: e.clientY,
    t: e.timeStamp,
    long: false,
    // appui long : « rougit » tient tant qu'on garde le doigt, et redescend au relachement
    minuteur: window.setTimeout(() => {
      if (!appui) return
      appui.long = true
      humeurs.react(REACTION_DE_EVENEMENT.longue, clock)
    }, APPUI_LONG)
  }
  secousse = []
  dernierDx = 0
  // le parent peut capturer le pointeur (glisser pour tourner) : on suit alors la fin sur la fenetre
  window.addEventListener('pointermove', onGlisse)
  window.addEventListener('pointerup', onRelache)
  window.addEventListener('pointercancel', onRelache)
}

function onGlisse(e: PointerEvent) {
  if (!appui) return
  const dx = e.clientX - appui.x
  const dy = e.clientY - appui.y
  if (!appui.long && Math.hypot(dx, dy) > DEPLACEMENT_MAX) {
    // on glisse : ni tap ni appui long
    clearTimeout(appui.minuteur)
    appui.t = -1e9
  }
  // secousse : au moins quatre inversions de sens, vives, en moins d'une demi-seconde
  const pas = e.movementX || e.clientX - dernierDx
  if (Math.abs(pas) > 6) {
    const sens = Math.sign(pas)
    const dernier = secousse[secousse.length - 1]
    if (!dernier || dernier.sens !== sens) {
      secousse.push({ sens, t: e.timeStamp })
      secousse = secousse.filter((s) => e.timeStamp - s.t < 600)
      if (secousse.length >= 5 && interactif.value) {
        secousse = []
        humeurs.react(REACTION_DE_EVENEMENT.secoue, clock)
      }
    }
  }
  dernierDx = e.clientX
}

function onRelache(e: PointerEvent) {
  window.removeEventListener('pointermove', onGlisse)
  window.removeEventListener('pointerup', onRelache)
  window.removeEventListener('pointercancel', onRelache)
  const a = appui
  appui = null
  if (!a) return
  clearTimeout(a.minuteur)
  if (e.pointerType === 'touch') humeurs.regarder(null, clock)
  if (a.long) {
    humeurs.relacher(clock)
    return
  }
  if (e.type === 'pointercancel' || e.timeStamp - a.t > TAP_MAX) return
  // tap ou double tap
  if (e.timeStamp - dernierTap < DOUBLE_MAX) {
    dernierTap = -1e9
    humeurs.react(REACTION_DE_EVENEMENT.double, clock)
  } else {
    dernierTap = e.timeStamp
    humeurs.react(REACTION_DE_EVENEMENT.tap, clock)
  }
}

/** Tourne vite : la vue 3D (`yaw`) fait plus d'un tour en moins d'une seconde. */
watch(
  () => props.yaw,
  (v) => {
    const now = typeof performance === 'undefined' ? 0 : performance.now()
    if (!interactif.value) {
      yawPrec = v
      return
    }
    tours.push({ t: now, d: Math.abs(v - yawPrec) })
    yawPrec = v
    tours = tours.filter((x) => now - x.t < 900)
    if (tours.reduce((n, x) => n + x.d, 0) >= Math.PI * 2 && humeurs.reaction(clock) !== 'etourdi') {
      tours = []
      humeurs.react(REACTION_DE_EVENEMENT.secoue, clock)
    }
  }
)

watch(
  () => props.mood,
  (id) => setMood(moodDe(id))
)

/** Redessin plafonne : date du dernier dessin, en ms navigateur. */
let dernierDessin = 0

function tick(ms: number) {
  raf = requestAnimationFrame(tick)
  // Horloge de scene a delta borne : un onglet masque puis reaffiche reprend
  // sans sauter en avant (rAF est suspendu pendant ce temps-la).
  const dt = last ? Math.min((ms - last) / 1000, 0.064) : 0
  last = ms
  clock += dt

  // Le stop ne gele pas l'horloge : arrete, le bot continue de respirer et de
  // cligner. Seuls l'enchainement du montage et la tete de lecture sont
  // suspendus.
  if (playing.value) {
    if (clock >= nextAt && props.cycle.length) {
      goToBlock((block.value + 1) % props.cycle.length)
    } else {
      elapsed.value = clock - blockStart
    }
  }

  // Le suivi prime : les deux ecrivent la meme cible, et l'arrivee est terminee
  // bien avant qu'une vue a suivi ne s'ouvre.
  if (props.follow) aim()
  else if (props.gaze) scriptedGaze(props.gaze)

  // cadence plafonnee (tableau de bord) : l'horloge a avance, on saute seulement le dessin
  if (!doitRedessiner(ms, dernierDessin, props.fps)) return
  dernierDessin = ms
  temps.value = clock
  avancerOrdi(dt)
  frame.value = engine.sample(clock, gesteA(clock))
  triggerRef(frame)
}

/** Redessine sans la boucle : sert aux vignettes figees quand la forme change. */
function redrawFrozen() {
  if (props.frozenAt === undefined) return
  temps.value = props.frozenAt
  avancerOrdi(0, true)
  frame.value = engine.sample(props.frozenAt, gesteA(props.frozenAt))
  triggerRef(frame)
}

// Curseur deplace de l'exterieur : clic sur un bloc de la timeline. Quand c'est
// `goToBlock` qui l'a bouge, `apply` est deja passe et repasse ici sans effet
// (setState sort si l'etat n'a pas change, la date de fin est la meme).
watch(block, (i) => {
  apply(i, pendingOffset)
  pendingOffset = 0
})

// Changement d'etat venu d'une prop : c'est le cas des vignettes figees, qui
// n'ont pas de curseur. En lecture, `apply` a deja fait le travail.
//
// Le garde n'est pas une optimisation, il corrompait une image a CHAQUE jointure
// de bloc a l'export : `rendAt` pose l'etat sur le moteur a son offset ABSOLU
// puis echantillonne a la bonne date, mais le watcher — dont la file est videe
// par le `nextTick` de l'export — repassait ensuite un `redrawFrozen()` non
// inerte (le lecteur hors ecran est monte avec `frozenAt: 0`). Or `sample(0)`
// juste apres un changement date a l'offset donne un ratio de melange nul, donc
// la pose de l'etat PRECEDENT : le point d'exclamation revenait au depart de sa
// course pendant une image, treize fois dans le montage par defaut.
watch(state, (id) => {
  // `rendAt` ou `apply` l'a deja applique, et a la bonne date
  if (engine.state === id) return
  engine.setState(id, clock)
  redrawFrozen()
})

// Reprise la ou la tete de lecture s'est arretee, pas au debut du bloc.
watch(playing, (on) => {
  if (on) apply(block.value, elapsed.value)
  else nextAt = Infinity
})

// Le montage a change sous nos pieds : bloc supprime, duree tiree, autre cycle
// choisi. On garde le curseur dans les bornes et on recale la date de fin sur
// la nouvelle duree — si le bloc a ete raccourci sous la position courante, la
// boucle passe au suivant des la frame suivante, ce qui est le comportement
// voulu.
watch(
  () => props.cycle,
  (blocks) => {
    if (!blocks.length) {
      nextAt = Infinity
      return
    }
    const i = Math.min(block.value, blocks.length - 1)
    if (i !== block.value) {
      goToBlock(i)
      return
    }
    nextAt = playing.value ? blockStart + blocks[i]!.duration : Infinity
  }
)

watch(shapeRadii, (radii) => {
  // on passe l'horloge : le moteur morphe vers la nouvelle forme au lieu de
  // l'appliquer d'un coup
  engine.setShape(radii, clock)
  redrawFrozen()
})

watch(expression, (expr) => {
  humeurs.setBase(expr)
  engine.setExpression(expr, clock)
  redrawFrozen()
})

/**
 * Deplacer `frozenAt` redessine. La prop ne servait qu'a poser une vignette une
 * fois pour toutes, donc personne ne la bougeait ; l'export anime, lui, avance
 * image par image sur une instance hors ecran. Sans ce watcher elle reste sur sa
 * premiere image et l'animation exportee ne bouge pas.
 */
watch(() => props.frozenAt, redrawFrozen)

/**
 * L'ecoute du pointeur ne vit que le temps du suivi. `immediate` parce que la
 * vue peut s'ouvrir deja en mode suivi ; le garde sur `frozenAt` parce qu'une
 * vignette figee n'a pas de boucle pour consommer la cible, donc rien a ecouter.
 */
watch(
  () => props.follow && props.frozenAt === undefined,
  (on) => {
    if (on) {
      window.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerleave', onPointerLeave)
      return
    }
    detach()
    release()
  },
  { immediate: true }
)

function detach() {
  window.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerleave', onPointerLeave)
}

// geste ou accessoire change : une image figee se redessine (en lecture, la boucle s'en charge)
watch([() => props.accessoire, () => props.geste, () => props.porte], redrawFrozen)

let mqReduit: MediaQueryList | null = null
const majReduit = () => {
  reduit.value = !!mqReduit?.matches
  humeurs.reduit = reduit.value
}

onMounted(() => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    mqReduit = window.matchMedia('(prefers-reduced-motion: reduce)')
    majReduit()
    mqReduit.addEventListener?.('change', majReduit)
  }
  if (props.frozenAt !== undefined) {
    redrawFrozen()
    return
  }
  if (props.coucou) {
    // mouvement reduit : pas de pousse, un simple fondu a l'apparition ; sinon la reaction fait grandir le Mochi
    if (reduit.value) svg.value?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' })
    else humeurs.react(REACTION_DE_EVENEMENT.arrivee, clock)
  }
  // le curseur peut arriver deja pose (URL, cycle relu du stockage)
  apply(block.value, elapsed.value)
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  detach()
  clearTimeout(appui?.minuteur)
  window.removeEventListener('pointermove', onGlisse)
  window.removeEventListener('pointerup', onRelache)
  window.removeEventListener('pointercancel', onRelache)
  mqReduit?.removeEventListener?.('change', majReduit)
})

/**
 * Un point est un simple disque, sauf quand l'etat fournit une forme (la
 * goutte du "!" penche) : le path est alors en unites de rayon de boule et
 * centre sur l'origine, donc on le pose avec translate/rotate/scale.
 *
 * La couleur suit celle du corps par defaut ; `depth` sert aux particules, qui
 * se fondent dans le fond a mesure qu'elles s'eloignent.
 */
function dotAttrs(dot: BotFrame['dots'][number]) {
  const fill =
    dot.color ?? (dot.depth === undefined ? ink.value : mixHex(props.paper, ink.value, dot.depth))
  const common = { fill, opacity: dot.opacity }
  return dot.d
    ? {
        ...common,
        d: dot.d,
        transform: `translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})`
      }
    : { ...common, cx: dot.x, cy: dot.y, r: dot.r }
}
</script>

<template>
  <svg
    ref="svg"
    :width="props.size"
    :height="props.size"
    :viewBox="`${-VB} ${-VB} ${VB * 2} ${VB * 2}`"
    role="img"
    :aria-label="props.label ?? t('app.botAria')"
    :style="acc || props.porte ? 'overflow: visible' : undefined"
    @pointerenter="onSurvol"
    @pointermove="onSurvol"
    @pointerleave="onQuitte"
    @pointerdown="onAppui"
  >
    <!--
      Pixel art : l'image du moteur rasterisee sur une grille basse resolution, un
      chemin par couleur. `crispEdges` garde des cases nettes a toute taille, y compris
      quand l'export la rasterise a 1024 px.
    -->
    <g v-if="pixels" data-pixels="1" shape-rendering="crispEdges">
      <path v-for="(c, i) in pixels" :key="i" :d="c.d" :fill="c.fill" />
    </g>
    <template v-else>
    <defs>
      <!--
        Les yeux sont de vrais trous perces dans le corps, pas
        des formes blanches posees dessus : ils restent donc automatiquement
        rognes par la silhouette quand ils glissent vers le bord.
      -->
      <mask
        :id="maskId"
        maskUnits="userSpaceOnUse"
        :x="-VB"
        :y="-VB"
        :width="VB * 2"
        :height="VB * 2"
      >
        <path :d="frame.bodyPath" fill="#fff" />
        <path
          v-for="(eye, i) in frame.eyes"
          :key="i"
          :d="eye.d"
          :transform="eye.matrix"
          :opacity="eye.alpha"
          fill="#000"
        />
      </mask>

      <linearGradient
        v-for="arc in frame.arcs"
        :id="`${uid}-${arc.id}`"
        :key="arc.id"
        gradientUnits="userSpaceOnUse"
        :x1="arc.grad.x1"
        :y1="arc.grad.y1"
        :x2="arc.grad.x2"
        :y2="arc.grad.y2"
      >
        <stop
          v-for="(c, i) in arc.grad.stops"
          :key="i"
          :offset="i / (arc.grad.stops.length - 1)"
          :stop-color="c"
        />
      </linearGradient>

      <!--
        3D douce. Tout reste dans le SVG (degrades et filtres), donc les exports le
        serialisent et le rasterisent tel quel. Le masque des yeux reste le PREMIER
        masque du document et les seules formes a matrice y sont les yeux : c'est ce que
        lit l'export anime.
      -->
      <template v-if="t3d">
        <!-- volume : lumiere en haut a gauche -->
        <radialGradient
          :id="`${uid}-vol`"
          gradientUnits="userSpaceOnUse"
          cx="-28"
          cy="-38"
          r="172"
          fx="-46"
          fy="-58"
        >
          <stop offset="0" :stop-color="t3d.clair" />
          <stop :offset="argile ? 0.5 : 0.44" :stop-color="t3d.base" />
          <stop offset="1" :stop-color="t3d.ombre" />
        </radialGradient>
        <filter :id="`${uid}-flou`" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur :stdDeviation="argile ? 6 : 8" />
        </filter>
        <filter :id="`${uid}-creux`" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <filter :id="`${uid}-reflet`" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur :stdDeviation="argile ? 13 : 6" />
        </filter>
        <!-- ombre interne legere : le bord bas droit s'assombrit vers l'interieur -->
        <filter :id="`${uid}-interne`" x="-10%" y="-10%" width="120%" height="120%">
          <feComponentTransfer in="SourceAlpha" result="inverse">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feOffset in="inverse" :dx="argile ? -7 : -5" :dy="argile ? -10 : -7" result="decale" />
          <feGaussianBlur in="decale" :stdDeviation="argile ? 10 : 5" result="flou" />
          <feComposite in="flou" in2="SourceAlpha" operator="in" result="bord" />
          <feFlood :flood-color="t3d.ombre" :flood-opacity="argile ? 0.7 : 0.45" />
          <feComposite in2="bord" operator="in" result="teinte" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="teinte" />
          </feMerge>
        </filter>
        <clipPath :id="`${uid}-clip`">
          <path :d="frame.bodyPath" />
        </clipPath>
      </template>
    </defs>

    <!-- moitie arriere des orbites : dessinee avant le corps, donc occultee -->
    <g fill="none" stroke-linecap="round">
      <path
        v-for="arc in frame.arcs"
        :key="`b${arc.id}`"
        :d="arc.back"
        :stroke="`url(#${uid}-${arc.id})`"
        :stroke-width="arc.width"
        :opacity="arc.opacity"
      />
    </g>


    <!--
      Vraie 3D : le corps et les yeux sont rendus par WebGL dans ce canvas, cale sur le
      viewBox. Il prend la place du corps SVG, entre la moitie arriere des anneaux et leur
      moitie avant, qui restent en SVG : l'ordre de profondeur ne change pas.
    -->
    <foreignObject v-if="vraie3d" :x="-VB" :y="-VB" :width="VB * 2" :height="VB * 2">
      <canvas
        ref="toile"
        :width="pxToile"
        :height="pxToile"
        data-vraie3d="1"
        :style="rendu === 'pixel3d' ? 'image-rendering: pixelated' : undefined"
        style="display: block; width: 100%; height: 100%"
      />
    </foreignObject>
    <g v-else :opacity="frame.bodyAlpha">
      <!-- 3D : ombre portee, coloree et floue, sous la forme -->
      <path
        v-if="t3d"
        :d="frame.bodyPath"
        :fill="t3d.portee"
        :opacity="argile ? 0.36 : 0.4"
        :transform="argile ? 'translate(0 8)' : 'translate(0 6)'"
        :filter="`url(#${uid}-flou)`"
      />
      <!--
        Fond opaque a la forme exacte du corps, sous le corps lui-meme.

        Les yeux sont des TROUS perces dans le corps, pas des formes blanches
        posees dessus : c'est ce qui les fait rogner tout seuls au bord de la
        silhouette, et ca ne change pas. Mais un trou laisse voir ce qui est
        dessine derriere — or la moitie arriere des anneaux du tourbillon l'est justement, pour etre occultees par le corps. Sans ce
        fond, un anneau qui passe derriere la boule reapparait DANS les yeux.

        Rempli avec `paper` et non en blanc pur : c'est exactement ce que les yeux
        laissaient voir jusqu'ici, le fond de la page. Les mettre en blanc les
        rendrait plus clairs que le fond, ce qui se verrait sur une grande boule.
      -->
      <path :d="frame.bodyPath" :fill="props.paper" />
      <!--
        3D : profondeur des yeux. Le corps perce, decale vers le bas a droite et flou,
        n'est visible qu'a travers les trous : il y pose l'ombre du rebord haut gauche,
        comme dans un creux. Meme masque que le corps, donc il suit les yeux, y compris
        dans l'export anime.
      -->
      <g v-if="t3d" :clip-path="`url(#${uid}-clip)`">
        <g transform="translate(3 5)" :filter="`url(#${uid}-creux)`">
          <g :mask="`url(#${maskId})`">
            <rect
              :x="-VB"
              :y="-VB"
              :width="VB * 2"
              :height="VB * 2"
              :fill="t3d.ombre"
              opacity="0.5"
            />
          </g>
        </g>
      </g>
      <!-- l'ombre interne se calcule sur la forme PERCEE, donc hors du masque -->
      <g v-if="t3d" :filter="`url(#${uid}-interne)`">
        <g :mask="`url(#${maskId})`">
          <rect :x="-VB" :y="-VB" :width="VB * 2" :height="VB * 2" :fill="`url(#${uid}-vol)`" />
          <!-- reflet : large et doux sur l'argile, net et vif sur la bulle -->
          <ellipse
            :cx="argile ? -34 : -40"
            :cy="argile ? -46 : -54"
            :rx="argile ? 48 : 30"
            :ry="argile ? 32 : 17"
            fill="#ffffff"
            :opacity="argile ? 0.22 : 0.8"
            transform="rotate(-32 -40 -52)"
            :filter="`url(#${uid}-reflet)`"
          />
          <!-- lumiere renvoyee par le sol, en bas a droite : seulement la bulle -->
          <ellipse
            v-if="!argile"
            cx="34"
            cy="62"
            rx="44"
            ry="20"
            fill="#ffffff"
            opacity="0.1"
            transform="rotate(-32 34 62)"
            :filter="`url(#${uid}-reflet)`"
          />
        </g>
      </g>
      <g v-else :mask="`url(#${maskId})`">
        <rect :x="-VB" :y="-VB" :width="VB * 2" :height="VB * 2" :fill="ink" />
      </g>
    </g>

    <g :opacity="decorAlpha">
      <component
        :is="dot.d ? 'path' : 'circle'"
        v-for="(dot, i) in frame.dots"
        :key="`pf${i}`"
        v-bind="dotAttrs(dot)"
      />
    </g>

    <!-- moitie avant des orbites -->
    <g fill="none" stroke-linecap="round">
      <path
        v-for="arc in frame.arcs"
        :key="`f${arc.id}`"
        :d="arc.front"
        :stroke="`url(#${uid}-${arc.id})`"
        :stroke-width="arc.width"
        :opacity="arc.opacity"
      />
    </g>


    <g v-if="objetSvg" :opacity="decorAlpha" :transform="objetDecalage || undefined" v-html="objetSvg" />
    </template>
    <!-- accessoire porte : meme description pour tous les rendus (`portes.ts`) -->
    <g v-if="porteTexte" data-porte="1" v-html="porteTexte" />
    <g v-if="portePixels" data-porte="1" shape-rendering="crispEdges">
      <path v-for="(c, i) in portePixels" :key="i" :d="c.d" :fill="c.fill" />
    </g>
  </svg>
</template>
