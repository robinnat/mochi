/**
 * Point d'entree PUBLIC de la bibliotheque (`pnpm build:lib` -> `dist-lib/mochi-world.js`, alias `mochi-world` dans le
 * depot) : importer ce fichier declare la balise `<mochi-bot>`. Il reexporte aussi l'entree legere
 * `mochi-world/catalogue` (catalogues et reglages communs) et le moteur, pour qui veut construire autour.
 *
 * Three.js n'est pas dans ce fichier : il est charge a part, au premier Mochi en 3D (ou par `charger3d`).
 */
export { MochiBotElement, PROPRIETES, attributDe, definirMochiBot, type MochiBotProps } from './components/mochi-bot'
export * from './catalogue'
export { BotEngine, type BotFrame } from './bot/engine'
