import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { zSommeil } from './gestes'
import { DEMI_VIEWBOX } from './repere'

describe('les « z » de l humeur dort', () => {
  it('montent, restent dans le cadre et s effacent', () => {
    for (let t = 0; t < 7; t += 0.25) {
      for (const z of zSommeil(t)) {
        // en rayons : x 100 = bord du corps ; le trait doit rester dans le viewBox
        expect(Math.abs(z.x * 100) + (z.taille * 100) / 2 + 5).toBeLessThan(DEMI_VIEWBOX)
        expect(Math.abs(z.y * 100) + (z.taille * 100) / 2 + 5).toBeLessThan(DEMI_VIEWBOX)
        expect(z.opacite).toBeGreaterThanOrEqual(0)
        expect(z.opacite).toBeLessThanOrEqual(0.8)
      }
    }
    const y0 = zSommeil(0.1)[0]!.y
    expect(zSommeil(0.9)[0]!.y).toBeLessThan(y0) // ils montent (y vers le bas)
  })

  it('<mochi-bot> les dessine par-dessus tous les rendus quand l humeur est dort, une image fixe en mouvement reduit', () => {
    const src = readFileSync(new URL('../components/mochi-bot.ts', import.meta.url), 'utf8')
    expect(src).toContain("'data-zzz': '1'")
    expect(src).toContain("moodDe(props.mood) !== 'dort'")
    expect(src).toMatch(/reduit\.value \|\| props\.frozenAt !== undefined \? 1\.2/)
  })
})
