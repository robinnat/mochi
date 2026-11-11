/**
 * PUBLIC entry point of the library (`pnpm build:lib` -> `dist-lib/mochiz.js`, alias `mochiz` in the repository):
 * importing this file declares the `<mochi-bot>` tag. It also re-exports the light entry `mochiz/catalog` (catalogs
 * and shared settings) and the engine, for those who build around it.
 *
 * Three.js is not in this file: it loads separately, with the first 3D Mochi (or through `load3d`).
 */
export { MochiBotElement, PROPERTIES, attributeOf, defineMochiBot, type MochiBotProps } from './components/mochi-bot'
export * from './catalog'
export { BotEngine, type BotFrame } from './bot/engine'
