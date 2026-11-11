/**
 * Real 3D rendering (WebGL, Three.js) of an engine frame.
 *
 * This module is NEVER imported statically: `mochi-bot.ts` and the lab page load it with `await import(...)` when the
 * 3D style is chosen. The rest of the app therefore does not carry Three.js (same rule as `mediabunny`).
 *
 * The engine does not change: we read `engine.sample(t)` and draw it. The body is the inflated outline (`volume.ts`);
 * the eyes are painted in a texture projected from the front, at the exact positions the engine gives. So they are
 * always "holes": the texture only exists on the body, and an eye sliding to the edge is cropped by the silhouette,
 * as the SVG mask used to do.
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
} from './three'
import type { BotFrame } from '@/bot/engine'
import { HALF_VIEWBOX } from '@/bot/frame'
import { mixHex } from '@/bot/skins'
import { radiusLens, eyesOf, type Shadow } from '@/bot/eyePlacement'
import { Accessories3d } from './accessories3d'
import { measureLandmarks } from './anchors'
import type { AccessorySelection } from '@/bot/slots'
import { rim } from './rim'
import { leverDark, luminance, palettePixel, quantifier } from './pixel3d'
import {
  colorOutline,
  lightingFlat,
  outlineWidthPx,
  finesseOf,
  gradientMap,
  meshOf,
  settingFlat,
  type Softness,
  DEFAULT_SOFTNESS,
  type Material,
  DEFAULT_MATERIAL
} from './material'
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
 * Material tints: the chosen color barely lightened (base), its shaded side (hollows, eye bottoms) and the ground
 * shadow, colored and not gray.
 */
export function materialKind(hex: string) {
  return { base: mixHex(hex, '#ffffff', 0.16), hollow: mixHex(hex, '#000000', 0.18), scope: mixHex(hex, '#000000', 0.3) }
}

/**
 * A 3D body: a mesh and its face texture, updated frame by frame. One instance per Mochi shown in a scene; the avatar
 * shares a single instance for all its thumbnails.
 */
/** A mesh and its volume: `full` (realistic, toon, flat) or `coarse` (lowpoly). */
interface BodyMesh {
  geo: BufferGeometry
  volume?: Volume
  positions?: Float32Array
  neck: number
}

/**
 * Meshes kept by a body (LRU): one per shape and outline. A shape at rest, or an avatar the page renders every frame,
 * does not recompute its geometry; during motion each frame is a new outline, and the oldest is recycled.
 */
const MESHES_KEPT = 24

type MatDef = MeshStandardMaterial | MeshToonMaterial

export class Mochi3d {
  readonly mesh: Mesh<BufferGeometry, MatDef | MeshBasicMaterial>
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly texture: CanvasTexture
  /** eye mask (white on black): they glow, to stay sharp whatever the light */
  private readonly canvasEyes: HTMLCanvasElement
  private readonly ctxEyes: CanvasRenderingContext2D
  private readonly textureEyes: CanvasTexture
  private readonly meshes = new Map<string, BodyMesh>()
  /** accessories by slot (head, eyes, face, neck, back), stackable */
  private accs: AccessorySelection = {}
  private readonly acc3d = new Accessories3d()
  /** volume model (shading, rims): on by default; off = flat body color, eyes unchanged */
  private shading = true
  private matFlat: MeshBasicMaterial | null = null
  /** laptop of the `working` mood: scale from 0 (hidden) to about 1 (grown), set by the component */
  private laptop = 0
  /** ground of each shape: the lowest point seen during bounces (the laptop does not jump with the body) */
  private readonly grounds = new Map<string, number>()
  /** theme: `light` (white eyes, default) or `dark` (black eyes) */
  private theme: Theme = DEFAULT_THEME
  /** minimum contrast black eye / body in dark (below it, the body is lightened); 0 = never */
  private eyeContrast = MIN_EYE_CONTRAST
  /** shape of the Mochi (`squircle`, `star`...): sets its volume profile and its eyes */
  private shape = ''
  /** forced profile (lab option); otherwise the shape's */
  private profileForced: ProfileVolume | null = null
  private get profile(): ProfileVolume {
    return this.profileForced ?? profileOf(this.shape)
  }
  private readonly materials = new Map<string, MatDef>()
  private readonly ramps: DataTexture[] = []
  /** accessories alone: the body stays (it anchors the pieces) but is not drawn */
  private withoutBody = false
  setWithoutBody(v: boolean) {
    this.withoutBody = v
  }
  /** dark outline (inverted shell), visible only in `toon-outline` */
  private readonly shell: Mesh<BufferGeometry, MeshBasicMaterial>
  private renderStyle: Material = DEFAULT_MATERIAL
  private softness: Softness = DEFAULT_SOFTNESS
  /** black eyes (dark theme): 1 = no emission, no glow added on the eyes */
  private readonly uEye = { value: 0 }
  /** half thickness of the outline, in engine units (shell uniform) */
  private readonly thickness = { value: 4.5 }
  /** last painted outline and face: unchanged from one frame to the next, nothing is redone */
  private keyFace = ''
  /** Bottom of the body, Three space (y up): where it touches the ground. */
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
    this.mesh.add(this.acc3d.group)
  }

  /** Eye emission intensity: the material's in light, zero in dark (the eye is black, it does not glow). */
  private emission(m: MatDef): number {
    return this.theme === 'dark' ? 0 : m instanceof MeshStandardMaterial ? 0.85 : 1
  }

  /** Material of a variant, created on demand and kept. */
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
        // an eye is a hole on the light background: without this the light grays it and it gets lost
        emissive: new Color(0xffffff),
        emissiveIntensity: 0.85,
        roughness: 0.9,
        metalness: 0
      })
    } else {
      // toon material: clean steps, no specular highlight. The gradientMap is
      // read with NearestFilter, so the ramp stays in steps.
      const g = gradientMap(flat)
      const ramp = new DataTexture(g, g.length, 1, RedFormat, UnsignedByteType)
      // smooth shading: linear filtering, the ramp is a continuous curve (no step)
      ramp.minFilter = ramp.magFilter = flat.smooth ? LinearFilter : NearestFilter
      ramp.generateMipmaps = false
      ramp.needsUpdate = true
      this.ramps.push(ramp)
      m = new MeshToonMaterial({
        map: this.texture,
        gradientMap: ramp,
        // the eyes stay white and sharp: they glow, no shadow grays them
        emissiveMap: this.textureEyes,
        emissive: new Color(0xffffff),
        emissiveIntensity: 1
      })
      if (flat.organic) organiser(m)
      // the toon shader can derive a normal per facet; only the typing does not declare it
      if (flat.facets) (m as unknown as { flatShading: boolean }).flatShading = true
    }
    // continuous shading (AO, rims) only makes sense for the soft material: flat styles keep their clean tones
    if (!flat || flat.smooth) rim(m, flat ? 0.7 : 0.5, flat ? 0.32 : 0.22, { ao: 1, eye: this.uEye })
    m.emissiveIntensity = this.emission(m)
    this.materials.set(key, m)
    return m
  }

  /** Body without a model: the texture alone (body color, painted eyes), no light shades it. */
  private flat(): MeshBasicMaterial {
    this.matFlat ??= new MeshBasicMaterial({ map: this.texture })
    return this.matFlat
  }

  /** Turns the volume shading on or off (Soft, Flat and Pixel). Called before `setRenderStyle`. */
  setShading(yes: boolean) {
    this.shading = yes
  }

  /**
   * Chooses the material. Called after `setShading` and before `update`. `shading` on = relief, off = one flat
   * color. There is no highlight spot (removed on 11/11/2026).
   */
  setRenderStyle(r: Material, softness: Softness = DEFAULT_SOFTNESS) {
    this.renderStyle = r
    this.softness = softness
    this.mesh.material = this.shading ? this.mat(r, softness) : this.flat()
    // the inverted shell only belongs to the internal `toon-outline` material (out of the public styles)
    this.shell.visible = !!settingFlat(r, softness)?.outline
  }

  /**
   * Fits the outline thickness to the Mochi's size on screen: `pxByUnit` = (device) pixels per engine unit. The
   * stroke gets lighter at small sizes.
   */
  fitOutline(pxByUnit: number) {
    const diameter = 2 * 100 * pxByUnit
    this.thickness.value = outlineWidthPx(diameter) / Math.max(1e-6, pxByUnit)
  }

  /** Forces a volume profile (trying an alternative profile); `null` goes back to the shape's. */
  setProfile(p: ProfileVolume | null) {
    this.profileForced = p
  }

  /** Chooses the accessories by slot (at most one per slot, all stackable). Called before `update`. */
  /** Laptop scale (0 = absent). */
  setLaptop(k: number) {
    this.laptop = k
  }

  setAccessories(sel: AccessorySelection) {
    this.accs = this.theme === 'dark' ? accessoriesDark(sel) : sel
  }

  /**
   * Chooses the theme (`dark` = black eyes). Called before `setAccessories` and `update`: the choice of accessories
   * and the painting of the face depend on it.
   */
  setTheme(theme: Theme, eyeContrast = MIN_EYE_CONTRAST) {
    this.theme = theme
    this.eyeContrast = eyeContrast
    // dark: the eye mask no longer lights anything (emission at 0) and the glows avoid it
    this.uEye.value = theme === 'dark' ? 1 : 0
    for (const m of this.materials.values()) m.emissiveIntensity = this.emission(m)
  }

  /** Colors of the accessories (pixel art palette). */
  get colorsAccessories(): string[] {
    return this.acc3d.colors
  }

  /** Redoes the accessory pose on the next render (see `Accessories3d.invalidate`). */
  invalidateAccessories() {
    this.acc3d.invalidate()
  }

  /** Tells which shape is rendered: its volume profile (cube, prism, dome...) depends on it. */
  setShape(shape: string) {
    this.shape = shape
    // "cushion" shape: the height field is solved here, once, rather than in the middle of an animation
    if (profileOf(shape).cushion) fieldOfIdle(shape)
  }

  /** The mesh of the current outline: read from the cache, else computed (recycling the oldest). */
  private meshData(frame: BotFrame): BodyMesh {
    const key = `${meshOf(this.renderStyle)}|${this.shape}${this.profileForced ? '+' + JSON.stringify(this.profileForced) : ''}|${frame.bodyPath}`
    const already = this.meshes.get(key)
    if (already) {
      // the most recently used goes last
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

  /** Copies the engine's `frame` into the mesh and the texture. */
  update(frame: BotFrame, color: string, paper: string) {
    // dark: black eyes, and a body lightened only if it does not contrast enough with them
    color = bodyForTheme(color, this.theme, this.eyeContrast)
    paper = eyeColor(this.theme, paper)
    // Flat and Pixel: an almost black color keeps relief (see `leverDark`)
    if (this.renderStyle === 'toon' || this.renderStyle === 'toon-outline' || this.renderStyle === 'pixel') color = leverDark(color)
    this.mesh.visible = frame.bodyPath.length > 10 && frame.bodyAlpha > 0.01
    if (!this.mesh.visible) return
    // invisible body: the material is not drawn, but its children (accessories) are; anchoring uses the geometry
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
    const geo = this.mesh.geometry
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    // the 3D eyes: facing front, on the front face. `frameFace` adds the moods' gaze
    // (eye offset): only the painted eyes follow it, the glasses stay on the face
    const frameFace = frame.face ? this.eyesOnFace(frame, true) : null
    frame = this.eyesOnFace(frame)
    const flat0 = settingFlat(this.renderStyle, this.softness)
    // accessories by slot: anchored on the volume of THIS body, recomputed when the body changes
    this.acc3d.settings = flat0?.smooth ? { force: 0.7, top: 0.32, ao: 1 } : null
    this.acc3d.body = color
    // v12: pieces are no longer rebuilt every frame (the body outline changes on every breath:
    // ray casting and geometries redone 60 times per second). They are built for the shape and style, on the
    // body of this frame, then follow the body with a transform (below).
    const keyBody = `${this.renderStyle}|${this.shape}`
    this.acc3d.update(this.accs, keyBody, this.mat(this.renderStyle, this.softness), () => {
      const ye = eyesOf(frame)
      const sc = ye.map((o) => ({ x: o.x, y: -o.y, r: o.r }))
      return measureLandmarks(this.mesh.geometry, sc, ye.length === 2 ? radiusLens(ye[0]!, ye[1]!) : 22)
    }, { k: this.laptop, ground: this.grounds.get(this.shape) ?? mt.neck, key: `${this.renderStyle}|${this.shape}` })
    this.followBody(bb)
    // the accessory outline follows the body's (same visibility, same thickness)
    this.acc3d.outline(this.shell.visible, this.thickness.value)
    const shadows: Shadow[] = this.acc3d.shadows
    // nothing but the eyes is painted in the texture, so the back and sides get the same shading as the face
    const eyesPainted = frameFace ?? frame
    const cheeks = frameFace?.face?.cheeks ?? 0
    const keyFace = `${this.renderStyle}|${this.softness}|${this.shading}|${this.theme}|${color}|${paper}|${JSON.stringify(eyesPainted.eyes)}|${cheeks.toFixed(2)}|${shadows.map((o) => [o.x, o.y, o.rx, o.ry].map((v) => Math.round(v)).join(',')).join(';')}`
    if (keyFace !== this.keyFace) {
      this.keyFace = keyFace
      // flat keeps the chosen color as is (no pastel), with no eye hollow
      this.paint(eyesPainted, flat ? color : m.base, paper, m.hollow, !flat && this.theme === 'light' && this.shading, shadows, cheeks)
    }
  }

  /** Box of the body the pieces were built on (Three space). */
  private refPieces: { version: number; cx: number; cy: number; w: number; h: number } | null = null
  /**
   * The pieces follow the body: the box of this frame's body is mapped onto the build body's (scale in x and y, depth
   * follows x; translation). The body breathes, squashes and stretches; its pieces with it.
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

  /**
   * The 3D eyes face STRAIGHT FRONT (`frontEyes`): centered, symmetric, upright, a little above the center of the
   * front face. The engine's gaze, tilt and sphere distortion do not count here; the difference with the 2D is on
   * purpose. Each eye keeps its shape (blink, expression) and its opacity.
   */
  private eyesOnFace(frame: BotFrame, gaze = false): BotFrame {
    if (!frame.eyes.length) return frame
    const eyes = [...frame.eyes].sort((p, q) => readMatrix(p.matrix)[4]! - readMatrix(q.matrix)[4]!)
    const half = eyes.map((e) => halfExtentEye(e.d, 'matrix(1 0 0 1 0 0)'))
    let outline = bodyOutline(frame.bodyPath, 1)
    // mood: the head tilts. We find the face on the STRAIGHTENED body, then tilt the eyes with it
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
        // position: rotation around the body center (the head tilts), then gaze in the head's frame
        const x0 = rot ? center.x + cq * (p.x - center.x) - sq * (p.y - center.y) : p.x
        const y0 = rot ? center.y + sq * (p.x - center.x) + cq * (p.y - center.y) : p.y
        // without `gaze`: where the eyes sit on the face, upright and round, for the glasses and accessories
        // (their measurements must not vary with a blink or a gaze)
        if (!frame.face || !gaze) return { ...e, matrix: `matrix(${f(p.s)} 0 0 ${f(p.s)} ${f(x0)} ${f(y0)})` }
        // face layer: own tilt (already increased by the head's), eyelid, gaze
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
    vertexNormals(geo)
    weldNormals(geo.attributes.normal!.array as Float32Array, pts.length, finesseOf(this.renderStyle).rings)
    // Flat and Pixel: clean steps on irregular normals make spots (cloud, flower,
    // star). The normals are smoothed before cutting into tones: the boundaries become clean curves.
    // Soft on a "cushion" shape: a few passes too, to blend the seam between front and back
    const smoothFlat = !!flat && !flat.smooth && !flat.facets
    if ((smoothFlat || (this.profile.cushion && !flat?.facets)) && geo.index) {
      smoothNormals(geo.attributes.normal as BufferAttribute, geo.index.array, smoothFlat ? 14 : 20)
      weldNormals(geo.attributes.normal!.array as Float32Array, pts.length, finesseOf(this.renderStyle).rings)
    }
    geo.computeBoundingSphere()
    mt.neck = -v.neck
  }

  /**
   * The face: the body color, and the eyes in the background color (holes), with an inner shadow on the top-left rim.
   */
  private paint(frame: BotFrame, base: string, paper: string, hollow: string, carve = true, shadows: Shadow[] = [], cheeks = 0) {
    const c = this.ctx
    const T = this.canvas.width
    const k = T / (2 * VB)
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.fillStyle = base
    c.fillRect(0, 0, T, T)
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
      // the mask stays white on the eye, also in dark: it lights nothing there (emission at 0) but
      // tells the shader to leave a plain black there (see `rim`)
      y.fillStyle = '#fff'
      y.fill(path)
      c.setTransform(k * a, k * b, k * cc, k * d, k * (e + VB), k * (f + VB))
      c.globalAlpha = alpha
      c.fillStyle = paper
      c.fill(path)
      if (!carve) continue
      // inner shadow: a big frame pierced by the eye, whose shadow alone enters the hole
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
    // cheeks: a pink tint softly blended under the eyes, painted INTO the body color (not an object)
    if (cheeks > 0.01) this.paintCheeks(frame, base, cheeks, k)
    // soft shadows of the accessories, on the body (radial gradient, no edge)
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
   * Cheek tint: two elliptic spots, outside and under each eye, blending into the body color. They follow the eyes
   * (so the tilted head) and never overflow: the texture only exists on the body.
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
      // offset in the head's frame: outwards and down
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
    this.acc3d.liberer()
    this.texture.dispose()
    this.textureEyes.dispose()
  }
}

/**
 * `BufferGeometry.computeVertexNormals` for an indexed mesh, the same operations in the same order (so the same
 * numbers), on the typed arrays directly. Three's version goes through a `Vector3` read and write per corner: it was a
 * quarter of a Mochi's frame (v13).
 */
export function vertexNormals(geo: BufferGeometry) {
  const pos = geo.attributes.position as BufferAttribute
  const index = geo.index!.array
  let nor = geo.attributes.normal as BufferAttribute | undefined
  if (!nor || nor.count !== pos.count) {
    nor = new BufferAttribute(new Float32Array(pos.count * 3), 3)
    geo.setAttribute('normal', nor)
  }
  const P = pos.array as Float32Array
  const N = nor.array as Float32Array
  N.fill(0)
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i]! * 3
    const b = index[i + 1]! * 3
    const c = index[i + 2]! * 3
    // cb = C - B, ab = A - B, cb x ab
    const cbx = P[c]! - P[b]!
    const cby = P[c + 1]! - P[b + 1]!
    const cbz = P[c + 2]! - P[b + 2]!
    const abx = P[a]! - P[b]!
    const aby = P[a + 1]! - P[b + 1]!
    const abz = P[a + 2]! - P[b + 2]!
    const x = cby * abz - cbz * aby
    const y = cbz * abx - cbx * abz
    const z = cbx * aby - cby * abx
    // read the three corners first, then write (a corner repeated in a triangle behaves as in Three)
    const ax = N[a]! + x, ay = N[a + 1]! + y, az = N[a + 2]! + z
    const bx = N[b]! + x, by = N[b + 1]! + y, bz = N[b + 2]! + z
    const cx = N[c]! + x, cy = N[c + 1]! + y, cz = N[c + 2]! + z
    N[a] = ax
    N[a + 1] = ay
    N[a + 2] = az
    N[b] = bx
    N[b + 1] = by
    N[b + 2] = bz
    N[c] = cx
    N[c + 1] = cy
    N[c + 2] = cz
  }
  for (let i = 0; i < N.length; i += 3) {
    const x = N[i]!
    const y = N[i + 1]!
    const z = N[i + 2]!
    const k = 1 / (Math.sqrt(x * x + y * y + z * z) || 1)
    N[i] = x * k
    N[i + 1] = y * k
    N[i + 2] = z * k
  }
  nor.needsUpdate = true
}

/**
 * Neighbors of each vertex through the triangles (each triangle gives a vertex its two other corners), in compressed
 * rows: `nbr[off[i]..off[i+1]]`, each neighbor once with its count `w` (an inner edge belongs to two triangles).
 * Computed once per index array (a mesh keeps its index from frame to frame).
 */
const NEIGHBORS = new WeakMap<object, { off: Uint32Array; nbr: Uint32Array; w: Float32Array }>()
function neighborsOf(index: ArrayLike<number>, n: number) {
  const known = NEIGHBORS.get(index as object)
  if (known && known.off.length === n + 1) return known
  const lists: Map<number, number>[] = Array.from({ length: n }, () => new Map())
  const add = (a: number, b: number) => lists[a]!.set(b, (lists[a]!.get(b) ?? 0) + 1)
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t]!
    const b = index[t + 1]!
    const c = index[t + 2]!
    add(a, b)
    add(a, c)
    add(b, a)
    add(b, c)
    add(c, a)
    add(c, b)
  }
  const off = new Uint32Array(n + 1)
  for (let i = 0; i < n; i++) off[i + 1] = off[i]! + lists[i]!.size
  const nbr = new Uint32Array(off[n]!)
  const w = new Float32Array(off[n]!)
  for (let i = 0; i < n; i++) {
    let j = off[i]!
    for (const [q, k] of lists[i]!) {
      nbr[j] = q
      w[j++] = k
    }
  }
  const r = { off, nbr, w }
  NEIGHBORS.set(index as object, r)
  return r
}

let smoothBuffer: Float32Array = new Float32Array(0)
/**
 * A few passes averaging normals with those of neighboring vertices (through the triangles), to erase triangulation
 * folds that read as spots under stepped shading. Each pass: twice the normal plus the sum of its neighbors (one per
 * triangle corner), normalized. The neighbors are read from a list built once (v13: it was half a Mochi's frame).
 */
export function smoothNormals(nor: BufferAttribute, index: ArrayLike<number>, passes: number) {
  const n = nor.count
  const { off, nbr, w } = neighborsOf(index, n)
  let A: Float32Array = nor.array as Float32Array
  if (smoothBuffer.length < n * 3) smoothBuffer = new Float32Array(n * 3)
  let B: Float32Array = smoothBuffer
  const original = A
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < n; i++) {
      let x = A[i * 3]! * 2
      let y = A[i * 3 + 1]! * 2
      let z = A[i * 3 + 2]! * 2
      for (let j = off[i]!, e = off[i + 1]!; j < e; j++) {
        const q = nbr[j]! * 3
        const k = w[j]!
        x += k * A[q]!
        y += k * A[q + 1]!
        z += k * A[q + 2]!
      }
      // sqrt rather than Math.hypot: several times faster, same value to the last float bits that a color can show
      const l = 1 / (Math.sqrt(x * x + y * y + z * z) || 1)
      B[i * 3] = x * l
      B[i * 3 + 1] = y * l
      B[i * 3 + 2] = z * l
    }
    const t = A
    A = B
    B = t
  }
  if (A !== original) original.set(A.subarray(0, n * 3))
  else smoothBuffer = B
  nor.needsUpdate = true
}

/** Outline material: an inverted shell, inflated along the normals. */
function shellMaterial(thickness: { value: number }): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color: 0x1a1428, side: BackSide })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTh = thickness
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'uniform float uTh;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * uTh;')
  }
  return m
}

/**
 * Organic shadow boundary: the normal used for lighting is disturbed by a low frequency noise ANCHORED ON THE BODY
 * (local position), so the boundary between the base tone and the shadow tone waves instead of following a straight
 * line on almost flat faces (star, flower). The eyes (emission) are not touched.
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

/** Cheek pink: blends with the body color (never laid flat on top). */
export const PLAYED = '#ff5c8a'

/** Position of the main light in the avatar's frame: top left, in front. */
const KEY_AVATAR: [number, number, number] = [-1.1, 1.5, 1.6]

/**
 * Lights of a material. Realistic: a soft light at the top left, a light sky and a warm ground for colored, never
 * black shadows, a small backlight on the right. Flat variants: only an ambient and a directional light, which set
 * the tones (`lightingFlat`). Returns every light and the main one.
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

/** Adds a material's lights to the scene; returns the main one (cast shadows). */
export function light(scene: Scene, r: Material = DEFAULT_MATERIAL, softness: Softness = DEFAULT_SOFTNESS): DirectionalLight {
  const l = lights(r, softness)
  for (const x of l.all) scene.add(x)
  return l.key
}

/* ------------------------------------------------------------- avatar */

/**
 * A single WebGL context for every avatar of the page: a browser opens about fifteen at most, and the sheet or the
 * timeline mount far more thumbnails. Each avatar asks for a frame, we render it here then copy it into ITS 2D
 * canvas.
 */
let share: {
  renderer: WebGLRenderer
  scene: Scene
  camera: OrthographicCamera
  /** body shared by the callers that bring no slot (one-off renders, tools, thumbnails) */
  mochi: Mochi3d
  /** body currently in the scene: the shared one or an avatar's own (see `AvatarSlot`) */
  current: Mochi3d
  /** installed material and its lights: changed only when the material changes */
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
  // front camera, orthographic, fitted to the viewBox: the body lands exactly
  // where the SVG would draw it, so the rings and the dot stay aligned
  const camera = new OrthographicCamera(-VB, VB, VB, -VB, 1, 2000)
  camera.position.set(0, 0, 1000)
  const l = lights(DEFAULT_MATERIAL)
  for (const x of l.all) scene.add(x)
  const mochi = new Mochi3d(512)
  scene.add(mochi.mesh)
  share = { renderer, scene, camera, mochi, current: mochi, renderStyle: DEFAULT_MATERIAL, softness: DEFAULT_SOFTNESS, lights: l.all }
  return share
}

/** Puts `m` in the shared scene in place of the body that was there (a single body is drawn at a time). */
function install(ctx3: NonNullable<typeof share>, m: Mochi3d) {
  if (ctx3.current === m) return
  ctx3.scene.remove(ctx3.current.mesh)
  ctx3.scene.add(m.mesh)
  ctx3.current = m
}

/**
 * An avatar's own 3D body (v13): its mesh cache, its face textures and its accessories, kept from one frame to the
 * next. With a single body shared by every Mochi of the page, each one undid the previous one's work: accessories
 * rebuilt with ray casting, face repainted and sent again to the GPU, for every Mochi, every frame (6 Mochiz with
 * accessories: 4 frames per second on a Mac). The WebGL context stays shared. Made by `avatarSlot`, freed by
 * `releaseSlot`.
 */
export interface AvatarSlot {
  mochi: Mochi3d | null
  /** side of its face texture, in pixels */
  texture: number
}

export function avatarSlot(): AvatarSlot {
  return { mochi: null, texture: 0 }
}

/** Frees an avatar's body (geometries, textures, materials). The slot can be used again: a new body is made. */
export function releaseSlot(slot: AvatarSlot) {
  const m = slot.mochi
  if (!m) return
  slot.mochi = null
  slot.texture = 0
  if (share?.current === m) install(share, share.mochi)
  m.liberer()
}

/**
 * Side of an avatar's face texture: at least the rendered size (no texel is stretched over several pixels), 512 at
 * most (the shared body's size). A 120 px Mochi no longer carries two 512 px canvases.
 */
export function textureSizeFor(px: number): number {
  return px <= 256 ? 256 : 512
}

/**
 * Compiles in advance the programs of the three styles (Soft, Flat, Pixel) and their light sets, during idle time:
 * the first switch to another style no longer freezes the page while its shaders compile (v12).
 */
export function warmUp() {
  const ctx3 = context()
  const { renderer, scene, camera, mochi } = ctx3
  install(ctx3, mochi)
  const before = { renderStyle: ctx3.renderStyle, softness: ctx3.softness }
  const trials: [Material, Softness][] = [['soft', 'strong'], ['toon', DEFAULT_SOFTNESS], ['pixel', DEFAULT_SOFTNESS]]
  for (const [r, d] of trials) {
    for (const x of ctx3.lights) scene.remove(x)
    const l = lights(r, d)
    for (const x of l.all) scene.add(x)
    ctx3.lights = l.all
    ctx3.renderStyle = r
    ctx3.softness = d
    mochi.setRenderStyle(r, d)
    renderer.compile(scene, camera)
  }
  // back to the previous state: the next rendered avatar sets its own settings anyway
  for (const x of ctx3.lights) scene.remove(x)
  const l = lights(before.renderStyle, before.softness)
  for (const x of l.all) scene.add(x)
  ctx3.lights = l.all
  ctx3.renderStyle = before.renderStyle
  ctx3.softness = before.softness
}

/** true if the browser can do WebGL; otherwise the avatar shows a message instead of the Mochi. */
export function webglAvailable(): boolean {
  try {
    context()
    return true
  } catch {
    return false
  }
}

/**
 * Draws `frame` in the `target` canvas (square, in device pixels): ground shadow (blurred in realistic, flat in the
 * flat variants), then the 3D body. `yaw` (radians) turns the body on itself around the vertical axis, the camera and
 * the light stay fixed.
 */
/**
 * Shape (or other body geometry) changed: accessories are placed again as soon as the body has finished morphing.
 */
export function invalidateAccessories3d(slot?: AvatarSlot) {
  ;(slot ? slot.mochi : share?.mochi)?.invalidateAccessories()
}

export function renderAvatar(
  target: HTMLCanvasElement,
  frame: BotFrame,
  color: string,
  paper: string,
  material: Material = DEFAULT_MATERIAL,
  softness: Softness = DEFAULT_SOFTNESS,
  shape = '',
  yaw = 0,
  accessories: AccessorySelection = {},
  /**
 * half width of the frame in engine units (the viewBox by default): widening it leaves room for big accessories
 */
  viewHalf = VB,
  /** `light` (default) or `dark`: the eyes turn black */
  theme: Theme = DEFAULT_THEME,
  /** dark: minimum contrast black eye / body (default 3, 0 = never lighten the body) */
  eyeContrast = MIN_EYE_CONTRAST,
  /** laptop of the `working` mood: scale from 0 (absent) to about 1 */
  laptop = 0,
  /** ground shadow under the body (default: yes) */
  shadow = true,
  /** volume model (body shading): on by default; off = flat color */
  shading = true,
  /**
 * true: the body is not drawn, only the accessories are (anchored on this invisible body); no shadow or outline
 */
  withoutBody = false,
  /**
 * center of the frame in engine units (y up); the origin by default. Used to frame tight on accessories alone.
 */
  center: { x: number; y: number } = { x: 0, y: 0 },
  /** the avatar's own body (`avatarSlot`); absent, the body shared by one-off renders */
  slot?: AvatarSlot
) {
  color = bodyForTheme(color, theme, eyeContrast)
  const ctx3 = context()
  const { renderer, scene, camera } = ctx3
  // pixel: render 4 times bigger then downscale (average) before reducing to the palette
  const px = target.width
  const pixel = material === 'pixel'
  const pxRender = pixel ? px * 4 : px
  let mochi = ctx3.mochi
  if (slot) {
    const t = textureSizeFor(pxRender)
    if (!slot.mochi || slot.texture !== t) {
      releaseSlot(slot)
      slot.mochi = new Mochi3d(t)
      slot.texture = t
    }
    mochi = slot.mochi
  }
  install(ctx3, mochi)
  if (ctx3.renderStyle !== material || ctx3.softness !== softness) {
    // a page can show several materials: lights only change when needed
    for (const x of ctx3.lights) scene.remove(x)
    const l = lights(material, softness)
    for (const x of l.all) scene.add(x)
    ctx3.lights = l.all
    ctx3.renderStyle = material
    ctx3.softness = softness
  }
  mochi.setWithoutBody(withoutBody)
  mochi.setShading(shading)
  mochi.setRenderStyle(material, softness)
  mochi.setShape(shape)
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
  // the instance is shared: the angle is set again every frame, never kept from one avatar to the next
  mochi.mesh.rotation.y = yaw
  mochi.fitOutline(pxRender / (2 * viewHalf))
  // The shared WebGL canvas only GROWS: each avatar renders in the bottom left corner (viewport + scissor),
  // then that square is copied. Resizing the canvas for each avatar (two sizes on screen) reallocated the drawing
  // buffer every frame: more than half the render time on a phone (v12).
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
  // the rendered square, in canvas coordinates (the WebGL origin is at the bottom left)
  const sy = canvasGl.height - pxRender
  const c = target.getContext('2d')
  if (!c) return
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.clearRect(0, 0, px, px)
  if (!mochi.mesh.visible) return
  if (pixel) {
    // downscaling and the palette run on a small SOFTWARE canvas (`willReadFrequently`): reading back the pixels
    // of the visible (accelerated) canvas forced a full sync every frame, half the time (v12)
    const cp = canvasPixel(px)
    cp.imageSmoothingEnabled = true
    cp.imageSmoothingQuality = 'high'
    cp.clearRect(0, 0, px, px)
    cp.drawImage(canvasGl, 0, sy, pxRender, pxRender, 0, 0, px, px)
    const im = cp.getImageData(0, 0, px, px)
    const tints: string[] = []
    // cheeks: their tint enters the palette, otherwise it would be brought back to the body color
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
    // ground shadow: an ellipse under the lowest point
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
      // soft: smooth ground shadow, a very light gradient with no sharp edge
      const g = c.createRadialGradient(0, 0, 0, 0, 0, k * large)
      g.addColorStop(0, hexA(scope, 0.34))
      g.addColorStop(0.6, hexA(scope, 0.17))
      g.addColorStop(1, hexA(scope, 0))
      c.fillStyle = g
    } else if (flat) {
      // flat 3D: a full, semi-transparent ellipse, no blur
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
/** Working canvas of the Pixel style, software (read back every frame), enlarged when needed. */
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
