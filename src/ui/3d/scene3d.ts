/**
 * Rendu 3D reel (WebGL, Three.js) d'une image du moteur.
 *
 * Ce module n'est JAMAIS importe statiquement : `mochi-bot.ts` et la page labo le
 * chargent par `await import(...)` quand le style 3D est choisi. Le reste de l'application
 * ne porte donc pas Three.js (meme regle que `mediabunny`).
 *
 * Le moteur ne change pas : on lit `engine.sample(t)` et on le dessine. Le corps est le
 * contour gonfle (`volume.ts`) ; les yeux sont peints dans une texture projetee de face,
 * aux positions exactes que rend le moteur. Ce sont donc toujours des « trous » : la
 * texture n'existe que sur le corps, un oeil qui glisse au bord est rogne par la
 * silhouette, comme le masque SVG le faisait.
 */

import {
  AmbientLight,
  BackSide,
  type Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  DirectionalLight,
  HemisphereLight,
  type Light,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  LinearFilter,
  NearestFilter,
  RedFormat,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  UnsignedByteType,
  WebGLRenderer
} from 'three'
import type { BotFrame } from '@/bot/engine'
import { HALF_VIEWBOX } from '@/bot/frame'
import { mixHex } from '@/bot/skins'
import { measuresWorn, shadowsWorn, radiusLens, eyesOf, type Shadow, type WornId } from '@/bot/worn'
import { Worn3d } from './worn3d'
import { Accessories3d } from './accessories3d'
import { measureLandmarks } from './anchors'
import type { AccessorySelection } from '@/bot/slots'
import { rim } from './rim'
import { leverDark, luminance, palettePixel, quantifier } from './pixel3d'
import { WORN_TINTS } from '@/bot/worn'
import {
  colorOutline,
  lightingFlat,
  outlineWidthPx,
  DEFAULT_OUTLINE_WIDTH,
  MAX_OUTLINE_WIDTH,
  MIN_OUTLINE_WIDTH,
  finesseOf,
  gradientMap,
  meshOf,
  settingFlat,
  type Softness,
  DEFAULT_SOFTNESS,
  type Material,
  DEFAULT_MATERIAL
} from './material'
import { paintHighlight, DEFAULT_HIGHLIGHT, type Highlight } from './highlight'
import { accessoriesDark, MIN_EYE_CONTRAST, bodyForTheme, eyeColor, EYE_RGB, DEFAULT_THEME, type Theme } from './theme'
import {
  centerOf,
  fieldOfIdle,
  bodyOutline,
  halfExtentEye,
  inflate,
  readMatrix,
  profileOf,
  reduce,
  weldNormals,
  frontEyes,
  type ProfileVolume,
  type Volume
} from './volume'

export type { Material } from './material'

const VB = HALF_VIEWBOX

/**
 * Teintes de la matiere : la couleur choisie a peine eclaircie (base), son cote a l'ombre (creux, fond des yeux)
 * et l'ombre portee au sol, coloree et non grise.
 */
export function materialKind(hex: string) {
  return { base: mixHex(hex, '#ffffff', 0.16), hollow: mixHex(hex, '#000000', 0.18), scope: mixHex(hex, '#000000', 0.3) }
}

/**
 * Un corps 3D : un maillage et sa texture de visage, mis a jour image par image.
 * Une instance par mochi affiche dans une scene (la page isometrique en a trois) ;
 * l'avatar, lui, partage une seule instance pour toutes ses vignettes.
 */
/** Un maillage et son volume : `full` (realiste, toon, aplat) ou `grossier` (lowpoly). */
interface BodyMesh {
  geo: BufferGeometry
  volume?: Volume
  positions?: Float32Array
  neck: number
}

/**
 * Maillages gardes par un corps (LRU) : un par forme et par contour. Une forme au repos, ou
 * un avatar que la page rend a chaque image, ne recalcule donc pas sa geometrie ; pendant un
 * mouvement chaque image est un contour neuf, et on recycle alors le plus ancien.
 */
const MESHES_KEPT = 24

type MatDef = MeshStandardMaterial | MeshToonMaterial

export class Mochi3d {
  readonly mesh: Mesh<BufferGeometry, MatDef | MeshBasicMaterial>
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly texture: CanvasTexture
  /** masque des yeux (blanc sur noir) : ils s'allument, pour rester nets quelle que soit la lumiere */
  private readonly canvasEyes: HTMLCanvasElement
  private readonly ctxEyes: CanvasRenderingContext2D
  private readonly textureEyes: CanvasTexture
  private readonly meshes = new Map<string, BodyMesh>()
  /** accessoire porte : chapeau et casque en volumes fixes au maillage, lunettes peintes sur le visage */
  private worn: WornId | null = null
  private readonly worn3d = new Worn3d()
  /** accessoires par emplacements (tete, yeux, visage, bas, dos), combinables */
  private accs: AccessorySelection = {}
  private readonly acc3d = new Accessories3d()
  /** modele du volume (ombrage, liseres) : oui par defaut ; non = corps en aplat de couleur, yeux inchanges */
  private shading = true
  private matFlat: MeshBasicMaterial | null = null
  /** ordinateur du mood `working` : echelle de 0 (cache) a ~1 (pousse), posee par le composant */
  private laptop = 0
  /** sol de chaque forme : le point le plus bas vu pendant les rebonds (l'ordinateur ne saute pas avec le corps) */
  private readonly grounds = new Map<string, number>()
  /** theme : `light` (yeux blancs, defaut) ou `dark` (yeux noirs) */
  private theme: Theme = DEFAULT_THEME
  /** contraste minimal oeil noir / corps en sombre (en dessous, le corps est eclairci) ; 0 = jamais */
  private eyeContrast = MIN_EYE_CONTRAST
  /** forme du mochi (`squircle`, `star`...) : fixe son profil de volume et ses yeux */
  private shape = ''
  /** profil impose (option de labo) ; sinon celui de la forme */
  private profileForced: ProfileVolume | null = null
  private get profile(): ProfileVolume {
    return this.profileForced ?? profileOf(this.shape)
  }
  private readonly materials = new Map<string, MatDef>()
  private readonly ramps: DataTexture[] = []
  /** accessoires seuls : le corps reste (il ancre les pieces) mais ne se dessine pas */
  private withoutBody = false
  setWithoutBody(v: boolean) {
    this.withoutBody = v
  }
  /** contour fonce (coque inversee), visible seulement en `toon-outline` */
  private readonly shell: Mesh<BufferGeometry, MeshBasicMaterial>
  private renderStyle: Material = DEFAULT_MATERIAL
  private softness: Softness = DEFAULT_SOFTNESS
  /** petit reflet doux en haut a gauche (matiere `soft` seulement) */
  /** reflet doux en shader : 1 = actif (uniform partage par les materiaux de ce corps) */
  private readonly uHighlight = { value: 1 }
  /** yeux noirs (theme sombre) : 1 = pas d'emission, pas de lueur ajoutee sur les yeux */
  private readonly uEye = { value: 0 }
  /** demi-epaisseur du contour, en unites du moteur (uniform de la coque) */
  private readonly thickness = { value: 4.5 }
  /** facteur d'epaisseur du contour (1 = l'epaisseur de base) */
  private factorOutline = 1
  /** derniers contour et visage peints : inchanges d'une image a l'autre, on ne refait rien */
  private keyFace = ''
  /** Bas du corps, repere Three (y vers le haut) : la ou il touche le sol. */
  neck = -100

  constructor(size = 512) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.canvas.height = size
    this.ctx = this.canvas.getContext('2d')!
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.canvasEyes = document.createElement('canvas')
    this.canvasEyes.width = this.canvasEyes.height = size
    this.ctxEyes = this.canvasEyes.getContext('2d')!
    this.textureEyes = new CanvasTexture(this.canvasEyes)
    this.textureEyes.colorSpace = SRGBColorSpace
    const mat = this.mat(DEFAULT_MATERIAL)
    this.mesh = new Mesh(new BufferGeometry(), mat)
    this.mesh.castShadow = true
    this.shell = new Mesh(this.mesh.geometry, shellMaterial(this.thickness))
    this.shell.visible = false
    this.mesh.add(this.shell)
    this.mesh.add(this.worn3d.group)
    this.mesh.add(this.acc3d.group)
  }

  /** Intensite d'emission des yeux : celle du materiau en clair, nulle en sombre (l'oeil est noir, il ne s'allume pas). */
  private emission(m: MatDef): number {
    return this.theme === 'dark' ? 0 : m instanceof MeshStandardMaterial ? 0.85 : 1
  }

  /** Materiau d'une variante, cree a la demande et garde. */
  private mat(r: Material, softness: Softness = this.softness): MatDef {
    const key = `${r}|${r === 'soft' ? softness : ''}`
    const already = this.materials.get(key)
    if (already) return already
    const flat = settingFlat(r, softness)
    let m: MatDef
    if (!flat) {
      m = new MeshStandardMaterial({
        map: this.texture,
        emissiveMap: this.textureEyes,
        // un oeil est un trou sur le fond clair : sans cela la lumiere le grise et il se perd
        emissive: new Color(0xffffff),
        emissiveIntensity: 0.85,
        roughness: 0.9,
        metalness: 0
      })
    } else {
      // matiere toon : des paliers nets, aucun reflet spaculaire. Le gradientMap est
      // lu en NearestFilter, donc la rampe reste en marches.
      const g = gradientMap(flat)
      const ramp = new DataTexture(g, g.length, 1, RedFormat, UnsignedByteType)
      // ombrage lisse : filtrage lineaire, la rampe est une courbe continue (pas de marche)
      ramp.minFilter = ramp.magFilter = flat.smooth ? LinearFilter : NearestFilter
      ramp.generateMipmaps = false
      ramp.needsUpdate = true
      this.ramps.push(ramp)
      m = new MeshToonMaterial({
        map: this.texture,
        gradientMap: ramp,
        // les yeux restent blancs et nets : ils s'allument, aucune ombre ne les grise
        emissiveMap: this.textureEyes,
        emissive: new Color(0xffffff),
        emissiveIntensity: 1
      })
      if (flat.organic) organiser(m)
      // le shader toon sait deriver une normale par facette ; seul le typage ne le declare pas
      if (flat.facets) (m as unknown as { flatShading: boolean }).flatShading = true
    }
    // l'ombrage continu (AO, liseres, reflet) n'a de sens que pour la matiere douce : les styles a aplats gardent leurs tons nets
    if (!flat || flat.smooth) rim(m, flat ? 0.7 : 0.5, flat ? 0.32 : 0.22, { highlight: this.uHighlight, ao: 1, eye: this.uEye })
    m.emissiveIntensity = this.emission(m)
    this.materials.set(key, m)
    return m
  }

  /** Corps sans modele : la texture seule (couleur du corps, yeux peints), aucune lumiere ne l'ombre. */
  private flat(): MeshBasicMaterial {
    this.matFlat ??= new MeshBasicMaterial({ map: this.texture })
    return this.matFlat
  }

  /** Active ou coupe l'ombrage du volume (Soft, Flat et Pixel). Appele avant `setRenderStyle`. */
  setShading(yes: boolean) {
    this.shading = yes
  }

  /** Choisit la matiere : materiau, maillage et contour. Appele avant `update`. */
  setRenderStyle(r: Material, outline = false, softness: Softness = DEFAULT_SOFTNESS, highlight = DEFAULT_HIGHLIGHT) {
    this.renderStyle = r
    this.softness = softness
    this.uHighlight.value = highlight && settingFlat(r, softness)?.smooth ? 1 : 0
    this.mesh.material = this.shading ? this.mat(r, softness) : this.flat()
    // le contour cartoon est une option des variantes plates (jamais du realiste)
    this.shell.visible = !!settingFlat(r, softness) && (outline || !!settingFlat(r, softness)?.outline)
  }

  /**
   * Cale l'epaisseur du contour sur la taille du mochi a l'ecran : `pxByUnit` = pixels
   * (physiques) d'une unite du moteur. Le trait s'allege en petite taille.
   */
  fitOutline(pxByUnit: number) {
    const diameter = 2 * 100 * pxByUnit
    this.thickness.value = (outlineWidthPx(diameter) * this.factorOutline) / Math.max(1e-6, pxByUnit)
  }

  /** Facteur d'epaisseur du contour (1 = l'epaisseur de base). Appele avant `fitOutline`. */
  setOutlineWidth(k: number) {
    this.factorOutline = Number.isFinite(k) ? Math.min(MAX_OUTLINE_WIDTH, Math.max(MIN_OUTLINE_WIDTH, k)) : DEFAULT_OUTLINE_WIDTH
  }

  /** Impose un profil de volume (essai d'un profil alternatif) ; `null` revient a celui de la forme. */
  setProfile(p: ProfileVolume | null) {
    this.profileForced = p
  }

  /** Choisit l'accessoire porte (`null` = aucun). Appele avant `update`. */
  setWorn(id: WornId | null) {
    this.worn = id
  }

  /** Choisit les accessoires par emplacement (un au plus par emplacement, tous cumulables). Appele avant `update`. */
  /** Echelle de l'ordinateur (0 = absent). */
  setLaptop(k: number) {
    this.laptop = k
  }

  setAccessories(sel: AccessorySelection) {
    this.accs = this.theme === 'dark' ? accessoriesDark(sel) : sel
  }

  /**
   * Choisit le theme (`dark` = yeux noirs). Appele avant `setAccessories` et `update` : le choix des
   * accessoires et la peinture du visage en dependent.
   */
  setTheme(theme: Theme, eyeContrast = MIN_EYE_CONTRAST) {
    this.theme = theme
    this.eyeContrast = eyeContrast
    // sombre : le masque des yeux n'allume plus rien (emission a 0) et les lueurs l'evitent
    this.uEye.value = theme === 'dark' ? 1 : 0
    for (const m of this.materials.values()) m.emissiveIntensity = this.emission(m)
  }

  /** Couleurs des accessoires portes (palette du pixel art). */
  get colorsAccessories(): string[] {
    return this.acc3d.colors
  }

  /** Refait la pose des accessoires au prochain rendu (voir `Accessories3d.invalidate`). */
  invalidateAccessories() {
    this.acc3d.invalidate()
  }

  /** Dit quelle forme est rendue : son profil de volume (cube, prisme, dome...) en depend. */
  setShape(shape: string) {
    this.shape = shape
    // forme « coussin » : le champ de hauteur se resout ici, une fois, plutot qu'au milieu d'une animation
    if (profileOf(shape).cushion) fieldOfIdle(shape)
  }

  /** Le maillage du contour courant : relu du cache, sinon calcule (en recyclant le plus ancien). */
  private meshData(frame: BotFrame): BodyMesh {
    const key = `${meshOf(this.renderStyle)}|${this.shape}${this.profileForced ? '+' + JSON.stringify(this.profileForced) : ''}|${frame.bodyPath}`
    const already = this.meshes.get(key)
    if (already) {
      // le plus recemment utilise passe en dernier
      this.meshes.delete(key)
      this.meshes.set(key, already)
      return already
    }
    let m: BodyMesh | undefined
    if (this.meshes.size >= MESHES_KEPT) {
      const old = this.meshes.keys().next().value!
      m = this.meshes.get(old)
      this.meshes.delete(old)
    }
    m ??= { geo: new BufferGeometry(), neck: -100 }
    this.fill(frame, m)
    this.meshes.set(key, m)
    return m
  }

  /** Recopie l'image `frame` du moteur dans le maillage et la texture. */
  update(frame: BotFrame, color: string, paper: string) {
    // sombre : yeux noirs, et un corps eclairci seulement s'il ne contraste pas assez avec eux
    color = bodyForTheme(color, this.theme, this.eyeContrast)
    paper = eyeColor(this.theme, paper)
    // Flat et Pixel : une couleur quasi noire garde du relief (voir `leverDark`)
    if (this.renderStyle === 'toon' || this.renderStyle === 'toon-outline' || this.renderStyle === 'pixel') color = leverDark(color)
    this.mesh.visible = frame.bodyPath.length > 10 && frame.bodyAlpha > 0.01
    if (!this.mesh.visible) return
    // corps invisible : la matiere ne se dessine pas, mais ses enfants (accessoires) si ; l'ancrage se fait sur la geometrie
    ;(this.mesh.material as { visible: boolean }).visible = !this.withoutBody
    if (this.withoutBody) this.shell.visible = false
    const mat = this.mesh.material
    mat.transparent = frame.bodyAlpha < 1
    mat.opacity = frame.bodyAlpha
    const flat = settingFlat(this.renderStyle, this.softness)
    const m = materialKind(color)
    const mt = this.meshData(frame)
    this.mesh.geometry = this.shell.geometry = mt.geo
    this.neck = mt.neck
    this.grounds.set(this.shape, Math.min(this.grounds.get(this.shape) ?? Infinity, mt.neck))
    if (this.shell.visible) {
      const cm = this.shell.material
      cm.color.set(colorOutline(color))
      cm.transparent = mat.transparent
      cm.opacity = mat.opacity
    }
    // accessoire porte : replace depuis le contour de cette image (chapeau, noeud) ou depuis les
    // yeux 3D (lunettes, vraie monture en tube), et petite ombre douce qu'il pose sur le corps
    const geo = this.mesh.geometry
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    const frameBody = frame
    // les yeux de la 3D : pile en face, sur la face avant. `frameFace` y ajoute le regard des humeurs
    // (decalage des yeux) : seuls les yeux peints le suivent, les lunettes restent sur le visage
    const frameFace = frame.face ? this.eyesOnFace(frame, true) : null
    frame = this.eyesOnFace(frame)
    const flat0 = settingFlat(this.renderStyle, this.softness)
    this.worn3d.settings = flat0?.smooth ? { force: 0.7, top: 0.32, ao: 1, highlight: this.uHighlight } : null
    this.worn3d.update(this.worn, frameBody, this.mat(this.renderStyle, this.softness), bb ? (bb.min.z + bb.max.z) / 2 : 0, frame, (x, y) => this.zFace(x, y), (y, sg) => this.edgeX(y, sg))
    // accessoires par emplacements : ancres sur le volume de CE corps, recalcules quand le corps change
    this.acc3d.settings = this.worn3d.settings
    this.acc3d.body = color
    // v12 : les pieces ne sont plus reconstruites a chaque image (le contour du corps change a chaque respiration :
    // tirs de rayons et geometries refaits 60 fois par seconde). Elles sont construites pour la forme et le style, sur le
    // corps de cette image, puis suivent le corps par une transformation (ci-dessous).
    const keyBody = `${this.renderStyle}|${this.shape}`
    this.acc3d.update(this.accs, keyBody, this.mat(this.renderStyle, this.softness), () => {
      const ye = eyesOf(frame)
      const sc = ye.map((o) => ({ x: o.x, y: -o.y, r: o.r }))
      return measureLandmarks(this.mesh.geometry, sc, ye.length === 2 ? radiusLens(ye[0]!, ye[1]!) : 22)
    }, { k: this.laptop, ground: this.grounds.get(this.shape) ?? mt.neck, key: `${this.renderStyle}|${this.shape}` })
    this.followBody(bb)
    // le contour des accessoires suit celui du corps (meme visibilite, meme epaisseur)
    this.acc3d.outline(this.shell.visible, this.thickness.value)
    const shadows: Shadow[] = [...(this.worn ? shadowsWorn(this.worn, frame, measuresWorn(frameBody)) : []), ...this.acc3d.shadows]
    // le reflet doux est un effet de matiere (shader, repere de la camera) : plus rien n'est peint dans la
    // texture hors des yeux, donc le dos et les flancs recoivent le meme ombrage que la face
    const highlight = null as Highlight | null
    const keyHighlight = highlight ? [highlight.x, highlight.y, highlight.rx].map((v) => Math.round(v * 2)).join(',') : '-'
    const eyesPainted = frameFace ?? frame
    const cheeks = frameFace?.face?.cheeks ?? 0
    const keyFace = `${this.renderStyle}|${this.softness}|${this.shading}|${this.theme}|${color}|${paper}|${JSON.stringify(eyesPainted.eyes)}|${cheeks.toFixed(2)}|${keyHighlight}|${this.worn ?? ''}|${shadows.map((o) => [o.x, o.y, o.rx, o.ry].map((v) => Math.round(v)).join(',')).join(';')}`
    if (keyFace !== this.keyFace) {
      this.keyFace = keyFace
      // le flat garde la couleur choisie telle quelle (pas de pastel), sans creux d'oeil
      this.paint(eyesPainted, flat ? color : m.base, paper, m.hollow, !flat && this.theme === 'light' && this.shading, highlight, shadows, cheeks)
    }
  }

  /** Boite du corps sur lequel les pieces ont ete construites (repere Three). */
  private refPieces: { version: number; cx: number; cy: number; w: number; h: number } | null = null
  /**
   * Les pieces suivent le corps : la boite du corps de cette image est ramenee sur celle du corps de construction
   * (echelle en x et y, la profondeur suit x ; translation). Le corps respire, s'ecrase et s'etire ; ses pieces avec.
   */
  private followBody(bb: Box3 | null) {
    if (!bb || bb.isEmpty()) return
    const cx = (bb.min.x + bb.max.x) / 2
    const cy = (bb.min.y + bb.max.y) / 2
    const w = bb.max.x - bb.min.x
    const h = bb.max.y - bb.min.y
    if (!this.refPieces || this.refPieces.version !== this.acc3d.version) this.refPieces = { version: this.acc3d.version, cx, cy, w, h }
    const r = this.refPieces
    const sx = r.w > 1e-6 ? w / r.w : 1
    const sy = r.h > 1e-6 ? h / r.h : 1
    for (const g of this.acc3d.pieces()) {
      g.scale.set(sx, sy, sx)
      g.position.set(cx - sx * r.cx, cy - sy * r.cy, 0)
    }
  }

  /** Abscisse du bord du corps (cote `sg` : -1 gauche, 1 droite) a la hauteur `y` du moteur. */
  private edgeX(y: number, sg: number): number {
    const P = this.mesh.geometry.attributes.position
    if (!P) return 0
    let x = 0
    for (let i = 0; i < P.count; i++) {
      if (Math.abs(P.getY(i) + y) < 5) x = sg > 0 ? Math.max(x, P.getX(i)) : Math.min(x, P.getX(i))
    }
    return x
  }

  /** Profondeur (z) de la face avant du corps a (x, y) du moteur : le sommet le plus avance du voisinage. */
  private zFace(x: number, y: number): number {
    const P = this.mesh.geometry.attributes.position
    if (!P) return 0
    let z = -Infinity
    for (let i = 0; i < P.count; i++) {
      if (Math.abs(P.getX(i) - x) < 7 && Math.abs(P.getY(i) + y) < 7) z = Math.max(z, P.getZ(i))
    }
    return z === -Infinity ? (this.mesh.geometry.boundingBox?.max.z ?? 0) : z
  }

  /**
   * Les yeux de la 3D sont PILE EN FACE (`frontEyes`) : centres, symetriques, droits, un peu
   * au-dessus du centre de la face avant. Le regard, l'inclinaison et la deformation de
   * sphere du moteur ne comptent pas ici ; l'ecart au 2D est voulu. Chaque oeil garde sa forme
   * (clignement, expression) et son opacite.
   */
  private eyesOnFace(frame: BotFrame, gaze = false): BotFrame {
    if (!frame.eyes.length) return frame
    const eyes = [...frame.eyes].sort((p, q) => readMatrix(p.matrix)[4]! - readMatrix(q.matrix)[4]!)
    const half = eyes.map((e) => halfExtentEye(e.d, 'matrix(1 0 0 1 0 0)'))
    let outline = bodyOutline(frame.bodyPath, 1)
    // humeur : la tete penche. On cherche la face sur le corps REDRESSE, puis on penche les yeux avec lui
    const rot = frame.face?.rot ?? 0
    const q = (rot * Math.PI) / 180
    const cq = Math.cos(q)
    const sq = Math.sin(q)
    const center = rot ? centerOf(outline) : { x: 0, y: 0 }
    if (rot) outline = outline.map((p) => ({ x: center.x + cq * (p.x - center.x) + sq * (p.y - center.y), y: center.y - sq * (p.x - center.x) + cq * (p.y - center.y) }))
    const pos = frontEyes(outline, half, this.profile)
    if (pos.length !== eyes.length) return frame
    return {
      ...frame,
      eyes: eyes.map((e, i) => {
        const p = pos[i]!
        const f = (v: number) => Math.round(v * 100) / 100
        // position : rotation autour du centre du corps (la tete penche), puis regard dans le repere de la tete
        const x0 = rot ? center.x + cq * (p.x - center.x) - sq * (p.y - center.y) : p.x
        const y0 = rot ? center.y + sq * (p.x - center.x) + cq * (p.y - center.y) : p.y
        // sans `gaze` : la place des yeux sur le visage, droits et ronds, pour les lunettes et les accessoires
        // (leurs mesures ne doivent pas varier avec un clignement ou un regard)
        if (!frame.face || !gaze) return { ...e, matrix: `matrix(${f(p.s)} 0 0 ${f(p.s)} ${f(x0)} ${f(y0)})` }
        // couche visage : inclinaison propre (deja augmentee de celle de la tete), paupiere, regard
        const phi = ((e.tilt ?? 0) * Math.PI) / 180
        const k = e.k ?? 1
        const a = Math.cos(phi) * p.s
        const b = Math.sin(phi) * p.s
        const gx = e.gx ?? 0
        const gy = e.gy ?? 0
        const x1 = x0 + cq * gx - sq * gy
        const y1 = y0 + sq * gx + cq * gy
        return { ...e, matrix: `matrix(${f(a)} ${f(b * k)} ${f(-b)} ${f(a * k)} ${f(x1)} ${f(y1)})` }
      })
    }
  }

  private fill(frame: BotFrame, mt: BodyMesh) {
    const flat = settingFlat(this.renderStyle, this.softness)
    let pts = bodyOutline(frame.bodyPath, flat && flat.reduction > 1 ? 1 : undefined)
    if (flat && flat.reduction > 1) pts = reduce(pts, flat.reduction)
    if (pts.length < 3) return
    const v = inflate(pts, VB, mt.volume, finesseOf(this.renderStyle), this.profile)
    const geo = mt.geo
    if (v !== mt.volume) {
      mt.volume = v
      mt.positions = new Float32Array(v.positions.length)
      geo.setAttribute('position', new BufferAttribute(mt.positions, 3))
      geo.setAttribute('uv', new BufferAttribute(v.uvs, 2))
      geo.setIndex(new BufferAttribute(v.index, 1))
    }
    const P = mt.positions!
    const S = v.positions
    for (let i = 0; i < S.length; i += 3) {
      P[i] = S[i]!
      P[i + 1] = -S[i + 1]!
      P[i + 2] = S[i + 2]!
    }
    geo.attributes.position!.needsUpdate = true
    geo.attributes.uv!.needsUpdate = true
    geo.computeVertexNormals()
    weldNormals(geo.attributes.normal!.array as Float32Array, pts.length, finesseOf(this.renderStyle).rings)
    // Flat et Pixel : des paliers nets sur des normales irregulieres font des taches (nuage, fleur,
    // etoile). On lisse les normales avant de couper en tons : les limites deviennent des courbes propres.
    // Soft sur une forme « coussin » : quelques passes aussi, pour fondre la ligne de raccord entre l'avant et l'arriere
    const smoothFlat = !!flat && !flat.smooth && !flat.facets
    if ((smoothFlat || (this.profile.cushion && !flat?.facets)) && geo.index) {
      smoothNormals(geo.attributes.normal as BufferAttribute, geo.index.array, smoothFlat ? 14 : 20)
      weldNormals(geo.attributes.normal!.array as Float32Array, pts.length, finesseOf(this.renderStyle).rings)
    }
    geo.computeBoundingSphere()
    mt.neck = -v.neck
  }

  /**
   * Le visage : la couleur du corps, et les yeux en couleur du fond (des trous), avec une
   * ombre interne sur le rebord haut gauche, comme le creux de l'argile.
   */
  private paint(frame: BotFrame, base: string, paper: string, hollow: string, carve = true, highlight: Highlight | null = null, shadows: Shadow[] = [], cheeks = 0) {
    const c = this.ctx
    const T = this.canvas.width
    const k = T / (2 * VB)
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.fillStyle = base
    c.fillRect(0, 0, T, T)
    // le reflet est peint AVANT les yeux : ils le recouvrent, il ne les touche jamais
    if (highlight) paintHighlight(c, highlight, k, VB)
    const holes: Array<{ path: Path2D; m: number[]; alpha: number }> = frame.eyes.map((e) => ({
      path: new Path2D(e.d),
      m: readMatrix(e.matrix),
      alpha: e.alpha
    }))
    const y = this.ctxEyes
    y.setTransform(1, 0, 0, 1, 0, 0)
    y.globalAlpha = 1
    y.fillStyle = '#000'
    y.fillRect(0, 0, T, T)
    for (const { path, m, alpha } of holes) {
      if (alpha <= 0.01) continue
      const [a, b, cc, d, e, f] = m as [number, number, number, number, number, number]
      y.setTransform(k * a, k * b, k * cc, k * d, k * (e + VB), k * (f + VB))
      y.globalAlpha = alpha
      // le masque reste blanc sur l'oeil, aussi en sombre : il n'y allume rien (emission a 0) mais
      // dit au shader d'y laisser un noir franc (voir `rim`)
      y.fillStyle = '#fff'
      y.fill(path)
      c.setTransform(k * a, k * b, k * cc, k * d, k * (e + VB), k * (f + VB))
      c.globalAlpha = alpha
      c.fillStyle = paper
      c.fill(path)
      if (!carve) continue
      // ombre interne : un grand cadre perce de l'oeil, dont seule l'ombre entre dans le trou
      c.save()
      c.clip(path)
      const clip = new Path2D()
      clip.rect(-400, -400, 800, 800)
      clip.addPath(path)
      c.shadowColor = mixHex(hollow, paper, 0.15)
      c.shadowBlur = 5 * k
      c.shadowOffsetX = 2.5 * k
      c.shadowOffsetY = 4 * k
      c.fillStyle = hollow
      c.fill(clip, 'evenodd')
      c.restore()
    }
    // joues : une teinte rose doucement fondue sous les yeux, peinte DANS la couleur du corps (pas un objet)
    if (cheeks > 0.01) this.paintCheeks(frame, base, cheeks, k)
    // ombres douces des accessoires, posees sur le corps (degrade radial, sans bord)
    for (const o of shadows) {
      c.setTransform(k * o.rx, 0, 0, k * o.ry, k * (o.x + VB), k * (o.y + VB))
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1)
      const shadow = mixHex(hollow, '#000000', 0.45)
      g.addColorStop(0, hexA(shadow, o.a))
      g.addColorStop(1, hexA(shadow, 0))
      c.globalAlpha = 1
      c.fillStyle = g
      c.fillRect(-1, -1, 2, 2)
    }
    y.setTransform(1, 0, 0, 1, 0, 0)
    y.globalAlpha = 1
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    this.texture.needsUpdate = true
    this.textureEyes.needsUpdate = true
  }

  /**
   * Teinte des joues : deux taches elliptiques, a l'exterieur et sous chaque oeil, qui se fondent dans
   * la couleur du corps. Elles suivent les yeux (donc la tete penchee) et ne depassent pas : la texture
   * n'existe que sur le corps.
   */
  private paintCheeks(frame: BotFrame, base: string, cheeks: number, k: number) {
    const c = this.ctx
    const eyes = [...frame.eyes].sort((p, q) => readMatrix(p.matrix)[4]! - readMatrix(q.matrix)[4]!)
    if (eyes.length < 2) return
    const q = ((frame.face?.rot ?? 0) * Math.PI) / 180
    const cq = Math.cos(q)
    const sq = Math.sin(q)
    const tint = mixHex(base, PLAYED, 0.62)
    eyes.forEach((e, i) => {
      const [, , , , ex, ey] = readMatrix(e.matrix)
      const sg = i === 0 ? -1 : 1
      // decalage dans le repere de la tete : vers l'exterieur et vers le bas
      const dx = sg * 17
      const dy = 25
      const x = ex + cq * dx - sq * dy
      const y = ey + sq * dx + cq * dy
      c.setTransform(k * 27, 0, 0, k * 17, k * (x + VB), k * (y + VB))
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1)
      g.addColorStop(0, hexA(tint, 0.9 * cheeks))
      g.addColorStop(0.55, hexA(tint, 0.55 * cheeks))
      g.addColorStop(1, hexA(tint, 0))
      c.globalAlpha = e.alpha
      c.fillStyle = g
      c.fillRect(-1, -1, 2, 2)
    })
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
  }

  liberer() {
    for (const m of this.meshes.values()) m.geo.dispose()
    this.mesh.geometry.dispose()
    for (const m of this.materials.values()) m.dispose()
    for (const r of this.ramps) r.dispose()
    this.shell.material.dispose()
    this.worn3d.liberer()
    this.acc3d.liberer()
    this.texture.dispose()
    this.textureEyes.dispose()
  }
}

/**
 * Quelques passes de moyenne des normales avec celles des sommets voisins (via les triangles),
 * pour effacer les plis de triangulation qui se lisent comme des taches sous un ombrage a paliers.
 */
function smoothNormals(nor: BufferAttribute, index: ArrayLike<number>, passes: number) {
  const n = nor.count
  const acc = new Float32Array(n * 3)
  const A = nor.array as Float32Array
  for (let p = 0; p < passes; p++) {
    acc.fill(0)
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t]!
      const b = index[t + 1]!
      const c = index[t + 2]!
      for (let d = 0; d < 3; d++) {
        acc[a * 3 + d]! += A[b * 3 + d]! + A[c * 3 + d]!
        acc[b * 3 + d]! += A[a * 3 + d]! + A[c * 3 + d]!
        acc[c * 3 + d]! += A[a * 3 + d]! + A[b * 3 + d]!
      }
    }
    for (let i = 0; i < n; i++) {
      const x = A[i * 3]! * 2 + acc[i * 3]!
      const y = A[i * 3 + 1]! * 2 + acc[i * 3 + 1]!
      const z = A[i * 3 + 2]! * 2 + acc[i * 3 + 2]!
      const l = Math.hypot(x, y, z) || 1
      A[i * 3] = x / l
      A[i * 3 + 1] = y / l
      A[i * 3 + 2] = z / l
    }
  }
  nor.needsUpdate = true
}

/** Materiau du contour : une coque inversee, gonflee le long des normales. */
function shellMaterial(thickness: { value: number }): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color: 0x1a1428, side: BackSide })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTh = thickness
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'uniform float uEp;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * uEp;')
  }
  return m
}

/**
 * Limite d'ombre organique : la normale utilisee pour l'eclairage est perturbee par un bruit
 * de basse frequence ANCRE SUR LE CORPS (position locale), si bien que la limite entre le
 * ton de base et le ton d'ombre ondule au lieu de suivre une ligne droite sur les faces
 * presque planes (etoile, fleur). Les yeux (emission) ne sont pas touches.
 */
function organiser(m: MeshToonMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'varying vec3 vObj;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObj = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'varying vec3 vObj;\nvoid main() {')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
  {
    vec3 o = vObj * 0.022;
    vec3 w = vec3(
      sin(o.y * 1.7 + o.x * 0.9 + 1.0) + 0.4 * sin(o.x * 2.3 - o.y * 1.9),
      sin(o.x * 1.5 - o.y * 1.1 + 2.0) + 0.4 * sin(o.y * 2.1 + o.x * 1.7),
      0.0
    );
    normal = normalize(normal + w * 0.2);
  }`
      )
  }
}

/** Rose des joues : se melange a la couleur du corps (jamais pose en aplat par-dessus). */
export const PLAYED = '#ff5c8a'

/** Position de la lumiere principale dans le repere de l'avatar : en haut a gauche, devant. */
const KEY_AVATAR: [number, number, number] = [-1.1, 1.5, 1.6]

/**
 * Lumieres d'une matiere. Realiste : lumiere douce en haut a gauche (celle de l'argile),
 * ciel clair et sol chaud pour des ombres colorees et jamais noires, petit contre-jour a
 * droite. Variantes plates : une ambiante et une directionnelle seulement, qui fixent les
 * tons (`lightingFlat`). Renvoie toutes les lumieres et la principale.
 */
export function lights(
  r: Material = DEFAULT_MATERIAL,
  softness: Softness = DEFAULT_SOFTNESS
): { all: Light[]; key: DirectionalLight } {
  const flat = settingFlat(r, softness)
  if (flat) {
    const e = lightingFlat(flat)
    const key = new DirectionalLight(0xffffff, e.directe)
    key.position.set(...KEY_AVATAR)
    return { all: [new AmbientLight(0xffffff, e.ambient), key], key }
  }
  const key = new DirectionalLight(0xffffff, 2.1)
  key.position.set(...KEY_AVATAR)
  const contre = new DirectionalLight(0xfff4e8, 0.45)
  contre.position.set(1.4, -0.3, 0.6)
  return { all: [new HemisphereLight(0xffffff, 0xd9cfc4, 1.9), key, contre], key }
}

/** Ajoute les lumieres d'une matiere a la scene ; renvoie la principale (ombres portees). */
export function light(scene: Scene, r: Material = DEFAULT_MATERIAL, softness: Softness = DEFAULT_SOFTNESS): DirectionalLight {
  const l = lights(r, softness)
  for (const x of l.all) scene.add(x)
  return l.key
}

/* ------------------------------------------------------------- avatar */

/**
 * Un seul contexte WebGL pour tous les avatars de la page : un navigateur en ouvre une
 * quinzaine au plus, et la planche ou la timeline montent bien plus de vignettes. Chaque
 * avatar demande une image, on la rend ici puis on la recopie dans SON canvas 2D.
 */
let share: {
  renderer: WebGLRenderer
  scene: Scene
  camera: OrthographicCamera
  mochi: Mochi3d
  /** matiere installee et ses lumieres : changees seulement quand la matiere change */
  renderStyle: Material
  softness: Softness
  lights: Light[]
} | null = null

function context() {
  if (share) return share
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setClearColor(new Color(0x000000), 0)
  const scene = new Scene()
  // camera de face, orthographique, calee sur le viewBox : le corps tombe exactement
  // la ou le SVG le dessinerait, donc les anneaux et la pastille restent alignes
  const camera = new OrthographicCamera(-VB, VB, VB, -VB, 1, 2000)
  camera.position.set(0, 0, 1000)
  const l = lights(DEFAULT_MATERIAL)
  for (const x of l.all) scene.add(x)
  const mochi = new Mochi3d(512)
  scene.add(mochi.mesh)
  share = { renderer, scene, camera, mochi, renderStyle: DEFAULT_MATERIAL, softness: DEFAULT_SOFTNESS, lights: l.all }
  return share
}

/**
 * Compile a l'avance les programmes des trois styles (Soft, Flat, Pixel) et leurs jeux de lumieres, pendant un moment
 * libre : le premier passage a un autre style ne fige plus la page le temps de compiler ses shaders (v12).
 */
export function warmUp() {
  const ctx3 = context()
  const { renderer, scene, camera, mochi } = ctx3
  const before = { renderStyle: ctx3.renderStyle, softness: ctx3.softness }
  const trials: [Material, Softness][] = [['soft', 'strong'], ['toon', DEFAULT_SOFTNESS], ['pixel', DEFAULT_SOFTNESS]]
  for (const [r, d] of trials) {
    for (const x of ctx3.lights) scene.remove(x)
    const l = lights(r, d)
    for (const x of l.all) scene.add(x)
    ctx3.lights = l.all
    ctx3.renderStyle = r
    ctx3.softness = d
    mochi.setRenderStyle(r, false, d)
    renderer.compile(scene, camera)
  }
  // retour a l'etat d'avant : le prochain avatar rendu repose ses propres reglages de toute facon
  for (const x of ctx3.lights) scene.remove(x)
  const l = lights(before.renderStyle, before.softness)
  for (const x of l.all) scene.add(x)
  ctx3.lights = l.all
  ctx3.renderStyle = before.renderStyle
  ctx3.softness = before.softness
}

/** true si le navigateur sait faire du WebGL ; sinon l'avatar affiche un message a la place du Mochi. */
export function webglAvailable(): boolean {
  try {
    context()
    return true
  } catch {
    return false
  }
}

/**
 * Dessine `frame` dans le canvas `target` (carre, en pixels physiques) : ombre au sol
 * (floue en realiste, en aplat dans les variantes flat), puis le corps 3D. `yaw` (radians)
 * fait tourner le corps sur lui-meme autour de l'axe vertical, la camera et la lumiere restent fixes.
 */
/** Forme (ou autre geometrie du corps) changee : les accessoires se replacent des que le corps a fini de se transformer. */
export function invalidateAccessories3d() {
  share?.mochi.invalidateAccessories()
}

export function renderAvatar(
  target: HTMLCanvasElement,
  frame: BotFrame,
  color: string,
  paper: string,
  material: Material = DEFAULT_MATERIAL,
  outline = false,
  softness: Softness = DEFAULT_SOFTNESS,
  highlight = DEFAULT_HIGHLIGHT,
  shape = '',
  yaw = 0,
  worn: WornId | null = null,
  accessories: AccessorySelection = {},
  /** demi-largeur du cadre en unites du moteur (par defaut le viewBox) : l'elargir laisse de la place aux grands accessoires */
  viewHalf = VB,
  /** `light` (defaut, rendu d'avant) ou `dark` : les yeux deviennent noirs */
  theme: Theme = DEFAULT_THEME,
  /** sombre : contraste minimal oeil noir / corps (defaut 3, 0 = ne jamais eclaircir le corps) */
  eyeContrast = MIN_EYE_CONTRAST,
  /** ordinateur du mood `working` : echelle de 0 (absent) a ~1 */
  laptop = 0,
  /** ombre portee au sol sous le corps (defaut : oui) */
  shadow = true,
  /** modele du volume (ombrage du corps) : oui par defaut ; non = aplat de couleur */
  shading = true,
  /** facteur d'epaisseur du contour (1 = l'epaisseur de base) */
  outlineWidth = DEFAULT_OUTLINE_WIDTH,
  /** vrai : le corps n'est pas dessine, seuls les accessoires le sont (ancres sur ce corps invisible) ; pas d'ombre ni de contour */
  withoutBody = false,
  /** centre du cadre en unites du moteur (y vers le haut) ; par defaut l'origine. Sert a cadrer serre sur des accessoires seuls. */
  center: { x: number; y: number } = { x: 0, y: 0 }
) {
  color = bodyForTheme(color, theme, eyeContrast)
  const ctx3 = context()
  const { renderer, scene, camera, mochi } = ctx3
  if (ctx3.renderStyle !== material || ctx3.softness !== softness) {
    // une page peut montrer plusieurs matieres : on change de lumieres seulement si besoin
    for (const x of ctx3.lights) scene.remove(x)
    const l = lights(material, softness)
    for (const x of l.all) scene.add(x)
    ctx3.lights = l.all
    ctx3.renderStyle = material
    ctx3.softness = softness
  }
  mochi.setWithoutBody(withoutBody)
  mochi.setShading(shading)
  mochi.setRenderStyle(material, outline, softness, highlight)
  mochi.setOutlineWidth(outlineWidth)
  mochi.setShape(shape)
  mochi.setWorn(worn)
  mochi.setTheme(theme, eyeContrast)
  mochi.setAccessories(accessories)
  mochi.setLaptop(laptop)
  if (camera.right !== center.x + viewHalf || camera.left !== center.x - viewHalf || camera.top !== center.y + viewHalf || camera.bottom !== center.y - viewHalf) {
    camera.left = center.x - viewHalf
    camera.right = center.x + viewHalf
    camera.top = center.y + viewHalf
    camera.bottom = center.y - viewHalf
    camera.updateProjectionMatrix()
  }
  // l'instance est partagee : l'angle est remis a chaque image, jamais garde d'un avatar a l'autre
  mochi.mesh.rotation.y = yaw
  const px = target.width
  // pixel : on rend 4 fois plus grand puis on reduit (moyenne) avant de ramener a la palette
  const pixel = material === 'pixel'
  const pxRender = pixel ? px * 4 : px
  mochi.fitOutline(pxRender / (2 * viewHalf))
  // Le canvas WebGL partage ne fait que GRANDIR : chaque avatar se rend dans le coin bas gauche (viewport + scissor),
  // puis on recopie ce carre. Redimensionner le canvas a chaque avatar (deux tailles a l'ecran) reallouait le tampon
  // de dessin a chaque image : plus de la moitie du temps de rendu sur telephone (v12).
  const canvasGl = renderer.domElement
  if (canvasGl.width < pxRender || canvasGl.height < pxRender) {
    const t = Math.max(pxRender, canvasGl.width, canvasGl.height)
    renderer.setSize(t, t, false)
  }
  renderer.setViewport(0, 0, pxRender, pxRender)
  renderer.setScissor(0, 0, pxRender, pxRender)
  renderer.setScissorTest(true)
  mochi.update(frame, color, paper)
  renderer.render(scene, camera)
  // le carre rendu, en coordonnees du canvas (l'origine WebGL est en bas a gauche)
  const sy = canvasGl.height - pxRender
  const c = target.getContext('2d')
  if (!c) return
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.clearRect(0, 0, px, px)
  if (!mochi.mesh.visible) return
  if (pixel) {
    // la reduction et la palette se font sur une petite toile LOGICIELLE (`willReadFrequently`) : relire les pixels
    // de la toile visible (acceleree) forcait une synchronisation complete a chaque image, la moitie du temps (v12)
    const cp = canvasPixel(px)
    cp.imageSmoothingEnabled = true
    cp.imageSmoothingQuality = 'high'
    cp.clearRect(0, 0, px, px)
    cp.drawImage(canvasGl, 0, sy, pxRender, pxRender, 0, 0, px, px)
    const im = cp.getImageData(0, 0, px, px)
    const t = worn ? WORN_TINTS[worn] : null
    const tints = worn === 'glasses' || worn === 'sunglasses' ? ['#26222f'] : t ? [t.background, t.accent] : []
    // joues : leur teinte entre dans la palette, sinon elle serait ramenee a la couleur du corps
    if ((frame.face?.cheeks ?? 0) > 0.05) tints.push(mixHex(color, PLAYED, 0.62))
    const body = leverDark(color)
    const eye = theme === 'dark' ? EYE_RGB : undefined
    quantifier(im.data, px, px, palettePixel(body, [...tints, ...mochi.colorsAccessories], eye), !eye && luminance(body) < 0.62, eye)
    cp.putImageData(im, 0, 0)
    c.drawImage(cp.canvas, 0, 0)
    return
  }
  const k = px / (2 * viewHalf)
  if (shadow && !withoutBody) {
    // ombre au sol : ellipse sous le point le plus bas, couleur de l'argile
    const neck = -mochi.neck
    const box = mochi.mesh.geometry.boundingSphere
    const large = (box?.radius ?? 100) * 0.72
    const cx = (box?.center.x ?? 0) + 6
    const flat = settingFlat(material, softness)
    c.save()
    c.translate(k * (cx + viewHalf), k * (neck + viewHalf - 2))
    c.scale(1, 0.2)
    const scope = materialKind(color).scope
    c.globalAlpha = frame.bodyAlpha
    c.beginPath()
    c.arc(0, 0, k * large, 0, Math.PI * 2)
    if (flat?.smooth) {
      // doux : ombre au sol lisse, un degrade tres leger sans bord net
      const g = c.createRadialGradient(0, 0, 0, 0, 0, k * large)
      g.addColorStop(0, hexA(scope, 0.34))
      g.addColorStop(0.6, hexA(scope, 0.17))
      g.addColorStop(1, hexA(scope, 0))
      c.fillStyle = g
    } else if (flat) {
      // 3D flat : une ellipse pleine et semi-transparente, sans flou
      c.fillStyle = hexA(scope, 0.26)
    } else {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, k * large)
      g.addColorStop(0, hexA(scope, 0.42))
      g.addColorStop(1, hexA(scope, 0))
      c.fillStyle = g
    }
    c.fill()
    c.restore()
  }
  c.globalAlpha = 1
  c.drawImage(canvasGl, 0, sy, pxRender, pxRender, 0, 0, px, px)
}

let ctxPixel: CanvasRenderingContext2D | null = null
/** Toile de travail du style Pixel, logicielle (relue a chaque image), agrandie au besoin. */
function canvasPixel(px: number): CanvasRenderingContext2D {
  if (!ctxPixel) {
    const cv = document.createElement('canvas')
    ctxPixel = cv.getContext('2d', { willReadFrequently: true })!
  }
  const cv = ctxPixel.canvas
  if (cv.width !== px || cv.height !== px) {
    cv.width = px
    cv.height = px
  }
  return ctxPixel
}

const hexA = (hex: string, a: number) => {
  const v = parseInt(hex.slice(1), 16)
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`
}
