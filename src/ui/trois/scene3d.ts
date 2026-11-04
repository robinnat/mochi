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
import { mesuresPorte, ombresPorte, type Ombre, type PorteId } from '@/bot/portes'
import { Porte3d } from './porte3d'
import { lisere } from './lisere'
import { leverSombre, luminance, palettePixel, quantifier } from './pixel3d'
import { TEINTES_PORTES } from '@/bot/portes'
import {
  couleurContour,
  eclairagePlat,
  epaisseurContourPx,
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
import {
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
  readonly mesh: Mesh<BufferGeometry, Materiau>
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
  /** demi-epaisseur du contour, en unites du moteur (uniform de la coque) */
  private readonly epaisseur = { value: 4.5 }
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
    if (!plat || plat.lisse) lisere(m, plat ? 0.7 : 0.5, plat ? 0.32 : 0.22, { reflet: this.uReflet, ao: 1 })
    this.materiaux.set(cle, m)
    return m
  }

  /** Choisit la matiere : materiau, maillage et contour. Appele avant `maj`. */
  setRendu(r: Rendu3d, contour = false, douceur: Douceur = DOUCEUR_DEFAUT, reflet = REFLET_DEFAUT) {
    this.rendu = r
    this.douceur = douceur
    this.uReflet.value = reflet && reglagePlat(r, douceur)?.lisse ? 1 : 0
    this.mesh.material = this.materiau(r, douceur)
    // le contour cartoon est une option des variantes plates (jamais du realiste)
    this.coque.visible = !!reglagePlat(r, douceur) && (contour || !!reglagePlat(r, douceur)?.contour)
  }

  /**
   * Cale l'epaisseur du contour sur la taille du mochi a l'ecran : `pxParUnite` = pixels
   * (physiques) d'une unite du moteur. Le trait s'allege en petite taille.
   */
  calerContour(pxParUnite: number) {
    const diametre = 2 * 100 * pxParUnite
    this.epaisseur.value = epaisseurContourPx(diametre) / Math.max(1e-6, pxParUnite)
  }

  /** Impose un profil de volume (essai d'un profil alternatif) ; `null` revient a celui de la forme. */
  setProfil(p: ProfilVolume | null) {
    this.profilImpose = p
  }

  /** Choisit l'accessoire porte (`null` = aucun). Appele avant `maj`. */
  setPorte(id: PorteId | null) {
    this.porte = id
  }

  /** Dit quelle forme est rendue : son profil de volume (cube, prisme, dome...) en depend. */
  setForme(forme: string) {
    this.forme = forme
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
    // les yeux de la 3D : pile en face, sur la face avant
    frame = this.yeuxSurLaFace(frame)
    const plat0 = reglagePlat(this.rendu, this.douceur)
    this.porte3d.reglages = plat0?.lisse ? { force: 0.7, haut: 0.32, ao: 1, reflet: this.uReflet } : null
    this.porte3d.maj(this.porte, frameCorps, this.mesh.material, bb ? (bb.min.z + bb.max.z) / 2 : 0, frame, (x, y) => this.zFace(x, y), (y, sg) => this.bordX(y, sg))
    const ombres: Ombre[] = this.porte ? ombresPorte(this.porte, frame, mesuresPorte(frameCorps)) : []
    // le reflet doux est un effet de matiere (shader, repere de la vue) : plus rien n'est peint dans la
    // texture hors des yeux, donc le dos et les flancs recoivent le meme ombrage que la face
    const reflet = null as Reflet | null
    const cleReflet = reflet ? [reflet.x, reflet.y, reflet.rx].map((v) => Math.round(v * 2)).join(',') : '-'
    const cleVisage = `${this.rendu}|${this.douceur}|${couleur}|${papier}|${JSON.stringify(frame.eyes)}|${cleReflet}|${this.porte ?? ''}|${ombres.map((o) => [o.x, o.y, o.rx, o.ry].map((v) => Math.round(v)).join(',')).join(';')}`
    if (cleVisage !== this.cleVisage) {
      this.cleVisage = cleVisage
      // le flat garde la couleur choisie telle quelle (pas de pastel), sans creux d'oeil
      this.peindre(frame, plat ? couleur : m.base, papier, m.creux, !plat, reflet, ombres)
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
  private yeuxSurLaFace(frame: BotFrame): BotFrame {
    if (!frame.eyes.length) return frame
    const yeux = [...frame.eyes].sort((p, q) => lireMatrice(p.matrix)[4]! - lireMatrice(q.matrix)[4]!)
    const demi = yeux.map((e) => demiEtendueOeil(e.d, 'matrix(1 0 0 1 0 0)'))
    const pos = yeuxDeFace(contourDuCorps(frame.bodyPath, 1), demi, this.profil)
    if (pos.length !== yeux.length) return frame
    return {
      ...frame,
      eyes: yeux.map((e, i) => {
        const p = pos[i]!
        const f = (v: number) => Math.round(v * 100) / 100
        return { ...e, matrix: `matrix(${f(p.s)} 0 0 ${f(p.s)} ${f(p.x)} ${f(p.y)})` }
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
    geo.computeBoundingSphere()
    mt.bas = -v.bas
  }

  /**
   * Le visage : la couleur du corps, et les yeux en couleur du fond (des trous), avec une
   * ombre interne sur le rebord haut gauche, comme le creux de l'argile.
   */
  private peindre(frame: BotFrame, base: string, papier: string, creux: string, creuser = true, reflet: Reflet | null = null, ombres: Ombre[] = []) {
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

  liberer() {
    for (const m of this.maillages.values()) m.geo.dispose()
    this.mesh.geometry.dispose()
    for (const m of this.materiaux.values()) m.dispose()
    for (const r of this.rampes) r.dispose()
    this.coque.material.dispose()
    this.porte3d.liberer()
    this.texture.dispose()
    this.textureYeux.dispose()
  }
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
  porte: PorteId | null = null
) {
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
  mochi.setRendu(rendu3d, contour, douceur, reflet)
  mochi.setForme(forme)
  mochi.setPorte(porte)
  // l'instance est partagee : l'angle est remis a chaque image, jamais garde d'un avatar a l'autre
  mochi.mesh.rotation.y = yaw
  const px = cible.width
  // pixel : on rend 4 fois plus grand puis on reduit (moyenne) avant de ramener a la palette
  const pixel = rendu3d === 'pixel'
  const pxRendu = pixel ? px * 4 : px
  mochi.calerContour(pxRendu / (2 * VB))
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
    const accessoires = porte === 'lunettes' || porte === 'soleil' ? ['#26222f'] : t ? [t.fond, t.accent] : []
    const corps = leverSombre(couleur)
    quantifier(im.data, px, px, palettePixel(corps, accessoires), luminance(corps) < 0.62)
    c.putImageData(im, 0, 0)
    return
  }
  const k = px / (2 * VB)
  // ombre au sol : ellipse sous le point le plus bas, couleur de l'argile
  const bas = -mochi.bas
  const box = mochi.mesh.geometry.boundingSphere
  const large = (box?.radius ?? 100) * 0.72
  const cx = (box?.center.x ?? 0) + 6
  const plat = reglagePlat(rendu3d, douceur)
  c.save()
  c.translate(k * (cx + VB), k * (bas + VB - 2))
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
  c.globalAlpha = 1
  c.drawImage(renderer.domElement, 0, 0, px, px)
}

const hexA = (hex: string, a: number) => {
  const v = parseInt(hex.slice(1), 16)
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`
}
