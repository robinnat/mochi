/**
 * Capturing the avatar as an image. It is the DOM layer of the export: it needs a canvas and the clipboard, so
 * nothing here can be tested under Node (framing and naming live in `export.ts` and are tested).
 *
 * Every export starts from the 3D: the still image is the SCREEN node, reframed, whose WebGL canvas is frozen into an
 * image (`freezeCanvases`); animations (GIF, video) are replayed frame by frame on an off-screen instance, also in
 * 3D. There is no other drawing source.
 */

import { nextTick } from '@/ui/dom/reactive'
import { MochiBotElement } from '@/components/mochi-bot'
import type { Block } from '@/bot/cycles'
import { gifAnimate, gifIndexed, indexed, newPalette, listed } from './animate'
import { stops, HALF_SCREEN, withoutComments, viewBoxExport } from './export'
import type { RenderStyleId, PixelSizeId } from './renderStyle'

/**
 * Serializes the displayed SVG into a standalone document, reframed on the ball.
 *
 * `width`/`height` are set explicitly and it is not cosmetic: without an intrinsic size, Firefox refuses to rasterize
 * an SVG loaded in an `<img>`, and the canvas comes out empty.
 */
export function svgStandalone(svg: SVGSVGElement, size: number, viewBox = viewBoxExport()) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  freezeCanvases(svg, clone)
  // The page's Tailwind classes do not exist in the shipped file.
  clone.removeAttribute('class')
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('viewBox', viewBox)
  clone.setAttribute('width', String(size))
  clone.setAttribute('height', String(size))
  return withoutComments(new XMLSerializer().serializeToString(clone))
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Replaces, in the CLONE, each `<foreignObject>` holding a canvas with an `<image>` as a `data:` URL of what the
 * original canvas shows.
 *
 * That is the real 3D case: body and eyes are rendered by WebGL in a canvas placed in a `<foreignObject>`. Left as
 * is, it breaks both exports:
 * - as PNG, an SVG holding a `<foreignObject>` taints the rasterization canvas (Chrome, Safari) and `toBlob` fails
 *   with
 *   `SecurityError`, hence "Export failed" on the default style;
 * - as SVG, `cloneNode` does not copy a canvas's pixels: the shipped file would have an empty canvas.
 *
 * An `<image>` as a `data:` URL is standalone and does not taint the canvas: the SVG file keeps the body, and the PNG
 * rasterizes. We read the LIVE canvas (the clone has no pixels), matched by document order.
 */
export function freezeCanvases(source: SVGSVGElement, clone: SVGSVGElement) {
  const origins = [...source.querySelectorAll('foreignObject')]
  const copies = [...clone.querySelectorAll('foreignObject')]
  copies.forEach((fo, i) => {
    const canvas = origins[i]?.querySelector('canvas')
    let href = ''
    try {
      // a zero-width canvas (not rendered yet) gives "data:,": no image rather than a broken one
      if (canvas && canvas.width > 0 && canvas.height > 0) href = canvas.toDataURL('image/png')
    } catch {
      href = ''
    }
    if (!href.startsWith('data:image/')) {
      fo.remove()
      return
    }
    const img = clone.ownerDocument.createElementNS(SVG_NS, 'image')
    for (const k of ['x', 'y', 'width', 'height']) {
      const v = fo.getAttribute(k)
      if (v !== null) img.setAttribute(k, v)
    }
    img.setAttribute('href', href)
    img.setAttribute('preserveAspectRatio', 'none')
    // pixel art: keep the cells sharp when scaled up
    if (canvas?.style.imageRendering === 'pixelated') img.setAttribute('style', 'image-rendering: pixelated')
    fo.replaceWith(img)
  })
}

/**
 * Rasterizes an SVG into a canvas and returns its context.
 *
 * Goes through a blob and not a `data:` URL: `btoa` breaks on accented characters of the `aria-label`, and percent
 * encoding a whole SVG is needlessly long. The URL is released in a `finally`: a non-revoked object keeps the blob in
 * memory until the page reloads.
 *
 * The canvas is never tainted: `svgStandalone` replaced the real 3D's `<foreignObject>` with an `<image>` as a
 * `data:` URL (see `freezeCanvases`). A remaining `<foreignObject>` would make `toBlob` fail; a `data:` URL is safe.
 */
async function draws(
  markup: string,
  size: number,
  canvas: HTMLCanvasElement,
  background: string | null = null
) {
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()

    canvas.width = size
    canvas.height = size
    // default `alpha`: that keeps the background transparent when no
    // color is asked for. The bot then exports as a cut-out thumbnail.
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas indisponible')
    // The canvas is reused from one frame to the next for the animated export: without
    // clearing, a frame with closed eyes would keep open eyes underneath.
    ctx.clearRect(0, 0, size, size)
    if (background) {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, size, size)
    }
    ctx.drawImage(img, 0, 0, size, size)
    return ctx
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Rasterizes an SVG to PNG. PNG is lossless, there is no quality to set. */
export async function toPng(markup: string, size: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  await draws(markup, size, canvas)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encodage png impossible'))),
      'image/png'
    )
  })
}

/** Triggers the download of a blob under the given name. */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
  } finally {
    // Delayed: Safari still reads the URL after the click on a big blob.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

/** Can the clipboard write an image here? */
export function copyPossible() {
  return (
    typeof ClipboardItem !== 'undefined' &&
    !!navigator.clipboard?.write &&
    // `supports` is recent: its absence is not a refusal.
    (ClipboardItem.supports?.('image/png') ?? true)
  )
}

/**
 * Copies an image to the clipboard.
 *
 * The blob is passed as a PROMISE and not awaited before the call: Safari requires `write` to come from the user's
 * gesture, and any `await` slipped in between loses that gesture and the copy is refused.
 */
export async function copy(blob: Promise<Blob>) {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

/**
 * Copies the SVG as TEXT and not as an image: in that form Figma, Illustrator and a code editor paste it as editable
 * vector. Pasted as `image/svg+xml`, it would come out flattened.
 */
export async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

/** How many frames done out of how many, for the progress bar. */
export type Progress = (done: number, total: number) => void

/**
 * Exports the cycle as MP4.
 *
 * The background is REQUIRED, not optional: video has no alpha (checked, `VideoEncoder` refuses `alpha: 'keep'`).
 * Without a background, the bot would be composited on black.
 */
export async function cycleToMp4(
  settings: SettingsBot,
  blocks: Block[],
  size: number,
  images: number,
  step: number,
  background: string,
  advance?: Progress,
  signal?: AbortSignal
): Promise<Blob> {
  const { toMp4 } = await import('./video')
  const canvas = document.createElement('canvas')
  const player = await opensCycle(settings, blocks, size, background)
  try {
    return await toMp4(
      canvas,
      images,
      Math.round(1 / step),
      async (i) => {
        const svg = await player.render(i * step)
        await draws(svgStandalone(svg, size, viewBoxExport(HALF_SCREEN)), size, canvas, background)
      },
      advance,
      signal
    )
  } finally {
    player.closed()
  }
}

/**
 * Exports the cycle as GIF.
 *
 * TWO passes over the sequence, for memory: a GIF needs a palette shared by all frames, so they must all be counted
 * before encoding a single one. Keeping raw pixels would cost 255 MB on a thirty-second cycle. The first pass only
 * keeps the colors, the second encodes: rendering is deterministic, so replaying the sequence gives exactly the same
 * frames.
 *
 * That determinism relies on the PLAYER being idempotent: replaying frame 0 after a full pass must give exactly frame
 * 0. It was not always so (the engine keeps the previous state for its fades, so the first state mixed with the LAST
 * and the default GIF opened on a ball without eyes, `sleep` having a zero `eyeAlpha`). `renderAt` now rewinds, and
 * `capture.test.ts` locks it.
 */
export async function cycleToGif(
  settings: SettingsBot,
  blocks: Block[],
  size: number,
  images: number,
  step: number,
  background: string | null,
  advance?: Progress,
  signal?: AbortSignal
): Promise<Blob> {
  // A single canvas and a single player for both passes: the canvas is reset on
  // each frame, and the player can rewind.
  const canvas = document.createElement('canvas')
  const box = viewBoxExport(HALF_SCREEN)
  const player = await opensCycle(settings, blocks, size, background ?? undefined)

  /** A full pass over the sequence. */
  const passe = async (read: (index: number, pixels: Uint8ClampedArray) => void) => {
    for (let i = 0; i < images; i++) {
      // checked on every frame: a thirty-second cycle is twice six hundred
      // frames, and giving up must not wait for the end of a pass
      stops(signal)
      const svg = await player.render(i * step)
      const ctx = await draws(svgStandalone(svg, size, box), size, canvas, background)
      read(i, ctx.getImageData(0, 0, size, size).data)
    }
  }

  try {
    const palette = newPalette()
    await passe((i, pixels) => {
      listed(palette, pixels)
      advance?.(i + 1, images * 2)
    })

    const chunks: Uint8Array[] = []
    await passe((i, pixels) => {
      chunks.push(indexed(palette, pixels))
      advance?.(images + i + 1, images * 2)
    })

    return new Blob([gifIndexed(palette, chunks, size, size, Math.round(step * 1000))], {
      type: 'image/gif'
    })
  } finally {
    player.closed()
  }
}

/**
 * Waits for the first 3D frame of an off-screen Mochi (`ready`). Without WebGL (`no3d`) or if nothing comes, the
 * export fails cleanly: there is no 2D fallback drawing.
 */
export function wait3d(bot: MochiBotElement, delay = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (bot.querySelector('canvas[data-real3d]') && bot.dataset.ready === '1') return resolve()
    const end = (ok: boolean) => {
      clearTimeout(timer)
      bot.removeEventListener('ready', good)
      bot.removeEventListener('no3d', bad)
      if (ok) resolve()
      else reject(new Error('3D unavailable'))
    }
    const good = () => end(true)
    const bad = () => end(false)
    const timer = setTimeout(bad, delay)
    bot.addEventListener('ready', good)
    bot.addEventListener('no3d', bad)
  })
}

/** Lets the engine drawing go through, THEN the 3D one (`post` queue). */
async function image() {
  await nextTick()
  await nextTick()
}

/** What the bot must carry on the exported animation. */
export interface SettingsBot {
  shape: string
  color: string
  expression: string
  /** render style; absent, the screen's current style */
  renderStyle?: RenderStyleId
  pixel?: PixelSizeId
}

/**
 * Renders the sequence frame by frame, on an OFF-SCREEN instance.
 *
 * Not a capture of the displayed avatar, on purpose: on screen the bot is at any clock time, while here we want a
 * reproducible sequence that starts at the beginning. That works because `engine.sample(t)` is a pure function of
 * time (the same time always gives the same frame) and because a `MochiBot` given `frozenAt` starts no animation loop
 * and no listener: we drive it ourselves.
 */
export async function sequenceOfBot<T>(
  settings: SettingsBot,
  size: number,
  number: number,
  step: number,
  read: (svg: SVGSVGElement, index: number) => T | Promise<T>,
  /**
   * Eye color. The eyes are HOLES filled with this tint, so on an export with a full background it must equal the
   * background exactly, otherwise the site's old tint stays visible inside, as a darker ring.
   */
  paper?: string
): Promise<T[]> {
  const host = document.createElement('div')
  // out of the flow and off screen, but RENDERED: `display:none` would give
  // no SVG to serialize.
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden'
  document.body.appendChild(host)

  const bot = createBot({ ...settings, size: size, frozenAt: 0, maxPixelRatio: 2, ...(paper ? { paper } : {}) })
  const ready = wait3d(bot)
  host.appendChild(bot)

  try {
    await ready
    const out: T[] = []
    for (let i = 0; i < number; i++) {
      bot.frozenAt = i * step
      await image()
      const svg = host.querySelector('svg')
      if (!svg) throw new Error('bot hors ecran non rendu')
      out.push(await read(svg, i))
    }
    return out
  } finally {
    bot.remove()
    host.remove()
  }
}

/** A `<mochi-bot>` with its options set as properties, not in the page yet. */
export function createBot(options: Record<string, unknown>): MochiBotElement {
  const bot = document.createElement('mochi-bot') as MochiBotElement
  Object.assign(bot, options)
  return bot
}

/**
 * Renders a CYCLE off screen, frame by frame, calling `read` for each one.
 *
 * Frames are never accumulated: a thirty-second cycle has over six hundred frames, 255 MB of raw pixels if all were
 * kept. The caller decides what to do with them as they come: encode, index, drop.
 *
 * Rendering goes through `renderAt` and not `frozenAt`: only `renderAt` walks the blocks timing each state change at
 * its absolute offset, which gives the same fades at joints as real-time playback. See its doc in
 * `components/mochi-bot.ts`.
 */
export interface PlayerOutScreen {
  /** Renders time `t` of the cycle and returns the SVG to read. */
  render: (t: number) => Promise<SVGSVGElement>
  closed: () => void
}

export async function opensCycle(
  settings: SettingsBot,
  blocks: Block[],
  size: number,
  paper?: string
): Promise<PlayerOutScreen> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden'
  document.body.appendChild(host)

  /*
   * `state`: the engine is built on the state it is given, and frame 0 must be the FIRST state of the montage,
   * without a morph from an idle never shown.
   */
  const bot = createBot({
    ...settings,
    size: size,
    cycle: blocks,
    state: blocks[0]?.state ?? 'idle',
    frozenAt: 0,
    maxPixelRatio: 1,
    ...(paper ? { paper } : {})
  })
  const ready = wait3d(bot)
  host.appendChild(bot)
  const close = () => {
    bot.remove()
    host.remove()
  }
  try {
    await ready
  } catch (e) {
    close()
    throw e
  }

  const svg = host.querySelector('svg')
  if (!svg) {
    close()
    throw new Error('bot hors ecran non rendu')
  }

  return {
    render: async (t: number) => {
      bot.renderAt(t)
      await image()
      return svg
    },
    closed: close
  }
}

/**
 * Assembles the bot's animation into an animated GIF.
 *
 * A real flip book: each frame is rendered in 3D off screen, then rasterized. For animated avatars (Discord, Slack);
 * its edge is hard, its transparency having a single bit.
 */
export async function toGifAnimate(
  settings: SettingsBot,
  size: number,
  number: number,
  step: number,
  background: string | null = null
): Promise<Blob> {
  // A single canvas for the whole sequence: creating one per frame leaves
  // dozens of contexts to the garbage collector during the export.
  const canvas = document.createElement('canvas')
  const images = await sequenceOfBot(
    settings,
    size,
    number,
    step,
    async (svg) => {
      const ctx = await draws(svgStandalone(svg, size), size, canvas, background)
      return ctx.getImageData(0, 0, size, size).data
    },
    // the eyes take the background tint to blend into it exactly
    background ?? undefined
  )
  return new Blob([gifAnimate(images, size, size, Math.round(step * 1000))], { type: 'image/gif' })
}
