import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as three from './three'

const root = new URL('../../../', import.meta.url).pathname
const read = (f: string) => readFileSync(join(root, f), 'utf8')

function files(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((n) => {
    const p = join(dir, n)
    return statSync(join(root, p)).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []
  })
}

/** v13: Three.js enters through `src/ui/3d/three.ts` only (tree-shaken classes, one copy of each). */
describe('Three.js entry', () => {
  it('no source file imports the prebuilt `three` package directly', () => {
    const offenders = files('src').filter((f) => !f.startsWith(join('src', 'ui', '3d', 'three.')) && /from 'three'/.test(read(f)))
    expect(offenders).toEqual([])
  })

  it("every build points 'three' at the single entry (the add-ons import 'three')", () => {
    for (const f of ['vite.config.ts', 'vite.lib.config.ts', 'vitest.config.ts']) {
      expect(read(f), f).toContain("{ find: /^three$/, replacement: fileURLToPath(new URL('./src/ui/3d/three.ts', import.meta.url)) }")
    }
  })

  it('the entry gives real classes, and the add-on sees the same ones', async () => {
    expect(typeof three.WebGLRenderer).toBe('function')
    expect(typeof three.MeshStandardMaterial).toBe('function')
    const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js')
    const g = new three.BufferGeometry()
    g.setAttribute('position', new three.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
    // same class on both sides: `mergeGeometries` builds its result with the BufferGeometry it imports
    expect(mergeGeometries([g])).toBeInstanceOf(three.BufferGeometry)
  })
})
