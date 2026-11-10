import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Box3, MeshStandardMaterial, type Mesh, type Object3D } from 'three'
import { BotEngine } from '@/bot/engine'
import { HALF_VIEWBOX, RADIUS } from '@/bot/frame'
import { SHAPES } from '@/bot/skins'
import { radiusLens, eyesOf } from '@/bot/eyePlacement'
import {
  ACCESSORIES,
  ACCESSORY_PALETTE,
  SLOTS,
  colorsOf,
  accessoriesInSlot,
  resolveAccessories,
  REMOVED,
  type Slot,
  type AccessorySelection
} from '@/bot/slots'
import { Accessories3d, IDS_IMPLEMENTED } from './accessories3d'
import { measureLandmarks, type Landmarks } from './anchors'
import { fieldOfIdle, bodyOutline, inflate, readMatrix, profileOf } from './volume'

/**
 * Accessories by slot: the catalog is complete, each accessory builds on the 12 shapes (anchoring computed on the
 * volume, not hard-coded), and all slots stack.
 */

/** The 3D volume of a shape, as `Mochi3d` fills it (y up), and its landmarks. */
function body(shape: string): { geo: BufferGeometry; R: Landmarks } {
  const frame = new BotEngine(RADIUS, 'idle', SHAPES.find((s) => s.id === shape)!.radii, null).sample(0.5)
  const profile = profileOf(shape)
  if (profile.cushion) fieldOfIdle(shape)
  const v = inflate(bodyOutline(frame.bodyPath), HALF_VIEWBOX, undefined, undefined, profile)
  const P = new Float32Array(v.positions.length)
  for (let i = 0; i < P.length; i += 3) {
    P[i] = v.positions[i]!
    P[i + 1] = -v.positions[i + 1]!
    P[i + 2] = v.positions[i + 2]!
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(P, 3))
  geo.setIndex(new BufferAttribute(v.index, 1))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  const ye = eyesOf(frame)
  // 3D eyes: facing front, a little above the center (the same sizes as the engine's)
  const R = measureLandmarks(
    geo,
    ye.map((o, i) => ({ x: (i - 0.5) * 50, y: 12, r: o.r })),
    ye.length === 2 ? Math.min(radiusLens(ye[0]!, ye[1]!), 25) : 22
  )
  void readMatrix
  return { geo, R }
}

const SHAPE_LIST = SHAPES.map((s) => s.id)
const mat = () => new MeshStandardMaterial()

const meshes = (o: Object3D): Mesh[] => {
  const out: Mesh[] = []
  o.traverse((m) => {
    if ((m as Mesh).isMesh) out.push(m as Mesh)
  })
  return out
}

/** All vertices of a group, in body space, finite. */
function verticesFinite(o: Object3D): boolean {
  o.updateMatrixWorld(true)
  for (const m of meshes(o)) {
    const P = m.geometry.attributes.position
    if (!P || P.count === 0) return false
    for (let i = 0; i < P.array.length; i++) if (!Number.isFinite(P.array[i] as number)) return false
  }
  return true
}

const cache = new Map<string, ReturnType<typeof body>>()
const bodyOf = (f: string) => {
  let c = cache.get(f)
  if (!c) cache.set(f, (c = body(f)))
  return c
}

describe('catalog', () => {
  it('22 accessories, spread over the four offered slots (no pink cheeks, freckles, beauty mark, mustache or cat whiskers)', () => {
    expect(ACCESSORIES.length).toBe(22)
    for (const e of SLOTS) expect(accessoriesInSlot(e).length).toBeGreaterThanOrEqual(1)
    expect(ACCESSORIES.some((a) => ['whiskers', 'freckles', 'mole', 'mustache', 'cheeks'].includes(a.id))).toBe(false)
    // glasses and monocle stay, in "eyes" (10/11/2026)
    expect(accessoriesInSlot('eyes').map((a) => a.id)).toEqual(['round', 'square', 'sunglasses', 'heart', 'star', 'monocle'])
    expect(accessoriesInSlot('face')).toEqual([])
  })

  it('each accessory has a builder, unique ids per slot, hex colors and a name with no em dash', () => {
    for (const e of SLOTS) {
      const ids = accessoriesInSlot(e).map((a) => a.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect([...ids].sort()).toEqual([...IDS_IMPLEMENTED(e)].sort())
    }
    for (const a of ACCESSORIES) {
      expect(a.c1).toMatch(/^#[0-9a-f]{6}$/i)
      expect(a.c2).toMatch(/^#[0-9a-f]{6}$/i)
      expect(a.name).not.toMatch(/[—–]/)
    }
    expect(Object.values(ACCESSORY_PALETTE).every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true)
  })

  it('resolveAccessories accepts an id or an id with colors, and refuses an unknown one', () => {
    expect(resolveAccessories('head', 'cap')?.name).toBe('Cap')
    expect(resolveAccessories('head', { id: 'cap', c1: '#112233' })?.c1).toBe('#112233')
    expect(resolveAccessories('head', 'unknown')).toBeNull()
    expect(resolveAccessories('eyes', 'cap')).toBeNull()
    expect(colorsOf({ head: 'cap', neck: 'bowtie' }).length).toBeGreaterThanOrEqual(2)
  })
})

describe('anchoring on the 12 shapes', () => {
  it('there are indeed 12 shapes', () => {
    expect(SHAPE_LIST).toHaveLength(12)
  })

  it.each(SHAPE_LIST)('%s: headwear seat in the body, neck under the eyes', (shape) => {
    const { R } = bodyOf(shape)
    expect(R.head.R).toBeGreaterThan(5)
    expect(R.head.rz).toBeGreaterThan(3)
    // hollow top (heart): the headwear rests on the bumps, 5 % of its radius above the top
    expect(R.head.y).toBeLessThanOrEqual(R.top + 0.05 * R.head.R + 1e-6)
    expect(R.head.y).toBeGreaterThan(R.neck + 0.3 * R.H)
    expect(R.yBottom).toBeLessThan(R.yEyes)
    expect(R.yBottom).toBeGreaterThan(R.neck)
    // the headwear axis is roughly the body axis
    expect(Math.abs(R.head.cx)).toBeLessThan(0.2 * R.hw)
    // the front surface is in the middle of the body
    const f = R.A.before(0, R.yEyes)
    expect(f).not.toBeNull()
    expect(f!.n.z).toBeGreaterThan(0.3)
  })

  it.each(SHAPE_LIST)('%s: every accessory of every slot builds, with no invalid value', (shape) => {
    const { R } = bodyOf(shape)
    for (const a of ACCESSORIES) {
      const acc = new Accessories3d()
      acc.update({ [a.slot]: a.id } as AccessorySelection, `${shape}|${a.id}`, mat(), () => R)
      expect(acc.group.visible).toBe(true)
      const g = acc.group.children[0]!
      expect(g.name).toBe(a.slot)
      expect(meshes(g).length, `${shape} ${a.id}`).toBeGreaterThan(0)
      expect(verticesFinite(g), `${shape} ${a.id}`).toBe(true)
      acc.liberer()
    }
  })

  it.each(SHAPE_LIST)('%s: a headwear rises above its seat, and the seat stays in the top of the body', (shape) => {
    const { R } = bodyOf(shape)
    // the seat: never lower than 28 % of the height below the top (not in front of the eyes)
    expect(R.head.y).toBeGreaterThanOrEqual(R.top - 0.28 * R.H - 1)
    for (const a of accessoriesInSlot('head')) {
      const acc = new Accessories3d()
      acc.update({ head: a.id }, 'x', mat(), () => R)
      const b = new Box3().setFromObject(acc.group)
      // the piece goes above the top of the seat: it shows; its volumes sink into the body (no gap)
      expect(b.max.y, `${shape} ${a.id}`).toBeGreaterThan(R.head.y)
      expect(b.min.y, `${shape} ${a.id}`).toBeLessThan(R.top)
      acc.liberer()
    }
  })
})

describe('combining slots', () => {
  const everything: AccessorySelection = { head: 'top-hat', eyes: 'sunglasses', neck: 'bowtie', back: 'backpack' }

  it.each(SHAPE_LIST)('%s: the four slots together, without error', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update(everything, shape, mat(), () => R)
    expect(acc.group.children.map((c) => c.name)).toEqual(SLOTS)
    for (const g of acc.group.children) {
      expect(meshes(g).length).toBeGreaterThan(0)
      expect(verticesFinite(g)).toBe(true)
    }
    expect(acc.colors.length).toBeGreaterThanOrEqual(3)
    // each slot only produces one group: one accessory per slot
    expect(new Set(acc.group.children.map((c) => c.name)).size).toBe(4)
    acc.liberer()
  })

  it('every pair (head, eyes, neck, back) of the catalog builds on a shape without error', () => {
    const { R } = bodyOf('circle')
    const sels: AccessorySelection[] = []
    const t = accessoriesInSlot('head')
    const y = accessoriesInSlot('eyes')
    const b = accessoriesInSlot('neck')
    const d = accessoriesInSlot('back')
    const n = Math.max(t.length, y.length, b.length, d.length)
    for (let i = 0; i < n; i++) {
      sels.push({ head: t[i % t.length]!.id, eyes: y[(i + 1) % y.length]!.id, neck: b[(i + 3) % b.length]!.id, back: d[i % d.length]!.id })
    }
    for (const sel of sels) {
      const acc = new Accessories3d()
      acc.update(sel, JSON.stringify(sel), mat(), () => R)
      expect(acc.group.children).toHaveLength(4)
      for (const g of acc.group.children) expect(verticesFinite(g), JSON.stringify(sel)).toBe(true)
      acc.liberer()
    }
  }, 30000)

  it('the head area stays above the neck area: no collision between top and bottom slots', () => {
    for (const shape of ['circle', 'squircle', 'cloud', 'egg']) {
      const { R } = bodyOf(shape)
      const acc = new Accessories3d()
      acc.update({ head: 'top-hat', neck: 'bowtie' } as AccessorySelection, shape, mat(), () => R)
      const [head, neck] = acc.group.children as [Object3D, Object3D]
      const bt = new Box3().setFromObject(head)
      const bb = new Box3().setFromObject(neck)
      expect(bt.min.y, shape).toBeGreaterThan(bb.max.y)
      acc.liberer()
    }
  })

  it("an empty slot or an unknown accessory produces nothing; the group hides when there is nothing", () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({}, 'a', mat(), () => R)
    expect(acc.group.visible).toBe(false)
    acc.update({ head: 'unknown' } as unknown as AccessorySelection, 'b', mat(), () => R)
    expect(acc.group.children).toHaveLength(0)
    acc.liberer()
  })

  it('the (costly) landmark computation is not redone as long as the body and the selection stay the same', () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    let n = 0
    const f = () => (n++, R)
    const m = mat()
    acc.update({ head: 'cap' }, 'k', m, f)
    acc.update({ head: 'cap' }, 'k', m, f)
    expect(n).toBe(1)
    acc.update({ head: 'top-hat' }, 'k', m, f)
    expect(n).toBe(2)
    acc.liberer()
  })
})

describe('slot list', () => {
  it('four offered slots in a stable order (face empty since 10/11/2026)', () => {
    expect(SLOTS).toEqual(['head', 'eyes', 'neck', 'back'] as Slot[])
  })
})

describe('feedback of 05/11/2026', () => {
  it('removed accessories are no longer in the catalog or resolved, but stay listed in REMOVED', () => {
    expect(REMOVED.map((r) => `${r.slot}:${r.id}`).sort()).toEqual(
      ['neck:bandana', 'neck:bell', 'neck:medal', 'neck:tie', 'head:beanie', 'head:bob', 'back:tail', 'eyes:sleep', 'head:party', 'head:ears', 'face:tear', 'face:bandage', 'eyes:domino', 'eyes:ski', 'face:whiskers', 'face:freckles', 'face:mole', 'neck:mustache', 'back:wings', 'back:batwings', 'face:cheeks'].sort()
    )
    for (const r of REMOVED) {
      expect(ACCESSORIES.some((a) => a.slot === r.slot && a.id === r.id)).toBe(false)
      expect(resolveAccessories(r.slot, r.id)).toBeNull()
    }
  })

  it('the pearl necklace no longer has a pendant: only identical spheres', () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ neck: 'pearls' }, 'p', mat(), () => R)
    const radii = new Set(meshes(acc.group).map((m) => m.geometry.uuid))
    expect(radii.size).toBe(1)
    acc.liberer()
  })

  it.each(SHAPE_LIST)('%s: the headphones have a band over the head and two cups on the sides, sunk into the body', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ head: 'headphones' }, shape, mat(), () => R)
    const b = new Box3().setFromObject(acc.group)
    expect(verticesFinite(acc.group)).toBe(true)
    // the band goes above the eye, up to the top of the body
    expect(b.max.y).toBeGreaterThan(R.yEyes + 0.3 * R.H)
    // the cups stick out left and right of the body width at eye height
    const g = R.A.side(R.yEyes, R.zc, -1)!
    const d = R.A.side(R.yEyes, R.zc, 1)!
    expect(b.min.x).toBeLessThan(g.p.x)
    expect(b.max.x).toBeGreaterThan(d.p.x)
    // symmetric: about as much on the left as on the right
    expect(Math.abs(b.min.x + b.max.x)).toBeLessThan(0.25 * R.hw)
    // a cup goes into the body (like the glasses): its inner end is inside the edge
    expect(b.min.x).toBeLessThan(g.p.x - 1)
    acc.liberer()
  })

  it('the headphones take the head slot: they do not stack with a hat (documented), but with all the others', () => {
    const { R } = bodyOf('squircle')
    const acc = new Accessories3d()
    acc.update({ head: 'headphones', eyes: 'sunglasses', neck: 'scarf', back: 'backpack' }, 'x', mat(), () => R)
    expect(acc.group.children.map((c) => c.name)).toEqual(SLOTS)
    for (const g of acc.group.children) expect(verticesFinite(g)).toBe(true)
    acc.liberer()
  })

  it('the backpack straps follow the body: all their vertices are on the surface or just above (no free flight)', () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ back: 'backpack' }, 's', mat(), () => R)
    const tubes = meshes(acc.group).filter((m) => m.geometry.type === 'TubeGeometry')
    expect(tubes.length).toBe(2)
    for (const t of tubes) {
      const P = t.geometry.attributes.position!
      let maxD = 0
      for (let i = 0; i < P.count; i += 7) {
        const dist = Math.hypot(P.getX(i), P.getY(i), P.getZ(i) - R.zc)
        maxD = Math.max(maxD, dist)
      }
      expect(maxD).toBeLessThan(R.hw * 1.35)
    }
    acc.liberer()
  })
})

describe('accessories v3 (feedback of 05/11/2026)', () => {
  it.each(SHAPE_LIST)('%s: the bow tie is symmetric, set in front of the neck, two wings and a knot', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ neck: 'bowtie' }, shape, mat(), () => R)
    const ms = meshes(acc.group)
    expect(ms).toHaveLength(3)
    const b = new Box3().setFromObject(acc.group)
    expect(verticesFinite(acc.group)).toBe(true)
    expect(Math.abs(b.min.x + b.max.x)).toBeLessThan(0.15 * R.hw)
    expect(b.max.x - b.min.x).toBeGreaterThan(0.6 * R.hw)
    // in front of the body at the knot's height (at the very bottom since v4)
    expect(b.max.z).toBeGreaterThan(R.A.before(0, (b.min.y + b.max.y) / 2)!.p.z)
    acc.liberer()
  })

  it('the cape is plain red: a single color, no yellow piece', () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ back: 'cape' }, 'c', mat(), () => R)
    const colors = new Set(meshes(acc.group).map((m) => ((m.material as unknown as { color: { getHexString(): string } }).color.getHexString())))
    expect(colors.size).toBe(1)
    expect(resolveAccessories('back', 'cape')!.c1).toBe(resolveAccessories('back', 'cape')!.c2)
    acc.liberer()
  })

  it('the tail and the sleep mask are removed from the catalog (code kept)', () => {
    expect(resolveAccessories('back', 'tail')).toBeNull()
    expect(resolveAccessories('eyes', 'sleep')).toBeNull()
    expect(REMOVED.some((r) => r.id === 'tail')).toBe(true)
    expect(REMOVED.some((r) => r.id === 'sleep')).toBe(true)
  })

  it('the mustache, freckles, beauty mark and cat whiskers are removed (09/11/2026, code kept)', () => {
    expect(resolveAccessories('neck', 'mustache')).toBeNull()
    expect(resolveAccessories('face', 'whiskers')).toBeNull()
    expect(resolveAccessories('back', 'wings')).toBeNull()
    expect(resolveAccessories('back', 'batwings')).toBeNull()
    expect(REMOVED.some((r) => r.id === 'mustache')).toBe(true)
  })

  it.each(SHAPE_LIST)('%s: the bow tie is small (at most 45 percent of the body) and only sticks out a little below the silhouette', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ neck: 'bowtie' }, shape, mat(), () => R)
    const b = new Box3().setFromObject(acc.group)
    expect(b.max.x - b.min.x, shape).toBeLessThan(0.45 * 2 * R.hw)
    expect(b.min.y, shape).toBeGreaterThan(R.neck - 0.12 * R.H)
    acc.liberer()
  })

  it.each(SHAPE_LIST)('%s: the cap has a visor that clearly sticks out forward', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ head: 'cap' }, shape, mat(), () => R)
    const b = new Box3().setFromObject(acc.group)
    expect(b.max.z, shape).toBeGreaterThan(R.A.box.max.z + 0.1 * R.hw)
    expect(verticesFinite(acc.group)).toBe(true)
    acc.liberer()
  })

  it.each(SHAPE_LIST)('%s: the cap\'s crown is a round dome above the seat', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ head: 'cap' }, shape, mat(), () => R)
    const b = new Box3().setFromObject(acc.group)
    expect(b.max.y, shape).toBeGreaterThan(R.head.y + 0.5 * R.head.R)
    expect(b.min.x, shape).toBeLessThan(R.head.cx)
    expect(b.max.x, shape).toBeGreaterThan(R.head.cx)
    acc.liberer()
  })

  it.each(SHAPE_LIST)('%s: the laptop of the working mood is in front of the body, bottom right, under the eyes, and grows with its scale', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    const laptop = (k: number) => ({ k, ground: R.neck, key: shape })
    acc.update({}, shape, mat(), () => R, laptop(1))
    const og = acc.group.children.find((c) => c.name === 'laptop')
    expect(og, shape).toBeDefined()
    expect(og!.visible).toBe(true)
    const b = new Box3().setFromObject(og!)
    // in front of the body, centered, under the eyes, on the ground
    expect(b.max.z, shape).toBeGreaterThan((R.A.before(0, R.neck + 0.1 * R.H)?.p.z ?? R.A.box.max.z) + 0.1 * R.hw)
    // at the bottom right of the image (positive x), without leaving the frame
    expect((b.max.x + b.min.x) / 2, shape).toBeGreaterThan(0.25 * R.hw)
    expect(b.max.x, shape).toBeLessThan(1.6 * R.hw)
    expect(b.max.y, shape).toBeLessThan(R.yEyes)
    expect(b.min.y, shape).toBeGreaterThan(R.neck - 0.03 * R.H)
    expect(verticesFinite(acc.group)).toBe(true)
    // halfway through growing it is smaller, at zero it disappears
    acc.update({}, shape, mat(), () => R, laptop(0.5))
    expect(og!.scale.x).toBeCloseTo(0.5, 6)
    acc.update({ head: 'cap' }, shape, mat(), () => R, laptop(0))
    expect(acc.group.children.some((c) => c.name === 'laptop' && c.visible)).toBe(false)
    acc.liberer()
  })

  it('the laptop stacks with accessories and does not show without the mood', () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    const m = mat()
    acc.update({ head: 'cap', eyes: 'round', neck: 'bowtie' }, 'c', m, () => R, { k: 1, ground: R.neck, key: 'c' })
    const names = acc.group.children.filter((c) => c.visible).map((c) => c.name)
    expect(names).toContain('laptop')
    expect(names).toContain('head')
    acc.update({ head: 'cap' }, 'c', m, () => R)
    expect(acc.group.children.some((c) => c.name === 'laptop' && c.visible)).toBe(false)
    acc.liberer()
  })

  it.each(SHAPE_LIST)('%s: the crown covers the top of the body (no tip sticks out)', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ head: 'cap' }, shape, mat(), () => R)
    const b = new Box3().setFromObject(acc.group)
    expect(b.max.y, shape).toBeGreaterThan(R.top)
    acc.liberer()
  })

  it('the cap and the headphones share a slot: the second replaces the first', () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ head: 'headphones' }, 'x', mat(), () => R)
    const n1 = meshes(acc.group).length
    acc.update({ head: 'cap' }, 'x', mat(), () => R)
    const n2 = meshes(acc.group).length
    expect(n2).not.toBe(0)
    expect(n2).not.toBe(n1 + n2)
    acc.liberer()
  })

  it.each(SHAPE_LIST)('%s: the glasses arms stay inside the body\'s box', (shape) => {
    const { R } = bodyOf(shape)
    for (const id of ['round', 'square', 'sunglasses', 'heart', 'star']) {
      const acc = new Accessories3d()
      acc.update({ eyes: id }, shape, mat(), () => R)
      for (const t of meshes(acc.group).filter((m) => m.geometry.type === 'TubeGeometry')) {
        const P = t.geometry.attributes.position!
        let xmax = -Infinity
        for (let i = 0; i < P.count; i++) xmax = Math.max(xmax, Math.abs(P.getX(i)))
        expect(xmax, `${shape} ${id}`).toBeLessThan(R.A.box.max.x + 0.05 * R.hw)
      }
      acc.liberer()
    }
  })

  it('the backpack straps do not go across the front of the body', () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ back: 'backpack' }, 's', mat(), () => R)
    for (const t of meshes(acc.group).filter((m) => m.geometry.type === 'TubeGeometry')) {
      const P = t.geometry.attributes.position!
      for (let i = 0; i < P.count; i++) expect(P.getZ(i)).toBeLessThan(R.zc + 0.45 * R.hw)
    }
    acc.liberer()
  })
})


describe('accessories v4: simple, one or two colors, customizable (05/11/2026)', () => {
  const hexMat = (m: Mesh) => (m.material as unknown as { color: { getHexString(): string } }).color.getHexString()
  /** colors of the opaque pieces (the translucent lens of glasses is not an accessory color) */
  const colorsOpaque = (o: Object3D) =>
    new Set(meshes(o).filter((m) => (m.material as unknown as { opacity: number }).opacity >= 1).map(hexMat))

  it.each(ACCESSORIES.map((a) => [a.slot, a.id] as const))('%s:%s has at most two colors, on a round shape and on a star', (e, id) => {
    for (const shape of ['circle', 'star']) {
      const { R } = bodyOf(shape)
      const acc = new Accessories3d()
      acc.update({ [e]: id } as AccessorySelection, shape, mat(), () => R)
      expect(colorsOpaque(acc.group).size, `${shape} ${e}:${id}`).toBeLessThanOrEqual(2)
      acc.liberer()
    }
  })

  it.each(ACCESSORIES.map((a) => [a.slot, a.id, a.c1, a.c2] as const))('%s:%s can be customized: forced c1 and c2 show up on the pieces', (e, id, d1, d2) => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ [e]: { id, c1: '#123456', c2: '#654321' } } as AccessorySelection, 'p', mat(), () => R)
    const cs = [...colorsOpaque(acc.group)]
    expect(cs).toContain('123456')
    // no catalog color remains when c1 is forced (except a forced c2)
    for (const c of cs) expect(['123456', '654321']).toContain(c)
    expect(d1).toMatch(/^#/)
    expect(d2).toMatch(/^#/)
    acc.liberer()
  })

  it('a sober default color: black bow tie, red cape, c2 = c1 when there is a single color', () => {
    expect(resolveAccessories('neck', 'bowtie')!.c1).toBe(ACCESSORY_PALETTE.black)
    expect(resolveAccessories('back', 'cape')!.c1).toBe(ACCESSORY_PALETTE.red)
    for (const id of ['bowtie', 'scarf']) {
      const d = resolveAccessories('neck', id)!
      expect(d.c2, id).toBe(d.c1)
    }
  })

  it.each(SHAPE_LIST)('%s: the bow tie is at the very bottom of the body, black, one color', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ neck: 'bowtie' }, shape, mat(), () => R)
    expect(colorsOpaque(acc.group).size).toBe(1)
    const b = new Box3().setFromObject(acc.group)
    // centered in the bottom third of the body, clearly under the former neck height
    expect((b.min.y + b.max.y) / 2).toBeLessThan(R.neck + 0.4 * R.H)
    acc.liberer()
  })

  it('the cape is a single piece: a single mesh, no collar (no tube)', () => {
    for (const shape of ['circle', 'egg']) {
      const { R } = bodyOf(shape)
      const acc = new Accessories3d()
      acc.update({ back: 'cape' }, shape, mat(), () => R)
      expect(meshes(acc.group)).toHaveLength(1)
      acc.liberer()
    }
  })

  it("the scarf has no stripes any more and the flower necklace only has two colors", () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ neck: 'scarf' }, 'e', mat(), () => R)
    expect(colorsOpaque(acc.group).size).toBe(1)
    acc.liberer()
    acc.update({ neck: 'lei' }, 'f', mat(), () => R)
    expect(colorsOpaque(acc.group).size).toBe(2)
    acc.liberer()
  })
})

describe('accessory outline', () => {
  const shells = (o: Object3D) => meshes(o).filter((m) => (m.userData as { shell?: boolean }).shell)
  const pieces = (o: Object3D) => meshes(o).filter((m) => !(m.userData as { shell?: boolean }).shell)

  it('one shell per opaque piece, hidden as long as the outline is off', () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ head: 'top-hat' }, 'c0', mat(), () => R)
    acc.outline(false, 4)
    expect(shells(acc.group)).toHaveLength(0)
    acc.outline(true, 4)
    expect(shells(acc.group).length).toBe(pieces(acc.group).length)
    expect(shells(acc.group).every((c) => c.visible)).toBe(true)
    acc.outline(false, 4)
    expect(shells(acc.group).every((c) => !c.visible)).toBe(true)
    acc.liberer()
  })

  it('shells are inverted meshes, darker than the piece, with finite vertices', () => {
    const { R } = bodyOf('star')
    const acc = new Accessories3d()
    acc.update({ head: 'cap', eyes: 'round', neck: 'bowtie' }, 'c1', mat(), () => R)
    acc.outline(true, 3)
    const cs = shells(acc.group)
    expect(cs.length).toBeGreaterThan(3)
    for (const c of cs) {
      expect(c.material).toHaveProperty('side', 1) // BackSide
      const parent = c.parent as Mesh
      const lum = (m: Mesh) => {
        const k = (m.material as MeshStandardMaterial).color
        return k.r + k.g + k.b
      }
      expect(lum(c)).toBeLessThanOrEqual(lum(parent) + 1e-6)
    }
    expect(verticesFinite(acc.group)).toBe(true)
    acc.liberer()
  })

  it("the thickness is the body's and follows its value every frame", () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ head: 'top-hat' }, 'c2', mat(), () => R)
    acc.outline(true, 2)
    const th = () => shells(acc.group).map((c) => (c.userData as { th: { value: number } }).th.value)
    const end = th()
    acc.outline(true, 6)
    const thick = th()
    end.forEach((v, i) => expect(thick[i]! / v).toBeCloseTo(3, 5))
    expect(Math.min(...end)).toBeGreaterThan(0)
    acc.liberer()
  })

  it("the stroke does not depend on the piece's scale: the folding laptop keeps the same stroke", () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    const laptop = (k: number) => ({ k, ground: R.neck, key: 'laptop-circle' })
    acc.update({}, 'c3', mat(), () => R, laptop(1))
    acc.outline(true, 4)
    const full = shells(acc.group).map((c) => (c.userData as { th: { value: number } }).th.value)
    expect(full.length).toBeGreaterThan(0)
    acc.update({}, 'c3', mat(), () => R, laptop(0.5))
    acc.outline(true, 4)
    const half = shells(acc.group).map((c) => (c.userData as { th: { value: number } }).th.value)
    // the piece is half size: the local value doubles, the stroke on screen stays the same
    half.forEach((v, i) => expect(v / full[i]!).toBeCloseTo(2, 5))
    acc.liberer()
  })
})

describe('heart: hats rest ON the two bumps, without sinking into the hollow (06/11/2026)', () => {
  /** Height of the body's highest point under the headwear's footprint (the top of the two bumps). */
  const topOfBumps = (R: Landmarks) => {
    let y = -Infinity
    for (let k = -8; k <= 8; k++) {
      const h = R.A.top((k / 8) * 0.6 * R.hw, R.zc)
      if (h) y = Math.max(y, h.p.y)
    }
    return y
  }
  const HEADWEAR = ['top-hat', 'crown', 'straw', 'beret', 'toque']

  it('the heart does have a hollow at the top (the middle is clearly lower than the bumps), not the circle', () => {
    const c = bodyOf('heart').R
    const m = c.A.top(0, c.zc)!
    expect(c.top - m.p.y).toBeGreaterThan(0.05 * c.H)
    const r = bodyOf('circle').R
    expect(r.top - r.A.top(0, r.zc)!.p.y).toBeLessThan(0.05 * r.H)
  })

  it('the seat is on top of the bumps: neither in the hollow nor in the air', () => {
    const { R } = bodyOf('heart')
    const h = topOfBumps(R)
    expect(R.head.y).toBeGreaterThanOrEqual(h - 0.01 * R.H)
    expect(R.head.y).toBeLessThanOrEqual(h + 0.1 * R.head.R)
    expect(R.head.cx).toBe(0)
    expect(R.head.R).toBeGreaterThan(30)
    expect(R.head.rz).toBeGreaterThan(R.head.R * 0.7 - 1e-6)
  })

  it.each(HEADWEAR)('%s: the headwear sits at the bumps\' height, not in the hollow', (id) => {
    const { R } = bodyOf('heart')
    const acc = new Accessories3d()
    acc.update({ head: id } as AccessorySelection, 'heart', mat(), () => R)
    acc.group.updateMatrixWorld(true)
    // the headwear frame: the group scaled to the seat radius
    let origin: Object3D | null = null
    acc.group.traverse((o) => {
      if (!origin && Math.abs(o.scale.x - R.head.R * 1.18) < 1e-3) origin = o
    })
    expect(origin, id).not.toBeNull()
    const h = topOfBumps(R)
    const y = (origin as unknown as Object3D).position.y
    // its base (a little under the origin) touches the top of the bumps: before the fix it was about 0.17 H lower, in the hollow
    expect(y, id).toBeGreaterThanOrEqual(h - 0.08 * R.head.R)
    expect(y, id).toBeLessThanOrEqual(h + 0.05 * R.head.R)
    // and the whole thing does stick out of the top of the body
    expect(new Box3().setFromObject(acc.group).max.y, id).toBeGreaterThan(R.top)
    acc.liberer()
  })

  it('cap, headphones, ribbon, flower, antenna: build on the heart, finite vertices, above the hollow', () => {
    const { R } = bodyOf('heart')
    for (const id of ['cap', 'headphones', 'ribbon', 'flower', 'antenna']) {
      const acc = new Accessories3d()
      acc.update({ head: id } as AccessorySelection, 'heart', mat(), () => R)
      expect(verticesFinite(acc.group), id).toBe(true)
      const box = new Box3().setFromObject(acc.group)
      expect(box.max.y, id).toBeGreaterThan(R.top - 0.02 * R.H)
      acc.liberer()
    }
  })

  it('the other shapes keep their seat (the hollow changes nothing for the circle, the star, the cloud)', () => {
    for (const f of ['circle', 'star', 'cloud', 'egg']) {
      const { R } = bodyOf(f)
      expect(R.head.y, f).toBeLessThanOrEqual(R.top)
    }
  })
})

describe('customizer shape change (09/11/2026)', () => {
  const top = (acc: Accessories3d) => new Box3().setFromObject(acc.group).min.y

  it('bug reproduced: same key, another body -> the pieces stay where they were; invalidate() puts them back', () => {
    const a = bodyOf('circle').R
    const b = bodyOf('triangle').R
    expect(Math.abs(a.top - b.top)).toBeGreaterThan(1) // the two bodies do not have the same top
    const sel: AccessorySelection = { head: 'cap' }
    const m = mat()
    const acc = new Accessories3d()
    acc.update(sel, 'x|shape', m, () => a)
    const placed = top(acc)
    // the shape changes but the key only sees the style and shape names, already taken: nothing is recomputed
    acc.update(sel, 'x|shape', m, () => b)
    expect(top(acc)).toBeCloseTo(placed, 5)
    // after invalidate(), the pose follows the new body, like a fresh build
    acc.invalidate()
    acc.update(sel, 'x|shape', m, () => b)
    const fresh = new Accessories3d()
    fresh.update(sel, 'x|shape', m, () => b)
    expect(top(acc)).toBeCloseTo(top(fresh), 5)
    expect(Math.abs(top(acc) - placed)).toBeGreaterThan(0.5)
    acc.liberer()
    fresh.liberer()
  })

  it('<mochi-bot> invalidates the accessory pose after the morph when the shape changes', () => {
    const src = readFileSync(new URL('../../components/mochi-bot.ts', import.meta.url), 'utf8')
    expect(src).toContain('invalidateAccessories3d()')
    expect(src).toMatch(/watch\(\s*\(\) => props\.shape/)
    expect(src).toContain('BotEngine.SHAPE_MORPH')
  })
})
