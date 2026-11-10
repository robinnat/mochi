/**
 * Data of the site's accessory strips: one strip per offered package slot (head, eyes, neck, back), filled with
 * PIECES ALONE (without a body), in many color variants. Everything is DETERMINISTIC: the same strips on every visit,
 * and testable without a browser. No rendering here: `thumbnails.ts` draws.
 */
import { SLOTS, type Slot } from 'mochis/catalogue'
import { SITE_ACCESSORIES, PALETTE_SITE } from './catalog'

export interface ItemStrip {
  /** stable id (list key) */
  key: string
  slot: Slot
  accessory: string
  /** texte alternatif, en anglais */
  label: string
  c1: string
  c2: string
  /** rotation of the piece, in radians: three quarters so the volume reads; back pieces show from behind */
  yaw: number
}

export interface DefStrip {
  slot: Slot
  title: string
  text: string
  /** scroll direction: alternating left, right, left... */
  direction: 'left' | 'right'
  /** seconds for a full turn: longer = slower */
  duration: number
}

/** The strips, in the order of the package slots; the direction alternates from one row to the next. */
export const STRIPS: DefStrip[] = [
  { slot: 'head', title: 'Hats', text: 'Caps, crowns, berets, headphones, flowers', direction: 'left', duration: 64 },
  { slot: 'eyes', title: 'Glasses', text: 'Round, square, sun, heart, star and a monocle', direction: 'right', duration: 60 },
  { slot: 'neck', title: 'Neck', text: 'Bow ties, scarves, necklaces', direction: 'left', duration: 62 },
  { slot: 'back', title: 'Back', text: 'A backpack and a cape, seen from behind', direction: 'right', duration: 68 }
]

/**
 * Angle per slot: three quarters (the sign alternates from one piece to the next); face almost front; back three
 * quarters behind.
 */
const YAW: Record<Slot, number> = { head: 0.55, eyes: 0.24, face: 0.2, neck: 0.5, back: Math.PI - 0.6 }

/**
 * Step of the color cycle (14), chosen so the cycle does not close too fast, so the whole palette is walked through
 * without close repeats.
 */
const STEP_COLOR = 6

const rgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
/** Distance of two colors, from 0 to about 441: used to avoid a two-color piece that is almost plain. */
export function distanceColor(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}
/** Minimum gap between the two colors of a two-color piece. */
export const GAP_MIN = 85

/** First palette color, from `startPos`, far enough from the `avoid` colors. */
function far(startPos: number, avoid: string[]): string {
  for (let k = 0; k < PALETTE_SITE.length; k++) {
    const h = PALETTE_SITE[(startPos + k) % PALETTE_SITE.length]!.hex
    if (avoid.every((e) => distanceColor(h, e) >= GAP_MIN)) return h
  }
  return '#26222f'
}

/** `n` pieces for a slot: the whole catalog of the slot, several times, in other colors each round. */
export function itemsStrip(slot: Slot, n = 24): ItemStrip[] {
  const rang = SLOTS.indexOf(slot)
  const list = SITE_ACCESSORIES(slot)
  const out: ItemStrip[] = []
  for (let i = 0; i < n; i++) {
    const acc = list[i % list.length]!
    const turn = Math.floor(i / list.length)
    const twoColors = acc.c1 !== acc.c2
    // first round: the catalog's original colors; then, other tints of the palette
    const c1 = turn === 0 ? acc.c1 : PALETTE_SITE[(i * STEP_COLOR + rang * 5 + turn * 3) % PALETTE_SITE.length]!.hex
    const c2 = !twoColors ? c1 : turn === 0 ? acc.c2 : far(i * 5 + rang * 3 + turn * 9 + 4, [c1])
    const direction = i % 2 === 0 ? 1 : -1
    out.push({
      key: `${slot}-${i}`,
      slot,
      accessory: acc.id,
      label: `${acc.label}${turn > 0 ? ` (colour ${turn + 1})` : ''}`,
      c1,
      c2,
      yaw: direction * YAW[slot]
    })
  }
  return out
}

/**
 * A piece alone, in the catalog colors, seen at three quarters: the icon of an accessory in the "Make it yours"
 * picker (rendered by `thumbnails.ts`).
 */
export function itemPiece(slot: Slot, id: string): ItemStrip | null {
  const acc = SITE_ACCESSORIES(slot).find((a) => a.id === id)
  if (!acc) return null
  return { key: `${slot}:${id}`, slot, accessory: id, label: acc.label, c1: acc.c1, c2: acc.c2, yaw: YAW[slot] }
}
