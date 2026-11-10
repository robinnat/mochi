import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Box3, MeshStandardMaterial, type Mesh, type Object3D } from 'three'
import { BotEngine } from '@/bot/engine'
import { HALF_VIEWBOX, RADIUS } from '@/bot/frame'
import { SHAPES } from '@/bot/skins'
import { radiusLens, eyesOf } from '@/bot/worn'
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
 * Accessoires par emplacements : le catalogue est complet, chaque accessoire se construit sur les
 * 12 formes (ancrage calcule sur le volume, pas en dur), et tous les emplacements se cumulent.
 */

/** Le volume 3D d'une forme, comme `Mochi3d` le remplit (y vers le haut), et ses reperes. */
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
  // yeux de la 3D : de face, un peu au-dessus du centre (les memes tailles que celles du moteur)
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

/** Tous les sommets d'un groupe, dans le repere du corps, finis. */
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

describe('catalogue', () => {
  it('22 accessoires, repartis sur les quatre emplacements proposes (sans joues roses ni taches de rousseur, grain de beaute, moustache, moustaches de chat)', () => {
    expect(ACCESSORIES.length).toBe(22)
    for (const e of SLOTS) expect(accessoriesInSlot(e).length).toBeGreaterThanOrEqual(1)
    expect(ACCESSORIES.some((a) => ['whiskers', 'freckles', 'mole', 'mustache', 'cheeks'].includes(a.id))).toBe(false)
    // lunettes et monocle restent, dans « yeux » (Robin, 10/11/2026)
    expect(accessoriesInSlot('eyes').map((a) => a.id)).toEqual(['round', 'square', 'sunglasses', 'heart', 'star', 'monocle'])
    expect(accessoriesInSlot('face')).toEqual([])
  })

  it('chaque accessoire a un generateur, des identifiants uniques par emplacement, des couleurs hex et un nom sans tiret cadratin', () => {
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

  it('resoudre accepte un id ou un id avec couleurs, et refuse un inconnu', () => {
    expect(resolveAccessories('head', 'cap')?.name).toBe('Cap')
    expect(resolveAccessories('head', { id: 'cap', c1: '#112233' })?.c1).toBe('#112233')
    expect(resolveAccessories('head', 'unknown')).toBeNull()
    expect(resolveAccessories('eyes', 'cap')).toBeNull()
    expect(colorsOf({ head: 'cap', neck: 'bowtie' }).length).toBeGreaterThanOrEqual(2)
  })
})

describe('ancrage sur les 12 formes', () => {
  it('il y a bien 12 formes', () => {
    expect(SHAPE_LIST).toHaveLength(12)
  })

  it.each(SHAPE_LIST)('%s : assise de coiffe dans le corps, cou sous les yeux', (shape) => {
    const { R } = bodyOf(shape)
    expect(R.head.R).toBeGreaterThan(5)
    expect(R.head.rz).toBeGreaterThan(3)
    // sommet creuse (coeur) : la coiffe repose sur les bosses, a 5 % de son rayon au-dessus du haut
    expect(R.head.y).toBeLessThanOrEqual(R.top + 0.05 * R.head.R + 1e-6)
    expect(R.head.y).toBeGreaterThan(R.neck + 0.3 * R.H)
    expect(R.yBottom).toBeLessThan(R.yEyes)
    expect(R.yBottom).toBeGreaterThan(R.neck)
    // l'axe de la coiffe est a peu pres l'axe du corps
    expect(Math.abs(R.head.cx)).toBeLessThan(0.2 * R.hw)
    // la surface avant se trouve au milieu du corps
    const f = R.A.before(0, R.yEyes)
    expect(f).not.toBeNull()
    expect(f!.n.z).toBeGreaterThan(0.3)
  })

  it.each(SHAPE_LIST)('%s : chaque accessoire de chaque emplacement se construit, sans valeur invalide', (shape) => {
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

  it.each(SHAPE_LIST)('%s : une coiffe monte au-dessus de son assise, et l assise reste dans le haut du corps', (shape) => {
    const { R } = bodyOf(shape)
    // l'assise : jamais plus bas que 28 % de la hauteur sous le sommet (pas devant les yeux)
    expect(R.head.y).toBeGreaterThanOrEqual(R.top - 0.28 * R.H - 1)
    for (const a of accessoriesInSlot('head')) {
      const acc = new Accessories3d()
      acc.update({ head: a.id }, 'x', mat(), () => R)
      const b = new Box3().setFromObject(acc.group)
      // la piece depasse le sommet de l'assise : elle se voit ; ses volumes plongent dans le corps (pas de vide)
      expect(b.max.y, `${shape} ${a.id}`).toBeGreaterThan(R.head.y)
      expect(b.min.y, `${shape} ${a.id}`).toBeLessThan(R.top)
      acc.liberer()
    }
  })
})

describe('combinaison des emplacements', () => {
  const everything: AccessorySelection = { head: 'top-hat', eyes: 'sunglasses', neck: 'bowtie', back: 'backpack' }

  it.each(SHAPE_LIST)('%s : les quatre emplacements ensemble, sans erreur', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update(everything, shape, mat(), () => R)
    expect(acc.group.children.map((c) => c.name)).toEqual(SLOTS)
    for (const g of acc.group.children) {
      expect(meshes(g).length).toBeGreaterThan(0)
      expect(verticesFinite(g)).toBe(true)
    }
    expect(acc.colors.length).toBeGreaterThanOrEqual(3)
    // chaque emplacement ne produit qu'un groupe : un seul accessoire par emplacement
    expect(new Set(acc.group.children.map((c) => c.name)).size).toBe(4)
    acc.liberer()
  })

  it('toutes les paires (tete, yeux, bas, dos) du catalogue se construisent sur une forme sans erreur', () => {
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

  it('la zone de la tete reste au-dessus de celle du cou : pas de collision entre emplacements du haut et du bas', () => {
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

  it("un emplacement vide ou un accessoire inconnu ne produit rien ; le groupe se masque s'il n'y a rien", () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({}, 'a', mat(), () => R)
    expect(acc.group.visible).toBe(false)
    acc.update({ head: 'unknown' } as unknown as AccessorySelection, 'b', mat(), () => R)
    expect(acc.group.children).toHaveLength(0)
    acc.liberer()
  })

  it('le calcul des reperes (couteux) ne se refait pas tant que le corps et la selection sont les memes', () => {
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

describe('liste des emplacements', () => {
  it('quatre emplacements proposes dans un ordre stable (visage vide depuis le 10/11/2026)', () => {
    expect(SLOTS).toEqual(['head', 'eyes', 'neck', 'back'] as Slot[])
  })
})

describe('retours de Robin du 05/11/2026', () => {
  it('les accessoires retires ne sont plus au catalogue ni resolus, mais restent listes dans RETIRES', () => {
    expect(REMOVED.map((r) => `${r.slot}:${r.id}`).sort()).toEqual(
      ['bas:bandana', 'bas:clochette', 'bas:medaille', 'bas:cravate', 'tete:bonnet', 'tete:bob', 'dos:queue', 'yeux:sommeil', 'tete:fete', 'tete:oreilles', 'visage:larme', 'visage:pansement', 'yeux:domino', 'yeux:ski', 'visage:chat', 'visage:rousseur', 'visage:grain', 'bas:moustache', 'dos:ailes', 'dos:diable', 'visage:joues'].sort()
    )
    for (const r of REMOVED) {
      expect(ACCESSORIES.some((a) => a.slot === r.slot && a.id === r.id)).toBe(false)
      expect(resolveAccessories(r.slot, r.id)).toBeNull()
    }
  })

  it('le collier de perles ne porte plus de pendentif : que des spheres identiques', () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ neck: 'pearls' }, 'p', mat(), () => R)
    const radii = new Set(meshes(acc.group).map((m) => m.geometry.uuid))
    expect(radii.size).toBe(1)
    acc.liberer()
  })

  it.each(SHAPE_LIST)('%s : le casque de musique a un arceau au-dessus de la tete et deux coques sur les flancs, enfoncees dans le corps', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ head: 'headphones' }, shape, mat(), () => R)
    const b = new Box3().setFromObject(acc.group)
    expect(verticesFinite(acc.group)).toBe(true)
    // l'arceau passe au-dessus de l'oeil, jusqu'au haut du corps
    expect(b.max.y).toBeGreaterThan(R.yEyes + 0.3 * R.H)
    // les coques depassent a gauche et a droite de la largeur du corps a hauteur des yeux
    const g = R.A.side(R.yEyes, R.zc, -1)!
    const d = R.A.side(R.yEyes, R.zc, 1)!
    expect(b.min.x).toBeLessThan(g.p.x)
    expect(b.max.x).toBeGreaterThan(d.p.x)
    // symetrique : autant a gauche qu'a droite, a peu pres
    expect(Math.abs(b.min.x + b.max.x)).toBeLessThan(0.25 * R.hw)
    // une coque rentre dans le corps (comme les lunettes) : son extremite interieure est en dedans du bord
    expect(b.min.x).toBeLessThan(g.p.x - 1)
    acc.liberer()
  })

  it('le casque occupe l emplacement tete : il ne se cumule pas avec un chapeau (documente), mais avec tous les autres', () => {
    const { R } = bodyOf('squircle')
    const acc = new Accessories3d()
    acc.update({ head: 'headphones', eyes: 'sunglasses', neck: 'scarf', back: 'backpack' }, 'x', mat(), () => R)
    expect(acc.group.children.map((c) => c.name)).toEqual(SLOTS)
    for (const g of acc.group.children) expect(verticesFinite(g)).toBe(true)
    acc.liberer()
  })

  it('les bretelles du sac suivent le corps : tous leurs sommets sont a la surface ou juste au-dessus (pas de vol libre)', () => {
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

describe('accessoires v3 (retours de Robin du 05/11/2026)', () => {
  it.each(SHAPE_LIST)('%s : le noeud papillon est symetrique, pose devant le cou, deux ailes et un noeud', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ neck: 'bowtie' }, shape, mat(), () => R)
    const ms = meshes(acc.group)
    expect(ms).toHaveLength(3)
    const b = new Box3().setFromObject(acc.group)
    expect(verticesFinite(acc.group)).toBe(true)
    expect(Math.abs(b.min.x + b.max.x)).toBeLessThan(0.15 * R.hw)
    expect(b.max.x - b.min.x).toBeGreaterThan(0.6 * R.hw)
    // devant le corps a la hauteur du noeud (tout en bas depuis la v4)
    expect(b.max.z).toBeGreaterThan(R.A.before(0, (b.min.y + b.max.y) / 2)!.p.z)
    acc.liberer()
  })

  it('la cape est rouge unie : une seule couleur, aucune piece jaune', () => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ back: 'cape' }, 'c', mat(), () => R)
    const colors = new Set(meshes(acc.group).map((m) => ((m.material as unknown as { color: { getHexString(): string } }).color.getHexString())))
    expect(colors.size).toBe(1)
    expect(resolveAccessories('back', 'cape')!.c1).toBe(resolveAccessories('back', 'cape')!.c2)
    acc.liberer()
  })

  it('la queue et le masque de sommeil sont retires du catalogue (code garde)', () => {
    expect(resolveAccessories('back', 'tail')).toBeNull()
    expect(resolveAccessories('eyes', 'sleep')).toBeNull()
    expect(REMOVED.some((r) => r.id === 'tail')).toBe(true)
    expect(REMOVED.some((r) => r.id === 'sleep')).toBe(true)
  })

  it('la moustache, les taches de rousseur, le grain de beaute et les moustaches de chat sont retires (09/11/2026, code garde)', () => {
    expect(resolveAccessories('neck', 'mustache')).toBeNull()
    expect(resolveAccessories('face', 'whiskers')).toBeNull()
    expect(resolveAccessories('back', 'wings')).toBeNull()
    expect(resolveAccessories('back', 'batwings')).toBeNull()
    expect(REMOVED.some((r) => r.id === 'mustache')).toBe(true)
  })

  it.each(SHAPE_LIST)('%s : le noeud papillon est petit (au plus 45 pour cent du corps) et ne depasse que peu sous la silhouette', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ neck: 'bowtie' }, shape, mat(), () => R)
    const b = new Box3().setFromObject(acc.group)
    expect(b.max.x - b.min.x, shape).toBeLessThan(0.45 * 2 * R.hw)
    expect(b.min.y, shape).toBeGreaterThan(R.neck - 0.12 * R.H)
    acc.liberer()
  })

  it.each(SHAPE_LIST)('%s : la casquette a une visiere qui depasse nettement vers l avant', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ head: 'cap' }, shape, mat(), () => R)
    const b = new Box3().setFromObject(acc.group)
    expect(b.max.z, shape).toBeGreaterThan(R.A.box.max.z + 0.1 * R.hw)
    expect(verticesFinite(acc.group)).toBe(true)
    acc.liberer()
  })

  it.each(SHAPE_LIST)('%s : la calotte de la casquette est un dome rond qui depasse de l assise', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ head: 'cap' }, shape, mat(), () => R)
    const b = new Box3().setFromObject(acc.group)
    expect(b.max.y, shape).toBeGreaterThan(R.head.y + 0.5 * R.head.R)
    expect(b.min.x, shape).toBeLessThan(R.head.cx)
    expect(b.max.x, shape).toBeGreaterThan(R.head.cx)
    acc.liberer()
  })

  it.each(SHAPE_LIST)('%s : l ordinateur du mood travaille est devant le corps, en bas a droite, sous les yeux, et pousse avec son echelle', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    const laptop = (k: number) => ({ k, ground: R.neck, key: shape })
    acc.update({}, shape, mat(), () => R, laptop(1))
    const og = acc.group.children.find((c) => c.name === 'laptop')
    expect(og, shape).toBeDefined()
    expect(og!.visible).toBe(true)
    const b = new Box3().setFromObject(og!)
    // devant le corps, centre, sous les yeux, pose au sol
    expect(b.max.z, shape).toBeGreaterThan((R.A.before(0, R.neck + 0.1 * R.H)?.p.z ?? R.A.box.max.z) + 0.1 * R.hw)
    // en bas a droite de l'image (x positif), sans sortir du cadre
    expect((b.max.x + b.min.x) / 2, shape).toBeGreaterThan(0.25 * R.hw)
    expect(b.max.x, shape).toBeLessThan(1.6 * R.hw)
    expect(b.max.y, shape).toBeLessThan(R.yEyes)
    expect(b.min.y, shape).toBeGreaterThan(R.neck - 0.03 * R.H)
    expect(verticesFinite(acc.group)).toBe(true)
    // a mi-pousse il est plus petit, a zero il disparait
    acc.update({}, shape, mat(), () => R, laptop(0.5))
    expect(og!.scale.x).toBeCloseTo(0.5, 6)
    acc.update({ head: 'cap' }, shape, mat(), () => R, laptop(0))
    expect(acc.group.children.some((c) => c.name === 'laptop' && c.visible)).toBe(false)
    acc.liberer()
  })

  it('l ordinateur se cumule avec les accessoires et ne s poster pas sans le mood', () => {
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

  it.each(SHAPE_LIST)('%s : la calotte couvre le haut du corps (aucune pointe ne depasse)', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ head: 'cap' }, shape, mat(), () => R)
    const b = new Box3().setFromObject(acc.group)
    expect(b.max.y, shape).toBeGreaterThan(R.top)
    acc.liberer()
  })

  it('la casquette et le casque de musique sont au meme emplacement : le second remplace le premier', () => {
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

  it.each(SHAPE_LIST)('%s : les branches des lunettes restent dans la boite du corps', (shape) => {
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

  it('les bretelles du sac ne passent pas par le devant du corps', () => {
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


describe('accessoires v4 : simples, une ou deux couleurs, personnalisables (Robin, 05/11/2026)', () => {
  const hexMat = (m: Mesh) => (m.material as unknown as { color: { getHexString(): string } }).color.getHexString()
  /** couleurs des pieces opaques (le verre translucide d'une lunette n'est pas une couleur de l'accessoire) */
  const colorsOpaque = (o: Object3D) =>
    new Set(meshes(o).filter((m) => (m.material as unknown as { opacity: number }).opacity >= 1).map(hexMat))

  it.each(ACCESSORIES.map((a) => [a.slot, a.id] as const))('%s:%s a au plus deux couleurs, sur une forme ronde et sur une etoile', (e, id) => {
    for (const shape of ['circle', 'star']) {
      const { R } = bodyOf(shape)
      const acc = new Accessories3d()
      acc.update({ [e]: id } as AccessorySelection, shape, mat(), () => R)
      expect(colorsOpaque(acc.group).size, `${shape} ${e}:${id}`).toBeLessThanOrEqual(2)
      acc.liberer()
    }
  })

  it.each(ACCESSORIES.map((a) => [a.slot, a.id, a.c1, a.c2] as const))('%s:%s se personnalise : c1 et c2 imposes se retrouvent sur les pieces', (e, id, d1, d2) => {
    const { R } = bodyOf('circle')
    const acc = new Accessories3d()
    acc.update({ [e]: { id, c1: '#123456', c2: '#654321' } } as AccessorySelection, 'p', mat(), () => R)
    const cs = [...colorsOpaque(acc.group)]
    expect(cs).toContain('123456')
    // aucune couleur du catalogue ne reste quand c1 est impose (sauf c2 impose)
    for (const c of cs) expect(['123456', '654321']).toContain(c)
    expect(d1).toMatch(/^#/)
    expect(d2).toMatch(/^#/)
    acc.liberer()
  })

  it('une couleur par defaut sobre : papillon noir, cape rouge, c2 = c1 quand une seule couleur', () => {
    expect(resolveAccessories('neck', 'bowtie')!.c1).toBe(ACCESSORY_PALETTE.black)
    expect(resolveAccessories('back', 'cape')!.c1).toBe(ACCESSORY_PALETTE.red)
    for (const id of ['bowtie', 'scarf']) {
      const d = resolveAccessories('neck', id)!
      expect(d.c2, id).toBe(d.c1)
    }
  })

  it.each(SHAPE_LIST)('%s : le noeud papillon est tout en bas du corps, noir, une couleur', (shape) => {
    const { R } = bodyOf(shape)
    const acc = new Accessories3d()
    acc.update({ neck: 'bowtie' }, shape, mat(), () => R)
    expect(colorsOpaque(acc.group).size).toBe(1)
    const b = new Box3().setFromObject(acc.group)
    // centre dans le tiers bas du corps, nettement sous la hauteur du cou d'avant
    expect((b.min.y + b.max.y) / 2).toBeLessThan(R.neck + 0.4 * R.H)
    acc.liberer()
  })

  it('la cape est un seul morceau : un seul maillage, sans col (aucun tube)', () => {
    for (const shape of ['circle', 'egg']) {
      const { R } = bodyOf(shape)
      const acc = new Accessories3d()
      acc.update({ back: 'cape' }, shape, mat(), () => R)
      expect(meshes(acc.group)).toHaveLength(1)
      acc.liberer()
    }
  })

  it("l'echarpe n'a plus de rayures et le collier de fleurs n'a que deux couleurs", () => {
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

describe('contour des accessoires', () => {
  const shells = (o: Object3D) => meshes(o).filter((m) => (m.userData as { shell?: boolean }).shell)
  const pieces = (o: Object3D) => meshes(o).filter((m) => !(m.userData as { shell?: boolean }).shell)

  it('une coque par piece opaque, cachee tant que le contour est coupe', () => {
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

  it('les coques sont des maillages inverses, plus sombres que la piece, aux sommets finis', () => {
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

  it("l'epaisseur est celle du corps et suit sa valeur a chaque image", () => {
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

  it("le trait ne depend pas de l'echelle de la piece : l'ordinateur qui se replie garde le meme trait", () => {
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
    // la piece est a moitie taille : la valeur locale double, le trait a l'ecran reste le meme
    half.forEach((v, i) => expect(v / full[i]!).toBeCloseTo(2, 5))
    acc.liberer()
  })
})

describe('coeur : les chapeaux reposent SUR les deux bosses, sans s enfoncer dans le creux (Robin, 06/11/2026)', () => {
  /** Hauteur du plus haut point du corps sous l'emprise de la coiffe (le dessus des deux bosses). */
  const topOfBumps = (R: Landmarks) => {
    let y = -Infinity
    for (let k = -8; k <= 8; k++) {
      const h = R.A.top((k / 8) * 0.6 * R.hw, R.zc)
      if (h) y = Math.max(y, h.p.y)
    }
    return y
  }
  const HEADWEAR = ['top-hat', 'crown', 'straw', 'beret', 'toque']

  it('le coeur a bien un creux en haut (le milieu est nettement plus bas que les bosses), pas le cercle', () => {
    const c = bodyOf('heart').R
    const m = c.A.top(0, c.zc)!
    expect(c.top - m.p.y).toBeGreaterThan(0.05 * c.H)
    const r = bodyOf('circle').R
    expect(r.top - r.A.top(0, r.zc)!.p.y).toBeLessThan(0.05 * r.H)
  })

  it('l assise est sur le haut des bosses : ni dans le creux, ni en l air', () => {
    const { R } = bodyOf('heart')
    const h = topOfBumps(R)
    expect(R.head.y).toBeGreaterThanOrEqual(h - 0.01 * R.H)
    expect(R.head.y).toBeLessThanOrEqual(h + 0.1 * R.head.R)
    expect(R.head.cx).toBe(0)
    expect(R.head.R).toBeGreaterThan(30)
    expect(R.head.rz).toBeGreaterThan(R.head.R * 0.7 - 1e-6)
  })

  it.each(HEADWEAR)('%s : la coiffe est posee a la hauteur des bosses, pas dans le creux', (id) => {
    const { R } = bodyOf('heart')
    const acc = new Accessories3d()
    acc.update({ head: id } as AccessorySelection, 'heart', mat(), () => R)
    acc.group.updateMatrixWorld(true)
    // le repere de la coiffe : le groupe mis a l'echelle du rayon d'assise
    let origin: Object3D | null = null
    acc.group.traverse((o) => {
      if (!origin && Math.abs(o.scale.x - R.head.R * 1.18) < 1e-3) origin = o
    })
    expect(origin, id).not.toBeNull()
    const h = topOfBumps(R)
    const y = (origin as unknown as Object3D).position.y
    // sa base (un peu sous l'origine) touche le haut des bosses : avant la correction elle etait ~0,17 H plus bas, dans le creux
    expect(y, id).toBeGreaterThanOrEqual(h - 0.08 * R.head.R)
    expect(y, id).toBeLessThanOrEqual(h + 0.05 * R.head.R)
    // et l'ensemble depasse bien du haut du corps
    expect(new Box3().setFromObject(acc.group).max.y, id).toBeGreaterThan(R.top)
    acc.liberer()
  })

  it('casquette, casque, ruban, fleur, antenne : se construisent sur le coeur, sommets finis, au-dessus du creux', () => {
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

  it('les autres formes gardent leur assise (le creux ne change rien au cercle, a l etoile, au nuage)', () => {
    for (const f of ['circle', 'star', 'cloud', 'egg']) {
      const { R } = bodyOf(f)
      expect(R.head.y, f).toBeLessThanOrEqual(R.top)
    }
  })
})

describe('changement de forme du personnalisateur (09/11/2026)', () => {
  const top = (acc: Accessories3d) => new Box3().setFromObject(acc.group).min.y

  it('bug reproduit : meme cle, autre corps -> les pieces restent la ou elles etaient ; invalider() les recale', () => {
    const a = bodyOf('circle').R
    const b = bodyOf('triangle').R
    expect(Math.abs(a.top - b.top)).toBeGreaterThan(1) // les deux corps n'ont pas le meme sommet
    const sel: AccessorySelection = { head: 'cap' }
    const m = mat()
    const acc = new Accessories3d()
    acc.update(sel, 'x|forme', m, () => a)
    const placed = top(acc)
    // la forme change mais la cle ne voit que le nom du style et de la forme, deja pris : rien n'est recalcule
    acc.update(sel, 'x|forme', m, () => b)
    expect(top(acc)).toBeCloseTo(placed, 5)
    // apres invalider(), la pose suit le nouveau corps, comme une construction neuve
    acc.invalidate()
    acc.update(sel, 'x|forme', m, () => b)
    const fresh = new Accessories3d()
    fresh.update(sel, 'x|forme', m, () => b)
    expect(top(acc)).toBeCloseTo(top(fresh), 5)
    expect(Math.abs(top(acc) - placed)).toBeGreaterThan(0.5)
    acc.liberer()
    fresh.liberer()
  })

  it('<mochi-bot> invalide la pose des accessoires apres le morph quand la forme change', () => {
    const src = readFileSync(new URL('../../components/mochi-bot.ts', import.meta.url), 'utf8')
    expect(src).toContain('invaliderAccessoires3d()')
    expect(src).toMatch(/watch\(\s*\(\) => props\.shape/)
    expect(src).toContain('BotEngine.SHAPE_MORPH')
  })
})
