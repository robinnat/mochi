/**
 * Site catalog: ENGLISH labels. Ids come from the package (`mochis`, the library's public entry, as for any user);
 * the site defines no measurement. Labels of shapes, colors, states and styles reuse the app's
 * (`src/i18n/locales/en.ts`).
 */
import en from '@/i18n/locales/en'
import { ACCESSORIES, SLOTS, MOOD_IDS, REACTION_IDS, RENDER_STYLES, SHAPES, accessoriesInSlot, type Slot, type MoodId } from 'mochis/catalog'

export const SHAPE_LABEL = en.shapes as Record<string, string>
export const COLOR_LABEL = en.colors as Record<string, string>
export const SHAPE_ID_LIST = SHAPES.map((s) => s.id)

/**
 * Palette of the site's examples: 14 bright tints (P1 "Candy and toys"), all readable on the light AND the dark page
 * background (none almost white or almost black; `catalog.test.ts` checks it).
 */
export const PALETTE_SITE: { name: string; hex: string }[] = [
  { name: 'Tomato', hex: '#ff3b30' },
  { name: 'Coral', hex: '#ff6a3d' },
  { name: 'Orange', hex: '#ff9500' },
  { name: 'Sunny yellow', hex: '#ffd60a' },
  { name: 'Lime', hex: '#b6e800' },
  { name: 'Apple green', hex: '#6fd400' },
  { name: 'Emerald', hex: '#00c46a' },
  { name: 'Turquoise', hex: '#00c7be' },
  { name: 'Sky', hex: '#21b0ff' },
  { name: 'Royal blue', hex: '#2d5bff' },
  { name: 'Violet', hex: '#8b3dff' },
  { name: 'Magenta', hex: '#d81bbd' },
  { name: 'Pink', hex: '#ff4d94' },
  { name: 'Cherry', hex: '#e6194b' }
]

/** The site's 3D shapes, each with ITS color (12 shapes, 12 different tints of the palette). */
export const SHAPES_3D: { id: string; label: string; color: string }[] = [
  { id: 'circle', label: 'Circle', color: '#00c46a' },
  { id: 'pebble', label: 'Pebble', color: '#21b0ff' },
  { id: 'squircle', label: 'Squircle', color: '#ffd60a' },
  { id: 'capsule', label: 'Capsule', color: '#d81bbd' },
  { id: 'triangle', label: 'Triangle', color: '#6fd400' },
  { id: 'hexagon', label: 'Hexagon', color: '#ff9500' },
  { id: 'cloud', label: 'Cloud', color: '#2d5bff' },
  { id: 'drop', label: 'Droplet', color: '#ff4d94' },
  { id: 'star', label: 'Star', color: '#b6e800' },
  { id: 'flower', label: 'Flower', color: '#00c7be' },
  { id: 'egg', label: 'Egg', color: '#8b3dff' },
  { id: 'heart', label: 'Heart', color: '#ff3b30' }
]

/*
 * ------------------------------------------------------------------ moods, interactions, accessories by slot
 */


/** The seven moods: name and one sentence, in English. */
export const SITE_MOODS: { id: MoodId; label: string; text: string }[] = [
  { id: 'idle', label: 'Rest', text: 'Soft breathing, blinks, a gaze that wanders.' },
  { id: 'thinking', label: 'Thinking', text: 'Eyes up, squinting, one a little more closed than the other.' },
  { id: 'working', label: 'Working', text: 'Types on a small 3D laptop seen from behind: quick uneven bounces, a lean from side to side, gaze down, and pauses to think. It grows in and out as the mood starts and ends (the laptop option hides it).' },
  { id: 'waiting', label: 'Waiting', text: 'Looking straight ahead, head tilted, a little impatient.' },
  { id: 'done', label: 'Done', text: 'Happy crescent eyes and two small jumps of joy.' },
  { id: 'blocked', label: 'Blocked', text: 'Frowning, slanted eyes and a shake that comes in bursts.' },
  { id: 'asleep', label: 'Asleep', text: 'Eyes closed, slow breathing, a few "z".' }
]
export const MOOD_ID_LIST: MoodId[] = MOOD_IDS

/** Reactions to the user, with the gesture that triggers them. */
export const INTERACTIONS_SITE: { gesture: string; name: string; text: string }[] = [
  { gesture: 'Hover', name: 'Follows you', text: 'The gaze and a small head turn follow the pointer.' },
  { gesture: 'Tap', name: 'Startle', text: 'A squash and a damped bounce.' },
  { gesture: 'Double tap', name: 'Laugh', text: 'Crescent eyes and a shaking body.' },
  { gesture: 'Long press', name: 'Blush', text: 'Closes its eyes, content, for as long as you press.' },
  { gesture: 'Shake or spin fast', name: 'Dizzy', text: 'Spinning eyes, a swaying body.' },
  { gesture: 'On arrival', name: 'Hello', text: 'It grows out of the floor with a small rebound, then nods hello.' }
]

export const SLOT_LABEL: Record<Slot, string> = {
  head: 'Head',
  eyes: 'Eyes',
  face: 'Face',
  neck: 'Neck',
  back: 'Back'
}
export const SLOT_IDS = SLOTS

/** English names of the catalog accessories. */
export const SITE_ACCESSORIES = (e: Slot) => accessoriesInSlot(e).map((a) => ({ id: a.id, label: a.name, c1: a.c1, c2: a.c2 }))

/** The hero figures: all read from the engine's catalogs, none written by hand. */
export const FIGURES: { value: number; label: string }[] = [
  { value: SHAPES.length, label: 'shapes' },
  { value: RENDER_STYLES.length, label: '3D styles' },
  { value: MOOD_IDS.length, label: 'moods' },
  { value: REACTION_IDS.length, label: 'reactions to touch' },
  { value: ACCESSORIES.length, label: 'accessories' }
]
