import {
  ACESFilmicToneMapping,
  BufferGeometry,
  CanvasTexture,
  MeshBasicMaterial,
  PlaneGeometry,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { BotEngine } from '@/bot/engine'
import { COLOR_BY_ID, SHAPE_BY_ID } from '@/bot/skins'
import { Mochi3d } from '@/ui/trois/scene3d'

/**
 * Prototype `labo-peluche.html` : matiere peluche en temps reel (coques de fibres), perles
 * brillantes, bouche et accessoires en volume avec leur propre matiere (feutre, tissu, plastique).
 * Page d'outil : aucun lien depuis le site.
 */
const q = new URLSearchParams(location.search)
const NN = Number(q.get('n') ?? 3)
/** Niveau de detail : moins de couches quand le Mochi est petit ou nombreux. */
export const couchesAuto = (px: number, n: number) => (n >= 10 ? 8 : px < 140 ? 10 : px < 220 ? 16 : px < 320 ? 24 : 32)
const COUCHES = Number(q.get('couches') ?? couchesAuto(Number(q.get('s') ?? 440) / 2, NN))
const DENS = Number(q.get('dens') ?? 1.7)
const LONG = Number(q.get('long') ?? 6.5)
const TAILLE = Number(q.get('s') ?? 440)

/* ------------------------------------------------------------------ fibres */

const VERT = /* glsl */ `
uniform float uCouche; uniform float uLong; uniform vec3 uGrav;
varying vec3 vN; varying vec3 vObj; varying vec3 vW;
void main() {
  vec3 n = normalize(normal);
  vec3 p = position + n * uLong * uCouche + uGrav * uCouche * uCouche;
  vObj = position;
  vN = normalize(mat3(modelMatrix) * n);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const FRAG = /* glsl */ `
uniform float uCouche; uniform float uDens; uniform vec3 uCol; uniform vec3 uKey; uniform vec3 uCam;
uniform float uFine; uniform float uBase; uniform float uGlow;
varying vec3 vN; varying vec3 vObj; varying vec3 vW;
vec3 h3(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  float L = uCouche;
  float jit = 1.0;
  if (uBase < 0.5) {
    // fibres : une cellule 3D = un brin, de hauteur et de rayon aleatoires, droit le long de la normale
    vec3 c = vObj * uDens;
    vec3 id = floor(c);
    vec3 r = h3(id);
    vec3 f = fract(c) - (0.2 + 0.6 * r.xyz);
    float d = length(f);
    float haut = 0.35 + 0.65 * r.x;
    float ray = mix(0.55, 0.08, L / max(haut, 0.001)) * uFine;
    if (L > haut || d > ray) discard;
    jit = 0.88 + 0.24 * r.y;
  }
  // eclairage studio doux : hemisphere + cle enveloppante + contre-jour, plus un velours de bord
  float hemi = 0.5 + 0.5 * N.y;
  float key = clamp(dot(N, normalize(uKey)) * 0.5 + 0.5, 0.0, 1.0);
  float ao = mix(0.42, 1.0, pow(L, 0.7));
  float vel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.5);
  float sh = 0.16 + 0.34 * hemi + 0.95 * key * key * key;
  vec3 col = uCol * sh * ao * jit;
  col += uCol * vel * 0.38 * (0.4 + 0.6 * L) + vec3(1.0, 0.97, 0.92) * vel * 0.10 * L;
  // pointe des fibres : plus claire et plus saturee, comme la lumiere traversant le poil
  vec3 tip = uCol * 1.35 + vec3(0.05);
  col = mix(col, tip * (0.45 + 0.4 * key + 0.2 * hemi), smoothstep(0.55, 1.0, L) * 0.55);
  col += uCol * uGlow;
  float alpha = uBase > 0.5 ? 1.0 : (1.0 - smoothstep(0.82, 1.0, L) * 0.55);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`

interface Peluche {
  groupe: Group
  mats: ShaderMaterial[]
}

const cle = new Vector3(-0.6, 0.9, 1.0)

/** Une geometrie habillee de coques de fibres (couche 0 = sous-poil plein). */
function peluche(geo: BufferGeometry, hex: string, long = LONG, dens = DENS, couches = COUCHES, fine = 1): Peluche {
  const groupe = new Group()
  const mats: ShaderMaterial[] = []
  const col = new Color(hex)
  for (let i = 0; i < couches; i++) {
    const m = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uCouche: { value: i / (couches - 1) },
        uLong: { value: long },
        uGrav: { value: new Vector3(0, -long * 0.25, 0) },
        uDens: { value: dens },
        uCol: { value: new Vector3(col.r, col.g, col.b) },
        uKey: { value: cle },
        uCam: { value: new Vector3() },
        uFine: { value: fine },
        uBase: { value: i === 0 ? 1 : 0 },
        uGlow: { value: 0 }
      }
    })
    if (i / (couches - 1) > 0.82) {
      m.transparent = true
      m.depthWrite = false
    }
    mats.push(m)
    groupe.add(new Mesh(geo, m))
  }
  return { groupe, mats }
}

/* ------------------------------------------------------------------ scene */

const toile = document.getElementById('c') as HTMLCanvasElement
const renderer = new WebGLRenderer({ canvas: toile, antialias: true, alpha: false })
renderer.setPixelRatio(Number(q.get('dpr') ?? 2))
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
const scene = new Scene()
scene.background = new Color(q.get('bg') ?? '#fbfaf7')
const pm = new PMREMGenerator(renderer)
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.9
scene.add(new HemisphereLight(0xffffff, 0xb9a9c9, 0.6))
const sun = new DirectionalLight(0xfff3e6, 1.4)
sun.position.set(-160, 260, 300)
scene.add(sun)
const camera = new PerspectiveCamera(22, 1, 10, 4000)
camera.position.set(0, 10, 1000)

const noir = new MeshPhysicalMaterial({ color: 0x0c0c10, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, metalness: 0 })
const blanc = new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, emissive: 0xffffff, emissiveIntensity: 0.9 })

interface Perso {
  forme: string
  couleur: string
  decor: (c: Ctx) => void
  yeux: 'perles' | 'arcs' | 'clin'
  bouche: boolean
}

interface Ctx {
  corps: Mesh
  box: { w: number; h: number; haut: number; bas: number; zf: number }
  groupe: Group
  surface: (x: number, y: number) => { z: number; n: Vector3 }
  fibres: Peluche[]
}

const rc = new Raycaster()
function construire(p: Perso): { groupe: Group; fibres: Peluche[] } {
  const radii = SHAPE_BY_ID.get(p.forme)!.radii
  const m = new Mochi3d(256)
  m.setRendu('doux', false, 'marque', false)
  m.setForme(p.forme)
  m.setProfil({ profondeur: 0.92, arrondi: 0.99, arriere: 1 })
  m.maj(new BotEngine(100, 'idle', radii, null).sample(1), '#ffffff', '#ffffff')
  const geo = m.mesh.geometry.clone()
  geo.computeBoundingBox()
  const bb0 = geo.boundingBox!
  const cc = bb0.getCenter(new Vector3())
  geo.computeVertexNormals()
  {
    // silhouette organique : un leger relief de basse frequence, puis des normales « gonflees »
    // (melange avec la direction radiale) pour un degrade doux et sans anneaux de biseau
    const pos = geo.attributes.position!
    const nor = geo.attributes.normal!
    const v = new Vector3()
    const n = new Vector3()
    const r = new Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      n.fromBufferAttribute(nor, i)
      const d = 3.2 * Math.sin(v.x * 0.041 + 1.3) * Math.sin(v.y * 0.047 + v.z * 0.03) + 1.6 * Math.sin(v.x * 0.11 + v.y * 0.09)
      pos.setXYZ(i, v.x + n.x * d, v.y + n.y * d, v.z + n.z * d)
    }
    geo.computeVertexNormals()
    // lissage des normales sur le maillage : quelques passes de moyenne avec les voisins, pour
    // effacer les plis de triangulation (anneaux, facettes) qui se lisent sous la fourrure
    const idx = geo.index?.array
    if (idx) {
      const acc = new Float32Array(pos.count * 3)
      for (let pass = 0; pass < 14; pass++) {
        acc.fill(0)
        for (let t = 0; t < idx.length; t += 3) {
          const a0 = idx[t]!
          const b0 = idx[t + 1]!
          const c0 = idx[t + 2]!
          for (const [i, j, k] of [[a0, b0, c0], [b0, c0, a0], [c0, a0, b0]] as const) {
            for (let d = 0; d < 3; d++) acc[i * 3 + d]! += nor.array[j * 3 + d]! + nor.array[k * 3 + d]!
          }
        }
        for (let i = 0; i < pos.count; i++) {
          n.set(nor.array[i * 3]! * 3 + acc[i * 3]!, nor.array[i * 3 + 1]! * 3 + acc[i * 3 + 1]!, nor.array[i * 3 + 2]! * 3 + acc[i * 3 + 2]!).normalize()
          nor.setXYZ(i, n.x, n.y, n.z)
        }
      }
    }
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      n.fromBufferAttribute(nor, i)
      r.copy(v).sub(cc).normalize()
      n.multiplyScalar(0.72).addScaledVector(r, 0.28).normalize()
      nor.setXYZ(i, n.x, n.y, n.z)
    }
  }
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  const corps = peluche(geo, COLOR_BY_ID.get(p.couleur)!.hex)
  const groupe = new Group()
  groupe.add(corps.groupe)
  const sonde = new Mesh(geo)
  const surface = (x: number, y: number) => {
    rc.set(new Vector3(x, y, 800), new Vector3(0, 0, -1))
    const hit = rc.intersectObject(sonde, false)[0]
    return { z: hit ? hit.point.z : 0, n: hit?.face ? hit.face.normal.clone() : new Vector3(0, 0, 1) }
  }
  const ctx: Ctx = {
    corps: sonde,
    box: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y, haut: bb.max.y, bas: bb.min.y, zf: bb.max.z },
    groupe,
    surface,
    fibres: [corps]
  }
  const cy = (bb.max.y + bb.min.y) / 2 + ctx.box.h * 0.04
  const ex = ctx.box.w * 0.17
  // visage : yeux simples et expressifs, bouche en trait
  for (const sg of [-1, 1]) {
    const s = surface(sg * ex, cy)
    if (p.yeux === 'perles') {
      const b = new Mesh(new SphereGeometry(11, 32, 22), noir)
      b.scale.set(0.82, 1.1, 0.62)
      b.position.set(sg * ex, cy, s.z - 1)
      const h = new Mesh(new SphereGeometry(3.4, 14, 10), blanc)
      h.position.set(sg * ex + 3.4, cy + 4.8, s.z + 6.2)
      groupe.add(b, h)
    } else {
      const bas = p.yeux === 'clin' && sg > 0
      const arc = new CatmullRomCurve3(
        bas
          ? [new Vector3(sg * ex - 9, cy - 1, s.z + 2), new Vector3(sg * ex, cy + 4, s.z + 3), new Vector3(sg * ex + 9, cy - 1, s.z + 2)]
          : [new Vector3(sg * ex - 9, cy + 3, s.z + 2), new Vector3(sg * ex, cy - 3, s.z + 3), new Vector3(sg * ex + 9, cy + 3, s.z + 2)]
      )
      groupe.add(new Mesh(new TubeGeometry(arc, 16, 2.6, 10), noir))
    }
  }
  if (p.bouche) {
    const my = cy - ctx.box.h * 0.13
    const s = surface(0, my)
    const sm = new CatmullRomCurve3([new Vector3(-13, my + 5, s.z + 3), new Vector3(0, my - 4, s.z + 4), new Vector3(13, my + 5, s.z + 3)])
    groupe.add(new Mesh(new TubeGeometry(sm, 16, 2.8, 10), noir))
  }
  p.decor(ctx)
  return { groupe, fibres: ctx.fibres }
}

/* ------------------------------------------------------------ accessoires */

/** Petite ombre portee douce sur le corps (disque a degrade radial), sous un accessoire. */
let texOmbre: CanvasTexture | null = null
function ombre(c: Ctx, x: number, y: number, rx: number, ry: number, a: number) {
  if (!texOmbre) {
    const k = document.createElement('canvas')
    k.width = k.height = 128
    const x2 = k.getContext('2d')!
    const g = x2.createRadialGradient(64, 64, 4, 64, 64, 62)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    x2.fillStyle = g
    x2.fillRect(0, 0, 128, 128)
    texOmbre = new CanvasTexture(k)
  }
  const m = new Mesh(new PlaneGeometry(rx * 2, ry * 2), new MeshBasicMaterial({ map: texOmbre, transparent: true, opacity: a, depthWrite: false }))
  m.position.set(x, y, c.surface(x, y).z + LONG + 1)
  c.groupe.add(m)
}

/** Lunettes : tubes noirs ronds, epais, plus grandes que les yeux, posees DEVANT, qui debordent. */
function lunettes(c: Ctx, cy: number, ex: number, r = 1) {
  const g = new Group()
  for (const sg of [-1, 1]) {
    // la monture se pose devant le point le plus avance sous la lentille entiere
    let z = -1e9
    for (let a = 0; a < 12; a++) z = Math.max(z, c.surface(sg * ex + Math.cos(a / 12 * 6.283) * 30 * r, cy + Math.sin(a / 12 * 6.283) * 37 * r).z)
    const t = new Mesh(new TorusGeometry(1, 0.11, 20, 64), noir)
    t.scale.set(30 * r, 37 * r, 30 * r)
    t.position.set(sg * ex, cy, z + 9 + LONG)
    ombre(c, sg * ex + 8, cy - 14, 36 * r, 42 * r, 0.16)
    g.add(t)
  }
  const sp = c.surface(0, cy + 6)
  const pont = new Mesh(new TorusGeometry(1, 0.11, 12, 24, Math.PI), noir)
  pont.scale.set(ex * 0.42, 10, 30)
  pont.position.set(0, cy + 8, sp.z + 9)
  g.add(pont)
  for (const sg of [-1, 1]) {
    const k = new CatmullRomCurve3([new Vector3(sg * (ex + 30 * r), cy + 8, c.surface(sg * (ex + 28), cy).z + 9), new Vector3(sg * (ex + 40 * r), cy + 9, c.surface(sg * (ex + 28), cy).z - 6), new Vector3(sg * (ex + 48 * r), cy + 9, c.surface(sg * (ex + 30), cy).z - 24)])
    g.add(new Mesh(new TubeGeometry(k, 12, 2.8, 8), noir))
  }
  c.groupe.add(g)
}

/** Beret en feutre : disque bombe, pose de travers, avec sa petite queue. */
function beret(c: Ctx, hex: string, dx = 0) {
  const w = c.box.w * 0.4
  const geo = new SphereGeometry(1, 48, 32).scale(w, w * 0.4, w * 0.92)
  const b = peluche(geo, hex, 3.4, 2.6, 18)
  b.groupe.position.set(dx, c.box.haut - c.box.h * 0.1, 18)
  ombre(c, dx, c.box.haut - c.box.h * 0.17, w * 0.9, w * 0.3, 0.3)
  b.groupe.rotation.z = -0.42
  c.groupe.add(b.groupe)
  c.fibres.push(b)
  const pomp = peluche(new SphereGeometry(7, 20, 14), '#2a2438', 2.4, 2.6, 12)
  pomp.groupe.position.set(dx - 6, c.box.haut - c.box.h * 0.1 + w * 0.55, 18)
  c.groupe.add(pomp.groupe)
  c.fibres.push(pomp)
}

/** Noeud en tissu : deux ailes bombees, un nœud central serre. */
function noeud(c: Ctx, hex: string, x: number, y: number, s = 1) {
  const g = new Group()
  for (const sg of [-1, 1]) {
    const wg = new SphereGeometry(1, 40, 28)
    const pos = wg.attributes.position!
    for (let i = 0; i < pos.count; i++) {
      // aile pincee au centre : le tissu se plisse vers le noeud
      const px = pos.getX(i)
      const k = 0.3 + 0.7 * Math.min(1, Math.abs(px) * 1.3)
      // plis : le tissu ondule le long de l'aile
      const pli = 1 + 0.1 * Math.sin(px * 13) * Math.abs(px)
      pos.setY(i, pos.getY(i) * k * pli)
      pos.setZ(i, pos.getZ(i) * (0.5 + 0.5 * k) * (1 + 0.15 * Math.cos(px * 11)))
    }
    wg.scale(30 * s, 24 * s, 16 * s)
    wg.computeVertexNormals()
    const aile = peluche(wg, hex, 2.2, 2.2, 12)
    aile.groupe.position.set(sg * 25 * s, 0, 0)
    aile.groupe.rotation.z = sg * 0.28
    g.add(aile.groupe)
    c.fibres.push(aile)
  }
  const n = peluche(new SphereGeometry(1, 24, 18).scale(12 * s, 13 * s, 12 * s), hex, 2.0, 2.2, 12)
  g.add(n.groupe)
  c.fibres.push(n)
  const zb = Math.max(c.surface(x, y).z, c.surface(x - 20, y).z, c.surface(x + 20, y).z)
  ombre(c, x + 4, y - 8, 52 * s, 28 * s, 0.22)
  // deux pans qui pendent sous le noeud
  for (const sg of [-1, 1]) {
    const pan = peluche(new SphereGeometry(1, 20, 14).scale(9 * s, 26 * s, 6 * s), hex, 1.8, 2.2, 10)
    pan.groupe.position.set(sg * 9 * s, -22 * s, -4)
    pan.groupe.rotation.z = sg * 0.28
    g.add(pan.groupe)
    c.fibres.push(pan)
  }
  g.position.set(x, y, zb + 12)
  g.rotation.z = -0.3
  g.rotation.y = -0.15
  c.groupe.add(g)
}

const PERSOS: Perso[] = [
  {
    forme: 'triangle',
    couleur: 'ambre',
    yeux: 'arcs',
    bouche: false,
    decor: (c) => lunettes(c, c.box.bas + c.box.h * 0.44, c.box.w * 0.16)
  },
  {
    forme: 'squircle',
    couleur: 'bleu',
    yeux: 'perles',
    bouche: true,
    decor: (c) => beret(c, '#3b3350', 14)
  },
  {
    forme: 'fleur',
    couleur: 'rose',
    yeux: 'clin',
    bouche: true,
    decor: (c) => noeud(c, '#12b5a3', c.box.w * 0.24, c.box.haut - c.box.h * 0.1, 1.15)
  }
]

const N = Number(q.get('n') ?? 3)
const COLS = N <= 3 ? N : 5
const LIGNES = Math.ceil(N / COLS)
const construits = Array.from({ length: N }, (_, i) => {
  const o = construire(PERSOS[i % 3]!)
  o.groupe.position.set((i % COLS - (COLS - 1) / 2) * 290, -(Math.floor(i / COLS) - (LIGNES - 1) / 2) * 290, 0)
  scene.add(o.groupe)
  return o
})

const W = TAILLE * COLS
const HH = TAILLE * LIGNES
renderer.setSize(W, HH, false)
toile.style.width = W + 'px'
toile.style.height = HH + 'px'
camera.aspect = W / HH
camera.position.z = 900 * LIGNES
camera.updateProjectionMatrix()
const yaw = (Number(q.get('yaw') ?? 8) * Math.PI) / 180
for (const o of construits) o.groupe.rotation.y = yaw

function rendre() {
  for (const o of construits) for (const f of o.fibres) for (const m of f.mats) m.uniforms.uCam!.value.copy(camera.position)
  renderer.render(scene, camera)
}
rendre()

/* mesures : 1 puis ~15 mochis (memes meshes repetes) */
const t0 = performance.now()
for (let i = 0; i < 6; i++) {
  rendre()
  const gl = renderer.getContext()
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
}
const un = (performance.now() - t0) / 6
let calls = 0
renderer.info.autoReset = false
renderer.info.reset()
rendre()
calls = renderer.info.render.calls
document.getElementById('res')!.textContent = `n=${N} couches=${COUCHES} dens=${DENS} long=${LONG} | ${N} mochis: ${un.toFixed(1)} ms/image, ${calls} draw calls, ${(renderer.info.render.triangles / 1000).toFixed(0)}k triangles (swiftshader logiciel)`
document.title = 'done'
