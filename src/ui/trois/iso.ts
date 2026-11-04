/**
 * Espace isometrique minimal : une grille de dalles, des mochis en vraie 3D posés dessus,
 * et la possibilite de leur faire SAUTER d'une case a l'autre (`src/bot/sauts.ts`).
 *
 * C'est une preuve d'architecture, pas un jeu : l'espace riche sera construit plus tard
 * dans une application hote (version ordinateur). Ce module en fixe l'API utile :
 *
 *   const espace = new EspaceIso(canvas, { largeur: 5, hauteur: 5 })
 *   espace.ajouter('a', { forme: 'etoile', couleur: 'violet', case: { x: 0, y: 0 } })
 *   espace.poser('a', { x: 2, y: 3 })        // place un mochi sur une case, sans animation
 *   espace.sauter('a', { x: 3, y: 3 }, t)    // lance un saut vers une case voisine
 *   espace.dessiner(t)                       // rend l'image au temps t (secondes)
 *   espace.liberer()
 *
 * Le temps vient de l'APPELANT (comme `engine.sample(t)`) : l'espace n'a pas d'horloge, il
 * n'a donc pas de boucle propre et se rejoue image par image (captures, tests).
 *
 * Ce module charge Three.js : ne l'importer que par `import()`.
 */

import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  LinearFilter,
  NearestFilter,
  OrthographicCamera,
  PCFShadowMap,
  PCFSoftShadowMap,
  RedFormat,
  DataTexture,
  UnsignedByteType,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  WebGLRenderer
} from 'three'
import { BotEngine } from '@/bot/engine'
import { RAYON } from '@/bot/repere'
import { poseSaut, SAUT_DEFAUT, type Case, type ParamsSaut } from '@/bot/sauts'
import { COLOR_BY_ID, SHAPE_BY_ID } from '@/bot/skins'
import { DOUCEUR_DEFAUT, eclairagePlat, gradientMap, reglagePlat, type Douceur, type Rendu3d, RENDU_3D_DEFAUT } from './rendu3d'
import { Mochi3d } from './scene3d'

/** Rayon d'un mochi, en cases : 100 unites du moteur valent 0,42 case. */
export const RAYON_CASE = 0.42
const ECHELLE = RAYON_CASE / RAYON

export interface OptionsEspace {
  largeur: number
  hauteur: number
  /** fond de la page, derriere la scene ; transparent si absent */
  fond?: string
  /** `iso` : camera a 45 degres, avec dalles. `gros` : gros plan sans dalles, vue trois quarts */
  vue?: 'iso' | 'gros'
  /** matiere des mochis et des dalles : `realiste` (defaut) ou une variante « 3D flat » */
  rendu3d?: Rendu3d
  /** contour cartoon (variantes plates) */
  contour?: boolean
  /** reglage de la matiere `doux` : `leger` (defaut) ou `marque` */
  douceur?: Douceur
  /** petit reflet doux en haut a gauche (matiere `doux`) ; defaut : oui */
  reflet?: boolean
}

export interface OptionsMochiIso {
  forme: string
  couleur: string
  case: Case
  /** decale le clignement et les micro-mouvements du moteur d'un mochi a l'autre */
  decalage?: number
}

interface MochiIso {
  moteur: BotEngine
  corps: Mochi3d
  groupe: Group
  couleur: string
  decalage: number
  case: Case
  /** saut en cours : de `de` a `vers`, commence a `debut` secondes */
  saut: { de: Case; vers: Case; debut: number } | null
  yaw: number
  /** ombre de contact : tache douce juste sous le corps, qui s'efface quand il saute */
  contact: Mesh<PlaneGeometry, MeshBasicMaterial>
}

export class EspaceIso {
  readonly renderer: WebGLRenderer
  readonly scene = new Scene()
  readonly camera: OrthographicCamera
  private readonly mochis = new Map<string, MochiIso>()
  private readonly cle: DirectionalLight
  private readonly largeur: number
  private readonly hauteur: number
  private readonly vue: 'iso' | 'gros'
  private readonly papier: string
  private readonly rendu3d: Rendu3d
  private readonly contour: boolean
  private readonly douceur: Douceur
  private readonly reflet: boolean
  /** pixels (physiques) d'une unite du moteur, pour l'epaisseur du contour */
  private pxParUnite = 0.5
  private readonly plat: ReturnType<typeof reglagePlat>

  constructor(
    readonly canvas: HTMLCanvasElement,
    opts: OptionsEspace,
    private readonly params: ParamsSaut = SAUT_DEFAUT
  ) {
    this.largeur = opts.largeur
    this.hauteur = opts.hauteur
    this.vue = opts.vue ?? 'iso'
    this.papier = opts.fond ?? '#f9f9f9'
    this.rendu3d = opts.rendu3d ?? RENDU_3D_DEFAUT
    this.contour = opts.contour ?? false
    this.douceur = opts.douceur ?? DOUCEUR_DEFAUT
    this.reflet = opts.reflet ?? true
    this.plat = reglagePlat(this.rendu3d, this.douceur)
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    // flat : ombres a bord net ; realiste : ombres douces
    this.renderer.shadowMap.type = this.plat ? PCFShadowMap : PCFSoftShadowMap
    this.scene.background = new Color(this.papier)

    // camera orthographique : la vraie projection isometrique (pas de fuite)
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
    if (this.vue === 'iso') this.camera.position.set(10, 10, 10)
    else this.camera.position.set(2.2, 3.4, 7)
    this.camera.lookAt(0, this.vue === 'iso' ? 0 : 0.3, 0)

    // lumiere : ciel et sol doux (pas d'ombre noire) + un soleil qui porte les ombres
    // (flat : une ambiante et une directionnelle, qui fixent les tons des paliers)
    const e = this.plat ? eclairagePlat(this.plat) : null
    if (e) this.scene.add(new AmbientLight(0xffffff, e.ambiante))
    else {
      this.scene.add(new HemisphereLight(0xffffff, 0xd9cfc4, 1.5))
      this.scene.add(new AmbientLight(0xffffff, 0.2))
    }
    this.cle = new DirectionalLight(0xffffff, e ? e.directe : 2.4)
    this.cle.position.set(-4, 8, 3)
    // flat : l'ombre au sol est l'ellipse pleine sous le mochi, pas une ombre portee
    this.cle.castShadow = !this.plat
    this.cle.shadow.mapSize.set(1024, 1024)
    const s = this.cle.shadow.camera
    const demi = Math.max(this.largeur, this.hauteur) * 0.9
    s.left = -demi
    s.right = demi
    s.top = demi
    s.bottom = -demi
    s.near = 0.5
    s.far = 30
    this.cle.shadow.bias = -0.0006
    this.cle.shadow.normalBias = 0.006
    this.cle.shadow.radius = 3
    this.scene.add(this.cle)

    this.construireSol()
    this.dimensionner()
  }

  /** Centre de la case, dans le monde : la grille est centree sur l'origine. */
  private monde(c: Case): [number, number] {
    return [c.x - (this.largeur - 1) / 2, c.y - (this.hauteur - 1) / 2]
  }

  private construireSol() {
    if (this.vue === 'gros') {
      // pas de dalles : un sol qui ne montre que les ombres
      const sol = new Mesh(new PlaneGeometry(30, 30), new ShadowMaterial({ opacity: this.plat ? 0.2 : 0.18 }))
      sol.rotation.x = -Math.PI / 2
      sol.receiveShadow = true
      this.scene.add(sol)
      return
    }
    let clair: MeshStandardMaterial | MeshToonMaterial
    let fonce: MeshStandardMaterial | MeshToonMaterial
    if (this.plat) {
      // flat : dalles en aplats, le dessus plein et les cotes a l'ombre (meme rampe que les mochis)
      const g = gradientMap(this.plat)
      const rampe = new DataTexture(g, g.length, 1, RedFormat, UnsignedByteType)
      rampe.minFilter = rampe.magFilter = this.plat.lisse ? LinearFilter : NearestFilter
      rampe.generateMipmaps = false
      rampe.needsUpdate = true
      clair = new MeshToonMaterial({ color: 0xf1ede6, gradientMap: rampe })
      fonce = new MeshToonMaterial({ color: 0xe2ddd3, gradientMap: rampe })
    } else {
      clair = new MeshStandardMaterial({ color: 0xf1ede6, roughness: 1 })
      fonce = new MeshStandardMaterial({ color: 0xe2ddd3, roughness: 1 })
    }
    const geo = new BoxGeometry(0.96, 0.3, 0.96)
    for (let y = 0; y < this.hauteur; y++) {
      for (let x = 0; x < this.largeur; x++) {
        const d = new Mesh(geo, (x + y) % 2 ? fonce : clair)
        const [wx, wz] = this.monde({ x, y })
        d.position.set(wx, -0.15, wz)
        d.receiveShadow = true
        this.scene.add(d)
      }
    }
  }

  /** Cadre la camera sur la grille et cale le canvas sur sa taille d'affichage. */
  dimensionner() {
    const l = this.canvas.clientWidth || this.canvas.width
    const h = this.canvas.clientHeight || this.canvas.height
    const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(l, h, false)
    const demiH = this.vue === 'iso' ? Math.max(this.largeur, this.hauteur) * 0.62 + 0.9 : 1.35
    const ratio = l / h
    this.camera.left = -demiH * ratio
    this.camera.right = demiH * ratio
    this.camera.top = demiH
    this.camera.bottom = -demiH
    this.camera.updateProjectionMatrix()
    // une unite du moteur = ECHELLE unites du monde ; le canvas montre 2 * demiH unites sur h pixels
    this.pxParUnite = (ECHELLE * h * dpr) / (2 * demiH)
    for (const b of this.mochis.values()) b.corps.calerContour(this.pxParUnite)
  }

  ajouter(id: string, o: OptionsMochiIso) {
    const moteur = new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get(o.forme)?.radii ?? null)
    const corps = new Mochi3d(256)
    corps.setRendu(this.rendu3d, this.contour, this.douceur, this.reflet)
    corps.setForme(o.forme)
    corps.calerContour(this.pxParUnite)
    corps.mesh.castShadow = true
    const groupe = new Group()
    groupe.add(corps.mesh)
    groupe.scale.setScalar(ECHELLE)
    this.scene.add(groupe)
    const contact = new Mesh(new PlaneGeometry(1, 1), this.matiereContact().clone())
    contact.rotation.x = -Math.PI / 2
    contact.position.y = 0.005
    contact.renderOrder = 1
    this.scene.add(contact)
    const b: MochiIso = {
      contact,
      moteur,
      corps,
      groupe,
      couleur: COLOR_BY_ID.get(o.couleur)?.hex ?? o.couleur,
      decalage: o.decalage ?? 0,
      case: o.case,
      saut: null,
      // le visage regarde la camera
      yaw: this.vue === 'iso' ? Math.PI / 4 : 0.5
    }
    this.mochis.set(id, b)
    this.placer(b, o.case, 0, 1, 1)
  }

  private matContact: MeshBasicMaterial | null = null

  /** Tache radiale douce, partagee : noire au centre, transparente au bord. */
  private matiereContact(): MeshBasicMaterial {
    if (this.matContact) return this.matContact
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const d = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    if (this.plat) {
      // flat : une ellipse pleine et semi-transparente, bord net
      g.fillStyle = 'rgba(40, 30, 50, 0.22)'
      g.beginPath()
      g.arc(64, 64, 62, 0, Math.PI * 2)
      g.fill()
    } else {
      d.addColorStop(0, 'rgba(40, 30, 50, 0.55)')
      d.addColorStop(1, 'rgba(40, 30, 50, 0)')
      g.fillStyle = d
      g.fillRect(0, 0, 128, 128)
    }
    this.matContact = new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false })
    return this.matContact
  }

  /** Oriente un mochi (rotation autour de la verticale, en radians). */
  orienter(id: string, yaw: number) {
    const b = this.mochis.get(id)
    if (b) b.yaw = yaw
  }

  /** Pose un mochi sur une case, sans animation (annule un saut en cours). */
  poser(id: string, c: Case) {
    const b = this.mochis.get(id)
    if (!b) return
    b.case = c
    b.saut = null
  }

  /** Lance un saut vers `vers` au temps `t` : `dessiner` l'anime ensuite, puis le pose. */
  sauter(id: string, vers: Case, t: number) {
    const b = this.mochis.get(id)
    if (!b) return
    b.saut = { de: b.case, vers, debut: t }
  }

  /** Vrai si le mochi est en plein saut (anticipation, vol ou atterrissage) au temps `t`. */
  enSaut(id: string, t: number): boolean {
    const b = this.mochis.get(id)
    return !!b?.saut && t - b.saut.debut < this.params.anticipation + this.params.vol + this.params.atterrissage
  }

  private placer(b: MochiIso, c: Case, hauteur: number, sy: number, sxz: number) {
    const [wx, wz] = this.monde(c)
    // le pivot du groupe est le bas du corps : l'ecrasement garde les pieds au sol
    b.corps.mesh.position.y = -b.corps.bas
    b.groupe.position.set(wx, hauteur * RAYON_CASE, wz)
    b.groupe.scale.set(ECHELLE * sxz, ECHELLE * sy, ECHELLE * sxz)
    b.groupe.rotation.y = b.yaw
    // la tache suit le mochi au sol, s'elargit un peu avec l'ecrasement et s'efface en vol
    b.contact.position.x = wx
    b.contact.position.z = wz
    b.contact.scale.setScalar(RAYON_CASE * 2.6 * sxz)
    b.contact.material.opacity = Math.max(0, 1 - hauteur * 1.2)
  }

  /**
   * Rend l'image au temps `t` (secondes) et renvoie le nombre de sauts en cours.
   * `rendre = false` met a jour les corps sans dessiner (mesure du cout cote JS).
   */
  dessiner(t: number, rendre = true): number {
    let enCours = 0
    for (const b of this.mochis.values()) {
      const frame = b.moteur.sample(t + b.decalage)
      b.corps.maj(frame, b.couleur, this.papier)
      let c = b.case
      let hauteur = 0
      let sy = 1
      let sxz = 1
      if (b.saut) {
        const p = poseSaut(t - b.saut.debut, b.saut.de, b.saut.vers, this.params)
        c = { x: p.x, y: p.y }
        hauteur = p.hauteur
        sy = p.sy
        sxz = p.sxz
        if (p.phase === 'pause' && p.avancement === 1) {
          // saut fini : la case d'arrivee devient la case du mochi
          b.case = b.saut.vers
          b.saut = null
        } else enCours++
      }
      this.placer(b, c, hauteur, sy, sxz)
    }
    if (rendre) this.renderer.render(this.scene, this.camera)
    return enCours
  }

  liberer() {
    for (const b of this.mochis.values()) {
      b.corps.liberer()
      b.contact.material.dispose()
      b.contact.geometry.dispose()
    }
    this.mochis.clear()
    this.matContact?.map?.dispose()
    this.matContact?.dispose()
    this.renderer.dispose()
  }
}
