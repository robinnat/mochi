import { describe, expect, it } from 'vitest'
import { PROPERTIES } from './mochi-bot'

const initial = (name: string) => PROPERTIES.find((p) => p.name === name)!.initial()

/** Les options de rendu 3D exposees par le composant (la section 3D du site et le tableau de bord s'appuient dessus). */
describe('<mochi-bot> : options de rendu 3D', () => {
  it('ombre au sol, contour cartoon, reflet et theme sont des options', () => {
    const names = PROPERTIES.map((p) => p.name)
    for (const name of ['shadow', 'shading', 'outline', 'outlineWidth', 'highlight', 'theme', 'accessories', 'laptop', 'mood']) expect(names, name).toContain(name)
  })
  it("l'ombre est active par defaut (le rendu d'avant ne change pas)", () => {
    expect(initial('shadow')).toBe(true)
    expect(initial('shading')).toBe(true)
  })
})

describe('<mochi-bot> : chargement sans repli visible (v11)', () => {
  it('maxPixelRatio plafonne la densite du canvas (2 par defaut)', () => {
    expect(initial('maxPixelRatio')).toBe(2)
  })
  it('chaque option a un nom unique, et le cycle par defaut est neuf a chaque fois', () => {
    expect(new Set(PROPERTIES.map((p) => p.name)).size).toBe(PROPERTIES.length)
    expect(initial('cycle')).not.toBe(initial('cycle'))
  })
})
