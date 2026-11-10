import { describe, expect, it } from 'vitest'
import { PROPRIETES } from './mochi-bot'

const defaut = (nom: string) => PROPRIETES.find((p) => p.nom === nom)!.defaut()

/** Les options de rendu 3D exposees par le composant (la section 3D du site et le tableau de bord s'appuient dessus). */
describe('<mochi-bot> : options de rendu 3D', () => {
  it('ombre au sol, contour cartoon, reflet et theme sont des options', () => {
    const noms = PROPRIETES.map((p) => p.nom)
    for (const nom of ['ombre', 'ombrage', 'contour', 'epaisseurContour', 'reflet', 'theme', 'accessoires', 'ordinateur', 'mood']) expect(noms, nom).toContain(nom)
  })
  it("l'ombre est active par defaut (le rendu d'avant ne change pas)", () => {
    expect(defaut('ombre')).toBe(true)
    expect(defaut('ombrage')).toBe(true)
  })
})

describe('<mochi-bot> : chargement sans repli visible (v11)', () => {
  it('maxPixelRatio plafonne la densite du canvas (2 par defaut)', () => {
    expect(defaut('maxPixelRatio')).toBe(2)
  })
  it('chaque option a un nom unique, et le cycle par defaut est neuf a chaque fois', () => {
    expect(new Set(PROPRIETES.map((p) => p.nom)).size).toBe(PROPRIETES.length)
    expect(defaut('cycle')).not.toBe(defaut('cycle'))
  })
})
