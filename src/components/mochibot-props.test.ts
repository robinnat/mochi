import { describe, expect, it } from 'vitest'
import { PROPERTIES } from './mochi-bot'

const initial = (name: string) => PROPERTIES.find((p) => p.name === name)!.initial()

/**
 * The 3D rendering options exposed by the component (the site's 3D section and the dashboard rely on them).
 */
describe('<mochi-bot>: 3D rendering options', () => {
  it('ground shadow, cartoon outline, highlight and theme are options', () => {
    const names = PROPERTIES.map((p) => p.name)
    for (const name of ['shadow', 'shading', 'outline', 'outlineWidth', 'highlight', 'theme', 'accessories', 'laptop', 'mood']) expect(names, name).toContain(name)
  })
  it("the shadow is on by default (the previous rendering does not change)", () => {
    expect(initial('shadow')).toBe(true)
    expect(initial('shading')).toBe(true)
  })
})

describe('<mochi-bot> : chargement sans repli visible (v11)', () => {
  it('maxPixelRatio caps the canvas density (2 by default)', () => {
    expect(initial('maxPixelRatio')).toBe(2)
  })
  it('each option has a unique name, and the default cycle is new each time', () => {
    expect(new Set(PROPERTIES.map((p) => p.name)).size).toBe(PROPERTIES.length)
    expect(initial('cycle')).not.toBe(initial('cycle'))
  })
})
