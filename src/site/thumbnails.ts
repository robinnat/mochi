/**
 * Strip thumbnails: each PIECE (hat, glasses, etc., without a body) is rendered ONCE by the shared 3D renderer
 * (`renderAvatar`, invisible body that still anchors the piece), framed tight and centered, then kept as an image.
 * The strips then scroll in pure CSS over images: no 3D rendering while scrolling, smooth even on iPhone. The 3D
 * comes through `load3d` (public entry): dynamic loading only. Used by `tools/renders.ts`.
 */
import { BotEngine, load3d, contrast, HALF_VIEWBOX, mixHex, RADIUS, SHAPE_BY_ID } from 'mochis'
import type { ItemStrip } from './strips'

/** Side of a thumbnail in pixels (shown at half size: dense screens). */
export const SIZE_THUMBNAIL = 256
/** Measuring pass: smaller, it only finds the box of the piece. */
const SIZE_MEASURE = 320
const PAPER = '#f9f9f9'
const T_IMAGE = 1.2
/** Share of the cell taken by the piece's largest dimension: every piece has the same apparent size. */
const FILL = 0.78
/** Share of the half frame that the whole piece (arms included) never exceeds. */
const EDGE = 0.96
/**
 * Minimum box dimension (engine units), per slot: a tiny piece is not enlarged forever, it stays a small piece in its
 * cell.
 */
const MIN_BOX: Record<ItemStrip['slot'], number> = { head: 40, eyes: 40, face: 78, neck: 40, back: 40 }
/**
 * Dark site background: a color too close to it (the black of most glasses) is lightened to stay readable.
 */
const BACKGROUND_DARK = '#1b1922'

type Scene3d = Awaited<ReturnType<typeof load3d>>
let scene: Promise<Scene3d> | null = null
let engine: BotEngine | null = null

/** Color of the piece by theme: in dark, what blends with the background is lightened. */
export function colorForTheme(hex: string, theme: 'light' | 'dark'): string {
  if (theme === 'light' || contrast(hex, BACKGROUND_DARK) >= 3) return hex
  return mixHex(hex, '#ffffff', 0.62)
}

export interface Box {
  cx: number
  cy: number
  w: number
  h: number
}

/**
 * Boxes (in engine units, y up) of the non transparent pixels of a canvas rendered with the frame `frame` centered on
 * 0: `full` (everything drawn) and `heart` (without thin parts: glasses arms, stems, wires, which must not decide the
 * apparent size). A column or a row counts in the core if it holds at least `threshold` (share of the maximum) of
 * opaque pixels.
 */
export function boxesOpaque(data: Uint8ClampedArray, px: number, frame: number, threshold = 0.4): { full: Box; heart: Box } | null {
  const col = new Uint32Array(px)
  const lig = new Uint32Array(px)
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      if (data[(y * px + x) * 4 + 3]! > 24) {
        col[x]!++
        lig[y]!++
      }
    }
  }
  const extent = (n: Uint32Array, min: number): [number, number] | null => {
    let a = -1
    let z = -1
    for (let i = 0; i < px; i++) {
      if (n[i]! > min) {
        if (a < 0) a = i
        z = i
      }
    }
    return a < 0 ? null : [a, z]
  }
  const fullX = extent(col, 0)
  const fullY = extent(lig, 0)
  if (!fullX || !fullY) return null
  const heartX = extent(col, threshold * Math.max(...col)) ?? fullX
  const heartY = extent(lig, threshold * Math.max(...lig)) ?? fullY
  const k = (2 * frame) / px
  const box = ([x0, x1]: [number, number], [y0, y1]: [number, number]): Box => ({
    cx: ((x0 + x1 + 1) / 2 - px / 2) * k,
    cy: -((y0 + y1 + 1) / 2 - px / 2) * k,
    w: (x1 - x0 + 1) * k,
    h: (y1 - y0 + 1) * k
  })
  return { full: box(fullX, fullY), heart: box(heartX, heartY) }
}

/** Compat: the full box alone. */
export const boxOpaque = (data: Uint8ClampedArray, px: number, frame: number): Box | null => boxesOpaque(data, px, frame)?.full ?? null

/**
 * Renders a piece alone as an image (object URL, to free with `URL.revokeObjectURL`); `null` if 3D rendering is not
 * available. Two passes: a wide pass measures the box of the piece, the second frames it tight, centered, at a
 * uniform size.
 */
export async function renderThumbnail(item: ItemStrip, theme: 'light' | 'dark'): Promise<string | null> {
  try {
    scene ??= load3d()
    const m = await scene
    engine ??= new BotEngine(RADIUS, 'idle', SHAPE_BY_ID.get('circle')!.radii, null)
    const frame = engine.sample(T_IMAGE)
    const sel = { [item.slot]: { id: item.accessory, c1: colorForTheme(item.c1, theme), c2: colorForTheme(item.c2, theme) } }
    const render = (cv: HTMLCanvasElement, viewFrame: number, center: { x: number; y: number }) =>
      m.renderAvatar(cv, frame, '#8b3dff', PAPER, 'soft', false, 'strong', true, 'circle', item.yaw, null, sel, viewFrame, theme, undefined, 0, false, true, undefined, true, center)
    // passe 1 : mesure
    const measure = document.createElement('canvas')
    measure.width = measure.height = SIZE_MEASURE
    const frame1 = HALF_VIEWBOX * 1.1
    render(measure, frame1, { x: 0, y: 0 })
    const data = measure.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, SIZE_MEASURE, SIZE_MEASURE).data
    const boxes = boxesOpaque(data, SIZE_MEASURE, frame1)
    if (!boxes) return null
    const { full, heart } = boxes
    // pass 2: square frame centered on the core of the piece, so its largest dimension takes `FILL` of the cell;
    // thin parts (arms, stems) can stick out a little, but never leave the image
    const most = Math.max(heart.w, heart.h, MIN_BOX[item.slot])
    const dehors = Math.max(Math.abs(full.cx - heart.cx) + full.w / 2, Math.abs(full.cy - heart.cy) + full.h / 2)
    const frame2 = Math.max(most / 2 / FILL, dehors / EDGE)
    const box = heart
    const cv = document.createElement('canvas')
    cv.width = cv.height = SIZE_THUMBNAIL
    render(cv, frame2, { x: box.cx, y: box.cy })
    const blob: Blob | null = await new Promise((r) => cv.toBlob((b) => r(b), 'image/png'))
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}
