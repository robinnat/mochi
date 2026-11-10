/**
 * LIGHT public entry of the library (`mochis/catalogue`): the catalogs (shapes, colors, moods, accessories, styles)
 * and the shared settings, WITHOUT the `<mochi-bot>` tag. To build an interface around Mochis (shape, color,
 * accessory pickers) without loading the component right away; `mochis` (the full entry) re-exports all of this and
 * declares the tag.
 *
 * The repository's site, docs and lab only use these two entries: they use Mochis exactly like a user of the package
 * (`src/site/public-entry.test.ts` checks it).
 */
import { closedPath, toPoints } from './bot/shape'

/* --------------------------------------------------------- shared settings */
export { currentTheme } from './ui/3d/currentTheme'
export { contrast, THEMES, type Theme } from './ui/3d/theme'
export { currentRenderStyle, currentOutline, RENDER_STYLES, DEFAULT_RENDER_STYLE, PIXEL_SIZES, type RenderStyleId, type PixelSizeId } from './ui/renderStyle'
export type { Softness, Material } from './ui/3d/material'

/* --------------------------------------------------------------- catalogues */
export { SHAPES, SHAPE_BY_ID, COLORS, COLOR_BY_ID, colorOf, isValidHex, mixHex } from './bot/skins'
export { MOOD_IDS, REACTION_IDS, resolveMood, type MoodId, type ReactionId } from './bot/moods'
export {
  ACCESSORIES,
  SLOTS,
  ACCESSORY_BY_KEY,
  accessoriesInSlot,
  resolveAccessories,
  ACCESSORY_PALETTE as ACCESSORY_PALETTE,
  type AccessoryDef,
  type AccessoryChoice,
  type Slot,
  type AccessorySelection
} from './bot/slots'
export { SEQUENCE, POSES, type StateId } from './bot/states'
export type { Block } from './bot/cycles'
export { RADIUS, HALF_VIEWBOX } from './bot/frame'

/**
 * Outline of a shape (its radii, `SHAPES[i].radii`) as an SVG path centered on 0: for a shape picker ICON in an
 * interface. The Mochi itself is always rendered in 3D.
 */
export const shapePath = (radii: readonly number[], scale = 10): string =>
  closedPath(toPoints({ radii: [...radii], rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }, scale))

/**
 * Loads the 3D renderer (Three.js) on demand, for advanced use: rendering a single piece in a canvas
 * (`renderAvatar`), warming up shaders (`warmUp`). The `<mochi-bot>` tag does not need it.
 */
export const load3d = () => import('./ui/3d/scene3d')
