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

/** v13 (10/11/2026): fast loading and at least 30 frames per second with every Mochi of a page. */
describe('3D performance (v13)', () => {
  const bot = read('../components/mochi-bot.ts')

  it('each Mochi keeps its own 3D body (accessories, face texture, meshes), freed with the element', () => {
    expect(scene).toContain('export function avatarSlot(): AvatarSlot')
    expect(scene).toContain('export function releaseSlot(slot: AvatarSlot)')
    expect(bot).toContain('slot = m.avatarSlot()')
    expect(bot).toContain('m3d.value?.releaseSlot(slot)')
    expect(bot).toMatch(/props\.shading, false, undefined, slot \?\? undefined\)/)
  })

  it('a Mochi off screen does not sample nor draw (IntersectionObserver)', () => {
    expect(bot).toContain('new IntersectionObserver(')
    expect(bot).toContain('if (!onScreen || !mustRedraw(ms, lastDrawing, props.fps)) return')
    expect(bot).toContain('io?.disconnect()')
  })

  it('the face texture is sized to the render, 512 at most', async () => {
    const { textureSizeFor } = await import('../ui/3d/scene3d')
    expect(textureSizeFor(120)).toBe(256)
    expect(textureSizeFor(256)).toBe(256)
    expect(textureSizeFor(480)).toBe(512)
    expect(textureSizeFor(2048)).toBe(512)
  })

  it('the wordmark font is served with the site, without the blocking Google Fonts stylesheet', () => {
    for (const f of ['../../index.html', '../../docs.html']) {
      expect(read(f)).not.toContain('fonts.googleapis.com')
      expect(read(f)).toContain('<link rel="preload" href="/src/site/fonts/fredoka-600-letters.woff2" as="font" type="font/woff2" crossorigin />')
    }
    expect(read('./site.css')).toContain("src: url('./fonts/fredoka-600-letters.woff2') format('woff2')")
    expect(read('./fonts/OFL.txt')).toContain('SIL Open Font License')
  })

  it('index.html fetches the first posters of the hero before the scripts run', async () => {
    const { HERO_FIRST } = await import('./Hero')
    const html = read('../../index.html')
    expect(html).toContain(`;[${HERO_FIRST.map((n) => `'${n}'`).join(', ')}].forEach(`)
  })
})

describe('ground shadow in every style (11/11/2026)', () => {
  it('the shadow is drawn before the Pixel branch returns, with whole cells (fillRect), no gradient', () => {
    const body = scene.slice(scene.indexOf('export function renderAvatar('))
    const shadowAt = body.indexOf('if (shadow && !withoutBody)')
    const pixelReturnAt = body.indexOf('if (pixel) {\n    // downscaling')
    expect(shadowAt).toBeGreaterThan(0)
    expect(pixelReturnAt).toBeGreaterThan(shadowAt)
    const pixelShadow = body.slice(shadowAt, pixelReturnAt)
    expect(pixelShadow).toMatch(/pixelEllipse\([^)]*\)\) c\.fillRect\(x0, ry, x1 - x0, 1\)/)
  })
})
