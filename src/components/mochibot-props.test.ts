// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import MochiBot from './MochiBot.vue'

/** Les options de rendu 3D exposees par le composant (la section 3D du site et le dashboard s'appuient dessus). */
describe('MochiBot : options de rendu 3D', () => {
  const props = (MochiBot as unknown as { props: Record<string, { default?: unknown }> }).props
  it('ombre au sol, contour cartoon, reflet et theme sont des props', () => {
    for (const nom of ['ombre', 'ombrage', 'contour', 'epaisseurContour', 'reflet', 'theme', 'accessoires', 'ordinateur', 'mood']) expect(props, nom).toHaveProperty(nom)
  })
  it("l'ombre est active par defaut (le rendu d'avant ne change pas)", () => {
    expect(props.ombre!.default).toBe(true)
    expect(props.ombrage!.default).toBe(true)
  })
})
