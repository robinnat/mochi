import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')
const scene = read('../ui/3d/scene3d.ts')
const acc = read('../ui/3d/accessories3d.ts')

/** Guards of v12 (06/11/2026): what made the 3D slow on iPhone must not come back. */
describe('3D performance (v12)', () => {
  it('the shared WebGL canvas only grows: each avatar renders in a viewport, without setSize every frame', () => {
    expect(scene).toContain('renderer.setViewport(0, 0, pxRender, pxRender)')
    expect(scene).toContain('renderer.setScissorTest(true)')
    expect(scene).not.toMatch(/if \(size !== pxRender\) renderer\.setSize/)
    expect(scene).toMatch(/canvasGl\.width < pxRender/)
  })

  it('accessories are not rebuilt on every breath: their key does not hold the body outline', () => {
    expect(scene).toContain('const keyBody = `${this.renderStyle}|${this.shape}`')
    expect(scene).toContain('this.followBody(bb)')
    expect(acc).toContain('pieces(): Object3D[]')
    expect(acc).toContain('this.version++')
  })

  it('Pixel reads its pixels back on a software canvas (willReadFrequently), not on the visible canvas', () => {
    expect(scene).toContain("getContext('2d', { willReadFrequently: true })")
    expect(scene).toContain('cp.getImageData(0, 0, px, px)')
    expect(scene).not.toContain('c.getImageData(0, 0, px, px)')
  })

  it('the shaders of the three styles are compiled in advance, after the first frame', () => {
    expect(scene).toContain('export function warmUp()')
    expect(read('./ready.ts')).toContain('m.warmUp()')
    expect(read('./Alive.ts')).toContain('warmUpStyles()')
  })

  it('a live Mochi turns with a finger, and vertical scrolling stays with the page', () => {
    const v = read('./Alive.ts')
    expect(v).toContain('yaw: (props.yaw ?? 0) + spin.value')
    expect(v).toContain('setPointerCapture')
    expect(v).toContain('onPointerdown: onDown')
    expect(read('./site.css')).toMatch(/\.alive\.turnable \{\s*touch-action: pan-y;/)
  })

  it('customization: the button changes at once, the Mochi gets the change on the next frame', () => {
    const p = read('./BodyCustomizer.ts')
    expect(p).toContain('const bot = shallowRef(stateBot())')
    expect(p).toContain('renderStyle: b.renderStyle')
    expect(p).toContain('shape: b.shape')
  })
})
