/**
 * Point d entree du moteur seul (sans composant), pour l utiliser dans une autre page :
 *
 *   npx esbuild@0.24.0 tools/moteur.ts --bundle --format=esm --minify --outfile=mochi-engine.js
 *
 * Le fichier produit garde la licence MIT : recopier l'en-tete de LICENSE en tete du fichier.
 */
export { BotEngine } from '../src/bot/engine'
export { COLOR_BY_ID, SHAPE_BY_ID, mixHex } from '../src/bot/skins'
export { EXPRESSION_BY_ID } from '../src/bot/expressions'
export { HALF_VIEWBOX, RADIUS } from '../src/bot/frame'
export {
  ACTIVITIES,
  ACTIVITY_BY_ID,
  NEUTRAL_GESTURE,
  IDLE_GESTURES,
  BOUNCE_DURATION,
  composer,
  gestureFailure,
  idleGesture,
  sleepGesture,
  personality,
  bounce,
  timeActivity,
  sleepZ
} from '../src/bot/gestures'
