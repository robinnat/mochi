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
  RETIRES,
  type Emplacement,
  type Selection
} from '@/bot/emplacements'
import { Accessoires3d, IDS_IMPLEMENTES } from './accessoires3d'
import { mesurerReperes, type Reperes } from './ancres'
import { champDeRepos, contourDuCorps, gonfler, lireMatrice, profilDe } from './volume'

/**
 * Accessoires par emplacements : le catalogue est complet, chaque accessoire se construit sur les
 * 12 formes (ancrage calcule sur le volume, pas en dur), et tous les emplacements se cumulent.
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
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(28)
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

describe('ancrage sur les 12 formes', () => {
  it('il y a bien 12 formes', () => {
    expect(FORMES).toHaveLength(12)
  })

  it.each(FORMES)('%s : assise de coiffe dans le corps, cou sous les yeux', (forme) => {
    const { R } = corpsDe(forme)
    expect(R.tete.R).toBeGreaterThan(5)
    expect(R.tete.rz).toBeGreaterThan(3)
    // sommet creuse (coeur) : la coiffe repose sur les bosses, a 5 % de son rayon au-dessus du haut
    expect(R.tete.y).toBeLessThanOrEqual(R.haut + 0.05 * R.tete.R + 1e-6)
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
      ['bas:bandana', 'bas:clochette', 'bas:medaille', 'bas:cravate', 'tete:bonnet', 'tete:bob', 'dos:queue', 'yeux:sommeil', 'tete:fete', 'tete:oreilles', 'visage:larme', 'visage:pansement', 'yeux:domino', 'yeux:ski'].sort()
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
    sel.bas = 'echarpe'
    expect(Object.keys(sel)).toEqual(['bas'])
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

  it.each(FORMES)('%s : l ordinateur du mood travaille est devant le corps, en bas a droite, sous les yeux, et pousse avec son echelle', (forme) => {
    const { R } = corpsDe(forme)
    const acc = new Accessoires3d()
    const ordi = (k: number) => ({ k, sol: R.bas, cle: forme })
    acc.maj({}, forme, mat(), () => R, ordi(1))
    const og = acc.groupe.children.find((c) => c.name === 'ordinateur')
    expect(og, forme).toBeDefined()
    expect(og!.visible).toBe(true)
    const b = new Box3().setFromObject(og!)
    // devant le corps, centre, sous les yeux, pose au sol
    expect(b.max.z, forme).toBeGreaterThan((R.A.avant(0, R.bas + 0.1 * R.H)?.p.z ?? R.A.box.max.z) + 0.1 * R.hw)
    // en bas a droite de l'image (x positif), sans sortir du cadre
    expect((b.max.x + b.min.x) / 2, forme).toBeGreaterThan(0.25 * R.hw)
    expect(b.max.x, forme).toBeLessThan(1.6 * R.hw)
    expect(b.max.y, forme).toBeLessThan(R.yYeux)
    expect(b.min.y, forme).toBeGreaterThan(R.bas - 0.03 * R.H)
    expect(sommetsFinis(acc.groupe)).toBe(true)
    // a mi-pousse il est plus petit, a zero il disparait
    acc.maj({}, forme, mat(), () => R, ordi(0.5))
    expect(og!.scale.x).toBeCloseTo(0.5, 6)
    acc.maj({ tete: 'casquette' }, forme, mat(), () => R, ordi(0))
    expect(acc.groupe.children.some((c) => c.name === 'ordinateur' && c.visible)).toBe(false)
    acc.liberer()
  })

  it('l ordinateur se cumule avec les accessoires et ne s affiche pas sans le mood', () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    const m = mat()
    acc.maj({ tete: 'casquette', yeux: 'rondes', bas: 'papillon' }, 'c', m, () => R, { k: 1, sol: R.bas, cle: 'c' })
    const noms = acc.groupe.children.filter((c) => c.visible).map((c) => c.name)
    expect(noms).toContain('ordinateur')
    expect(noms).toContain('tete')
    acc.maj({ tete: 'casquette' }, 'c', m, () => R)
    expect(acc.groupe.children.some((c) => c.name === 'ordinateur' && c.visible)).toBe(false)
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
    for (const id of ['papillon', 'echarpe']) {
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

describe('contour des accessoires', () => {
  const coques = (o: Object3D) => meshes(o).filter((m) => (m.userData as { coque?: boolean }).coque)
  const pieces = (o: Object3D) => meshes(o).filter((m) => !(m.userData as { coque?: boolean }).coque)

  it('une coque par piece opaque, cachee tant que le contour est coupe', () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    acc.maj({ tete: 'haut-de-forme' }, 'c0', mat(), () => R)
    acc.contour(false, 4)
    expect(coques(acc.groupe)).toHaveLength(0)
    acc.contour(true, 4)
    expect(coques(acc.groupe).length).toBe(pieces(acc.groupe).length)
    expect(coques(acc.groupe).every((c) => c.visible)).toBe(true)
    acc.contour(false, 4)
    expect(coques(acc.groupe).every((c) => !c.visible)).toBe(true)
    acc.liberer()
  })

  it('les coques sont des maillages inverses, plus sombres que la piece, aux sommets finis', () => {
    const { R } = corpsDe('etoile')
    const acc = new Accessoires3d()
    acc.maj({ tete: 'casquette', yeux: 'rondes', bas: 'papillon' }, 'c1', mat(), () => R)
    acc.contour(true, 3)
    const cs = coques(acc.groupe)
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
    expect(sommetsFinis(acc.groupe)).toBe(true)
    acc.liberer()
  })

  it("l'epaisseur est celle du corps et suit sa valeur a chaque image", () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    acc.maj({ tete: 'haut-de-forme' }, 'c2', mat(), () => R)
    acc.contour(true, 2)
    const ep = () => coques(acc.groupe).map((c) => (c.userData as { ep: { value: number } }).ep.value)
    const fin = ep()
    acc.contour(true, 6)
    const epais = ep()
    fin.forEach((v, i) => expect(epais[i]! / v).toBeCloseTo(3, 5))
    expect(Math.min(...fin)).toBeGreaterThan(0)
    acc.liberer()
  })

  it("le trait ne depend pas de l'echelle de la piece : l'ordinateur qui se replie garde le meme trait", () => {
    const { R } = corpsDe('cercle')
    const acc = new Accessoires3d()
    const ordi = (k: number) => ({ k, sol: R.bas, cle: 'ordi-cercle' })
    acc.maj({}, 'c3', mat(), () => R, ordi(1))
    acc.contour(true, 4)
    const plein = coques(acc.groupe).map((c) => (c.userData as { ep: { value: number } }).ep.value)
    expect(plein.length).toBeGreaterThan(0)
    acc.maj({}, 'c3', mat(), () => R, ordi(0.5))
    acc.contour(true, 4)
    const demi = coques(acc.groupe).map((c) => (c.userData as { ep: { value: number } }).ep.value)
    // la piece est a moitie taille : la valeur locale double, le trait a l'ecran reste le meme
    demi.forEach((v, i) => expect(v / plein[i]!).toBeCloseTo(2, 5))
    acc.liberer()
  })
})

describe('coeur : les chapeaux reposent SUR les deux bosses, sans s enfoncer dans le creux (Robin, 06/11/2026)', () => {
  /** Hauteur du plus haut point du corps sous l'emprise de la coiffe (le dessus des deux bosses). */
  const hautDesBosses = (R: Reperes) => {
    let y = -Infinity
    for (let k = -8; k <= 8; k++) {
      const h = R.A.dessus((k / 8) * 0.6 * R.hw, R.zc)
      if (h) y = Math.max(y, h.p.y)
    }
    return y
  }
  const COIFFES = ['haut-de-forme', 'couronne', 'paille', 'beret', 'toque']

  it('le coeur a bien un creux en haut (le milieu est nettement plus bas que les bosses), pas le cercle', () => {
    const c = corpsDe('coeur').R
    const m = c.A.dessus(0, c.zc)!
    expect(c.haut - m.p.y).toBeGreaterThan(0.05 * c.H)
    const r = corpsDe('cercle').R
    expect(r.haut - r.A.dessus(0, r.zc)!.p.y).toBeLessThan(0.05 * r.H)
  })

  it('l assise est sur le haut des bosses : ni dans le creux, ni en l air', () => {
    const { R } = corpsDe('coeur')
    const h = hautDesBosses(R)
    expect(R.tete.y).toBeGreaterThanOrEqual(h - 0.01 * R.H)
    expect(R.tete.y).toBeLessThanOrEqual(h + 0.1 * R.tete.R)
    expect(R.tete.cx).toBe(0)
    expect(R.tete.R).toBeGreaterThan(30)
    expect(R.tete.rz).toBeGreaterThan(R.tete.R * 0.7 - 1e-6)
  })

  it.each(COIFFES)('%s : la coiffe est posee a la hauteur des bosses, pas dans le creux', (id) => {
    const { R } = corpsDe('coeur')
    const acc = new Accessoires3d()
    acc.maj({ tete: id } as Selection, 'coeur', mat(), () => R)
    acc.groupe.updateMatrixWorld(true)
    // le repere de la coiffe : le groupe mis a l'echelle du rayon d'assise
    let origine: Object3D | null = null
    acc.groupe.traverse((o) => {
      if (!origine && Math.abs(o.scale.x - R.tete.R * 1.18) < 1e-3) origine = o
    })
    expect(origine, id).not.toBeNull()
    const h = hautDesBosses(R)
    const y = (origine as unknown as Object3D).position.y
    // sa base (un peu sous l'origine) touche le haut des bosses : avant la correction elle etait ~0,17 H plus bas, dans le creux
    expect(y, id).toBeGreaterThanOrEqual(h - 0.08 * R.tete.R)
    expect(y, id).toBeLessThanOrEqual(h + 0.05 * R.tete.R)
    // et l'ensemble depasse bien du haut du corps
    expect(new Box3().setFromObject(acc.groupe).max.y, id).toBeGreaterThan(R.haut)
    acc.liberer()
  })

  it('casquette, casque, ruban, fleur, antenne : se construisent sur le coeur, sommets finis, au-dessus du creux', () => {
    const { R } = corpsDe('coeur')
    for (const id of ['casquette', 'casque', 'ruban', 'fleur', 'antenne']) {
      const acc = new Accessoires3d()
      acc.maj({ tete: id } as Selection, 'coeur', mat(), () => R)
      expect(sommetsFinis(acc.groupe), id).toBe(true)
      const box = new Box3().setFromObject(acc.groupe)
      expect(box.max.y, id).toBeGreaterThan(R.haut - 0.02 * R.H)
      acc.liberer()
    }
  })

  it('les autres formes gardent leur assise (le creux ne change rien au cercle, a l etoile, au nuage)', () => {
    for (const f of ['cercle', 'etoile', 'nuage', 'oeuf']) {
      const { R } = corpsDe(f)
      expect(R.tete.y, f).toBeLessThanOrEqual(R.haut)
    }
  })
})
