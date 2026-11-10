/**
 * Entree publique LEGERE de la bibliotheque (`mochis/catalogue`) : les catalogues (formes, couleurs, humeurs,
 * accessoires, styles) et les reglages communs, SANS la balise `<mochi-bot>`. Pour construire une interface autour des
 * Mochi (choix de forme, de couleur, d'accessoires) sans charger le composant tout de suite ; `mochis` (l'entree
 * complete) reexporte tout ceci et declare la balise.
 *
 * Le site, la doc et le labo du depot n'utilisent que ces deux entrees : ils consomment Mochi exactement comme un
 * utilisateur du paquet (`src/site/entry-publique.test.ts` le verifie).
 */
import { closedPath, toPoints } from './bot/shape'

/* --------------------------------------------------------- reglages communs */
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
 * Contour d'une forme (ses rayons, `SHAPES[i].radii`) en chemin SVG centre sur 0 : pour une ICONE de choix de forme
 * dans une interface. Le Mochi lui-meme est toujours rendu en 3D.
 */
export const shapePath = (radii: readonly number[], scale = 10): string =>
  closedPath(toPoints({ radii: [...radii], rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }, scale))

/**
 * Charge le rendu 3D (Three.js) a la demande, pour un usage avance : rendre une piece seule dans un canvas
 * (`renderAvatar`), prechauffer les shaders (`warmUp`). La balise `<mochi-bot>` n'en a pas besoin.
 */
export const load3d = () => import('./ui/3d/scene3d')
