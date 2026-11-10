import { TAU, lerp, r2 } from './math'
import { PROFILES, PROFILE_SAMPLES, type ProfileName } from './profiles'

export interface Point {
  x: number
  y: number
}

/**
 * A silhouette = a radial profile r(theta) plus a pose.
 *
 * Everything goes through profiles sampled at the SAME number of angles: any two shapes have points that match one to
 * one, and morphing comes down to a linear interpolation of radii. That keeps transitions clean without a path
 * morphing library.
 */
export interface Silhouette {
  radii: number[]
  /** rotation du profil, en radians */
  rot: number
  /** center offset, in ball radius units */
  cx: number
  cy: number
  /** squash & stretch, applique en repere ecran (apres rotation) */
  sx: number
  sy: number
}

const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * TAU)
const COS = ANGLES.map(Math.cos)
const SIN = ANGLES.map(Math.sin)

export function silhouette(name: ProfileName, pose: Partial<Silhouette> = {}): Silhouette {
  return {
    radii: [...PROFILES[name]],
    rot: 0,
    cx: 0,
    cy: 0,
    sx: 1,
    sy: 1,
    ...pose
  }
}

/** Perfect circle: the neutral base (dot, bubble, fade target). */
export function circle(radius: number, pose: Partial<Silhouette> = {}): Silhouette {
  return {
    radii: new Array(PROFILE_SAMPLES).fill(radius),
    rot: 0,
    cx: 0,
    cy: 0,
    sx: 1,
    sy: 1,
    ...pose
  }
}

/** Interpolation of two silhouettes. `out` is reused to avoid allocating at 60 fps. */
export function blend(a: Silhouette, b: Silhouette, t: number, out?: Silhouette): Silhouette {
  const dst = out ?? { radii: new Array<number>(PROFILE_SAMPLES), rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    dst.radii[i] = lerp(a.radii[i] ?? 1, b.radii[i] ?? 1, t)
  }
  // Rotation by the shortest path: avoids a full turn
  // when going for example from +170deg to -170deg.
  let dRot = b.rot - a.rot
  while (dRot > Math.PI) dRot -= TAU
  while (dRot < -Math.PI) dRot += TAU
  dst.rot = a.rot + dRot * t
  dst.cx = lerp(a.cx, b.cx, t)
  dst.cy = lerp(a.cy, b.cy, t)
  dst.sx = lerp(a.sx, b.sx, t)
  dst.sy = lerp(a.sy, b.sy, t)
  return dst
}

/** Projects the silhouette to screen points. `scale` = ball radius in viewBox units. */
export function toPoints(s: Silhouette, scale: number, out: Point[] = []): Point[] {
  const cr = Math.cos(s.rot)
  const sr = Math.sin(s.rot)
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const r = s.radii[i] ?? 1
    const x = r * (COS[i] ?? 0)
    const y = r * (SIN[i] ?? 0)
    // rotation, then squash in screen space, then translation
    const rx = x * cr - y * sr
    const ry = x * sr + y * cr
    const p = out[i] ?? { x: 0, y: 0 }
    p.x = (rx * s.sx + s.cx) * scale
    p.y = (ry * s.sy + s.cy) * scale
    out[i] = p
  }
  out.length = PROFILE_SAMPLES
  return out
}

/**
 * Closed polyline -> Catmull-Rom cubics.
 *
 * With 64 points, centered tangents are plenty: the outline is smooth to the pixel even at 600 px, and the string
 * stays short.
 */
export function closedPath(pts: Point[], tension = 1 / 6): string {
  const n = pts.length
  if (n < 3) return ''
  const first = pts[0]!
  let d = `M${r2(first.x)} ${r2(first.y)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!
    const p1 = pts[i]!
    const p2 = pts[(i + 1) % n]!
    const p3 = pts[(i + 2) % n]!
    const c1x = p1.x + (p2.x - p0.x) * tension
    const c1y = p1.y + (p2.y - p0.y) * tension
    const c2x = p2.x - (p3.x - p1.x) * tension
    const c2y = p2.y - (p3.y - p1.y) * tension
    d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2.x)} ${r2(p2.y)}`
  }
  return `${d}Z`
}

/**
 * Any polygon -> radial profile, by casting rays from `center`.
 *
 * Builds shapes that are not naturally r(theta) (the tapered bar of the "!"). Computed once at load, never in the
 * render loop.
 */
export function profileFromPolygon(poly: Point[], cx: number, cy: number): number[] {
  const radii = new Array<number>(PROFILE_SAMPLES).fill(0)
  const n = poly.length
  for (let k = 0; k < PROFILE_SAMPLES; k++) {
    const dx = COS[k] ?? 0
    const dy = SIN[k] ?? 0
    let best = 0
    for (let i = 0; i < n; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % n]!
      const ex = b.x - a.x
      const ey = b.y - a.y
      const den = dx * ey - dy * ex
      if (Math.abs(den) < 1e-9) continue
      const px = a.x - cx
      const py = a.y - cy
      const t = (px * ey - py * ex) / den // distance along the ray
      const u = (px * dy - py * dx) / den // position on the segment
      if (t > best && u >= 0 && u <= 1) best = t
    }
    radii[k] = best
  }
  return radii
}

/** Convex hull of two circles: the tapered bar of the vertical "!". */
export function hullOfCircles(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2v: number,
  steps = 96
): Point[] {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy) || 1e-6
  // angle des tangentes externes communes
  const base = Math.atan2(dy, dx)
  const spread = Math.acos(Math.max(-1, Math.min(1, (r1 - r2v) / dist)))
  const pts: Point[] = []
  // arc of the big circle
  for (let i = 0; i <= steps / 2; i++) {
    const a = base + spread + ((TAU - 2 * spread) * i) / (steps / 2)
    pts.push({ x: x1 + Math.cos(a) * r1, y: y1 + Math.sin(a) * r1 })
  }
  // arc of the small circle
  for (let i = 0; i <= steps / 2; i++) {
    const a = base - spread + ((2 * spread) * i) / (steps / 2)
    pts.push({ x: x2 + Math.cos(a) * r2v, y: y2 + Math.sin(a) * r2v })
  }
  return pts
}

/**
 * Radius of the profile in any direction, interpolated between the two neighboring samples.
 *
 * Re-anchors what sits "on" the body (the eyes, the notification dot) when the silhouette is no longer a circle:
 * without it, an eye at 0.62 radius sticks out of a shape whose edge is at 0.55 in that direction, and the mask crops
 * it.
 */
export function radiusAtAngle(radii: number[], angle: number): number {
  const n = radii.length
  const t = ((((angle / TAU) % 1) + 1) % 1) * n
  const i = Math.floor(t)
  return lerp(radii[i % n] ?? 1, radii[(i + 1) % n] ?? 1, t - i)
}

/**
 * Superellipse: |x/sx|^n + |y/sy|^n = 1. n = 2 gives an ellipse, n ~ 4 the customizer's squircle.
 */
export function superellipseProfile(n: number, sx = 1, sy = 1): number[] {
  return ANGLES.map((_, i) => {
    const c = Math.abs((COS[i] ?? 0) / sx) ** n
    const s = Math.abs((SIN[i] ?? 0) / sy) ** n
    return (c + s) ** (-1 / n)
  })
}

/**
 * Radial profile of the UNION of discs: r(theta) = the farthest ray/circle intersection. Exact as long as the origin
 * is inside the union: that gives the cloud's bumps without path booleans.
 */
export function unionOfCirclesProfile(circles: Array<{ x: number; y: number; r: number }>): number[] {
  const out = new Array<number>(PROFILE_SAMPLES).fill(0)
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const dx = COS[i] ?? 0
    const dy = SIN[i] ?? 0
    let best = 0
    for (const c of circles) {
      const b = dx * c.x + dy * c.y
      const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r)
      if (disc < 0) continue
      const t = b + Math.sqrt(disc)
      if (t > best) best = t
    }
    out[i] = best
  }
  return out
}

/**
 * Polygon with rounded corners, by a Minkowski sum with a disc: each edge is pushed out by `rc`, each vertex becomes
 * an arc of radius `rc`. Vertices must therefore be placed at the wanted radius MINUS rc. Expects a clockwise polygon
 * (screen space, y down).
 */
function roundedPolygon(green: Point[], rc: number, arcSteps = 10): Point[] {
  const n = green.length
  const out: Point[] = []
  const normal = (a: Point, b: Point) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    // clockwise + y down: the outward normal is (dy, -dx)
    return Math.atan2(-dx / len, dy / len)
  }
  for (let i = 0; i < n; i++) {
    const prev = green[(i - 1 + n) % n]!
    const cur = green[i]!
    const next = green[(i + 1) % n]!
    const a0 = normal(prev, cur)
    const a1 = normal(cur, next)
    let d = a1 - a0
    while (d > Math.PI) d -= TAU
    while (d < -Math.PI) d += TAU
    for (let k = 0; k <= arcSteps; k++) {
      const a = a0 + (d * k) / arcSteps
      out.push({ x: cur.x + Math.cos(a) * rc, y: cur.y + Math.sin(a) * rc })
    }
  }
  return out
}

/** Polygone regulier a coins arrondis, inscrit dans `radius`. */
export function regularPolygonProfile(
  sides: number,
  radius: number,
  rc: number,
  rotationDeg = 0
): number[] {
  const rot = (rotationDeg * Math.PI) / 180
  const green = Array.from({ length: sides }, (_, i) => {
    // clockwise on screen: theta grows with y down
    const a = rot + (i / sides) * TAU
    return { x: Math.cos(a) * (radius - rc), y: Math.sin(a) * (radius - rc) }
  })
  return profileFromPolygon(roundedPolygon(green, rc), 0, 0)
}

/** Polyligne fermee exacte : garde les segments droits (contrairement a closedPath). */
export function polyPath(pts: Point[], scale = 1): string {
  if (pts.length < 3) return ''
  let d = ''
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    d += `${i === 0 ? 'M' : 'L'}${r2(p.x * scale)} ${r2(p.y * scale)}`
  }
  return `${d}Z`
}

/** Capsule (stadium) centered on the origin: the exact shape of the bot's eyes. */
export function capsulePath(w: number, h: number): string {
  const hw = Math.max(w, 0.01) / 2
  const hh = Math.max(h, 0.01) / 2
  const r = Math.min(hw, hh)
  return (
    `M${r2(-hw)} ${r2(-hh + r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw + r)} ${r2(-hh)}` +
    `L${r2(hw - r)} ${r2(-hh)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw)} ${r2(-hh + r)}` +
    `L${r2(hw)} ${r2(hh - r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw - r)} ${r2(hh)}` +
    `L${r2(-hw + r)} ${r2(hh)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw)} ${r2(hh - r)}Z`
  )
}

/**
 * "Crescent" eye: the lying capsule (width >= height) bent into an arch, ends down (^ ^), for the happy eye, the
 * laugh, eyes closed with pleasure. `arc` goes from 0 (straight capsule) to 1 (full arch): that lets one expression
 * glide into another. Same box as `capsulePath`, so the same measurements (`halfExtentEye`) hold.
 */
export function arcPath(w: number, h: number, arc: number): string {
  const hw = Math.max(w, 0.01) / 2
  const hh = Math.max(h, 0.01) / 2
  const r = Math.min(hw, hh)
  const bend = arc * 0.7 * Math.max(hw, hh)
  const N = 20
  const top: string[] = []
  const neck: string[] = []
  for (let i = 0; i <= N; i++) {
    // points get closer at the ends, where the curvature is strongest
    const x = hw * Math.sin(Math.PI * (i / N - 0.5))
    const dx = Math.max(0, Math.abs(x) - (hw - r))
    const half = hh - r + Math.sqrt(Math.max(0, r * r - dx * dx))
    const waisted = bend * (x / hw) ** 2 - bend * 0.5
    top.push(`${r2(x)} ${r2(-half + waisted)}`)
    neck.unshift(`${r2(x)} ${r2(half + waisted)}`)
  }
  return `M${top.join('L')}L${neck.join('L')}Z`
}
