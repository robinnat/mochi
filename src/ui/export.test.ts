import { describe, expect, it } from 'vitest'
import { RADIUS } from '@/bot/frame'
import { SHAPES } from '@/bot/skins'
import {
  ACTIONS,
  WHITE,
  CYCLE_FPS,
  CYCLE_SIZE,
  HALF_SCREEN,
  FORMATS_CYCLE,
  DEFAULT_CYCLE_FORMAT,
  cycleAccepteTransparence,
  cycleImages,
  BACKGROUNDS_GIF,
  DEFAULT_GIF_BACKGROUND,
  backgroundColor,
  ACTION_BY_ID,
  DEFAULT_ACTION,
  HALF_FRAME,
  RADIUS_MAX,
  nameFile,
  withoutComments,
  viewBoxExport
} from './export'

/** Radius of the ball at rest, see the `R` of <mochi-bot>. */


/** Half side of the screen viewBox, see the `VB` of <mochi-bot>. */
const VB_SCREEN = 158

describe('export frame', () => {
  /*
   * THE test of the file: the frame is tighter than the screen, so it decides what fits. A shape added to `skins.ts`
   * with a radius bigger than the margin would be cropped silently in the exported image.
   */
  it('holds every customizer shape', () => {
    for (const shape of SHAPES) {
      const radius = Math.max(...shape.radii) * RADIUS
      expect(radius, `the shape "${shape.id}" overflows the frame`).toBeLessThan(HALF_FRAME)
    }
  })

  it('leaves a margin for the circular crop of a profile picture', () => {
    // The ball at rest must not touch the edge: between 70 % and 90 % of the frame.
    const fill = RADIUS / HALF_FRAME
    expect(fill).toBeGreaterThan(0.7)
    expect(fill).toBeLessThan(0.9)
  })

  it('is tighter than the screen viewBox', () => {
    // The screen margin holds the rings of animated states, absent at rest:
    // keeping it would fill the export with empty space.
    expect(HALF_FRAME).toBeLessThan(VB_SCREEN)
  })

  it('fits the widest shape and not the circle', () => {
    // The squircle peaks at 1.15 on its diagonal: a frame computed on the
    // circle alone (1.0) would crop it.
    expect(RADIUS_MAX).toBeGreaterThan(1)
    expect(RADIUS_MAX).toBe(Math.max(...SHAPES.map((f) => Math.max(...f.radii))))
  })

  it('produces a square viewBox centered on the ball', () => {
    expect(viewBoxExport(125)).toBe('-125 -125 250 250')
    expect(viewBoxExport()).toBe(`${-HALF_FRAME} ${-HALF_FRAME} ${HALF_FRAME * 2} ${HALF_FRAME * 2}`)
  })
})

describe('export catalog', () => {
  it('has unique ids', () => {
    expect(new Set(ACTIONS.map((a) => a.id)).size).toBe(ACTIONS.length)
  })

  it('exposes a default action that exists', () => {
    expect(ACTION_BY_ID.get(DEFAULT_ACTION)).toBeDefined()
  })

  /*
   * A single PNG size: offering 1024 and 2048 made the user decide a question that is not theirs.
   */
  it('offers a single png to download', () => {
    const pngs = ACTIONS.filter((a) => a.mode === 'download' && a.extension === 'png')
    expect(pngs).toHaveLength(1)
  })

  /* The image clipboard can only write bitmaps; the SVG goes as text. */
  it('copies the bitmap as an image and the vector as text', () => {
    for (const action of ACTIONS) {
      if (action.mode === 'copyImage') expect(action.extension).toBe('png')
      if (action.mode === 'copyText') expect(action.extension).toBe('svg')
    }
  })

  it('offers to copy both formats', () => {
    expect(ACTIONS.some((a) => a.mode === 'copyImage')).toBe(true)
    expect(ACTIONS.some((a) => a.mode === 'copyText')).toBe(true)
  })

  it('gives each action a usable size', () => {
    for (const action of ACTIONS) {
      expect(action.size).toBeGreaterThan(0)
      expect(Number.isFinite(action.size)).toBe(true)
    }
  })
})

describe('cycle export', () => {
  /*
   * THE cycle trap: the rings of animated states grow to 1.4 times the ball radius, so 140: beyond the tight frame of
   * the still export, which would crop them. A cycle must therefore start from the screen viewBox.
   */
  it('exports on the screen viewBox, not the tight frame', () => {
    const RADIUS_ARCS = 140
    expect(HALF_SCREEN).toBeGreaterThan(RADIUS_ARCS)
    expect(HALF_FRAME).toBeLessThan(RADIUS_ARCS)
  })


  it('ne propose ni SVG anime ni format hors video', () => {
    // the body morphs every frame: 2.5 kB of path times six hundred frames
    expect(FORMATS_CYCLE).toEqual(['mp4', 'gif'])
    expect(FORMATS_CYCLE).toContain(DEFAULT_CYCLE_FORMAT)
  })

  /* Video has no alpha: `VideoEncoder` refuses `alpha: 'keep'`. */
  it('only the gif gets a background choice', () => {
    expect(cycleAccepteTransparence('gif')).toBe(true)
    expect(cycleAccepteTransparence('mp4')).toBe(false)
  })

  it('counts frames from the duration and the format', () => {
    expect(cycleImages(31.2, 'mp4')).toBe(Math.round(31.2 * CYCLE_FPS.mp4))
    expect(cycleImages(31.2, 'gif')).toBe(Math.round(31.2 * CYCLE_FPS.gif))
    // a tiny montage must still give one frame
    expect(cycleImages(0, 'mp4')).toBe(1)
  })

  /*
   * Settings are SEPARATE per format, and that fixed a real mistake: the MP4 had inherited the GIF's 320 px / 20 fps,
   * justified there by file size. At a measured 93 kbps, the video had thumbnail definition. A video compresses
   * motion, it has no such constraint.
   */
  it('exports the video bigger and smoother than the gif', () => {
    expect(CYCLE_SIZE.mp4).toBeGreaterThan(CYCLE_SIZE.gif)
    expect(CYCLE_FPS.mp4).toBeGreaterThan(CYCLE_FPS.gif)
    expect(CYCLE_SIZE.mp4).toBeGreaterThanOrEqual(1024)
  })

  /* A GIF delay counts in hundredths: 20 fps lands exactly, 30 does not. */
  it('keeps a gif frame rate expressible in hundredths of a second', () => {
    expect(Number.isInteger(100 / CYCLE_FPS.gif)).toBe(true)
  })
})

describe('gif background', () => {
  /* The GIF is the ONLY format that asks: only it has 1 bit of alpha. */
  it('only concerns the gif', () => {
    const animate = ACTIONS.filter((a) => a.mode === 'gif')
    expect(animate.filter((a) => a.extension === 'gif')).toHaveLength(1)
  })

  it('propose blanc et transparent, blanc par defaut', () => {
    expect(BACKGROUNDS_GIF).toEqual(['white', 'transparent'])
    expect(BACKGROUNDS_GIF).toContain(DEFAULT_GIF_BACKGROUND)
    expect(DEFAULT_GIF_BACKGROUND).toBe('white')
  })

  /* "White background" must be WHITE, not the site's slightly off `--paper`. */
  it('paints pure white, and nothing at all for transparent', () => {
    expect(backgroundColor('white')).toBe(WHITE)
    expect(WHITE).toBe('#ffffff')
    expect(backgroundColor('transparent')).toBeNull()
  })
})

describe('markup cleanup', () => {
  it('removes comments without touching the drawing', () => {
    const markup =
      '<defs><!-- the eyes are real holes --><mask id="m">' +
      '<path d="M0 0" fill="#fff"/></mask></defs>' +
      '<g mask="url(#m)"><rect fill="#0a0a0c"/></g>'
    const own = withoutComments(markup)
    expect(own).not.toContain('<!--')
    expect(own).not.toContain('holes')
    // What makes the drawing must survive intact.
    expect(own).toContain('fill="#fff"')
    expect(own).toContain('fill="#0a0a0c"')
    expect(own).toContain('mask="url(#m)"')
    expect(own).toContain('d="M0 0"')
  })

  it('removes a multiline comment', () => {
    expect(withoutComments('<a/><!--\n  two\n  lines\n--><b/>')).toBe('<a/><b/>')
  })

  it('leaves markup without comments as is', () => {
    expect(withoutComments('<circle r="100"/>')).toBe('<circle r="100"/>')
  })
})

describe('file name', () => {
  it('is built from the ids and not the labels', () => {
    expect(nameFile('drop', 'neutral', 'ink', 'png')).toBe('mochi-goutte-neutre-encre.png')
    expect(nameFile('circle', 'laughing', 'violet', 'svg')).toBe('mochi-cercle-hilare-violet.svg')
  })

  /*
   * `App.ts` reads shape / expression / color back from localStorage without validating them: a tampered value must
   * not be able to build a path.
   */
  it('lets no path separator through', () => {
    const name = nameFile('../../etc/passwd', 'neutral', 'ink', 'png')
    expect(name).not.toContain('/')
    // A single dot, the extension's.
    expect(name.split('.')).toHaveLength(2)
    expect(name.endsWith('.png')).toBe(true)
  })

  /*
 * A montage name must stay readable: an accented name like "Cycle par défaut" (the French default) becomes
 * "cycle-par-defaut", not "cyclepardfaut".
 */
  it('transliterates accents and separates words', () => {
    expect(nameFile('Cycle par défaut', '', '', 'mp4')).toBe('mochi-cycle-par-defaut.mp4')
    expect(nameFile('Été 2026', '', '', 'gif')).toBe('mochi-ete-2026.gif')
  })

  it('survit a des ids vides', () => {
    expect(nameFile('', '', '', 'png')).toBe('mochi.png')
  })
})
