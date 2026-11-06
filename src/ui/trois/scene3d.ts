/**
 * Rendu 3D reel (WebGL, Three.js) d'une image du moteur.
 *
 * Ce module n'est JAMAIS importe statiquement : `MochiBot.vue` et la page labo le
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
import { DEMI_VIEWBOX } from '@/bot/repere'
import { mixHex } from '@/bot/skins'
import { teintes3d } from '@/ui/rendu'
import { mesuresPorte, ombresPorte, rayonVerre, yeuxDe, type Ombre, type PorteId } from '@/bot/portes'
import { Porte3d } from './porte3d'
import { Accessoires3d } from './accessoires3d'
import { mesurerReperes } from './ancres'
import type { Selection } from '@/bot/emplacements'
import { lisere } from './lisere'
import { leverSombre, luminance, palettePixel, quantifier } from './pixel3d'
import { TEINTES_PORTES } from '@/bot/portes'
import {
  couleurContour,
  eclairagePlat,
  epaisseurContourPx,
  EPAISSEUR_CONTOUR_DEFAUT,
  EPAISSEUR_CONTOUR_MAX,
  EPAISSEUR_CONTOUR_MIN,
  finesseDe,
  gradientMap,
  maillageDe,
  reglagePlat,
  type Douceur,
  DOUCEUR_DEFAUT,
  type Rendu3d,
  RENDU_3D_DEFAUT
} from './rendu3d'
import { peindreReflet, REFLET_DEFAUT, type Reflet } from './reflet'
import { accessoiresSombres, CONTRASTE_OEIL_MIN, corpsPourTheme, couleurOeil, OEIL_RGB, THEME_DEFAUT, type Theme } from './theme'
import {
  centreDe,
  champDeRepos,
  contourDuCorps,
  demiEtendueOeil,
  gonfler,
  lireMatrice,
  profilDe,
  reduire,
  souderNormales,
  yeuxDeFace,
  type ProfilVolume,
  type Volume
} from './volume'

export type { Rendu3d } from './rendu3d'

const VB = DEMI_VIEWBOX

/** Teintes de la matiere : celles de l'argile, pour rester coherent avec la 3D douce. */
export function matiere(hex: string) {
  const t = teintes3d(hex, 'argile')
  return { base: t.base, creux: t.ombre, portee: t.portee }
}

/**
 * Un corps 3D : un maillage et sa texture de visage, mis a jour image par image.
 * Une instance par mochi affiche dans une scene (la page isometrique en a trois) ;
 * l'avatar, lui, partage une seule instance pour toutes ses vignettes.
 */
/** Un maillage et son volume : `plein` (realiste, toon, aplat) ou `grossier` (lowpoly). */
interface Maillage {
  geo: BufferGeometry
  volume?: Volume
  positions?: Float32Array
  bas: number
}

/**
 * Maillages gardes par un corps (LRU) : un par forme et par contour. Une forme au repos, ou
 * un avatar que la page rend a chaque image, ne recalcule donc pas sa geometrie ; pendant un
 * mouvement chaque image est un contour neuf, et on recycle alors le plus ancien.
 */
const MAILLAGES_GARDES = 24

type Materiau = MeshStandardMaterial | MeshToonMaterial

export class Mochi3d {
  readonly mesh: Mesh<BufferGeometry, Materiau | MeshBasicMaterial>
  private readonly toile: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly texture: CanvasTexture
  /** masque des yeux (blanc sur noir) : ils s'allument, pour rester nets quelle que soit la lumiere */
  private readonly toileYeux: HTMLCanvasElement
  private readonly ctxYeux: CanvasRenderingContext2D
  private readonly textureYeux: CanvasTexture
  private readonly maillages = new Map<string, Maillage>()
  /** accessoire porte : chapeau et casque en volumes fixes au maillage, lunettes peintes sur le visage */
  private porte: PorteId | null = null
  private readonly porte3d = new Porte3d()
  /** accessoires par emplacements (tete, yeux, visage, bas, dos), combinables */
  private accs: Selection = {}
  private readonly acc3d = new Accessoires3d()
  /** modele du volume (ombrage, liseres) : oui par defaut ; non = corps en aplat de couleur, yeux inchanges */
  private ombrage = true
  private matAplat: MeshBasicMaterial | null = null
  /** ordinateur du mood `travaille` : echelle de 0 (cache) a ~1 (pousse), posee par le composant */
  private ordi = 0
  /** sol de chaque forme : le point le plus bas vu pendant les rebonds (l'ordinateur ne saute pas avec le corps) */
  private readonly sols = new Map<string, number>()
  /** theme : `light` (yeux blancs, defaut) ou `dark` (yeux noirs) */
  private theme: Theme = THEME_DEFAUT
  /** contraste minimal oeil noir / corps en sombre (en dessous, le corps est eclairci) ; 0 = jamais */
  private contrasteOeil = CONTRASTE_OEIL_MIN
  /** forme du mochi (`squircle`, `etoile`...) : fixe son profil de volume et ses yeux */
  private forme = ''
  /** profil impose (option de labo) ; sinon celui de la forme */
  private profilImpose: ProfilVolume | null = null
  private get profil(): ProfilVolume {
    return this.profilImpose ?? profilDe(this.forme)
  }
  private readonly materiaux = new Map<string, Materiau>()
  private readonly rampes: DataTexture[] = []
  /** contour fonce (coque inversee), visible seulement en `toon-contour` */
  private readonly coque: Mesh<BufferGeometry, MeshBasicMaterial>
  private rendu: Rendu3d = RENDU_3D_DEFAUT
  private douceur: Douceur = DOUCEUR_DEFAUT
  /** petit reflet doux en haut a gauche (matiere `doux` seulement) */
  /** reflet doux en shader : 1 = actif (uniform partage par les materiaux de ce corps) */
  private readonly uReflet = { value: 1 }
  /** yeux noirs (theme sombre) : 1 = pas d'emission, pas de lueur ajoutee sur les yeux */
  private readonly uOeil = { value: 0 }
  /** demi-epaisseur du contour, en unites du moteur (uniform de la coque) */
  private readonly epaisseur = { value: 4.5 }
  /** facteur d'epaisseur du contour (1 = l'epaisseur de base) */
  private facteurContour = 1
  /** derniers contour et visage peints : inchanges d'une image a l'autre, on ne refait rien */
  private cleVisage = ''
  /** Bas du corps, repere Three (y vers le haut) : la ou il touche le sol. */
  bas = -100

  constructor(taille = 512) {
    this.toile = document.createElement('canvas')
    this.toile.width = this.toile.height = taille
    this.ctx = this.toile.getContext('2d')!
    this.texture = new CanvasTexture(this.toile)
    this.texture.colorSpace = SRGBColorSpace
    this.toileYeux = document.createElement('canvas')
    this.toileYeux.width = this.toileYeux.height = taille
    this.ctxYeux = this.toileYeux.getContext('2d')!
    this.textureYeux = new CanvasTexture(this.toileYeux)
    this.textureYeux.colorSpace = SRGBColorSpace
    const mat = this.materiau(RENDU_3D_DEFAUT)
    this.mesh = new Mesh(new BufferGeometry(), mat)
    this.mesh.castShadow = true
    this.coque = new Mesh(this.mesh.geometry, coqueMateriau(this.epaisseur))
    this.coque.visible = false
    this.mesh.add(this.coque)
    this.mesh.add(this.porte3d.groupe)
    this.mesh.add(this.acc3d.groupe)
  }

  /** Intensite d'emission des yeux : celle du materiau en clair, nulle en sombre (l'oeil est noir, il ne s'allume pas). */
  private emission(m: Materiau): number {
    return this.theme === 'dark' ? 0 : m instanceof MeshStandardMaterial ? 0.85 : 1
  }

  /** Materiau d'une variante, cree a la demande et garde. */
  private materiau(r: Rendu3d, douceur: Douceur = this.douceur): Materiau {
    const cle = `${r}|${r === 'doux' ? douceur : ''}`
    const deja = this.materiaux.get(cle)
    if (deja) return deja
    const plat = reglagePlat(r, douceur)
    let m: Materiau
    if (!plat) {
      m = new MeshStandardMaterial({
        map: this.texture,
        emissiveMap: this.textureYeux,
        // un oeil est un trou sur le fond clair : sans cela la lumiere le grise et il se perd
        emissive: new Color(0xffffff),
        emissiveIntensity: 0.85,
        roughness: 0.9,
        metalness: 0
      })
    } else {
      // matiere toon : des paliers nets, aucun reflet spaculaire. Le gradientMap est
      // lu en NearestFilter, donc la rampe reste en marches.
      const g = gradientMap(plat)
      const rampe = new DataTexture(g, g.length, 1, RedFormat, UnsignedByteType)
      // ombrage lisse : filtrage lineaire, la rampe est une courbe continue (pas de marche)
      rampe.minFilter = rampe.magFilter = plat.lisse ? LinearFilter : NearestFilter
      rampe.generateMipmaps = false
      rampe.needsUpdate = true
      this.rampes.push(rampe)
      m = new MeshToonMaterial({
        map: this.texture,
        gradientMap: rampe,
        // les yeux restent blancs et nets : ils s'allument, aucune ombre ne les grise
        emissiveMap: this.textureYeux,
        emissive: new Color(0xffffff),
        emissiveIntensity: 1
      })
      if (plat.organique) organiser(m)
      // le shader toon sait deriver une normale par facette ; seul le typage ne le declare pas
      if (plat.facettes) (m as unknown as { flatShading: boolean }).flatShading = true
    }
    // l'ombrage continu (AO, liseres, reflet) n'a de sens que pour la matiere douce : les styles a aplats gardent leurs tons nets
    if (!plat || plat.lisse) lisere(m, plat ? 0.7 : 0.5, plat ? 0.32 : 0.22, { reflet: this.uReflet, ao: 1, oeil: this.uOeil })
    m.emissiveIntensity = this.emission(m)
    this.materiaux.set(cle, m)
    return m
  }

  /** Corps sans modele : la texture seule (couleur du corps, yeux peints), aucune lumiere ne l'ombre. */
  private aplat(): MeshBasicMaterial {
    this.matAplat ??= new MeshBasicMaterial({ map: this.texture })
    return this.matAplat
  }

  /** Active ou coupe l'ombrage du volume (Soft, Flat et Pixel). Appele avant `setRendu`. */
  setOmbrage(oui: boolean) {
    this.ombrage = oui
  }

  /** Choisit la matiere : materiau, maillage et contour. Appele avant `maj`. */
  setRendu(r: Rendu3d, contour = false, douceur: Douceur = DOUCEUR_DEFAUT, reflet = REFLET_DEFAUT) {
    this.rendu = r
    this.douceur = douceur
    this.uReflet.value = reflet && reglagePlat(r, douceur)?.lisse ? 1 : 0
    this.mesh.material = this.ombrage ? this.materiau(r, douceur) : this.aplat()
    // le contour cartoon est une option des variantes plates (jamais du realiste)
    this.coque.visible = !!reglagePlat(r, douceur) && (contour || !!reglagePlat(r, douceur)?.contour)
  }

  /**
   * Cale l'epaisseur du contour sur la taille du mochi a l'ecran : `pxParUnite` = pixels
   * (physiques) d'une unite du moteur. Le trait s'allege en petite taille.
   */
  calerContour(pxParUnite: number) {
    const diametre = 2 * 100 * pxParUnite
    this.epaisseur.value = (epaisseurContourPx(diametre) * this.facteurContour) / Math.max(1e-6, pxParUnite)
  }

  /** Facteur d'epaisseur du contour (1 = l'epaisseur de base). Appele avant `calerContour`. */
  setEpaisseurContour(k: number) {
    this.facteurContour = Number.isFinite(k) ? Math.min(EPAISSEUR_CONTOUR_MAX, Math.max(EPAISSEUR_CONTOUR_MIN, k)) : EPAISSEUR_CONTOUR_DEFAUT
  }

  /** Impose un profil de volume (essai d'un profil alternatif) ; `null` revient a celui de la forme. */
  setProfil(p: ProfilVolume | null) {
    this.profilImpose = p
  }

  /** Choisit l'accessoire porte (`null` = aucun). Appele avant `maj`. */
  setPorte(id: PorteId | null) {
    this.porte = id
  }

  /** Choisit les accessoires par emplacement (un au plus par emplacement, tous cumulables). Appele avant `maj`. */
  /** Echelle de l'ordinateur (0 = absent). */
  setOrdinateur(k: number) {
    this.ordi = k
  }

  setAccessoires(sel: Selection) {
    this.accs = this.theme === 'dark' ? accessoiresSombres(sel) : sel
  }

  /**
   * Choisit le theme (`dark` = yeux noirs). Appele avant `setAccessoires` et `maj` : le choix des
   * accessoires et la peinture du visage en dependent.
   */
  setTheme(theme: Theme, contrasteOeil = CONTRASTE_OEIL_MIN) {
    this.theme = theme
    this.contrasteOeil = contrasteOeil
    // sombre : le masque des yeux n'allume plus rien (emission a 0) et les lueurs l'evitent
    this.uOeil.value = theme === 'dark' ? 1 : 0
    for (const m of this.materiaux.values()) m.emissiveIntensity = this.emission(m)
  }

  /** Couleurs des accessoires portes (palette du pixel art). */
  get couleursAccessoires(): string[] {
    return this.acc3d.couleurs
  }

  /** Dit quelle forme est rendue : son profil de volume (cube, prisme, dome...) en depend. */
  setForme(forme: string) {
    this.forme = forme
    // forme « coussin » : le champ de hauteur se resout ici, une fois, plutot qu'au milieu d'une animation
    if (profilDe(forme).coussin) champDeRepos(forme)
  }

  /** Le maillage du contour courant : relu du cache, sinon calcule (en recyclant le plus ancien). */
  private maillage(frame: BotFrame): Maillage {
    const cle = `${maillageDe(this.rendu)}|${this.forme}${this.profilImpose ? '+' + JSON.stringify(this.profilImpose) : ''}|${frame.bodyPath}`
    const deja = this.maillages.get(cle)
    if (deja) {
      // le plus recemment utilise passe en dernier
      this.maillages.delete(cle)
      this.maillages.set(cle, deja)
      return deja
    }
    let m: Maillage | undefined
    if (this.maillages.size >= MAILLAGES_GARDES) {
      const vieille = this.maillages.keys().next().value!
      m = this.maillages.get(vieille)
      this.maillages.delete(vieille)
    }
    m ??= { geo: new BufferGeometry(), bas: -100 }
    this.remplir(frame, m)
    this.maillages.set(cle, m)
    return m
  }

  /** Recopie l'image `frame` du moteur dans le maillage et la texture. */
  maj(frame: BotFrame, couleur: string, papier: string) {
    // sombre : yeux noirs, et un corps eclairci seulement s'il ne contraste pas assez avec eux
    couleur = corpsPourTheme(couleur, this.theme, this.contrasteOeil)
    papier = couleurOeil(this.theme, papier)
    // Flat et Pixel : une couleur quasi noire garde du relief (voir `leverSombre`)
    if (this.rendu === 'toon' || this.rendu === 'toon-contour' || this.rendu === 'pixel') couleur = leverSombre(couleur)
    this.mesh.visible = frame.bodyPath.length > 10 && frame.bodyAlpha > 0.01
    if (!this.mesh.visible) return
    const mat = this.mesh.material
    mat.transparent = frame.bodyAlpha < 1
    mat.opacity = frame.bodyAlpha
    const plat = reglagePlat(this.rendu, this.douceur)
    const m = matiere(couleur)
    const mt = this.maillage(frame)
    this.mesh.geometry = this.coque.geometry = mt.geo
    this.bas = mt.bas
    this.sols.set(this.forme, Math.min(this.sols.get(this.forme) ?? Infinity, mt.bas))
    if (this.coque.visible) {
      const cm = this.coque.material
      cm.color.set(couleurContour(couleur))
      cm.transparent = mat.transparent
      cm.opacity = mat.opacity
    }
    // accessoire porte : replace depuis le contour de cette image (chapeau, noeud) ou depuis les
    // yeux 3D (lunettes, vraie monture en tube), et petite ombre douce qu'il pose sur le corps
    const geo = this.mesh.geometry
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    const frameCorps = frame
    // les yeux de la 3D : pile en face, sur la face avant. `frameVisage` y ajoute le regard des humeurs
    // (decalage des yeux) : seuls les yeux peints le suivent, les lunettes restent sur le visage
    const frameVisage = frame.visage ? this.yeuxSurLaFace(frame, true) : null
    frame = this.yeuxSurLaFace(frame)
    const plat0 = reglagePlat(this.rendu, this.douceur)
    this.porte3d.reglages = plat0?.lisse ? { force: 0.7, haut: 0.32, ao: 1, reflet: this.uReflet } : null
    this.porte3d.maj(this.porte, frameCorps, this.materiau(this.rendu, this.douceur), bb ? (bb.min.z + bb.max.z) / 2 : 0, frame, (x, y) => this.zFace(x, y), (y, sg) => this.bordX(y, sg))
    // accessoires par emplacements : ancres sur le volume de CE corps, recalcules quand le corps change
    this.acc3d.reglages = this.porte3d.reglages
    this.acc3d.corps = couleur
    const cleCorps = `${this.rendu}|${this.forme}|${frameCorps.bodyPath}|${JSON.stringify(frame.eyes)}`
    this.acc3d.maj(this.accs, cleCorps, this.materiau(this.rendu, this.douceur), () => {
      const ye = yeuxDe(frame)
      const sc = ye.map((o) => ({ x: o.x, y: -o.y, r: o.r }))
      return mesurerReperes(this.mesh.geometry, sc, ye.length === 2 ? rayonVerre(ye[0]!, ye[1]!) : 22)
    }, { k: this.ordi, sol: this.sols.get(this.forme) ?? mt.bas, cle: `${this.rendu}|${this.forme}` })
    // le contour des accessoires suit celui du corps (meme visibilite, meme epaisseur)
    this.acc3d.contour(this.coque.visible, this.epaisseur.value)
    const ombres: Ombre[] = [...(this.porte ? ombresPorte(this.porte, frame, mesuresPorte(frameCorps)) : []), ...this.acc3d.ombres]
    // le reflet doux est un effet de matiere (shader, repere de la vue) : plus rien n'est peint dans la
    // texture hors des yeux, donc le dos et les flancs recoivent le meme ombrage que la face
    const reflet = null as Reflet | null
    const cleReflet = reflet ? [reflet.x, reflet.y, reflet.rx].map((v) => Math.round(v * 2)).join(',') : '-'
    const yeuxPeints = frameVisage ?? frame
    const joues = frameVisage?.visage?.joues ?? 0
    const cleVisage = `${this.rendu}|${this.douceur}|${this.ombrage}|${this.theme}|${couleur}|${papier}|${JSON.stringify(yeuxPeints.eyes)}|${joues.toFixed(2)}|${cleReflet}|${this.porte ?? ''}|${ombres.map((o) => [o.x, o.y, o.rx, o.ry].map((v) => Math.round(v)).join(',')).join(';')}`
    if (cleVisage !== this.cleVisage) {
      this.cleVisage = cleVisage
      // le flat garde la couleur choisie telle quelle (pas de pastel), sans creux d'oeil
      this.peindre(yeuxPeints, plat ? couleur : m.base, papier, m.creux, !plat && this.theme === 'light' && this.ombrage, reflet, ombres, joues)
    }
  }

  /** Abscisse du bord du corps (cote `sg` : -1 gauche, 1 droite) a la hauteur `y` du moteur. */
  private bordX(y: number, sg: number): number {
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
   * Les yeux de la 3D sont PILE EN FACE (`yeuxDeFace`) : centres, symetriques, droits, un peu
   * au-dessus du centre de la face avant. Le regard, l'inclinaison et la deformation de
   * sphere du moteur ne comptent pas ici ; l'ecart au 2D est voulu. Chaque oeil garde sa forme
   * (clignement, expression) et son opacite.
   */
  private yeuxSurLaFace(frame: BotFrame, regard = false): BotFrame {
    if (!frame.eyes.length) return frame
    const yeux = [...frame.eyes].sort((p, q) => lireMatrice(p.matrix)[4]! - lireMatrice(q.matrix)[4]!)
    const demi = yeux.map((e) => demiEtendueOeil(e.d, 'matrix(1 0 0 1 0 0)'))
    let contour = contourDuCorps(frame.bodyPath, 1)
    // humeur : la tete penche. On cherche la face sur le corps REDRESSE, puis on penche les yeux avec lui
    const rot = frame.visage?.rot ?? 0
    const q = (rot * Math.PI) / 180
    const cq = Math.cos(q)
    const sq = Math.sin(q)
    const centre = rot ? centreDe(contour) : { x: 0, y: 0 }
    if (rot) contour = contour.map((p) => ({ x: centre.x + cq * (p.x - centre.x) + sq * (p.y - centre.y), y: centre.y - sq * (p.x - centre.x) + cq * (p.y - centre.y) }))
    const pos = yeuxDeFace(contour, demi, this.profil)
    if (pos.length !== yeux.length) return frame
    return {
      ...frame,
      eyes: yeux.map((e, i) => {
        const p = pos[i]!
        const f = (v: number) => Math.round(v * 100) / 100
        // position : rotation autour du centre du corps (la tete penche), puis regard dans le repere de la tete
        const x0 = rot ? centre.x + cq * (p.x - centre.x) - sq * (p.y - centre.y) : p.x
        const y0 = rot ? centre.y + sq * (p.x - centre.x) + cq * (p.y - centre.y) : p.y
        // sans `regard` : la place des yeux sur le visage, droits et ronds, pour les lunettes et les accessoires
        // (leurs mesures ne doivent pas varier avec un clignement ou un regard)
        if (!frame.visage || !regard) return { ...e, matrix: `matrix(${f(p.s)} 0 0 ${f(p.s)} ${f(x0)} ${f(y0)})` }
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

  private remplir(frame: BotFrame, mt: Maillage) {
    const plat = reglagePlat(this.rendu, this.douceur)
    let pts = contourDuCorps(frame.bodyPath, plat && plat.reduction > 1 ? 1 : undefined)
    if (plat && plat.reduction > 1) pts = reduire(pts, plat.reduction)
    if (pts.length < 3) return
    const v = gonfler(pts, VB, mt.volume, finesseDe(this.rendu), this.profil)
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
    souderNormales(geo.attributes.normal!.array as Float32Array, pts.length, finesseDe(this.rendu).anneaux)
    // Flat et Pixel : des paliers nets sur des normales irregulieres font des taches (nuage, fleur,
    // etoile). On lisse les normales avant de couper en tons : les limites deviennent des courbes propres.
    // Soft sur une forme « coussin » : quelques passes aussi, pour fondre la ligne de raccord entre l'avant et l'arriere
    const lissePlat = !!plat && !plat.lisse && !plat.facettes
    if ((lissePlat || (this.profil.coussin && !plat?.facettes)) && geo.index) {
      lisserNormales(geo.attributes.normal as BufferAttribute, geo.index.array, lissePlat ? 14 : 20)
      souderNormales(geo.attributes.normal!.array as Float32Array, pts.length, finesseDe(this.rendu).anneaux)
    }
    geo.computeBoundingSphere()
    mt.bas = -v.bas
  }

  /**
   * Le visage : la couleur du corps, et les yeux en couleur du fond (des trous), avec une
   * ombre interne sur le rebord haut gauche, comme le creux de l'argile.
   */
  private peindre(frame: BotFrame, base: string, papier: string, creux: string, creuser = true, reflet: Reflet | null = null, ombres: Ombre[] = [], joues = 0) {
    const c = this.ctx
    const T = this.toile.width
    const k = T / (2 * VB)
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.fillStyle = base
    c.fillRect(0, 0, T, T)
    // le reflet est peint AVANT les yeux : ils le recouvrent, il ne les touche jamais
    if (reflet) peindreReflet(c, reflet, k, VB)
    const trous: Array<{ chemin: Path2D; m: number[]; alpha: number }> = frame.eyes.map((e) => ({
      chemin: new Path2D(e.d),
      m: lireMatrice(e.matrix),
      alpha: e.alpha
    }))
    const y = this.ctxYeux
    y.setTransform(1, 0, 0, 1, 0, 0)
    y.globalAlpha = 1
    y.fillStyle = '#000'
    y.fillRect(0, 0, T, T)
    for (const { chemin, m, alpha } of trous) {
      if (alpha <= 0.01) continue
      const [a, b, cc, d, e, f] = m as [number, number, number, number, number, number]
      y.setTransform(k * a, k * b, k * cc, k * d, k * (e + VB), k * (f + VB))
      y.globalAlpha = alpha
      // le masque reste blanc sur l'oeil, aussi en sombre : il n'y allume rien (emission a 0) mais
      // dit au shader d'y laisser un noir franc (voir `lisere`)
      y.fillStyle = '#fff'
      y.fill(chemin)
      c.setTransform(k * a, k * b, k * cc, k * d, k * (e + VB), k * (f + VB))
      c.globalAlpha = alpha
      c.fillStyle = papier
      c.fill(chemin)
      if (!creuser) continue
      // ombre interne : un grand cadre perce de l'oeil, dont seule l'ombre entre dans le trou
      c.save()
      c.clip(chemin)
      const cadre = new Path2D()
      cadre.rect(-400, -400, 800, 800)
      cadre.addPath(chemin)
      c.shadowColor = mixHex(creux, papier, 0.15)
      c.shadowBlur = 5 * k
      c.shadowOffsetX = 2.5 * k
      c.shadowOffsetY = 4 * k
      c.fillStyle = creux
      c.fill(cadre, 'evenodd')
      c.restore()
    }
    // joues : une teinte rose doucement fondue sous les yeux, peinte DANS la couleur du corps (pas un objet)
    if (joues > 0.01) this.peindreJoues(frame, base, joues, k)
    // ombres douces des accessoires, posees sur le corps (degrade radial, sans bord)
    for (const o of ombres) {
      c.setTransform(k * o.rx, 0, 0, k * o.ry, k * (o.x + VB), k * (o.y + VB))
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1)
      const ombre = mixHex(creux, '#000000', 0.45)
      g.addColorStop(0, hexA(ombre, o.a))
      g.addColorStop(1, hexA(ombre, 0))
      c.globalAlpha = 1
      c.fillStyle = g
      c.fillRect(-1, -1, 2, 2)
    }
    y.setTransform(1, 0, 0, 1, 0, 0)
    y.globalAlpha = 1
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    this.texture.needsUpdate = true
    this.textureYeux.needsUpdate = true
  }

  /**
   * Teinte des joues : deux taches elliptiques, a l'exterieur et sous chaque oeil, qui se fondent dans
   * la couleur du corps. Elles suivent les yeux (donc la tete penchee) et ne depassent pas : la texture
   * n'existe que sur le corps.
   */
  private peindreJoues(frame: BotFrame, base: string, joues: number, k: number) {
    const c = this.ctx
    const yeux = [...frame.eyes].sort((p, q) => lireMatrice(p.matrix)[4]! - lireMatrice(q.matrix)[4]!)
    if (yeux.length < 2) return
    const q = ((frame.visage?.rot ?? 0) * Math.PI) / 180
    const cq = Math.cos(q)
    const sq = Math.sin(q)
    const teinte = mixHex(base, JOUE, 0.62)
    yeux.forEach((e, i) => {
      const [, , , , ex, ey] = lireMatrice(e.matrix)
      const sg = i === 0 ? -1 : 1
      // decalage dans le repere de la tete : vers l'exterieur et vers le bas
      const dx = sg * 17
      const dy = 25
      const x = ex + cq * dx - sq * dy
      const y = ey + sq * dx + cq * dy
      c.setTransform(k * 27, 0, 0, k * 17, k * (x + VB), k * (y + VB))
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1)
      g.addColorStop(0, hexA(teinte, 0.9 * joues))
      g.addColorStop(0.55, hexA(teinte, 0.55 * joues))
      g.addColorStop(1, hexA(teinte, 0))
      c.globalAlpha = e.alpha
      c.fillStyle = g
      c.fillRect(-1, -1, 2, 2)
    })
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
  }

  liberer() {
    for (const m of this.maillages.values()) m.geo.dispose()
    this.mesh.geometry.dispose()
    for (const m of this.materiaux.values()) m.dispose()
    for (const r of this.rampes) r.dispose()
    this.coque.material.dispose()
    this.porte3d.liberer()
    this.acc3d.liberer()
    this.texture.dispose()
    this.textureYeux.dispose()
  }
}

/**
 * Quelques passes de moyenne des normales avec celles des sommets voisins (via les triangles),
 * pour effacer les plis de triangulation qui se lisent comme des taches sous un ombrage a paliers.
 */
function lisserNormales(nor: BufferAttribute, index: ArrayLike<number>, passes: number) {
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
function coqueMateriau(epaisseur: { value: number }): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color: 0x1a1428, side: BackSide })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uEp = epaisseur
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
export const JOUE = '#ff5c8a'

/** Position de la lumiere principale dans le repere de l'avatar : en haut a gauche, devant. */
const CLE_AVATAR: [number, number, number] = [-1.1, 1.5, 1.6]

/**
 * Lumieres d'une matiere. Realiste : lumiere douce en haut a gauche (celle de l'argile),
 * ciel clair et sol chaud pour des ombres colorees et jamais noires, petit contre-jour a
 * droite. Variantes plates : une ambiante et une directionnelle seulement, qui fixent les
 * tons (`eclairagePlat`). Renvoie toutes les lumieres et la principale.
 */
export function lumieres(
  r: Rendu3d = RENDU_3D_DEFAUT,
  douceur: Douceur = DOUCEUR_DEFAUT
): { toutes: Light[]; cle: DirectionalLight } {
  const plat = reglagePlat(r, douceur)
  if (plat) {
    const e = eclairagePlat(plat)
    const cle = new DirectionalLight(0xffffff, e.directe)
    cle.position.set(...CLE_AVATAR)
    return { toutes: [new AmbientLight(0xffffff, e.ambiante), cle], cle }
  }
  const cle = new DirectionalLight(0xffffff, 2.1)
  cle.position.set(...CLE_AVATAR)
  const contre = new DirectionalLight(0xfff4e8, 0.45)
  contre.position.set(1.4, -0.3, 0.6)
  return { toutes: [new HemisphereLight(0xffffff, 0xd9cfc4, 1.9), cle, contre], cle }
}

/** Ajoute les lumieres d'une matiere a la scene ; renvoie la principale (ombres portees). */
export function eclairer(scene: Scene, r: Rendu3d = RENDU_3D_DEFAUT, douceur: Douceur = DOUCEUR_DEFAUT): DirectionalLight {
  const l = lumieres(r, douceur)
  for (const x of l.toutes) scene.add(x)
  return l.cle
}

/* ------------------------------------------------------------- avatar */

/**
 * Un seul contexte WebGL pour tous les avatars de la page : un navigateur en ouvre une
 * quinzaine au plus, et la planche ou la timeline montent bien plus de vignettes. Chaque
 * avatar demande une image, on la rend ici puis on la recopie dans SON canvas 2D.
 */
let partage: {
  renderer: WebGLRenderer
  scene: Scene
  camera: OrthographicCamera
  mochi: Mochi3d
  /** matiere installee et ses lumieres : changees seulement quand la matiere change */
  rendu: Rendu3d
  douceur: Douceur
  lumieres: Light[]
} | null = null

function contexte() {
  if (partage) return partage
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setClearColor(new Color(0x000000), 0)
  const scene = new Scene()
  // camera de face, orthographique, calee sur le viewBox : le corps tombe exactement
  // la ou le SVG le dessinerait, donc les anneaux et la pastille restent alignes
  const camera = new OrthographicCamera(-VB, VB, VB, -VB, 1, 2000)
  camera.position.set(0, 0, 1000)
  const l = lumieres(RENDU_3D_DEFAUT)
  for (const x of l.toutes) scene.add(x)
  const mochi = new Mochi3d(512)
  scene.add(mochi.mesh)
  partage = { renderer, scene, camera, mochi, rendu: RENDU_3D_DEFAUT, douceur: DOUCEUR_DEFAUT, lumieres: l.toutes }
  return partage
}

/** true si le navigateur sait faire du WebGL ; sinon l'avatar garde l'argile en SVG. */
export function webglDisponible(): boolean {
  try {
    contexte()
    return true
  } catch {
    return false
  }
}

/**
 * Dessine `frame` dans le canvas `cible` (carre, en pixels physiques) : ombre au sol
 * (floue en realiste, en aplat dans les variantes flat), puis le corps 3D. `yaw` (radians)
 * fait tourner le corps sur lui-meme autour de l'axe vertical, la camera et la lumiere restent fixes.
 */
export function rendreAvatar(
  cible: HTMLCanvasElement,
  frame: BotFrame,
  couleur: string,
  papier: string,
  rendu3d: Rendu3d = RENDU_3D_DEFAUT,
  contour = false,
  douceur: Douceur = DOUCEUR_DEFAUT,
  reflet = REFLET_DEFAUT,
  forme = '',
  yaw = 0,
  porte: PorteId | null = null,
  accessoires: Selection = {},
  /** demi-largeur du cadre en unites du moteur (par defaut le viewBox) : l'elargir laisse de la place aux grands accessoires */
  cadre = VB,
  /** `light` (defaut, rendu d'avant) ou `dark` : les yeux deviennent noirs */
  theme: Theme = THEME_DEFAUT,
  /** sombre : contraste minimal oeil noir / corps (defaut 3, 0 = ne jamais eclaircir le corps) */
  contrasteOeil = CONTRASTE_OEIL_MIN,
  /** ordinateur du mood `travaille` : echelle de 0 (absent) a ~1 */
  ordinateur = 0,
  /** ombre portee au sol sous le corps (defaut : oui) */
  ombre = true,
  /** modele du volume (ombrage du corps) : oui par defaut ; non = aplat de couleur */
  ombrage = true,
  /** facteur d'epaisseur du contour (1 = l'epaisseur de base) */
  epaisseurContour = EPAISSEUR_CONTOUR_DEFAUT
) {
  couleur = corpsPourTheme(couleur, theme, contrasteOeil)
  const ctx3 = contexte()
  const { renderer, scene, camera, mochi } = ctx3
  if (ctx3.rendu !== rendu3d || ctx3.douceur !== douceur) {
    // une page peut montrer plusieurs matieres : on change de lumieres seulement si besoin
    for (const x of ctx3.lumieres) scene.remove(x)
    const l = lumieres(rendu3d, douceur)
    for (const x of l.toutes) scene.add(x)
    ctx3.lumieres = l.toutes
    ctx3.rendu = rendu3d
    ctx3.douceur = douceur
  }
  mochi.setOmbrage(ombrage)
  mochi.setRendu(rendu3d, contour, douceur, reflet)
  mochi.setEpaisseurContour(epaisseurContour)
  mochi.setForme(forme)
  mochi.setPorte(porte)
  mochi.setTheme(theme, contrasteOeil)
  mochi.setAccessoires(accessoires)
  mochi.setOrdinateur(ordinateur)
  if (camera.right !== cadre) {
    camera.left = -cadre
    camera.right = cadre
    camera.top = cadre
    camera.bottom = -cadre
    camera.updateProjectionMatrix()
  }
  // l'instance est partagee : l'angle est remis a chaque image, jamais garde d'un avatar a l'autre
  mochi.mesh.rotation.y = yaw
  const px = cible.width
  // pixel : on rend 4 fois plus grand puis on reduit (moyenne) avant de ramener a la palette
  const pixel = rendu3d === 'pixel'
  const pxRendu = pixel ? px * 4 : px
  mochi.calerContour(pxRendu / (2 * cadre))
  const taille = renderer.domElement.width
  if (taille !== pxRendu) renderer.setSize(pxRendu, pxRendu, false)
  mochi.maj(frame, couleur, papier)
  renderer.render(scene, camera)
  const c = cible.getContext('2d')
  if (!c) return
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.clearRect(0, 0, px, px)
  if (!mochi.mesh.visible) return
  if (pixel) {
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
    c.drawImage(renderer.domElement, 0, 0, px, px)
    const im = c.getImageData(0, 0, px, px)
    const t = porte ? TEINTES_PORTES[porte] : null
    const teintes = porte === 'lunettes' || porte === 'soleil' ? ['#26222f'] : t ? [t.fond, t.accent] : []
    // joues : leur teinte entre dans la palette, sinon elle serait ramenee a la couleur du corps
    if ((frame.visage?.joues ?? 0) > 0.05) teintes.push(mixHex(couleur, JOUE, 0.62))
    const corps = leverSombre(couleur)
    const oeil = theme === 'dark' ? OEIL_RGB : undefined
    quantifier(im.data, px, px, palettePixel(corps, [...teintes, ...mochi.couleursAccessoires], oeil), !oeil && luminance(corps) < 0.62, oeil)
    c.putImageData(im, 0, 0)
    return
  }
  const k = px / (2 * cadre)
  if (ombre) {
    // ombre au sol : ellipse sous le point le plus bas, couleur de l'argile
    const bas = -mochi.bas
    const box = mochi.mesh.geometry.boundingSphere
    const large = (box?.radius ?? 100) * 0.72
    const cx = (box?.center.x ?? 0) + 6
    const plat = reglagePlat(rendu3d, douceur)
    c.save()
    c.translate(k * (cx + cadre), k * (bas + cadre - 2))
    c.scale(1, 0.2)
    const portee = matiere(couleur).portee
    c.globalAlpha = frame.bodyAlpha
    c.beginPath()
    c.arc(0, 0, k * large, 0, Math.PI * 2)
    if (plat?.lisse) {
      // doux : ombre au sol lisse, un degrade tres leger sans bord net
      const g = c.createRadialGradient(0, 0, 0, 0, 0, k * large)
      g.addColorStop(0, hexA(portee, 0.34))
      g.addColorStop(0.6, hexA(portee, 0.17))
      g.addColorStop(1, hexA(portee, 0))
      c.fillStyle = g
    } else if (plat) {
      // 3D flat : une ellipse pleine et semi-transparente, sans flou
      c.fillStyle = hexA(portee, 0.26)
    } else {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, k * large)
      g.addColorStop(0, hexA(portee, 0.42))
      g.addColorStop(1, hexA(portee, 0))
      c.fillStyle = g
    }
    c.fill()
    c.restore()
  }
  c.globalAlpha = 1
  c.drawImage(renderer.domElement, 0, 0, px, px)
}

const hexA = (hex: string, a: number) => {
  const v = parseInt(hex.slice(1), 16)
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`
}
