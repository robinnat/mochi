/**
 * `<mochi-bot>` : le Mochi en Web Component natif, sans dependance ni framework.
 *
 * Il marche partout ou il y a un DOM : HTML simple et tous les frameworks (React, Svelte, Angular...). On l'importe une
 * fois (`import './components/mochi-bot'`), ce qui declare la balise, puis on l'ecrit comme
 * n'importe quel element :
 *
 *   <mochi-bot shape="etoile" color="#2d5bff" mood="repos" size="200" coucou></mochi-bot>
 *
 * - Chaque option existe en ATTRIBUT (kebab-case, texte : `frozen-at="1.2"`, `contour`,
 *   `reflet="false"`, `accessoires='{"tete":"casquette"}'`) et en PROPRIETE JavaScript (camelCase,
 *   n'importe quelle valeur : `el.accessoires = { tete: 'casquette' }`, `el.geste = (t) => ...`).
 * - Evenements (`CustomEvent`, sans propagation) : `pret` a la premiere image 3D peinte (ou `sans3d` si le
 *   navigateur n'a pas WebGL), puis
 *   `statechange`, `blockchange`, `playingchange`, `elapsedchange` quand le lecteur avance
 *   (`event.detail` porte la nouvelle valeur).
 * - Methodes : `seek`, `rendAt`, `setMood`, `react`, `relacher`, `regarder`.
 * - Le Mochi est TOUJOURS rendu en vraie 3D (WebGL) : un `<canvas>` pose dans un `<svg>` du DOM ordinaire (pas de
 *   shadow DOM), qui porte aussi les petits effets des etats (points, anneaux, « z »). `el.svg` le donne directement ;
 *   les exports le figent en image (`figeToiles`). Sans WebGL, un court message remplace le Mochi : il n'y a plus de
 *   dessin 2D de secours.
 * - Retire de la page, il arrete sa boucle d'animation, ses ecouteurs et ses minuteurs. Deplace
 *   dans la page (meme tache), il garde son etat.
 * - La vraie 3D (Three.js) n'est chargee qu'au premier Mochi en 3D, et tous partagent UN contexte
 *   WebGL (voir `src/ui/trois/scene3d.ts`).
 *
 * Le moteur (`src/bot/`) rend une image pour une date donnee ; ce composant tient l'horloge, le
 * montage, les humeurs, le regard et les reactions, et peint l'image en 3D.
 */

import { BotEngine, type BotFrame } from '@/bot/engine'
import { clamp, easings } from '@/bot/math'
import { t } from '@/i18n'
import { lookTarget, TURN_TIME, type GazeScript } from '@/ui/gaze'
import { DEFAULT_EXPRESSION, EXPRESSION_BY_ID } from '@/bot/expressions'
import { couleurDe, DEFAULT_COLOR, DEFAULT_SHAPE, SHAPE_BY_ID, mixHex } from '@/bot/skins'
import { blockAt, defaultCycle, offsetOf, type Block } from '@/bot/cycles'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { STATE_BY_ID, type StateId } from '@/bot/states'
import { PORTE_IDS, type PorteId } from '@/bot/portes'
import { composer, zSommeil, type Geste } from '@/bot/gestes'
import { Humeurs, REACTION_DE_EVENEMENT, doitRedessiner, moodDe, type ReactionId } from '@/bot/humeurs'
import { DOUCEUR_DEFAUT, RENDU_3D_DEFAUT, type Douceur, type Rendu3d } from '@/ui/trois/rendu3d'
import { type Theme } from '@/ui/trois/theme'
import { themeCourant } from '@/ui/trois/themeCourant'
import type { Selection } from '@/bot/emplacements'
import { contourCourant, matiere3dDe, grillePixel, pixelEffectif, renduEffectif, type RenduId, type TaillePixelId } from '@/ui/rendu'
import { computed, dans, Portee, ref, sansSuivi, shallowRef, surNettoyage, triggerRef, watch, type Ref } from '@/ui/dom/reactif'
import { h, rendre, type Enfant, type VNode } from '@/ui/dom/h'

/* ------------------------------------------------------------------ options */

/** Les options du composant (proprietes JavaScript). */
export interface MochiBotProps {
  /** Largeur et hauteur, en pixels. */
  size: number
  /** identifiant de forme du personnalisateur */
  shape: string
  /** identifiant de couleur du personnalisateur, ou une couleur libre en hex (`#ff8800`, `#f80`) */
  color: string
  /** identifiant d'expression de repos du personnalisateur */
  expression: string
  /** couleur du fond, utilisee pour la brume de profondeur des particules */
  paper: string
  /** theme de la 3D : `light` ou `dark` (les yeux deviennent noirs) ; absent, le theme courant (`themeCourant`, clair par defaut) */
  theme: Theme | undefined
  /** accessoires par emplacements (tete, yeux, visage, bas, dos), 3D seulement ; voir `src/bot/emplacements.ts` */
  accessoires: Selection | null
  /**
   * Fige le rendu a cette date (en secondes depuis le debut de l'etat). Le moteur etant une fonction pure du temps,
   * on obtient une image reproductible au pixel pres, sans boucle d'animation.
   */
  frozenAt: number | undefined
  /** Montage joue par le lecteur : une suite d'etats, chacun tenu la duree de son bloc. Par defaut, le cycle releve sur la video. */
  cycle: Block[]
  /** Le regard suit le pointeur dans toute la fenetre (coupe les reactions). */
  follow: boolean
  /** Regard scripte de l'arrivee : evalue a chaque image avec le temps ecoule depuis qu'il a ete pose. */
  gaze: GazeScript | null
  /** Style de rendu (`3d` Soft, `flat3d` Flat, `pixel3d` Pixel) ; absent ou inconnu, le reglage courant (`renduCourant`). */
  rendu: RenduId | undefined
  /** Taille des pixels du style Pixel (`gros`, `moyen`, `fin`) : resolution de sa toile ; absente, le reglage courant. */
  pixel: TaillePixelId | undefined
  /** Matiere de la vraie 3D (`rendu` = 3d seulement). Absente : le defaut (`doux`). */
  rendu3d: Rendu3d
  /** Reglage de la matiere `doux` : `leger` ou `marque`. Ignore par les autres matieres. */
  douceur: Douceur
  /** Contour cartoon de la vraie 3D ; absent, le reglage courant (`contourCourant`). */
  contour: boolean | undefined
  /** Epaisseur du contour (facteur : 1 = l'epaisseur de base, 0,4 a 4). */
  epaisseurContour: number
  /** Petit reflet doux en haut a gauche de la matiere 3D `doux` (defaut : oui). */
  reflet: boolean
  /** Ombre portee au sol sous le corps, en 3D (defaut : oui). */
  ombre: boolean
  /** Ombrage du volume du corps, en 3D (defaut : oui). `false` : corps en aplat de couleur, yeux inchanges. */
  ombrage: boolean
  /** Angle du corps autour de l'axe vertical, en radians (vraie 3D seulement). 0 = de face. */
  yaw: number
  /** Geste (`src/bot/gestes.ts`) : petits ecarts ajoutes a la pose, fonction du temps de la scene. */
  geste: ((t: number) => Geste) | null
  /** Accessoire PORTE en 3D (`src/bot/portes.ts`, ancien jeu) : lunettes, chapeau, noeud, couronne, casque. */
  porte: PorteId | null
  /** Humeur de travail jouee en boucle (`repos`, `reflechit`, `travaille`, `attend`, `termine`, `bloque`, `dort`, ou les alias anglais). */
  mood: string | null
  /** Reactions a l'utilisateur (survol, tap, double tap, appui long, secousse). `false` les coupe. */
  interactions: boolean
  /** Salut a l'apparition (`coucou`), joue une fois au montage. */
  coucou: boolean
  /** Ordinateur portable 3D du mood `travaille`. `false` le masque. */
  ordinateur: boolean
  /** Plafond d'images par seconde de la boucle. Absent : une image par image du navigateur. */
  fps: number | undefined
  /** Texte alternatif ; absent, le libelle traduit. */
  label: string | undefined
  /** Plafond de densite du canvas 3D (pixels physiques par pixel CSS). */
  maxPixelRatio: number
  /** Lecteur : index du bloc courant du montage. */
  block: number
  /** Lecteur : etat du bloc courant (sortie). */
  state: StateId
  /** Lecteur : le montage avance-t-il. */
  playing: boolean
  /** Lecteur : temps ecoule dans le bloc courant (sortie). */
  elapsed: number
}

type Genre = 'nombre' | 'texte' | 'booleen' | 'json' | 'fonction'

interface DefProp {
  nom: keyof MochiBotProps
  genre: Genre
  /** valeur par defaut (une fabrique pour un tableau) */
  defaut: () => unknown
  /** pas d'attribut (fonction) */
  sansAttribut?: boolean
}

const d = <T>(v: T) => () => v

/** Toutes les options, leur type d'attribut et leur valeur par defaut. */
export const PROPRIETES: DefProp[] = [
  { nom: 'size', genre: 'nombre', defaut: d(320) },
  { nom: 'shape', genre: 'texte', defaut: d(DEFAULT_SHAPE) },
  { nom: 'color', genre: 'texte', defaut: d(DEFAULT_COLOR) },
  { nom: 'expression', genre: 'texte', defaut: d(DEFAULT_EXPRESSION) },
  { nom: 'paper', genre: 'texte', defaut: d('#f9f9f9') },
  { nom: 'theme', genre: 'texte', defaut: d(undefined) },
  { nom: 'accessoires', genre: 'json', defaut: d(null) },
  { nom: 'frozenAt', genre: 'nombre', defaut: d(undefined) },
  { nom: 'cycle', genre: 'json', defaut: () => defaultCycle().blocks },
  { nom: 'follow', genre: 'booleen', defaut: d(false) },
  { nom: 'gaze', genre: 'fonction', defaut: d(null), sansAttribut: true },
  { nom: 'rendu', genre: 'texte', defaut: d(undefined) },
  { nom: 'pixel', genre: 'texte', defaut: d(undefined) },
  { nom: 'rendu3d', genre: 'texte', defaut: d(RENDU_3D_DEFAUT) },
  { nom: 'douceur', genre: 'texte', defaut: d(DOUCEUR_DEFAUT) },
  { nom: 'contour', genre: 'booleen', defaut: d(undefined) },
  { nom: 'epaisseurContour', genre: 'nombre', defaut: d(1) },
  { nom: 'reflet', genre: 'booleen', defaut: d(true) },
  { nom: 'ombre', genre: 'booleen', defaut: d(true) },
  { nom: 'ombrage', genre: 'booleen', defaut: d(true) },
  { nom: 'yaw', genre: 'nombre', defaut: d(0) },
  { nom: 'geste', genre: 'fonction', defaut: d(null), sansAttribut: true },
  { nom: 'porte', genre: 'texte', defaut: d(null) },
  { nom: 'mood', genre: 'texte', defaut: d(null) },
  { nom: 'interactions', genre: 'booleen', defaut: d(true) },
  { nom: 'coucou', genre: 'booleen', defaut: d(false) },
  { nom: 'ordinateur', genre: 'booleen', defaut: d(true) },
  { nom: 'fps', genre: 'nombre', defaut: d(undefined) },
  { nom: 'label', genre: 'texte', defaut: d(undefined) },
  { nom: 'maxPixelRatio', genre: 'nombre', defaut: d(2) },
  { nom: 'block', genre: 'nombre', defaut: d(0) },
  { nom: 'state', genre: 'texte', defaut: d('idle') },
  { nom: 'playing', genre: 'booleen', defaut: d(false) },
  { nom: 'elapsed', genre: 'nombre', defaut: d(0) }
]

/** `frozenAt` -> `frozen-at` */
export const attributDe = (nom: string) => nom.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())

const PAR_ATTRIBUT = new Map(PROPRIETES.filter((p) => !p.sansAttribut).map((p) => [attributDe(p.nom), p]))

/** Lit un attribut selon le type de l'option. Attribut retire : `undefined`, donc la valeur par defaut. */
export function lireAttribut(genre: Genre, v: string | null): unknown {
  if (v === null) return undefined
  switch (genre) {
    case 'nombre': {
      const n = Number(v)
      return v.trim() === '' || !Number.isFinite(n) ? undefined : n
    }
    case 'booleen':
      return v !== 'false' && v !== '0'
    case 'json':
      try {
        return JSON.parse(v)
      } catch {
        return undefined
      }
    default:
      return v
  }
}

/** Evenements du lecteur, par option. */
const EVENEMENT_MODELE: Partial<Record<keyof MochiBotProps, string>> = {
  block: 'blockchange',
  state: 'statechange',
  playing: 'playingchange',
  elapsed: 'elapsedchange'
}

/* ------------------------------------------------------------------ style */

let styleAjoute = false
/**
 * Une seule regle, sans specificite (`:where`) : une classe posee par la page l'emporte toujours. Le Mochi se
 * comporte comme une image : en ligne, sa boite est celle de son dessin, et il se reduit avec son conteneur.
 */
function ajouterStyle() {
  if (styleAjoute || typeof document === 'undefined') return
  styleAjoute = true
  const s = document.createElement('style')
  s.dataset.mochiBot = ''
  s.textContent =
    ':where(mochi-bot){display:inline-block}:where(mochi-bot)>svg{display:block;max-width:100%;height:auto}'
  document.head.prepend(s)
}

/* ------------------------------------------------------------------ element */

const BaseElement: typeof HTMLElement =
  typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement

interface Interne {
  seek: (index: number, offset?: number) => void
  rendAt: (t: number) => void
  setMood: (id: string | null) => void
  react: (id: ReactionId | string) => boolean
  relacher: () => void
  regarder: (cible: { nx: number; ny: number } | null) => void
}

export class MochiBotElement extends BaseElement {
  static get observedAttributes() {
    return [...PAR_ATTRIBUT.keys()]
  }

  /** une ref par option : le dessin suit chacune */
  private _refs = new Map<string, Ref<unknown>>()
  /** valeur explicitement donnee (propriete ou attribut) ; absente, le defaut */
  private _poses = new Map<string, unknown>()
  private _portee: Portee | null = null
  private _interne: Interne | null = null
  private _svg: SVGSVGElement | null = null

  constructor() {
    super()
    for (const p of PROPRIETES) this._refs.set(p.nom, ref(p.defaut()))
  }

  /** Le `<svg>` dessine (pour l'exporter ou le mesurer). */
  get svg(): SVGSVGElement | null {
    return this._svg
  }

  /** Pose une option. `undefined` remet la valeur par defaut. */
  _poser(nom: string, v: unknown) {
    const def = PROPRIETES.find((p) => p.nom === nom)!
    if (v === undefined) this._poses.delete(nom)
    else this._poses.set(nom, v)
    this._refs.get(nom)!.value = v === undefined ? def.defaut() : v
  }

  _lire(nom: string): unknown {
    return this._refs.get(nom)!.value
  }

  /** Ecrit une sortie du lecteur et la signale. */
  _emettre(nom: keyof MochiBotProps, v: unknown) {
    const r = this._refs.get(nom)!
    if (Object.is(r.value, v)) return
    this._poses.set(nom, v)
    r.value = v
    this.dispatchEvent(new CustomEvent(EVENEMENT_MODELE[nom]!, { detail: v }))
  }

  attributeChangedCallback(nom: string, _avant: string | null, v: string | null) {
    const p = PAR_ATTRIBUT.get(nom)
    if (p) this._poser(p.nom, lireAttribut(p.genre, v))
  }

  connectedCallback() {
    // une propriete posee avant la declaration de la balise est une propriete propre : on la reprend
    for (const p of PROPRIETES) {
      if (Object.prototype.hasOwnProperty.call(this, p.nom)) {
        const v = (this as unknown as Record<string, unknown>)[p.nom]
        delete (this as unknown as Record<string, unknown>)[p.nom]
        this._poser(p.nom, v)
      }
    }
    if (this._portee) return
    ajouterStyle()
    const portee = new Portee()
    this._portee = portee
    // sans suivi : l'element peut etre insere pendant le dessin d'une page, qui ne doit pas dependre de lui
    this._interne = dans(portee, () => sansSuivi(() => monterBot(this)))
  }

  disconnectedCallback() {
    // un deplacement dans la page (retire puis remis dans la meme tache) ne doit rien perdre
    queueMicrotask(() => {
      if (this.isConnected || !this._portee) return
      this._portee.arreter()
      this._portee = null
      this._interne = null
      rendre(null, this)
      this._svg = null
    })
  }

  /** Deplace la tete de lecture : bloc `index`, `offset` secondes dans ce bloc. */
  seek(index: number, offset = 0) {
    this._interne?.seek(index, offset)
  }
  /** Rend le MONTAGE a la date absolue `t`, sans horloge (exports image par image). */
  rendAt(t: number) {
    this._interne?.rendAt(t)
  }
  /** Change d'humeur (`null` coupe la couche). Glisse de l'une a l'autre sans saut. */
  setMood(id: string | null) {
    this._interne?.setMood(id)
  }
  /** Joue une reaction (`sursaut`, `rigole`, `rougit`, `etourdi`, `coucou`) puis rend la main a l'humeur. */
  react(id: ReactionId | string): boolean {
    return this._interne?.react(id) ?? false
  }
  /** Fin d'une reaction tenue (appui long). */
  relacher() {
    this._interne?.relacher()
  }
  /** Regard du survol, hors evenement : `nx`, `ny` de -1 a 1 (droite et bas positifs), `null` pour lacher. */
  regarder(cible: { nx: number; ny: number } | null) {
    this._interne?.regarder(cible)
  }

  /** @internal le dessin vient d'etre pose */
  _majSvg(s: SVGSVGElement | null) {
    this._svg = s
  }
}

// une propriete JavaScript par option
for (const p of PROPRIETES) {
  Object.defineProperty(MochiBotElement.prototype, p.nom, {
    get(this: MochiBotElement) {
      return this._lire(p.nom)
    },
    set(this: MochiBotElement, v: unknown) {
      this._poser(p.nom, v)
    },
    configurable: true,
    enumerable: true
  })
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface MochiBotElement extends MochiBotProps {}

declare global {
  interface HTMLElementTagNameMap {
    'mochi-bot': MochiBotElement
  }
}

export const NOM_BALISE = 'mochi-bot'

/** Declare la balise (sans effet si elle l'est deja). Appele a l'import de ce module. */
export function definirMochiBot() {
  if (typeof customElements !== 'undefined' && !customElements.get(NOM_BALISE)) customElements.define(NOM_BALISE, MochiBotElement)
}
definirMochiBot()

/* ------------------------------------------------------------------ logique */

/**
 * Met en place un Mochi sur l'element : horloge, moteur, humeurs, regard, reactions et dessin.
 * Tout ce qui est cree ici s'arrete avec la portee de l'element.
 */
function monterBot(hote: MochiBotElement): Interne {
  const r = <K extends keyof MochiBotProps>(k: K) => (hote as unknown as { _refs: Map<string, Ref<MochiBotProps[K]>> })._refs.get(k)!
  // lecture suivie des options : `props.x` dans un calcul ou un dessin se relance quand `x` change
  const props = new Proxy({} as MochiBotProps, {
    get: (_, k: string) => r(k as keyof MochiBotProps).value
  })
  // sorties du lecteur : lues comme des refs, ecrites avec signalement
  const modele = <K extends 'block' | 'state' | 'playing' | 'elapsed'>(k: K): Ref<MochiBotProps[K]> => ({
    get value() {
      return r(k).value
    },
    set value(v) {
      hote._emettre(k, v)
    }
  })
  const block = modele('block')
  const state = modele('state')
  const playing = modele('playing')
  const elapsed = modele('elapsed')

  let pretEmis = false
  const R = RAYON
  const VB = DEMI_VIEWBOX

  const shapeRadii = computed(() => SHAPE_BY_ID.get(props.shape)?.radii ?? null)
  const ink = computed(() => couleurDe(props.color))
  const expression = computed(() => EXPRESSION_BY_ID.get(props.expression) ?? null)

  /* --------------------------------------------------------- style de rendu */

  const rendu = computed(() => renduEffectif(props.rendu))
  const contourEffectif = computed(() => props.contour ?? contourCourant.value)
  const grille = computed(() => grillePixel(pixelEffectif(props.pixel)))

  const engine = new BotEngine(R, state.value, shapeRadii.value, expression.value)
  const frame = shallowRef<BotFrame>(engine.sample(props.frozenAt ?? 0))
  const uid = Math.random().toString(36).slice(2, 8)

  const temps = ref(props.frozenAt ?? 0)

  /* ------------------------------------------------- humeurs et reactions */

  const reduit = ref(false)
  const humeurs = new Humeurs(moodDe(props.mood), { base: expression.value })
  /** Petits « z » de l'humeur `dort`, dessines en SVG par-dessus tous les rendus. */
  const zMarques = computed(() => {
    if (moodDe(props.mood) !== 'dort') return []
    return zSommeil(reduit.value || props.frozenAt !== undefined ? 1.2 : temps.value).map((z, i) => {
      const x = z.x * 100 + 18
      const y = z.y * 100 - 10
      const k = z.taille * 100
      return {
        i,
        d: `M${(x - k / 2).toFixed(1)} ${(y - k / 2).toFixed(1)}h${k.toFixed(1)}l${(-k).toFixed(1)} ${k.toFixed(1)}h${k.toFixed(1)}`,
        op: reduit.value || props.frozenAt !== undefined ? 0.8 - 0.3 * i : z.opacite
      }
    })
  })
  const couleurZ = computed(() => mixHex(ink.value, '#1a1630', 0.5))
  const humeurActive = computed(() => moodDe(props.mood) !== null)

  /** Accessoire porte connu, ou rien. */
  const porte = computed<PorteId | null>(() => (props.porte && (PORTE_IDS as string[]).includes(props.porte) ? props.porte : null))

  const gesteA = (t: number): Geste | undefined => {
    const b = props.geste ? props.geste(t) : undefined
    const x = humeurs.sample(t)
    return x ? (b ? composer(b, x) : x) : b
  }

  let raf = 0
  let nextAt = Infinity
  let last = 0
  let clock = 0
  let blockStart = 0

  /** Pose le bloc `i` : etat, moteur, et date de fin. */
  function apply(i: number, from = 0) {
    const b = props.cycle[i]
    if (!b) {
      nextAt = Infinity
      return
    }
    blockStart = clock - from
    elapsed.value = from
    const etat = humeurActive.value ? 'idle' : b.state
    state.value = etat
    engine.setState(etat, clock)
    nextAt = playing.value && !humeurActive.value ? blockStart + b.duration : Infinity
  }

  function goToBlock(i: number) {
    block.value = i
    apply(i)
  }

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
   * Rend le MONTAGE a la date absolue `t`, sans horloge : capture d'un cycle entier hors ecran, image par image.
   * Chaque changement d'etat est date a l'offset ABSOLU de son bloc ; un retour en arriere repart sans historique.
   */
  let dernierBloc = -1
  function rendAt(t: number) {
    const blocs = props.cycle
    if (!blocs.length) return
    const { index } = blockAt(blocs, t)
    if (index !== dernierBloc) {
      const b = blocs[index]!
      state.value = b.state
      if (index < dernierBloc) engine.reset(b.state, offsetOf(blocs, index))
      else engine.setState(b.state, offsetOf(blocs, index))
      dernierBloc = index
    }
    temps.value = t
    frame.value = engine.sample(t, gesteA(t))
    triggerRef(frame)
  }

  function setMood(id: string | null) {
    humeurs.setMood(id, clock)
    apply(block.value, elapsed.value)
    redrawFrozen()
  }
  function react(id: ReactionId | string) {
    if (!humeurs.react(id, clock)) return false
    redrawFrozen()
    return true
  }
  function relacher() {
    humeurs.relacher(clock)
  }
  function regarder(cible: { nx: number; ny: number } | null) {
    humeurs.regarder(cible, clock)
  }

  /* -------------------------------------------------------------- vraie 3D */

  type Module3d = typeof import('@/ui/trois/scene3d')
  const m3d = shallowRef<Module3d | null>(null)
  /** Le navigateur n'a pas de WebGL (ou le module 3D n'a pas pu se charger) : un message remplace le Mochi. */
  const sans3d = ref(false)
  let toile: HTMLCanvasElement | null = null
  const toileRef = ref(0)
  const vraie3d = computed(() => m3d.value !== null)
  const pxToile = computed(() =>
    rendu.value === 'pixel3d'
      ? grille.value
      : Math.round(props.size * Math.min(props.maxPixelRatio, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
  )

  // la 3D (Three.js) est chargee au montage, une fois pour tous les Mochi de la page
  import('@/ui/trois/scene3d')
    .then((m) => {
      if (m.webglDisponible()) m3d.value = m
      else signalerSans3d()
    })
    // module introuvable : meme repli que sans WebGL
    .catch(signalerSans3d)
  function signalerSans3d() {
    sans3d.value = true
    hote.dispatchEvent(new CustomEvent('sans3d'))
  }

  const decorAlpha = computed(() => (vraie3d.value && props.yaw ? Math.max(0, Math.cos(props.yaw)) ** 3 : 1))

  /* ------------------------------------------------- ordinateur du mood « travaille » */

  let ordiK = 0
  let ordiVers = 0
  const ordiVoulu = () => props.ordinateur !== false && humeurs.mood === 'travaille'
  function avancerOrdi(dt: number, net = false) {
    const cible = ordiVoulu() ? 1 : 0
    if (cible !== ordiVers) ordiVers = cible
    ordiK = net ? cible : Math.min(1, Math.max(0, ordiK + Math.sign(cible - ordiK) * Math.min(Math.abs(cible - ordiK), dt / 0.45)))
    humeurs.regardOrdi = tourOrdi()
  }
  function tourOrdi(): number {
    return ordiVers >= 1 ? Math.min(1, ordiK * 1.2) : ordiK * ordiK * (3 - 2 * ordiK)
  }
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
    if (!vraie3d.value || !m || !toile) return
    m.rendreAvatar(toile, frame.value, ink.value, props.paper, rendu3dEff.value, contourEffectif.value, props.douceur, props.reflet, props.shape, props.yaw + 0.3 * tourOrdi(), porte.value, props.accessoires ?? {}, undefined, themeEff.value, undefined, ordiEchelle(), props.ombre, props.ombrage, props.epaisseurContour)
    if (!pretEmis) {
      pretEmis = true
      hote.dataset.pret = '1'
      hote.dispatchEvent(new CustomEvent('pret'))
    }
  }

  /** Changement de forme : une fois le morph fini, les accessoires 3D se recalent sur la forme finale. */
  let minuteurForme = 0
  watch(
    () => props.shape,
    () => {
      clearTimeout(minuteurForme)
      minuteurForme = window.setTimeout(() => {
        if (!vraie3d.value || !m3d.value) return
        m3d.value.invaliderAccessoires3d()
        dessiner3d()
      }, BotEngine.SHAPE_MORPH * 1000 + 120)
    }
  )
  surNettoyage(() => clearTimeout(minuteurForme))

  watch(
    [frame, vraie3d, toileRef, ink, pxToile, rendu3dEff, () => props.douceur, () => props.reflet, () => props.yaw, porte, themeEff, () => props.accessoires, () => props.ombre, () => props.ombrage, () => contourEffectif.value, () => props.epaisseurContour],
    dessiner3d,
    { flush: 'post' }
  )

  /* ------------------------------------------------------- regard qui suit */

  let svg: SVGSVGElement | null = null
  let pointer: { x: number; y: number } | null = null
  let aiming = false
  let turnSince = 0

  function onPointerMove(event: PointerEvent) {
    // le tactile n'a pas de curseur qui traine
    if (event.pointerType === 'touch') return
    pointer = { x: event.clientX, y: event.clientY }
  }
  function onPointerLeave() {
    pointer = null
  }
  function release() {
    if (!aiming) return
    engine.setLook(null, clock, TURN_TIME)
    aiming = false
  }
  /** Vise le pointeur ; le rectangle est relu a chaque image (l'avatar peut bouger). */
  function aim() {
    if (!STATE_BY_ID.get(state.value)?.baseFace) {
      release()
      return
    }
    const box = svg?.getBoundingClientRect()
    // boite sans surface (volet masque) : rien a viser, et surtout pas de NaN dans le moteur
    if (!box || box.width === 0 || box.height === 0) return
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

  let gazeSince = 0
  let scripted = false
  /** Rattrapage court mais non nul (a zero, le moteur divise zero par zero). */
  const SCRIPT_MORPH = 1 / 60
  function scriptedGaze(run: GazeScript) {
    engine.setLook(run(clock - gazeSince), clock, SCRIPT_MORPH)
  }
  watch(
    () => props.gaze,
    (run) => {
      if (run) {
        gazeSince = clock
        scripted = true
        // valeur de depart deja pleinement appliquee a la premiere image
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

  const TAP_MAX = 320
  const DOUBLE_MAX = 380
  const APPUI_LONG = 450
  const DEPLACEMENT_MAX = 10

  const interactif = computed(() => props.interactions && props.frozenAt === undefined && !props.follow)
  let appui: { x: number; y: number; t: number; minuteur: number; long: boolean } | null = null
  let dernierTap = -1e9
  let secousse: { sens: number; t: number }[] = []
  let dernierDx = 0
  let tours: { t: number; d: number }[] = []
  let yawPrec = props.yaw

  function normalise(e: PointerEvent): { nx: number; ny: number } | null {
    const box = svg?.getBoundingClientRect()
    if (!box || box.width === 0 || box.height === 0) return null
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
      minuteur: window.setTimeout(() => {
        if (!appui) return
        appui.long = true
        humeurs.react(REACTION_DE_EVENEMENT.longue, clock)
      }, APPUI_LONG)
    }
    secousse = []
    dernierDx = 0
    // le parent peut capturer le pointeur (glisser pour tourner) : on suit la fin sur la fenetre
    window.addEventListener('pointermove', onGlisse)
    window.addEventListener('pointerup', onRelache)
    window.addEventListener('pointercancel', onRelache)
  }
  function onGlisse(e: PointerEvent) {
    if (!appui) return
    const dx = e.clientX - appui.x
    const dy = e.clientY - appui.y
    if (!appui.long && Math.hypot(dx, dy) > DEPLACEMENT_MAX) {
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
    if (e.timeStamp - dernierTap < DOUBLE_MAX) {
      dernierTap = -1e9
      humeurs.react(REACTION_DE_EVENEMENT.double, clock)
    } else {
      dernierTap = e.timeStamp
      humeurs.react(REACTION_DE_EVENEMENT.tap, clock)
    }
  }

  /** Tourne vite : le modele 3D (`yaw`) fait plus d'un tour en moins d'une seconde. */
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

  let dernierDessin = 0
  function tick(ms: number) {
    raf = requestAnimationFrame(tick)
    // horloge de scene a delta borne : un onglet masque puis reaffiche reprend sans sauter
    const dt = last ? Math.min((ms - last) / 1000, 0.064) : 0
    last = ms
    clock += dt
    // le stop ne gele pas l'horloge : seuls l'enchainement et la tete de lecture sont suspendus
    if (playing.value) {
      if (clock >= nextAt && props.cycle.length) goToBlock((block.value + 1) % props.cycle.length)
      else elapsed.value = clock - blockStart
    }
    if (props.follow) aim()
    else if (props.gaze) scriptedGaze(props.gaze)
    if (!doitRedessiner(ms, dernierDessin, props.fps)) return
    dernierDessin = ms
    temps.value = clock
    avancerOrdi(dt)
    frame.value = engine.sample(clock, gesteA(clock))
    triggerRef(frame)
  }

  /** Redessine sans la boucle : sert aux images figees quand une option change. */
  function redrawFrozen() {
    if (props.frozenAt === undefined) return
    temps.value = props.frozenAt
    avancerOrdi(0, true)
    frame.value = engine.sample(props.frozenAt, gesteA(props.frozenAt))
    triggerRef(frame)
  }

  watch(
    () => block.value,
    (i) => {
      apply(i, pendingOffset)
      pendingOffset = 0
    }
  )
  // changement d'etat venu de l'exterieur (images figees) ; deja applique par `rendAt` ou `apply` sinon
  watch(
    () => state.value,
    (id) => {
      if (engine.state === id) return
      engine.setState(id, clock)
      redrawFrozen()
    }
  )
  watch(
    () => playing.value,
    (on) => {
      if (on) apply(block.value, elapsed.value)
      else nextAt = Infinity
    }
  )
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
    // l'horloge passee : le moteur morphe vers la nouvelle forme
    engine.setShape(radii, clock)
    redrawFrozen()
  })
  watch(expression, (expr) => {
    humeurs.setBase(expr)
    engine.setExpression(expr, clock)
    redrawFrozen()
  })
  watch(() => props.frozenAt, redrawFrozen)

  function detach() {
    window.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerleave', onPointerLeave)
  }
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
  watch([() => props.geste, () => props.porte], redrawFrozen)

  /* ------------------------------------------------------------------ dessin */

  function dotAttrs(dot: BotFrame['dots'][number]) {
    const fill = dot.color ?? (dot.depth === undefined ? ink.value : mixHex(props.paper, ink.value, dot.depth))
    const common = { fill, opacity: dot.opacity }
    return dot.d
      ? { ...common, d: dot.d, transform: `translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})` }
      : { ...common, cx: dot.x, cy: dot.y, r: dot.r }
  }

  function dessin(): VNode {
    const f = frame.value
    const enfants: Enfant[] = []
    enfants.push(
      h(
        'defs',
        null,
        f.arcs.map((arc) =>
          h(
            'linearGradient',
            { key: arc.id, id: `${uid}-${arc.id}`, gradientUnits: 'userSpaceOnUse', x1: arc.grad.x1, y1: arc.grad.y1, x2: arc.grad.x2, y2: arc.grad.y2 },
            arc.grad.stops.map((c, i) => h('stop', { key: i, offset: i / (arc.grad.stops.length - 1), 'stop-color': c }))
          )
        )
      )
    )
    // moitie arriere des orbites : posee avant le corps 3D, donc cachee par lui
    enfants.push(
      h(
        'g',
        { fill: 'none', 'stroke-linecap': 'round' },
        f.arcs.map((arc) => h('path', { key: `b${arc.id}`, d: arc.back, stroke: `url(#${uid}-${arc.id})`, 'stroke-width': arc.width, opacity: arc.opacity }))
      )
    )
    if (vraie3d.value) {
      // le corps, les yeux et les accessoires sont rendus par WebGL dans ce canvas, cale sur le viewBox
      enfants.push(
        h(
          'foreignObject',
          { key: 'fo', x: -VB, y: -VB, width: VB * 2, height: VB * 2 },
          h('canvas', {
            width: pxToile.value,
            height: pxToile.value,
            'data-vraie3d': '1',
            style: rendu.value === 'pixel3d' ? 'image-rendering: pixelated; display: block; width: 100%; height: 100%' : 'display: block; width: 100%; height: 100%',
            ref: (el: Element | null) => {
              toile = el as HTMLCanvasElement | null
              toileRef.value++
            }
          })
        )
      )
    } else if (sans3d.value) {
      // pas de WebGL : pas de dessin 2D de secours, un message court a la place du Mochi
      enfants.push(
        h(
          'text',
          { key: 'sans3d', 'data-sans3d': '1', x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 18, 'font-family': 'system-ui, sans-serif', fill: '#8a8a8a' },
          t('app.sans3d')
        )
      )
    }
    enfants.push(h('g', { opacity: decorAlpha.value }, f.dots.map((dot, i) => h(dot.d ? 'path' : 'circle', { key: `pf${i}`, ...dotAttrs(dot) }))))
    // moitie avant des orbites
    enfants.push(
      h(
        'g',
        { fill: 'none', 'stroke-linecap': 'round' },
        f.arcs.map((arc) => h('path', { key: `f${arc.id}`, d: arc.front, stroke: `url(#${uid}-${arc.id})`, 'stroke-width': arc.width, opacity: arc.opacity }))
      )
    )
    const z = zMarques.value
    if (z.length)
      enfants.push(
        h(
          'g',
          { key: 'zzz', 'data-zzz': '1', fill: 'none', stroke: couleurZ.value, 'stroke-width': '10', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
          z.map((m) => h('path', { key: m.i, d: m.d, opacity: m.op }))
        )
      )
    return h(
      'svg',
      {
        width: props.size,
        height: props.size,
        viewBox: `${-VB} ${-VB} ${VB * 2} ${VB * 2}`,
        role: 'img',
        'aria-label': props.label ?? t('app.botAria'),
        style: porte.value || z.length ? 'overflow: visible' : undefined,
        onPointerenter: onSurvol,
        onPointermove: onSurvol,
        onPointerleave: onQuitte,
        onPointerdown: onAppui,
        ref: (el: Element | null) => {
          svg = el as SVGSVGElement | null
          hote._majSvg(svg)
        }
      },
      enfants
    )
  }

  // le dessin est un effet : il se refait (en file, une fois par tache, avant le dessin 3D) quand ce qu'il lit change
  watch(dessin, (v) => rendre(v, hote))

  /* ------------------------------------------------------------------ montage */

  let mqReduit: MediaQueryList | null = null
  const majReduit = () => {
    reduit.value = !!mqReduit?.matches
    humeurs.reduit = reduit.value
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    mqReduit = window.matchMedia('(prefers-reduced-motion: reduce)')
    majReduit()
    mqReduit.addEventListener?.('change', majReduit)
  }
  rendre(dessin(), hote)

  if (props.frozenAt !== undefined) redrawFrozen()
  else {
    if (props.coucou) {
      // mouvement reduit : un simple fondu ; sinon la reaction fait grandir le Mochi
      if (reduit.value) (svg as SVGSVGElement | null)?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' })
      else humeurs.react(REACTION_DE_EVENEMENT.arrivee, clock)
    }
    // le curseur peut arriver deja pose
    apply(block.value, elapsed.value)
    raf = requestAnimationFrame(tick)
  }

  surNettoyage(() => {
    cancelAnimationFrame(raf)
    detach()
    clearTimeout(appui?.minuteur)
    window.removeEventListener('pointermove', onGlisse)
    window.removeEventListener('pointerup', onRelache)
    window.removeEventListener('pointercancel', onRelache)
    mqReduit?.removeEventListener?.('change', majReduit)
  })

  return { seek, rendAt, setMood, react, relacher, regarder }
}
