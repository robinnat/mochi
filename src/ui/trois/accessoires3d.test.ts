import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Box3, MeshStandardMaterial, Vector3, type Mesh, type Object3D } from 'three'
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
  RETIRES,
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
    for (const e of EMPLACEMENTS) expect(parEmplacement(e).length).toBeGreaterThanOrEqual(4)
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
  const tout: Selection = { tete: 'haut-de-forme', yeux: 'soleil', visage: 'joues', bas: 'papillon', dos: 'ailes' }

  it.each(FORMES)('%s : les cinq emplacements ensemble, sans erreur', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj(tout, forme, mat(), () => R)
    expect(acc.groupe.children.map((c) => c.name)).toEqual(EMPLACEMENTS)
    for (const g of acc.groupe.children) {
      expect(meshes(g).length).toBeGreaterThan(0)
      expect(sommetsFinis(g)).toBe(true)
    }
    expect(acc.couleurs.length).toBeGreaterThanOrEqual(3)
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
      acc.maj({ tete: 'haut-de-forme', bas: 'papillon' } as Selection, forme, mat(), () => R)
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
    acc.maj({ tete: 'casquette' }, 'k', m, f)
    acc.maj({ tete: 'casquette' }, 'k', m, f)
    expect(n).toBe(1)
    acc.maj({ tete: 'haut-de-forme' }, 'k', m, f)
    expect(n).toBe(2)
    acc.liberer()
  })
})

describe('liste des emplacements', () => {
  it('cinq emplacements dans un ordre stable', () => {
    expect(EMPLACEMENTS).toEqual(['tete', 'yeux', 'visage', 'bas', 'dos'] as Emplacement[])
  })
})

describe('retours de Robin du 05/11/2026', () => {
  it('les accessoires retires ne sont plus au catalogue ni resolus, mais restent listes dans RETIRES', () => {
    expect(RETIRES.map((r) => `${r.emplacement}:${r.id}`).sort()).toEqual(
      ['bas:bandana', 'bas:clochette', 'bas:medaille', 'tete:bonnet', 'tete:bob', 'dos:queue', 'yeux:sommeil', 'tete:fete', 'tete:oreilles', 'visage:larme', 'visage:pansement', 'yeux:domino', 'yeux:ski'].sort()
    )
    for (const r of RETIRES) {
      expect(CATALOGUE.some((a) => a.emplacement === r.emplacement && a.id === r.id)).toBe(false)
      expect(resoudre(r.emplacement, r.id)).toBeNull()
    }
  })

  it('le collier de perles ne porte plus de pendentif : que des spheres identiques', () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    acc.maj({ bas: 'perles' }, 'p', mat(), () => R)
    const rayons = new Set(meshes(acc.groupe).map((m) => m.geometry.uuid))
    expect(rayons.size).toBe(1)
    acc.liberer()
  })

  it.each(FORMES)('%s : le casque de musique a un arceau au-dessus de la tete et deux coques sur les flancs, enfoncees dans le corps', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj({ tete: 'casque' }, forme, mat(), () => R)
    const b = new Box3().setFromObject(acc.groupe)
    expect(sommetsFinis(acc.groupe)).toBe(true)
    // l'arceau passe au-dessus de l'oeil, jusqu'au haut du corps
    expect(b.max.y).toBeGreaterThan(R.yYeux + 0.3 * R.H)
    // les coques depassent a gauche et a droite de la largeur du corps a hauteur des yeux
    const g = R.A.cote(R.yYeux, R.zc, -1)!
    const d = R.A.cote(R.yYeux, R.zc, 1)!
    expect(b.min.x).toBeLessThan(g.p.x)
    expect(b.max.x).toBeGreaterThan(d.p.x)
    // symetrique : autant a gauche qu'a droite, a peu pres
    expect(Math.abs(b.min.x + b.max.x)).toBeLessThan(0.25 * R.hw)
    // une coque rentre dans le corps (comme les lunettes) : son extremite interieure est en dedans du bord
    expect(b.min.x).toBeLessThan(g.p.x - 1)
    acc.liberer()
  })

  it('le casque occupe l emplacement tete : il ne se cumule pas avec un chapeau (documente), mais avec tous les autres', () => {
    const { R } = corpsDe('squircle')
    const acc = new Accessoires3d()
    acc.maj({ tete: 'casque', yeux: 'soleil', visage: 'chat', bas: 'echarpe', dos: 'sac' }, 'x', mat(), () => R)
    expect(acc.groupe.children.map((c) => c.name)).toEqual(EMPLACEMENTS)
    for (const g of acc.groupe.children) expect(sommetsFinis(g)).toBe(true)
    acc.liberer()
  })

  it.each(FORMES)('%s : la cravate est une piece droite, symetrique, ancree en haut, qui ne traverse pas le corps', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj({ bas: 'cravate' }, forme, mat(), () => R)
    expect(meshes(acc.groupe).length).toBe(2)
    const b = new Box3().setFromObject(acc.groupe)
    // symetrique : centree sur l'axe du corps
    expect(Math.abs(b.max.x + b.min.x), forme).toBeLessThan(0.03 * R.hw)
    // taille : lame ~ 1/4 du corps, longueur 30 a 46 % de la hauteur
    expect((b.max.x - b.min.x) / (2 * R.hw), forme).toBeGreaterThan(0.18)
    expect((b.max.x - b.min.x) / (2 * R.hw), forme).toBeLessThan(0.34)
    expect((b.max.y - b.min.y) / R.H, forme).toBeGreaterThan(0.17)
    expect((b.max.y - b.min.y) / R.H, forme).toBeLessThan(0.55)
    // un vrai espace sous les yeux, et la pointe reste au-dessus du bas du corps
    expect(b.max.y, forme).toBeLessThan(R.yYeux - 1.0 * R.rVerre)
    expect(b.min.y, forme).toBeGreaterThan(R.bas - 0.08 * R.H)
    // ne traverse pas le corps : sous le haut (ancre), tout reste en avant de la surface (a un petit enfoncement pres)
    let ancre = false
    for (const m of meshes(acc.groupe)) {
      m.updateWorldMatrix(true, false)
      const P = m.geometry.attributes.position!
      for (let i = 0; i < P.count; i += 2) {
        const w = new Vector3(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(m.matrixWorld)
        const h = R.A.avant(w.x, w.y)
        if (!h) continue
        if (w.y > b.max.y - 0.2 * (b.max.y - b.min.y)) {
          if (w.z < h.p.z) ancre = true
        } else expect(w.z - h.p.z, forme).toBeGreaterThan(-0.14 * R.hw)
      }
    }
    expect(ancre, forme).toBe(true)
    acc.liberer()
  })

  it('les bretelles du sac suivent le corps : tous leurs sommets sont a la surface ou juste au-dessus (pas de vol libre)', () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    acc.maj({ dos: 'sac' }, 's', mat(), () => R)
    const tubes = meshes(acc.groupe).filter((m) => m.geometry.type === 'TubeGeometry')
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
  it.each(FORMES)('%s : le noeud papillon est symetrique, pose devant le cou, deux ailes et un noeud', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj({ bas: 'papillon' }, forme, mat(), () => R)
    const ms = meshes(acc.groupe)
    expect(ms).toHaveLength(3)
    const b = new Box3().setFromObject(acc.groupe)
    expect(sommetsFinis(acc.groupe)).toBe(true)
    expect(Math.abs(b.min.x + b.max.x)).toBeLessThan(0.15 * R.hw)
    expect(b.max.x - b.min.x).toBeGreaterThan(0.6 * R.hw)
    // devant le corps a la hauteur du noeud (tout en bas depuis la v4)
    expect(b.max.z).toBeGreaterThan(R.A.avant(0, (b.min.y + b.max.y) / 2)!.p.z)
    acc.liberer()
  })

  it('la cape est rouge unie : une seule couleur, aucune piece jaune', () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    acc.maj({ dos: 'cape' }, 'c', mat(), () => R)
    const couleurs = new Set(meshes(acc.groupe).map((m) => ((m.material as unknown as { color: { getHexString(): string } }).color.getHexString())))
    expect(couleurs.size).toBe(1)
    expect(resoudre('dos', 'cape')!.c1).toBe(resoudre('dos', 'cape')!.c2)
    acc.liberer()
  })

  it('la queue et le masque de sommeil sont retires du catalogue (code garde)', () => {
    expect(resoudre('dos', 'queue')).toBeNull()
    expect(resoudre('yeux', 'sommeil')).toBeNull()
    expect(RETIRES.some((r) => r.id === 'queue')).toBe(true)
    expect(RETIRES.some((r) => r.id === 'sommeil')).toBe(true)
  })

  it('la moustache est dans le meme emplacement que la cravate, le noeud papillon, l echarpe et les colliers', () => {
    expect(resoudre('bas', 'moustache')).not.toBeNull()
    expect(resoudre('visage', 'moustache')).toBeNull()
    const sel: Selection = { bas: 'moustache' }
    sel.bas = 'cravate'
    expect(Object.keys(sel)).toEqual(['bas'])
  })

  it.each(FORMES)('%s : la pointe de la cravate ne descend pas sous le bas du corps', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj({ bas: 'cravate' }, forme, mat(), () => R)
    const b = new Box3().setFromObject(acc.groupe)
    expect(b.min.y, forme).toBeGreaterThan(R.bas - 0.08 * R.H)
    acc.liberer()
  })

  it.each(FORMES)('%s : le noeud papillon est petit (au plus 45 pour cent du corps) et ne depasse que peu sous la silhouette', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj({ bas: 'papillon' }, forme, mat(), () => R)
    const b = new Box3().setFromObject(acc.groupe)
    expect(b.max.x - b.min.x, forme).toBeLessThan(0.45 * 2 * R.hw)
    expect(b.min.y, forme).toBeGreaterThan(R.bas - 0.12 * R.H)
    acc.liberer()
  })

  it.each(FORMES)('%s : la casquette a une visiere qui depasse nettement vers l avant', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj({ tete: 'casquette' }, forme, mat(), () => R)
    const b = new Box3().setFromObject(acc.groupe)
    expect(b.max.z, forme).toBeGreaterThan(R.A.box.max.z + 0.1 * R.hw)
    expect(sommetsFinis(acc.groupe)).toBe(true)
    acc.liberer()
  })

  it.each(FORMES)('%s : la calotte de la casquette est un dome rond qui depasse de l assise', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj({ tete: 'casquette' }, forme, mat(), () => R)
    const b = new Box3().setFromObject(acc.groupe)
    expect(b.max.y, forme).toBeGreaterThan(R.tete.y + 0.5 * R.tete.R)
    expect(b.min.x, forme).toBeLessThan(R.tete.cx)
    expect(b.max.x, forme).toBeGreaterThan(R.tete.cx)
    acc.liberer()
  })

  it.each(FORMES)('%s : la calotte couvre le haut du corps (aucune pointe ne depasse)', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj({ tete: 'casquette' }, forme, mat(), () => R)
    const b = new Box3().setFromObject(acc.groupe)
    expect(b.max.y, forme).toBeGreaterThan(R.haut)
    acc.liberer()
  })

  it('la casquette et le casque de musique sont au meme emplacement : le second remplace le premier', () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    acc.maj({ tete: 'casque' }, 'x', mat(), () => R)
    const n1 = meshes(acc.groupe).length
    acc.maj({ tete: 'casquette' }, 'x', mat(), () => R)
    const n2 = meshes(acc.groupe).length
    expect(n2).not.toBe(0)
    expect(n2).not.toBe(n1 + n2)
    acc.liberer()
  })

  it.each(FORMES)('%s : les branches des lunettes restent dans la boite du corps', (forme) => {
    const { R } = corpsDe(forme)
    for (const id of ['rondes', 'carrees', 'soleil', 'coeur', 'etoile']) {
      const acc = new Accessoires3d()
      acc.maj({ yeux: id }, forme, mat(), () => R)
      for (const t of meshes(acc.groupe).filter((m) => m.geometry.type === 'TubeGeometry')) {
        const P = t.geometry.attributes.position!
        let xmax = -Infinity
        for (let i = 0; i < P.count; i++) xmax = Math.max(xmax, Math.abs(P.getX(i)))
        expect(xmax, `${forme} ${id}`).toBeLessThan(R.A.box.max.x + 0.05 * R.hw)
      }
      acc.liberer()
    }
  })

  it.each(FORMES)('%s : le noeud de la cravate est clairement sous les yeux', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj({ bas: 'cravate' }, forme, mat(), () => R)
    const b = new Box3().setFromObject(acc.groupe)
    expect(b.max.y).toBeLessThan(R.yYeux - 0.5 * R.rVerre)
    acc.liberer()
  })

  it('les bretelles du sac ne passent pas par le devant du corps', () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    acc.maj({ dos: 'sac' }, 's', mat(), () => R)
    for (const t of meshes(acc.groupe).filter((m) => m.geometry.type === 'TubeGeometry')) {
      const P = t.geometry.attributes.position!
      for (let i = 0; i < P.count; i++) expect(P.getZ(i)).toBeLessThan(R.zc + 0.45 * R.hw)
    }
    acc.liberer()
  })
})


describe('accessoires v4 : simples, une ou deux couleurs, personnalisables (Robin, 05/11/2026)', () => {
  const hexMat = (m: Mesh) => (m.material as unknown as { color: { getHexString(): string } }).color.getHexString()
  /** couleurs des pieces opaques (le verre translucide d'une lunette n'est pas une couleur de l'accessoire) */
  const couleursOpaques = (o: Object3D) =>
    new Set(meshes(o).filter((m) => (m.material as unknown as { opacity: number }).opacity >= 1).map(hexMat))

  it.each(CATALOGUE.map((a) => [a.emplacement, a.id] as const))('%s:%s a au plus deux couleurs, sur une forme ronde et sur une etoile', (e, id) => {
    for (const forme of ['cercle', 'etoile']) {
      const { R } = corpsDe(forme)
      const acc = new Accessoires3d()
      acc.maj({ [e]: id } as Selection, forme, mat(), () => R)
      expect(couleursOpaques(acc.groupe).size, `${forme} ${e}:${id}`).toBeLessThanOrEqual(2)
      acc.liberer()
    }
  })

  it.each(CATALOGUE.map((a) => [a.emplacement, a.id, a.c1, a.c2] as const))('%s:%s se personnalise : c1 et c2 imposes se retrouvent sur les pieces', (e, id, d1, d2) => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    acc.maj({ [e]: { id, c1: '#123456', c2: '#654321' } } as Selection, 'p', mat(), () => R)
    const cs = [...couleursOpaques(acc.groupe)]
    expect(cs).toContain('123456')
    // aucune couleur du catalogue ne reste quand c1 est impose (sauf c2 impose)
    for (const c of cs) expect(['123456', '654321']).toContain(c)
    expect(d1).toMatch(/^#/)
    expect(d2).toMatch(/^#/)
    acc.liberer()
  })

  it('une couleur par defaut sobre : papillon noir, cape rouge, c2 = c1 quand une seule couleur', () => {
    expect(resoudre('bas', 'papillon')!.c1).toBe(COULEURS.noir)
    expect(resoudre('dos', 'cape')!.c1).toBe(COULEURS.rouge)
    for (const id of ['papillon', 'cravate', 'echarpe']) {
      const d = resoudre('bas', id)!
      expect(d.c2, id).toBe(d.c1)
    }
  })

  it.each(FORMES)('%s : le noeud papillon est tout en bas du corps, noir, une couleur', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    acc.maj({ bas: 'papillon' }, forme, mat(), () => R)
    expect(couleursOpaques(acc.groupe).size).toBe(1)
    const b = new Box3().setFromObject(acc.groupe)
    // centre dans le tiers bas du corps, nettement sous la hauteur du cou d'avant
    expect((b.min.y + b.max.y) / 2).toBeLessThan(R.bas + 0.4 * R.H)
    acc.liberer()
  })

  it('la cape est un seul morceau : un seul maillage, sans col (aucun tube)', () => {
    for (const forme of ['cercle', 'oeuf']) {
      const { R } = corpsDe(forme)
      const acc = new Accessoires3d()
      acc.maj({ dos: 'cape' }, forme, mat(), () => R)
      expect(meshes(acc.groupe)).toHaveLength(1)
      acc.liberer()
    }
  })

  it('la cravate est une seule couleur, sans rayures : un pan et un noeud', () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    acc.maj({ bas: 'cravate' }, 'c', mat(), () => R)
    expect(meshes(acc.groupe)).toHaveLength(2)
    expect(couleursOpaques(acc.groupe).size).toBe(1)
    acc.liberer()
  })

  it("l'echarpe n'a plus de rayures et le collier de fleurs n'a que deux couleurs", () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    acc.maj({ bas: 'echarpe' }, 'e', mat(), () => R)
    expect(couleursOpaques(acc.groupe).size).toBe(1)
    acc.liberer()
    acc.maj({ bas: 'fleurs' }, 'f', mat(), () => R)
    expect(couleursOpaques(acc.groupe).size).toBe(2)
    acc.liberer()
  })
})
