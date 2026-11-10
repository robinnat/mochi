/**
 * `<mochi-bot>` : le Mochi en Web Component natif, sans dependance ni framework.
 *
 * Il marche partout ou il y a un DOM : HTML simple et tous les frameworks (React, Svelte, Angular...). On l'importe une
 * fois (`import './components/mochi-bot'`), ce qui declare la balise, puis on l'ecrit comme
 * n'importe quel element :
 *
 *   <mochi-bot shape="etoile" color="#2d5bff" mood="repos" size="200" coucou></mochi-bot>
 *
 * - Chaque option existe en ATTRIBUT (kebab-case, texte : `frozen-at="1.2"`, `outline`,
 *   `highlight="false"`, `accessories='{"head":"cap"}'`) et en PROPRIETE JavaScript (camelCase,
 *   n'importe quelle valeur : `el.accessories = { head: 'cap' }`, `el.gesture = (t) => ...`).
 * - Evenements (`CustomEvent`, sans propagation) : `ready` a la premiere image 3D peinte (ou `no3d` si le
 *   navigateur n'a pas WebGL), puis
 *   `statechange`, `blockchange`, `playingchange`, `elapsedchange` quand le lecteur avance
 *   (`event.detail` porte la nouvelle valeur).
 * - Methodes : `seek`, `renderAt`, `setMood`, `react`, `release`, `lookAt`.
 * - Le Mochi est TOUJOURS rendu en vraie 3D (WebGL) : un `<canvas>` pose dans un `<svg>` du DOM ordinaire (pas de
 *   shadow DOM), qui porte aussi les petits effets des etats (points, anneaux, « z »). `el.svg` le donne directement ;
 *   les exports le figent en image (`freezeCanvases`). Sans WebGL, un court message remplace le Mochi : il n'y a plus de
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
import { colorOf, DEFAULT_COLOR, DEFAULT_SHAPE, SHAPE_BY_ID, mixHex } from '@/bot/skins'
import { blockAt, defaultCycle, offsetOf, type Block } from '@/bot/cycles'
import { HALF_VIEWBOX, RADIUS } from '@/bot/frame'
import { STATE_BY_ID, type StateId } from '@/bot/states'
import { WORN_IDS, type WornId } from '@/bot/worn'
import { composer, sleepZ, type Gesture } from '@/bot/gestures'
import { Moods, REACTION_FOR_EVENT, mustRedraw, resolveMood, type ReactionId } from '@/bot/moods'
import { DEFAULT_SOFTNESS, DEFAULT_MATERIAL, type Softness, type Material } from '@/ui/3d/material'
import { type Theme } from '@/ui/3d/theme'
import { currentTheme } from '@/ui/3d/currentTheme'
import type { AccessorySelection } from '@/bot/slots'
import { currentOutline, materialFor, pixelGrid, effectivePixel, effectiveRenderStyle, type RenderStyleId, type PixelSizeId } from '@/ui/renderStyle'
import { computed, within, Scope, ref, untracked, shallowRef, onCleanup, triggerRef, watch, type Ref } from '@/ui/dom/reactive'
import { h, render, type Child, type VNode } from '@/ui/dom/h'

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
  /** theme de la 3D : `light` ou `dark` (les yeux deviennent noirs) ; absent, le theme courant (`currentTheme`, clair par defaut) */
  theme: Theme | undefined
  /** accessoires par emplacements (tete, yeux, visage, bas, dos), 3D seulement ; voir `src/bot/emplacements.ts` */
  accessories: AccessorySelection | null
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
  /** Style de rendu (`3d` Soft, `flat3d` Flat, `pixel3d` Pixel) ; absent ou inconnu, le reglage courant (`currentRenderStyle`). */
  renderStyle: RenderStyleId | undefined
  /** Taille des pixels du style Pixel (`large`, `medium`, `end`) : resolution de sa toile ; absente, le reglage courant. */
  pixel: PixelSizeId | undefined
  /** Matiere de la vraie 3D (`renderStyle` = 3d seulement). Absente : le defaut (`soft`). */
  material: Material
  /** Reglage de la matiere `soft` : `light` ou `strong`. Ignore par les autres matieres. */
  softness: Softness
  /** Contour cartoon de la vraie 3D ; absent, le reglage courant (`currentOutline`). */
  outline: boolean | undefined
  /** Epaisseur du contour (facteur : 1 = l'epaisseur de base, 0,4 a 4). */
  outlineWidth: number
  /** Petit reflet doux en haut a gauche de la matiere 3D `soft` (defaut : oui). */
  highlight: boolean
  /** Ombre portee au sol sous le corps, en 3D (defaut : oui). */
  shadow: boolean
  /** Ombrage du volume du corps, en 3D (defaut : oui). `false` : corps en aplat de couleur, yeux inchanges. */
  shading: boolean
  /** Angle du corps autour de l'axe vertical, en radians (vraie 3D seulement). 0 = de face. */
  yaw: number
  /** Geste (`src/bot/gestures.ts`) : petits ecarts ajoutes a la pose, fonction du temps de la scene. */
  gesture: ((t: number) => Gesture) | null
  /** Accessoire PORTE en 3D (`src/bot/portes.ts`, ancien jeu) : lunettes, chapeau, noeud, couronne, casque. */
  worn: WornId | null
  /** Humeur de travail jouee en boucle (`idle`, `thinking`, `working`, `waiting`, `done`, `blocked`, `asleep`, ou les alias anglais). */
  mood: string | null
  /** Reactions a l'utilisateur (survol, tap, double tap, appui long, secousse). `false` les coupe. */
  interactions: boolean
  /** Salut a l'apparition (`wave`), joue une fois au montage. */
  wave: boolean
  /** Ordinateur portable 3D du mood `working`. `false` le masque. */
  laptop: boolean
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

type Kind = 'number' | 'text' | 'boolean' | 'json' | 'function'

interface DefProp {
  name: keyof MochiBotProps
  kind: Kind
  /** valeur par defaut (une fabrique pour un tableau) */
  initial: () => unknown
  /** pas d'attribut (fonction) */
  withoutAttribute?: boolean
}

const d = <T>(v: T) => () => v

/** Toutes les options, leur type d'attribut et leur valeur par defaut. */
export const PROPERTIES: DefProp[] = [
  { name: 'size', kind: 'number', initial: d(320) },
  { name: 'shape', kind: 'text', initial: d(DEFAULT_SHAPE) },
  { name: 'color', kind: 'text', initial: d(DEFAULT_COLOR) },
  { name: 'expression', kind: 'text', initial: d(DEFAULT_EXPRESSION) },
  { name: 'paper', kind: 'text', initial: d('#f9f9f9') },
  { name: 'theme', kind: 'text', initial: d(undefined) },
  { name: 'accessories', kind: 'json', initial: d(null) },
  { name: 'frozenAt', kind: 'number', initial: d(undefined) },
  { name: 'cycle', kind: 'json', initial: () => defaultCycle().blocks },
  { name: 'follow', kind: 'boolean', initial: d(false) },
  { name: 'gaze', kind: 'function', initial: d(null), withoutAttribute: true },
  { name: 'renderStyle', kind: 'text', initial: d(undefined) },
  { name: 'pixel', kind: 'text', initial: d(undefined) },
  { name: 'material', kind: 'text', initial: d(DEFAULT_MATERIAL) },
  { name: 'softness', kind: 'text', initial: d(DEFAULT_SOFTNESS) },
  { name: 'outline', kind: 'boolean', initial: d(undefined) },
  { name: 'outlineWidth', kind: 'number', initial: d(1) },
  { name: 'highlight', kind: 'boolean', initial: d(true) },
  { name: 'shadow', kind: 'boolean', initial: d(true) },
  { name: 'shading', kind: 'boolean', initial: d(true) },
  { name: 'yaw', kind: 'number', initial: d(0) },
  { name: 'gesture', kind: 'function', initial: d(null), withoutAttribute: true },
  { name: 'worn', kind: 'text', initial: d(null) },
  { name: 'mood', kind: 'text', initial: d(null) },
  { name: 'interactions', kind: 'boolean', initial: d(true) },
  { name: 'wave', kind: 'boolean', initial: d(false) },
  { name: 'laptop', kind: 'boolean', initial: d(true) },
  { name: 'fps', kind: 'number', initial: d(undefined) },
  { name: 'label', kind: 'text', initial: d(undefined) },
  { name: 'maxPixelRatio', kind: 'number', initial: d(2) },
  { name: 'block', kind: 'number', initial: d(0) },
  { name: 'state', kind: 'text', initial: d('idle') },
  { name: 'playing', kind: 'boolean', initial: d(false) },
  { name: 'elapsed', kind: 'number', initial: d(0) }
]

/** `frozenAt` -> `frozen-at` */
export const attributeOf = (name: string) => name.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())

const BY_ATTRIBUTE = new Map(PROPERTIES.filter((p) => !p.withoutAttribute).map((p) => [attributeOf(p.name), p]))

/** Lit un attribut selon le type de l'option. Attribut retire : `undefined`, donc la valeur par defaut. */
export function readAttribute(kind: Kind, v: string | null): unknown {
  if (v === null) return undefined
  switch (kind) {
    case 'number': {
      const n = Number(v)
      return v.trim() === '' || !Number.isFinite(n) ? undefined : n
    }
    case 'boolean':
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
const EVENT_FOR_PROP: Partial<Record<keyof MochiBotProps, string>> = {
  block: 'blockchange',
  state: 'statechange',
  playing: 'playingchange',
  elapsed: 'elapsedchange'
}

/* ------------------------------------------------------------------ style */

let styleAdds = false
/**
 * Une seule regle, sans specificite (`:where`) : une classe posee par la page l'emporte toujours. Le Mochi se
 * comporte comme une image : en ligne, sa boite est celle de son dessin, et il se reduit avec son conteneur.
 */
function addStyle() {
  if (styleAdds || typeof document === 'undefined') return
  styleAdds = true
  const s = document.createElement('style')
  s.dataset.mochiBot = ''
  s.textContent =
    ':where(mochi-bot){display:inline-block}:where(mochi-bot)>svg{display:block;max-width:100%;height:auto}'
  document.head.prepend(s)
}

/* ------------------------------------------------------------------ element */

const BaseElement: typeof HTMLElement =
  typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement

interface Internal {
  seek: (index: number, offset?: number) => void
  renderAt: (t: number) => void
  setMood: (id: string | null) => void
  react: (id: ReactionId | string) => boolean
  release: () => void
  lookAt: (target: { nx: number; ny: number } | null) => void
}

export class MochiBotElement extends BaseElement {
  static get observedAttributes() {
    return [...BY_ATTRIBUTE.keys()]
  }

  /** une ref par option : le dessin suit chacune */
  private _refs = new Map<string, Ref<unknown>>()
  /** valeur explicitement donnee (propriete ou attribut) ; absente, le defaut */
  private _poses = new Map<string, unknown>()
  private _scope: Scope | null = null
  private _internal: Internal | null = null
  private _svg: SVGSVGElement | null = null

  constructor() {
    super()
    for (const p of PROPERTIES) this._refs.set(p.name, ref(p.initial()))
  }

  /** Le `<svg>` dessine (pour l'exporter ou le mesurer). */
  get svg(): SVGSVGElement | null {
    return this._svg
  }

  /** Pose une option. `undefined` remet la valeur par defaut. */
  _set(name: string, v: unknown) {
    const def = PROPERTIES.find((p) => p.name === name)!
    if (v === undefined) this._poses.delete(name)
    else this._poses.set(name, v)
    this._refs.get(name)!.value = v === undefined ? def.initial() : v
  }

  _read(name: string): unknown {
    return this._refs.get(name)!.value
  }

  /** Ecrit une sortie du lecteur et la signale. */
  _emit(name: keyof MochiBotProps, v: unknown) {
    const r = this._refs.get(name)!
    if (Object.is(r.value, v)) return
    this._poses.set(name, v)
    r.value = v
    this.dispatchEvent(new CustomEvent(EVENT_FOR_PROP[name]!, { detail: v }))
  }

  attributeChangedCallback(name: string, _before: string | null, v: string | null) {
    const p = BY_ATTRIBUTE.get(name)
    if (p) this._set(p.name, readAttribute(p.kind, v))
  }

  connectedCallback() {
    // une propriete posee avant la declaration de la balise est une propriete propre : on la reprend
    for (const p of PROPERTIES) {
      if (Object.prototype.hasOwnProperty.call(this, p.name)) {
        const v = (this as unknown as Record<string, unknown>)[p.name]
        delete (this as unknown as Record<string, unknown>)[p.name]
        this._set(p.name, v)
      }
    }
    if (this._scope) return
    addStyle()
    const scope = new Scope()
    this._scope = scope
    // sans suivi : l'element peut etre insere pendant le dessin d'une page, qui ne doit pas dependre de lui
    this._internal = within(scope, () => untracked(() => mountBot(this)))
  }

  disconnectedCallback() {
    // un deplacement dans la page (retire puis remis dans la meme tache) ne doit rien perdre
    queueMicrotask(() => {
      if (this.isConnected || !this._scope) return
      this._scope.stop()
      this._scope = null
      this._internal = null
      render(null, this)
      this._svg = null
    })
  }

  /** Deplace la tete de lecture : bloc `index`, `offset` secondes dans ce bloc. */
  seek(index: number, offset = 0) {
    this._internal?.seek(index, offset)
  }
  /** Rend le MONTAGE a la date absolue `t`, sans horloge (exports image par image). */
  renderAt(t: number) {
    this._internal?.renderAt(t)
  }
  /** Change d'humeur (`null` coupe la couche). Glisse de l'une a l'autre sans saut. */
  setMood(id: string | null) {
    this._internal?.setMood(id)
  }
  /** Joue une reaction (`startle`, `laugh`, `blush`, `dizzy`, `wave`) puis rend la main a l'humeur. */
  react(id: ReactionId | string): boolean {
    return this._internal?.react(id) ?? false
  }
  /** Fin d'une reaction tenue (appui long). */
  release() {
    this._internal?.release()
  }
  /** Regard du survol, hors evenement : `nx`, `ny` de -1 a 1 (droite et bas positifs), `null` pour lacher. */
  lookAt(target: { nx: number; ny: number } | null) {
    this._internal?.lookAt(target)
  }

  /** @internal le dessin vient d'etre pose */
  _updateSvg(s: SVGSVGElement | null) {
    this._svg = s
  }
}

// une propriete JavaScript par option
for (const p of PROPERTIES) {
  Object.defineProperty(MochiBotElement.prototype, p.name, {
    get(this: MochiBotElement) {
      return this._read(p.name)
    },
    set(this: MochiBotElement, v: unknown) {
      this._set(p.name, v)
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

export const TAG_NAME = 'mochi-bot'

/** Declare la balise (sans effet si elle l'est deja). Appele a l'import de ce module. */
export function defineMochiBot() {
  if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) customElements.define(TAG_NAME, MochiBotElement)
}
defineMochiBot()

/* ------------------------------------------------------------------ logique */

/**
 * Met en place un Mochi sur l'element : horloge, moteur, humeurs, regard, reactions et dessin.
 * Tout ce qui est cree ici s'arrete avec la portee de l'element.
 */
function mountBot(host: MochiBotElement): Internal {
  const r = <K extends keyof MochiBotProps>(k: K) => (host as unknown as { _refs: Map<string, Ref<MochiBotProps[K]>> })._refs.get(k)!
  // lecture suivie des options : `props.x` dans un calcul ou un dessin se relance quand `x` change
  const props = new Proxy({} as MochiBotProps, {
    get: (_, k: string) => r(k as keyof MochiBotProps).value
  })
  // sorties du lecteur : lues comme des refs, ecrites avec signalement
  const model = <K extends 'block' | 'state' | 'playing' | 'elapsed'>(k: K): Ref<MochiBotProps[K]> => ({
    get value() {
      return r(k).value
    },
    set value(v) {
      host._emit(k, v)
    }
  })
  const block = model('block')
  const state = model('state')
  const playing = model('playing')
  const elapsed = model('elapsed')

  let readyEmitted = false
  const R = RADIUS
  const VB = HALF_VIEWBOX

  const shapeRadii = computed(() => SHAPE_BY_ID.get(props.shape)?.radii ?? null)
  const ink = computed(() => colorOf(props.color))
  const expression = computed(() => EXPRESSION_BY_ID.get(props.expression) ?? null)

  /* --------------------------------------------------------- style de rendu */

  const renderStyle = computed(() => effectiveRenderStyle(props.renderStyle))
  const effectiveOutline = computed(() => props.outline ?? currentOutline.value)
  const grid = computed(() => pixelGrid(effectivePixel(props.pixel)))

  const engine = new BotEngine(R, state.value, shapeRadii.value, expression.value)
  const frame = shallowRef<BotFrame>(engine.sample(props.frozenAt ?? 0))
  const uid = Math.random().toString(36).slice(2, 8)

  const time = ref(props.frozenAt ?? 0)

  /* ------------------------------------------------- humeurs et reactions */

  const reduced = ref(false)
  const moods = new Moods(resolveMood(props.mood), { base: expression.value })
  /** Petits « z » de l'humeur `asleep`, dessines en SVG par-dessus tous les rendus. */
  const zMarques = computed(() => {
    if (resolveMood(props.mood) !== 'asleep') return []
    return sleepZ(reduced.value || props.frozenAt !== undefined ? 1.2 : time.value).map((z, i) => {
      const x = z.x * 100 + 18
      const y = z.y * 100 - 10
      const k = z.size * 100
      return {
        i,
        d: `M${(x - k / 2).toFixed(1)} ${(y - k / 2).toFixed(1)}h${k.toFixed(1)}l${(-k).toFixed(1)} ${k.toFixed(1)}h${k.toFixed(1)}`,
        op: reduced.value || props.frozenAt !== undefined ? 0.8 - 0.3 * i : z.opacite
      }
    })
  })
  const colorZ = computed(() => mixHex(ink.value, '#1a1630', 0.5))
  const moodActive = computed(() => resolveMood(props.mood) !== null)

  /** Accessoire porte connu, ou rien. */
  const worn = computed<WornId | null>(() => (props.worn && (WORN_IDS as string[]).includes(props.worn) ? props.worn : null))

  const gestureA = (t: number): Gesture | undefined => {
    const b = props.gesture ? props.gesture(t) : undefined
    const x = moods.sample(t)
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
    const next = moodActive.value ? 'idle' : b.state
    state.value = next
    engine.setState(next, clock)
    nextAt = playing.value && !moodActive.value ? blockStart + b.duration : Infinity
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
  let lastBlock = -1
  function renderAt(t: number) {
    const blocks = props.cycle
    if (!blocks.length) return
    const { index } = blockAt(blocks, t)
    if (index !== lastBlock) {
      const b = blocks[index]!
      state.value = b.state
      if (index < lastBlock) engine.reset(b.state, offsetOf(blocks, index))
      else engine.setState(b.state, offsetOf(blocks, index))
      lastBlock = index
    }
    time.value = t
    frame.value = engine.sample(t, gestureA(t))
    triggerRef(frame)
  }

  function setMood(id: string | null) {
    moods.setMood(id, clock)
    apply(block.value, elapsed.value)
    redrawFrozen()
  }
  function react(id: ReactionId | string) {
    if (!moods.react(id, clock)) return false
    redrawFrozen()
    return true
  }
  function release() {
    moods.release(clock)
  }
  function lookAt(target: { nx: number; ny: number } | null) {
    moods.lookAt(target, clock)
  }

  /* -------------------------------------------------------------- vraie 3D */

  type Module3d = typeof import('@/ui/3d/scene3d')
  const m3d = shallowRef<Module3d | null>(null)
  /** Le navigateur n'a pas de WebGL (ou le module 3D n'a pas pu se charger) : un message remplace le Mochi. */
  const no3d = ref(false)
  let canvas: HTMLCanvasElement | null = null
  const canvasRef = ref(0)
  const real3d = computed(() => m3d.value !== null)
  const pxCanvas = computed(() =>
    renderStyle.value === 'pixel3d'
      ? grid.value
      : Math.round(props.size * Math.min(props.maxPixelRatio, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
  )

  // la 3D (Three.js) est chargee au montage, une fois pour tous les Mochi de la page
  import('@/ui/3d/scene3d')
    .then((m) => {
      if (m.webglAvailable()) m3d.value = m
      else signalNo3d()
    })
    // module introuvable : meme repli que sans WebGL
    .catch(signalNo3d)
  function signalNo3d() {
    no3d.value = true
    host.dispatchEvent(new CustomEvent('no3d'))
  }

  const decorAlpha = computed(() => (real3d.value && props.yaw ? Math.max(0, Math.cos(props.yaw)) ** 3 : 1))

  /* ------------------------------------------------- ordinateur du mood « travaille » */

  let laptopK = 0
  let laptopTo = 0
  const laptopWanted = () => props.laptop !== false && moods.mood === 'working'
  function advanceLaptop(dt: number, net = false) {
    const target = laptopWanted() ? 1 : 0
    if (target !== laptopTo) laptopTo = target
    laptopK = net ? target : Math.min(1, Math.max(0, laptopK + Math.sign(target - laptopK) * Math.min(Math.abs(target - laptopK), dt / 0.45)))
    moods.gazeLaptop = turnLaptop()
  }
  function turnLaptop(): number {
    return laptopTo >= 1 ? Math.min(1, laptopK * 1.2) : laptopK * laptopK * (3 - 2 * laptopK)
  }
  function laptopScale(): number {
    const k = laptopK
    if (k <= 0) return 0
    if (laptopTo >= 1 || k >= 1) {
      const c1 = 1.2
      return 1 + (c1 + 1) * (k - 1) ** 3 + c1 * (k - 1) ** 2
    }
    return k * k * (3 - 2 * k)
  }

  const themeEff = computed<Theme>(() => props.theme ?? currentTheme.value)
  const render3dEff = computed<Material>(() => materialFor(renderStyle.value, props.material))

  function draw3d() {
    const m = m3d.value
    if (!real3d.value || !m || !canvas) return
    m.renderAvatar(canvas, frame.value, ink.value, props.paper, render3dEff.value, effectiveOutline.value, props.softness, props.highlight, props.shape, props.yaw + 0.3 * turnLaptop(), worn.value, props.accessories ?? {}, undefined, themeEff.value, undefined, laptopScale(), props.shadow, props.shading, props.outlineWidth)
    if (!readyEmitted) {
      readyEmitted = true
      host.dataset.ready = '1'
      host.dispatchEvent(new CustomEvent('ready'))
    }
  }

  /** Changement de forme : une fois le morph fini, les accessoires 3D se recalent sur la forme finale. */
  let timerShape = 0
  watch(
    () => props.shape,
    () => {
      clearTimeout(timerShape)
      timerShape = window.setTimeout(() => {
        if (!real3d.value || !m3d.value) return
        m3d.value.invalidateAccessories3d()
        draw3d()
      }, BotEngine.SHAPE_MORPH * 1000 + 120)
    }
  )
  onCleanup(() => clearTimeout(timerShape))

  watch(
    [frame, real3d, canvasRef, ink, pxCanvas, render3dEff, () => props.softness, () => props.highlight, () => props.yaw, worn, themeEff, () => props.accessories, () => props.shadow, () => props.shading, () => effectiveOutline.value, () => props.outlineWidth],
    draw3d,
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
  function endAim() {
    if (!aiming) return
    engine.setLook(null, clock, TURN_TIME)
    aiming = false
  }
  /** Vise le pointeur ; le rectangle est relu a chaque image (l'avatar peut bouger). */
  function aim() {
    if (!STATE_BY_ID.get(state.value)?.baseFace) {
      endAim()
      return
    }
    const box = svg?.getBoundingClientRect()
    // boite sans surface (volet masque) : rien a viser, et surtout pas de NaN dans le moteur
    if (!box || box.width === 0 || box.height === 0) return
    if (!aiming) turnSince = clock
    const halfWidth = Math.max(1, window.innerWidth / 2)
    const halfHeight = Math.max(1, window.innerHeight / 2)
    engine.setLook(
      lookTarget({
        nx: pointer ? clamp((pointer.x - (box.left + box.width / 2)) / halfWidth, -1, 1) : 0,
        ny: pointer ? clamp((pointer.y - (box.top + box.height / 2)) / halfHeight, -1, 1) : 0,
        turn: easings.easeOutQuint(clamp((clock - turnSince) / TURN_TIME)),
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
  const LONG_PRESS = 450
  const MOVE_MAX = 10

  const interactive = computed(() => props.interactions && props.frozenAt === undefined && !props.follow)
  let press: { x: number; y: number; t: number; timer: number; long: boolean } | null = null
  let lastTap = -1e9
  let shake: { direction: number; t: number }[] = []
  let lastDx = 0
  let turns: { t: number; d: number }[] = []
  let yawPrev = props.yaw

  function normalized(e: PointerEvent): { nx: number; ny: number } | null {
    const box = svg?.getBoundingClientRect()
    if (!box || box.width === 0 || box.height === 0) return null
    return {
      nx: clamp((e.clientX - (box.left + box.width / 2)) / (box.width * 0.6), -1, 1),
      ny: clamp((e.clientY - (box.top + box.height / 2)) / (box.height * 0.6), -1, 1)
    }
  }
  function onHover(e: PointerEvent) {
    if (!interactive.value || reduced.value) return
    const c = normalized(e)
    if (c) moods.lookAt(c, clock)
  }
  function onLeaves() {
    if (!interactive.value) return
    moods.lookAt(null, clock)
  }
  function onPress(e: PointerEvent) {
    if (!interactive.value || (e.button !== undefined && e.button > 0)) return
    onHover(e)
    clearTimeout(press?.timer)
    press = {
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      long: false,
      timer: window.setTimeout(() => {
        if (!press) return
        press.long = true
        moods.react(REACTION_FOR_EVENT.long, clock)
      }, LONG_PRESS)
    }
    shake = []
    lastDx = 0
    // le parent peut capturer le pointeur (glisser pour tourner) : on suit la fin sur la fenetre
    window.addEventListener('pointermove', onDrag)
    window.addEventListener('pointerup', onReleased)
    window.addEventListener('pointercancel', onReleased)
  }
  function onDrag(e: PointerEvent) {
    if (!press) return
    const dx = e.clientX - press.x
    const dy = e.clientY - press.y
    if (!press.long && Math.hypot(dx, dy) > MOVE_MAX) {
      clearTimeout(press.timer)
      press.t = -1e9
    }
    // secousse : au moins quatre inversions de sens, vives, en moins d'une demi-seconde
    const step = e.movementX || e.clientX - lastDx
    if (Math.abs(step) > 6) {
      const direction = Math.sign(step)
      const lastShake = shake[shake.length - 1]
      if (!lastShake || lastShake.direction !== direction) {
        shake.push({ direction, t: e.timeStamp })
        shake = shake.filter((s) => e.timeStamp - s.t < 600)
        if (shake.length >= 5 && interactive.value) {
          shake = []
          moods.react(REACTION_FOR_EVENT.shaken, clock)
        }
      }
    }
    lastDx = e.clientX
  }
  function onReleased(e: PointerEvent) {
    window.removeEventListener('pointermove', onDrag)
    window.removeEventListener('pointerup', onReleased)
    window.removeEventListener('pointercancel', onReleased)
    const a = press
    press = null
    if (!a) return
    clearTimeout(a.timer)
    if (e.pointerType === 'touch') moods.lookAt(null, clock)
    if (a.long) {
      moods.release(clock)
      return
    }
    if (e.type === 'pointercancel' || e.timeStamp - a.t > TAP_MAX) return
    if (e.timeStamp - lastTap < DOUBLE_MAX) {
      lastTap = -1e9
      moods.react(REACTION_FOR_EVENT.double, clock)
    } else {
      lastTap = e.timeStamp
      moods.react(REACTION_FOR_EVENT.tap, clock)
    }
  }

  /** Tourne vite : le modele 3D (`yaw`) fait plus d'un tour en moins d'une seconde. */
  watch(
    () => props.yaw,
    (v) => {
      const now = typeof performance === 'undefined' ? 0 : performance.now()
      if (!interactive.value) {
        yawPrev = v
        return
      }
      turns.push({ t: now, d: Math.abs(v - yawPrev) })
      yawPrev = v
      turns = turns.filter((x) => now - x.t < 900)
      if (turns.reduce((n, x) => n + x.d, 0) >= Math.PI * 2 && moods.reaction(clock) !== 'dizzy') {
        turns = []
        moods.react(REACTION_FOR_EVENT.shaken, clock)
      }
    }
  )

  watch(
    () => props.mood,
    (id) => setMood(resolveMood(id))
  )

  let lastDrawing = 0
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
    if (!mustRedraw(ms, lastDrawing, props.fps)) return
    lastDrawing = ms
    time.value = clock
    advanceLaptop(dt)
    frame.value = engine.sample(clock, gestureA(clock))
    triggerRef(frame)
  }

  /** Redessine sans la boucle : sert aux images figees quand une option change. */
  function redrawFrozen() {
    if (props.frozenAt === undefined) return
    time.value = props.frozenAt
    advanceLaptop(0, true)
    frame.value = engine.sample(props.frozenAt, gestureA(props.frozenAt))
    triggerRef(frame)
  }

  watch(
    () => block.value,
    (i) => {
      apply(i, pendingOffset)
      pendingOffset = 0
    }
  )
  // changement d'etat venu de l'exterieur (images figees) ; deja applique par `renderAt` ou `apply` sinon
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
    moods.setBase(expr)
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
      endAim()
    },
    { immediate: true }
  )
  watch([() => props.gesture, () => props.worn], redrawFrozen)

  /* ------------------------------------------------------------------ dessin */

  function dotAttrs(dot: BotFrame['dots'][number]) {
    const fill = dot.color ?? (dot.depth === undefined ? ink.value : mixHex(props.paper, ink.value, dot.depth))
    const common = { fill, opacity: dot.opacity }
    return dot.d
      ? { ...common, d: dot.d, transform: `translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})` }
      : { ...common, cx: dot.x, cy: dot.y, r: dot.r }
  }

  function drawing(): VNode {
    const f = frame.value
    const children: Child[] = []
    children.push(
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
    children.push(
      h(
        'g',
        { fill: 'none', 'stroke-linecap': 'round' },
        f.arcs.map((arc) => h('path', { key: `b${arc.id}`, d: arc.back, stroke: `url(#${uid}-${arc.id})`, 'stroke-width': arc.width, opacity: arc.opacity }))
      )
    )
    if (real3d.value) {
      // le corps, les yeux et les accessoires sont rendus par WebGL dans ce canvas, cale sur le viewBox
      children.push(
        h(
          'foreignObject',
          { key: 'fo', x: -VB, y: -VB, width: VB * 2, height: VB * 2 },
          h('canvas', {
            width: pxCanvas.value,
            height: pxCanvas.value,
            'data-real3d': '1',
            style: renderStyle.value === 'pixel3d' ? 'image-rendering: pixelated; display: block; width: 100%; height: 100%' : 'display: block; width: 100%; height: 100%',
            ref: (el: Element | null) => {
              canvas = el as HTMLCanvasElement | null
              canvasRef.value++
            }
          })
        )
      )
    } else if (no3d.value) {
      // pas de WebGL : pas de dessin 2D de secours, un message court a la place du Mochi
      children.push(
        h(
          'text',
          { key: 'no3d', 'data-no3d': '1', x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 18, 'font-family': 'system-ui, sans-serif', fill: '#8a8a8a' },
          t('app.no3d')
        )
      )
    }
    children.push(h('g', { opacity: decorAlpha.value }, f.dots.map((dot, i) => h(dot.d ? 'path' : 'circle', { key: `pf${i}`, ...dotAttrs(dot) }))))
    // moitie avant des orbites
    children.push(
      h(
        'g',
        { fill: 'none', 'stroke-linecap': 'round' },
        f.arcs.map((arc) => h('path', { key: `f${arc.id}`, d: arc.front, stroke: `url(#${uid}-${arc.id})`, 'stroke-width': arc.width, opacity: arc.opacity }))
      )
    )
    const z = zMarques.value
    if (z.length)
      children.push(
        h(
          'g',
          { key: 'zzz', 'data-zzz': '1', fill: 'none', stroke: colorZ.value, 'stroke-width': '10', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
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
        style: worn.value || z.length ? 'overflow: visible' : undefined,
        onPointerenter: onHover,
        onPointermove: onHover,
        onPointerleave: onLeaves,
        onPointerdown: onPress,
        ref: (el: Element | null) => {
          svg = el as SVGSVGElement | null
          host._updateSvg(svg)
        }
      },
      children
    )
  }

  // le dessin est un effet : il se refait (en file, une fois par tache, avant le dessin 3D) quand ce qu'il lit change
  watch(drawing, (v) => render(v, host))

  /* ------------------------------------------------------------------ montage */

  let mqReduced: MediaQueryList | null = null
  const updateReduced = () => {
    reduced.value = !!mqReduced?.matches
    moods.reduced = reduced.value
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    updateReduced()
    mqReduced.addEventListener?.('change', updateReduced)
  }
  render(drawing(), host)

  if (props.frozenAt !== undefined) redrawFrozen()
  else {
    if (props.wave) {
      // mouvement reduit : un simple fondu ; sinon la reaction fait grandir le Mochi
      if (reduced.value) (svg as SVGSVGElement | null)?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' })
      else moods.react(REACTION_FOR_EVENT.arrival, clock)
    }
    // le curseur peut arriver deja pose
    apply(block.value, elapsed.value)
    raf = requestAnimationFrame(tick)
  }

  onCleanup(() => {
    cancelAnimationFrame(raf)
    detach()
    clearTimeout(press?.timer)
    window.removeEventListener('pointermove', onDrag)
    window.removeEventListener('pointerup', onReleased)
    window.removeEventListener('pointercancel', onReleased)
    mqReduced?.removeEventListener?.('change', updateReduced)
  })

  return { seek, renderAt, setMood, react, release, lookAt }
}
