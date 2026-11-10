/**
 * 3D accessories by stackable SLOTS. One accessory per slot at most, and all slots stack: a Mochi can wear a hat,
 * glasses, a bow tie and a backpack at the same time.
 *
 * This file only holds the catalog (names, colors): no geometry, no `three`.
 *
 * RULE (05/11/2026): each accessory is very simple, ONE color (`c1`), TWO at most (`c2`, for example a flower: petals
 * + center). Both can be set through the API (`{ id, c1, c2 }`, see `AccessoryChoice`); `c2` equal to `c1` means "a
 * single color". The volumes are built in `ui/3d/accessories3d.ts`, anchored on the 3D body.
 *
 * Slots, each on its own area of the body so they do not collide:
 *   head : above the top (hats, headwear, antenna, flower)
 *   eyes : at eye height (glasses, masks)
 *   face : cheeks and under the eyes (empty for now: all its accessories are REMOVED)
 *   neck : the "neck" of the body, around 72 % of the height (bow tie, scarf, necklace...)
 *   back : the sides and the back (backpack, cape)
 */

export type Slot = 'head' | 'eyes' | 'face' | 'neck' | 'back'

/** All slots, `face` included (empty since 10/11/2026, kept for the REMOVED accessories). */
export const ALL_SLOTS: Slot[] = ['head', 'eyes', 'face', 'neck', 'back']

/** The OFFERED slots: those with at least one accessory in the catalog. */
export const SLOTS: Slot[] = ['head', 'eyes', 'neck', 'back']

export const SLOT_NAMES: Record<Slot, string> = {
  head: 'Head',
  eyes: 'Eyes',
  face: 'Face and cheeks',
  neck: 'Neck',
  back: 'Sides and back'
}

export interface AccessoryDef {
  id: string
  slot: Slot
  /** name shown as a caption */
  name: string
  /** main color and second color (can be changed when used) */
  c1: string
  c2: string
}

/** Bright, sober palette, aligned on P1 "Candy and toys" (09/11/2026) for the bright tints. */
export const ACCESSORY_PALETTE = {
  red: '#ff3b30',
  yellow: '#ffd60a',
  turquoise: '#00c7be',
  navy: '#2b3a67',
  pink: '#ff4d94',
  cream: '#f6f1e7',
  black: '#26222f',
  gold: '#ffc933',
  green: '#00c46a',
  orange: '#ff9500',
  violet: '#8b3dff',
  blue: '#2d5bff',
  straw: '#efcf8a'
} as const

const C = ACCESSORY_PALETTE

const def = (slot: Slot, id: string, name: string, c1: string, c2: string): AccessoryDef => ({ id, slot, name, c1, c2 })

export const ACCESSORIES: AccessoryDef[] = [
  // head
  def('head', 'cap', 'Cap', C.red, C.red),
  def('head', 'beret', 'Beret', C.black, C.black),
  def('head', 'top-hat', 'Top hat', C.black, C.red),
  def('head', 'crown', 'Crown', C.gold, C.gold),
  def('head', 'straw', 'Straw hat', C.straw, C.red),
  def('head', 'antenna', 'Antenna', C.black, C.red),
  def('head', 'headphones', 'Headphones', C.red, C.red),
  def('head', 'ribbon', 'Ribbon bow', C.pink, C.pink),
  def('head', 'flower', 'Flower', C.pink, C.yellow),
  def('head', 'toque', 'Chef hat', C.cream, C.cream),
  // eyes
  def('eyes', 'round', 'Round glasses', C.black, C.black),
  def('eyes', 'square', 'Square glasses', C.navy, C.navy),
  def('eyes', 'sunglasses', 'Sunglasses', C.black, C.black),
  def('eyes', 'heart', 'Heart glasses', C.pink, C.pink),
  def('eyes', 'star', 'Star glasses', C.gold, C.gold),
  def('eyes', 'monocle', 'Monocle', C.gold, C.gold),
  // bas
  def('neck', 'bowtie', 'Bow tie', C.black, C.black),
  def('neck', 'scarf', 'Scarf', C.orange, C.orange),
  def('neck', 'pearls', 'Pearl necklace', C.cream, C.cream),
  def('neck', 'lei', 'Flower necklace', C.pink, C.yellow),
  // dos
  def('back', 'backpack', 'Backpack', C.orange, C.navy),
  def('back', 'cape', 'Cape', C.red, C.red)
]


/**
 * Accessories REMOVED from the catalog (feedback of 05/11/2026): they no longer show in the catalog or on the sheets.
 * The definitions and 3D builders stay in the repository: to bring one back, copy it into `ACCESSORIES`.
 */
export const REMOVED: AccessoryDef[] = [
  // v14 (10/11/2026): pink cheeks removed (the blush of the long press, an EXPRESSION, stays); no
  // accessory left in the face slot, which is no longer offered (glasses and monocle stay in "eyes")
  def('face', 'cheeks', 'Pink cheeks', C.pink, C.pink),
  // v13 (09/11/2026): both pairs of wings (angel and bat) removed
  def('back', 'wings', 'Angel wings', C.cream, C.cream),
  def('back', 'batwings', 'Bat wings', C.violet, C.violet),
  // v12 (09/11/2026): freckles, beauty mark, mustache and cat whiskers removed
  def('face', 'whiskers', 'Cat whiskers', C.black, C.pink),
  def('face', 'freckles', 'Freckles', '#c8733a', '#c8733a'),
  def('face', 'mole', 'Beauty mark', C.black, C.black),
  def('neck', 'mustache', 'Mustache', C.black, C.black),
  // v11 (05/11/2026) : la cravate (essais v9 a v11 refuses)
  def('neck', 'tie', 'Tie', C.red, C.red),
  def('head', 'ears', 'Ear headband', C.pink, C.cream),
  def('eyes', 'ski', 'Ski goggles', C.orange, C.blue),
  def('eyes', 'domino', 'Hero mask', C.red, C.cream),
  def('face', 'bandage', 'Bandage', C.cream, C.pink),
  def('face', 'tear', 'Tear', C.blue, C.blue),
  def('neck', 'medal', 'Medal', C.gold, C.red),
  def('neck', 'bell', 'Bell collar', C.turquoise, C.gold),
  // v3 (05/11/2026)
  def('head', 'party', 'Party hat', C.violet, C.yellow),
  def('head', 'bob', 'Bob', C.yellow, C.cream),
  def('neck', 'bandana', 'Bandana', C.red, C.cream),
  // v4 (05/11/2026)
  def('head', 'beanie', 'Pompom beanie', C.turquoise, C.cream),
  def('back', 'tail', 'Tail', C.orange, C.orange),
  def('eyes', 'sleep', 'Sleep mask', C.violet, C.cream)
]

export const ACCESSORY_BY_KEY = new Map(ACCESSORIES.map((a) => [`${a.slot}:${a.id}`, a]))

export const accessoriesInSlot = (e: Slot) => ACCESSORIES.filter((a) => a.slot === e)

/** A choice: the id alone (catalog colors) or the id with forced colors. */
export type AccessoryChoice = string | { id: string; c1?: string; c2?: string }

/** What is worn: at most one accessory per slot. */
export type AccessorySelection = Partial<Record<Slot, AccessoryChoice>>

/** Normalized choice: the catalog definition with the final colors; `null` if unknown. */
export function resolveAccessories(e: Slot, choice: AccessoryChoice | undefined | null): AccessoryDef | null {
  if (!choice) return null
  const id = typeof choice === 'string' ? choice : choice.id
  const d = ACCESSORY_BY_KEY.get(`${e}:${id}`)
  if (!d) return null
  if (typeof choice === 'string') return d
  return { ...d, c1: choice.c1 ?? d.c1, c2: choice.c2 ?? d.c2 }
}

/** All the colors of a selection (pixel art palette). */
export function colorsOf(sel: AccessorySelection): string[] {
  const out = new Set<string>()
  for (const e of SLOTS) {
    const d = resolveAccessories(e, sel[e])
    if (d) {
      out.add(d.c1)
      out.add(d.c2)
    }
  }
  return [...out]
}
