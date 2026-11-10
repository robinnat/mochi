/**
 * Point d'entree PUBLIC de la bibliotheque (`pnpm build:lib` -> `dist-lib/mochis.js`, alias `mochis` dans le
 * depot) : importer ce fichier declare la balise `<mochi-bot>`. Il reexporte aussi l'entree legere
 * `mochis/catalogue` (catalogues et reglages communs) et le moteur, pour qui veut construire autour.
 *
 * Three.js n'est pas dans ce fichier : il est charge a part, au premier Mochi en 3D (ou par `load3d`).
 */
export { MochiBotElement, PROPERTIES, attributeOf, defineMochiBot, type MochiBotProps } from './components/mochi-bot'
export * from './catalogue'
export { BotEngine, type BotFrame } from './bot/engine'
