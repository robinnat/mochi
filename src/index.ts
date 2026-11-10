/**
 * Point d'entree de la bibliotheque (`pnpm build:lib` -> `dist-lib/mochi-world.js`) : importer ce fichier declare
 * la balise `<mochi-bot>`. Le reste (moteur, reglages communs) est exporte pour qui en a besoin.
 * Three.js n'est pas dans ce fichier : il est charge a part, au premier Mochi en 3D.
 */
export { MochiBotElement, PROPRIETES, attributDe, definirMochiBot, type MochiBotProps } from './components/mochi-bot'
export { themeCourant } from './ui/trois/themeCourant'
export { renduCourant, contourCourant, RENDUS, type RenduId } from './ui/rendu'
export { BotEngine } from './bot/engine'
export { SHAPES, SHAPE_BY_ID, COLORS, COLOR_BY_ID } from './bot/skins'
export { MOOD_IDS, REACTION_IDS, moodDe } from './bot/humeurs'
export { CATALOGUE, EMPLACEMENTS, type Selection } from './bot/emplacements'
export { RAYON, DEMI_VIEWBOX } from './bot/repere'
