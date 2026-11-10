/**
 * Entree publique LEGERE de la bibliotheque (`mochi-world/catalogue`) : les catalogues (formes, couleurs, humeurs,
 * accessoires, styles) et les reglages communs, SANS la balise `<mochi-bot>`. Pour construire une interface autour des
 * Mochi (choix de forme, de couleur, d'accessoires) sans charger le composant tout de suite ; `mochi-world` (l'entree
 * complete) reexporte tout ceci et declare la balise.
 *
 * Le site, la doc et le labo du depot n'utilisent que ces deux entrees : ils consomment Mochi exactement comme un
 * utilisateur du paquet (`src/site/entree-publique.test.ts` le verifie).
 */
import { closedPath, toPoints } from './bot/shape'

/* --------------------------------------------------------- reglages communs */
export { themeCourant } from './ui/trois/themeCourant'
export { contraste, THEMES, type Theme } from './ui/trois/theme'
export { renduCourant, contourCourant, RENDUS, RENDU_DEFAUT, TAILLES_PIXEL, type RenduId, type TaillePixelId } from './ui/rendu'
export type { Douceur, Rendu3d } from './ui/trois/rendu3d'

/* --------------------------------------------------------------- catalogues */
export { SHAPES, SHAPE_BY_ID, COLORS, COLOR_BY_ID, couleurDe, hexValide, mixHex } from './bot/skins'
export { MOOD_IDS, REACTION_IDS, moodDe, type MoodId, type ReactionId } from './bot/humeurs'
export {
  CATALOGUE,
  EMPLACEMENTS,
  PAR_ID,
  parEmplacement,
  resoudre,
  COULEURS as COULEURS_ACCESSOIRES,
  type AccessoireDef,
  type Choix,
  type Emplacement,
  type Selection
} from './bot/emplacements'
export { SEQUENCE, POSES, type StateId } from './bot/states'
export type { Block } from './bot/cycles'
export { RAYON, DEMI_VIEWBOX } from './bot/repere'

/**
 * Contour d'une forme (ses rayons, `SHAPES[i].radii`) en chemin SVG centre sur 0 : pour une ICONE de choix de forme
 * dans une interface. Le Mochi lui-meme est toujours rendu en 3D.
 */
export const cheminDeForme = (radii: readonly number[], echelle = 10): string =>
  closedPath(toPoints({ radii: [...radii], rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }, echelle))

/**
 * Charge le rendu 3D (Three.js) a la demande, pour un usage avance : rendre une piece seule dans un canvas
 * (`rendreAvatar`), prechauffer les shaders (`prechauffer`). La balise `<mochi-bot>` n'en a pas besoin.
 */
export const charger3d = () => import('./ui/trois/scene3d')
