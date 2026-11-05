import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Box3, MeshStandardMaterial, type Mesh, type Object3D } from 'three'
import { BotEngine } from '@/bot/engine'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { SHAPES } from '@/bot/skins'
import { rayonVerre, yeuxDe } from '@/bot/portes'
import {
  CATALOGUE,
  COULEURS,
  EMPLACEMENTS,
  couleursDe,
  parEmplacement,
  resoudre,
  type Emplacement,
  type Selection
} from '@/bot/emplacements'
import { Accessoires3d, IDS_IMPLEMENTES } from './accessoires3d'
import { mesurerReperes, type Reperes } from './ancres'
import { champDeRepos, contourDuCorps, gonfler, lireMatrice, profilDe } from './volume'

/**
 * Accessoires par emplacements : le catalogue est complet, chaque accessoire se construit sur les
 * 11 formes (ancrage calcule sur le volume, pas en dur), et tous les emplacements se cumulent.
 */

/** Le volume 3D d'une forme, comme `Mochi3d` le remplit (y vers le haut), et ses reperes. */
function corps(forme: string): { geo: BufferGeometry; R: Reperes } {
  const frame = new BotEngine(RAYON, 'idle', SHAPES.find((s) => s.id === forme)!.radii, null).sample(0.5)
  const profil = profilDe(forme)
  if (profil.coussin) champDeRepos(forme)
  const v = gonfler(contourDuCorps(frame.bodyPath), DEMI_VIEWBOX, undefined, undefined, profil)
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
  const ye = yeuxDe(frame)
  // yeux de la 3D : de face, un peu au-dessus du centre (les memes tailles que celles du moteur)
  const R = mesurerReperes(
    geo,
    ye.map((o, i) => ({ x: (i - 0.5) * 50, y: 12, r: o.r })),
    ye.length === 2 ? Math.min(rayonVerre(ye[0]!, ye[1]!), 25) : 22
  )
  void lireMatrice
  return { geo, R }
}

const FORMES = SHAPES.map((s) => s.id)
const mat = () => new MeshStandardMaterial()

const meshes = (o: Object3D): Mesh[] => {
  const out: Mesh[] = []
  o.traverse((m) => {
    if ((m as Mesh).isMesh) out.push(m as Mesh)
  })
  return out
}

/** Tous les sommets d'un groupe, dans le repere du corps, finis. */
function sommetsFinis(o: Object3D): boolean {
  o.updateMatrixWorld(true)
  for (const m of meshes(o)) {
    const P = m.geometry.attributes.position
    if (!P || P.count === 0) return false
    for (let i = 0; i < P.array.length; i++) if (!Number.isFinite(P.array[i] as number)) return false
  }
  return true
}

const cache = new Map<string, ReturnType<typeof corps>>()
const corpsDe = (f: string) => {
  let c = cache.get(f)
  if (!c) cache.set(f, (c = corps(f)))
  return c
}

describe('catalogue', () => {
  it('au moins 30 accessoires, repartis sur les cinq emplacements', () => {
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(30)
    for (const e of EMPLACEMENTS) expect(parEmplacement(e).length).toBeGreaterThanOrEqual(5)
  })

  it('chaque accessoire a un generateur, des identifiants uniques par emplacement, des couleurs hex et un nom sans tiret cadratin', () => {
    for (const e of EMPLACEMENTS) {
      const ids = parEmplacement(e).map((a) => a.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect([...ids].sort()).toEqual([...IDS_IMPLEMENTES(e)].sort())
    }
    for (const a of CATALOGUE) {
      expect(a.c1).toMatch(/^#[0-9a-f]{6}$/i)
      expect(a.c2).toMatch(/^#[0-9a-f]{6}$/i)
      expect(a.nom).not.toMatch(/[—–]/)
    }
    expect(Object.values(COULEURS).every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true)
  })

  it('resoudre accepte un id ou un id avec couleurs, et refuse un inconnu', () => {
    expect(resoudre('tete', 'casquette')?.nom).toBe('Casquette')
    expect(resoudre('tete', { id: 'casquette', c1: '#112233' })?.c1).toBe('#112233')
    expect(resoudre('tete', 'inconnu')).toBeNull()
    expect(resoudre('yeux', 'casquette')).toBeNull()
    expect(couleursDe({ tete: 'casquette', bas: 'papillon' }).length).toBeGreaterThanOrEqual(2)
  })
})

describe('ancrage sur les 11 formes', () => {
  it('il y a bien 11 formes', () => {
    expect(FORMES).toHaveLength(11)
  })

  it.each(FORMES)('%s : assise de coiffe dans le corps, cou sous les yeux', (forme) => {
    const { R } = corpsDe(forme)
    expect(R.tete.R).toBeGreaterThan(5)
    expect(R.tete.rz).toBeGreaterThan(3)
    expect(R.tete.y).toBeLessThanOrEqual(R.haut)
    expect(R.tete.y).toBeGreaterThan(R.bas + 0.3 * R.H)
    expect(R.yBas).toBeLessThan(R.yYeux)
    expect(R.yBas).toBeGreaterThan(R.bas)
    // l'axe de la coiffe est a peu pres l'axe du corps
    expect(Math.abs(R.tete.cx)).toBeLessThan(0.2 * R.hw)
    // la surface avant se trouve au milieu du corps
    const f = R.A.avant(0, R.yYeux)
    expect(f).not.toBeNull()
    expect(f!.n.z).toBeGreaterThan(0.3)
  })

  it.each(FORMES)('%s : chaque accessoire de chaque emplacement se construit, sans valeur invalide', (forme) => {
    const { R } = corpsDe(forme)
    for (const a of CATALOGUE) {
      const acc = new Accessoires3d()
      acc.maj({ [a.emplacement]: a.id } as Selection, `${forme}|${a.id}`, mat(), () => R)
      expect(acc.groupe.visible).toBe(true)
      const g = acc.groupe.children[0]!
      expect(g.name).toBe(a.emplacement)
      expect(meshes(g).length, `${forme} ${a.id}`).toBeGreaterThan(0)
      expect(sommetsFinis(g), `${forme} ${a.id}`).toBe(true)
      acc.liberer()
    }
  })

  it.each(FORMES)('%s : une coiffe monte au-dessus de son assise, et l assise reste dans le haut du corps', (forme) => {
    const { R } = corpsDe(forme)
    // l'assise : jamais plus bas que 28 % de la hauteur sous le sommet (pas devant les yeux)
    expect(R.tete.y).toBeGreaterThanOrEqual(R.haut - 0.28 * R.H - 1)
    for (const a of parEmplacement('tete')) {
      const acc = new Accessoires3d()
      acc.maj({ tete: a.id }, 'x', mat(), () => R)
      const b = new Box3().setFromObject(acc.groupe)
      // la piece depasse le sommet de l'assise : elle se voit ; ses volumes plongent dans le corps (pas de vide)
      expect(b.max.y, `${forme} ${a.id}`).toBeGreaterThan(R.tete.y)
      expect(b.min.y, `${forme} ${a.id}`).toBeLessThan(R.haut)
      acc.liberer()
    }
  })
})

describe('combinaison des emplacements', () => {
  const tout: Selection = { tete: 'haut-de-forme', yeux: 'soleil', visage: 'moustache', bas: 'papillon', dos: 'ailes' }

  it.each(FORMES)('%s : les cinq emplacements ensemble, sans erreur', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj(tout, forme, mat(), () => R)
    expect(acc.groupe.children.map((c) => c.name)).toEqual(EMPLACEMENTS)
    for (const g of acc.groupe.children) {
      expect(meshes(g).length).toBeGreaterThan(0)
      expect(sommetsFinis(g)).toBe(true)
    }
    expect(acc.couleurs.length).toBeGreaterThan(3)
    // chaque emplacement ne produit qu'un groupe : un seul accessoire par emplacement
    expect(new Set(acc.groupe.children.map((c) => c.name)).size).toBe(5)
    acc.liberer()
  })

  it('toutes les paires (tete, yeux, visage, bas) du catalogue se construisent sur une forme sans erreur', () => {
    const { R } = corpsDe('cercle')
    const sels: Selection[] = []
    const t = parEmplacement('tete')
    const y = parEmplacement('yeux')
    const v = parEmplacement('visage')
    const b = parEmplacement('bas')
    const d = parEmplacement('dos')
    const n = Math.max(t.length, y.length, v.length, b.length, d.length)
    for (let i = 0; i < n; i++) {
      sels.push({ tete: t[i % t.length]!.id, yeux: y[(i + 1) % y.length]!.id, visage: v[(i + 2) % v.length]!.id, bas: b[(i + 3) % b.length]!.id, dos: d[i % d.length]!.id })
    }
    for (const sel of sels) {
      const acc = new Accessoires3d()
      acc.maj(sel, JSON.stringify(sel), mat(), () => R)
      expect(acc.groupe.children).toHaveLength(5)
      for (const g of acc.groupe.children) expect(sommetsFinis(g), JSON.stringify(sel)).toBe(true)
      acc.liberer()
    }
  })

  it('la zone de la tete reste au-dessus de celle du cou : pas de collision entre emplacements du haut et du bas', () => {
    for (const forme of ['cercle', 'squircle', 'nuage', 'oeuf']) {
      const { R } = corpsDe(forme)
      const acc = new Accessoires3d()
      acc.maj({ tete: 'bonnet', bas: 'papillon' } as Selection, forme, mat(), () => R)
      const [tete, bas] = acc.groupe.children as [Object3D, Object3D]
      const bt = new Box3().setFromObject(tete)
      const bb = new Box3().setFromObject(bas)
      expect(bt.min.y, forme).toBeGreaterThan(bb.max.y)
      acc.liberer()
    }
  })

  it("un emplacement vide ou un accessoire inconnu ne produit rien ; le groupe se masque s'il n'y a rien", () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    acc.maj({}, 'a', mat(), () => R)
    expect(acc.groupe.visible).toBe(false)
    acc.maj({ tete: 'inconnu' } as unknown as Selection, 'b', mat(), () => R)
    expect(acc.groupe.children).toHaveLength(0)
    acc.liberer()
  })

  it('le calcul des reperes (couteux) ne se refait pas tant que le corps et la selection sont les memes', () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    let n = 0
    const f = () => (n++, R)
    const m = mat()
    acc.maj({ tete: 'bob' }, 'k', m, f)
    acc.maj({ tete: 'bob' }, 'k', m, f)
    expect(n).toBe(1)
    acc.maj({ tete: 'bonnet' }, 'k', m, f)
    expect(n).toBe(2)
    acc.liberer()
  })
})

describe('liste des emplacements', () => {
  it('cinq emplacements dans un ordre stable', () => {
    expect(EMPLACEMENTS).toEqual(['tete', 'yeux', 'visage', 'bas', 'dos'] as Emplacement[])
  })
})
