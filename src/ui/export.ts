/**
 * Framing and naming of exported images. Everything is pure: no DOM, so testable under Node like the rest of
 * `src/ui/`. Rasterization lives in `capture.ts`, because it needs a canvas.
 */

import { HALF_VIEWBOX, RADIUS } from '@/bot/frame'
import { SHAPES } from '@/bot/skins'

/**
 * Margin around the widest shape. Eight percent: that lets the circular crop of a profile picture (Discord, Slack,
 * GitHub) stay clear of the silhouette.
 */
const MARGIN = 1.08

/**
 * Radius of the widest shape, in ball radius units. Computed, not hard-coded: adding a wider shape moves the frame by
 * itself instead of being cropped.
 */
export const RADIUS_MAX = Math.max(...SHAPES.map((shape) => Math.max(...shape.radii)))

/**
 * Half side of the export frame, in viewBox units.
 *
 * It is TIGHTER than the screen viewBox (158), on purpose: the screen margin holds the rings of animated states,
 * which do not exist at rest. Keeping it would make an export 63 % empty, and a tiny ball in a profile picture crop.
 *
 * One frame for every shape, not a per-shape crop: the radii of `skins.ts` are normalized so "every shape has the
 * same visual weight", and cropping them separately would bring each one to the same size and break that.
 */
export const HALF_FRAME = Math.ceil(RADIUS * RADIUS_MAX * MARGIN)

/** viewBox of the exported document, centered on the ball. */
export function viewBoxExport(half = HALF_FRAME) {
  return `${-half} ${-half} ${half * 2} ${half * 2}`
}

/**
 * Half side of the SCREEN viewBox.
 *
 * That is the one needed to export a CYCLE, not the tight frame: the margin the tight frame removes is exactly the
 * one that holds the rings of animated states. They grow to 1.4 times the ball radius, so 140, beyond the 125 of the
 * tight frame, which would crop them. A test locks it.
 */
export const HALF_SCREEN = HALF_VIEWBOX

export type ActionId = 'png' | 'svg' | 'gif' | 'copy' | 'copySvg'

/** What to do with the image once produced. */
export type ModeExport = 'download' | 'gif' | 'copyImage' | 'copyText'

export interface ActionExport {
  id: ActionId
  mode: ModeExport
  /** Side of the image in pixels. */
  size: number
  extension: 'png' | 'svg' | 'gif'
  /** Added to the file name. */
  suffix?: string
}

/**
 * Duration of the avatar's animated GIF. The first blink falls at 1.4 s, then every 1.9 to 4.6 s (`BLINKS`, face.ts):
 * three seconds always hold at least one.
 */
export const ANIM_SECONDS = 3

/**
 * The GIF is a real flip book: its frame rate IS its smoothness, and nothing interpolates it. Twenty frames per
 * second is its useful cap here: its delay counts in hundredths of a second, so 20 (5 hundredths) lands exactly where
 * 30 would not, and each added frame weighs.
 */
export const GIF_FPS = 20
export const GIF_IMAGES = GIF_FPS * ANIM_SECONDS
export const GIF_STEP = 1 / GIF_FPS

/**
 * The GIF is exported BIGGER than its display size, on purpose. Its transparency is one bit: the antialiased edge of
 * the ball is cut sharp and shows as stair steps. A Discord avatar shows between 40 and 128 px, so the browser's
 * downscaling smooths that edge again, which a file exported at its final size would not.
 */
export const GIF_SIZE = 320

/* --------------------------------------------------- cycle export */

/**
 * Export formats of a CYCLE: video and GIF, both rendered frame by frame from the 3D scene. No animated SVG: there is
 * no vector drawing to animate in 3D.
 */
export type FormatCycle = 'mp4' | 'gif'

export const FORMATS_CYCLE: FormatCycle[] = ['mp4', 'gif']
export const DEFAULT_CYCLE_FORMAT: FormatCycle = 'mp4'

/**
 * Frame rate and size, SEPARATE per format (sharing them was a mistake: the GIF is bound by its file size, the video
 * is not at all).
 *
 * GIF: 20 frames per second and 320 px. Its delay counts in hundredths of a second, and each added frame weighs
 * plainly in the file.
 *
 * MP4: 30 frames per second and 1024 px. A video compresses motion instead of storing each frame, so higher
 * resolution and frame rate cost little (measured on a sharp disc, going from 320 to 1024 and from 20 to 30 frames
 * only raises the bitrate from 93 to 342 kbps). At 320 px and 93 kbps, the export had thumbnail definition: that made
 * it look like a GIF.
 */
export const CYCLE_FPS = { gif: 20, mp4: 30 } as const
export const CYCLE_SIZE = { gif: 320, mp4: 1024 } as const

export const cycleStep = (format: FormatCycle) => 1 / CYCLE_FPS[format]

/** How many frames for a cycle of `duration` seconds. */
export const cycleImages = (duration: number, format: FormatCycle) =>
  Math.max(1, Math.round(duration * CYCLE_FPS[format]))

/**
 * The video is ALWAYS opaque: `VideoEncoder` refuses `alpha: 'keep'`, in H.264 as in VP9. The GIF keeps the
 * background choice.
 */
export const cycleAccepteTransparence = (format: FormatCycle) => format === 'gif'

/**
 * GIF background, chosen by the user.
 *
 * It is the only export where the question arises: the others have 8 bits of alpha and a perfectly smooth edge on a
 * transparent background. The GIF has one, so its transparent edge is hard and shows: a full background smooths it,
 * at the price of a color baked into the image.
 *
 * `white` by default: it looks clean everywhere, while transparent shows its stair steps on a colored background.
 */
export type BackgroundGif = 'white' | 'transparent'

export const BACKGROUNDS_GIF: BackgroundGif[] = ['white', 'transparent']
export const DEFAULT_GIF_BACKGROUND: BackgroundGif = 'white'

/** Pure white, not the site's `--paper`: "white background" must be white. */
export const WHITE = '#ffffff'

/** The color to paint under the ball, or `null` to paint nothing. */
export const backgroundColor = (background: BackgroundGif) => (background === 'white' ? WHITE : null)

/**
 * ONE PNG size, on purpose: offering 1024 and 2048 forced the user to decide a question that is not theirs. 1024
 * covers every profile picture spec (Discord 128, X 400, GitHub 500, Slack 512) and scales down cleanly.
 *
 * The SVG is a CONTAINER: it holds the image of the 3D canvas (as a `data:` PNG, see `freezeCanvases`) and the small
 * vector effects of the states. So it cannot be scaled up forever like the old 2D drawing.
 *
 * No STILL GIF: 256 colors and one-bit transparency, so a stair-step edge where PNG has 8 bits of alpha. The GIF only
 * exists here ANIMATED, for animated avatars on Discord or Slack.
 *
 * The catalog only holds **ids**: labels are resolved by `t('export.<id>')`, and the literal union above makes the
 * compiler check that each one has its translation in the three languages.
 */
export const ACTIONS: ActionExport[] = [
  { id: 'png', mode: 'download', size: 1024, extension: 'png' },
  { id: 'svg', mode: 'download', size: HALF_FRAME * 2, extension: 'svg' },
  { id: 'gif', mode: 'gif', size: GIF_SIZE, extension: 'gif' },
  { id: 'copy', mode: 'copyImage', size: 1024, extension: 'png' },
  { id: 'copySvg', mode: 'copyText', size: HALF_FRAME * 2, extension: 'svg' }
]

export const ACTION_BY_ID = new Map<string, ActionExport>(ACTIONS.map((a) => [a.id, a]))

/** What the main button does; the others are in the menu. */
export const DEFAULT_ACTION: ActionId = 'png'

/**
 * State of the export bar. A download does not always show (depending on the browser it lands in a folder without any
 * sign), hence this confirmation: without it, the user clicks again thinking nothing happened.
 */
export type StateExport = 'ready' | 'busy' | 'export' | 'copy' | 'error'

/**
 * Removes XML comments. The bot's SVG carries long ones that explain the mask to whoever reads the component: they
 * have no place in a file shipped to the user.
 */
export function withoutComments(markup: string) {
  return markup.replace(/<!--[\s\S]*?-->/g, '')
}

/**
 * `mochi-drop-neutral-ink.png`.
 *
 * Built from the **ids** and not the translated labels: the file name must not change with the interface language.
 *
 * The ids are filtered even though they come from literal unions, because `App.ts` reads them back from
 * `localStorage` without validating them: a tampered value must not be able to build the downloaded file's name.
 */
export function nameFile(
  shape: string,
  expression: string,
  color: string,
  extension: string,
  suffix = ''
) {
  const own = (v: string) =>
    v
      .toLowerCase()
      // Accented letters become bare letters rather than being dropped: a montage
      // name like "Cycle par défaut" must stay readable in the download
      // folder, not become "cyclepardfaut".
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
  const chunks = [own(shape), own(expression), own(color), own(suffix)].filter(
    Boolean
  )
  return `mochi${chunks.map((m) => `-${m}`).join('')}.${extension}`
}

/**
 * Can the browser encode a video here?
 *
 * This guard lives HERE and not in `video.ts`, and it is not tidying: the slightest static import of `video.ts` pulls
 * mediabunny into the entry chunk. `video.ts` only loads the library inside `toMp4`, but Rollup cannot split out a
 * module that is both statically and dynamically imported (it warns with `INEFFECTIVE_DYNAMIC_IMPORT`) and the 43 kB
 * gzip go back to the first load. It happened once, for this two-line function.
 */
export function videoPossible() {
  return typeof VideoEncoder !== 'undefined'
}

/* ------------------------------------------------------------- export abort */

/**
 * Error of an export given up by the user.
 *
 * A class and not a boolean return: the abort must climb the whole encoding stack, whose `finally` blocks free the
 * video encoder and the off-screen player on the way. The caller recognizes it so as NOT to show an error: we do not
 * tell someone they got what they asked for.
 *
 * It lives HERE and not in `video.ts` for the same reason as `videoPossible` just above: `capture.ts` needs it as a
 * static import, and a static import of `video.ts` pulls mediabunny into the entry chunk.
 */
export class Abandon extends Error {
  constructor() {
    super('export abandonne')
    this.name = 'Abandon'
  }
}

/** Throws if the user asked to give up. */
export function stops(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new Abandon()
}
