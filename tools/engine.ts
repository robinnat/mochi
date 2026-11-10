/**
 * Entry point of the engine alone (without the component), to use it in another page:
 *
 *   npx esbuild@0.24.0 tools/engine.ts --bundle --format=esm --minify --outfile=mochi-engine.js
 *
 * The produced file keeps the MIT license: copy the header of LICENSE at the top of the file.
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
  compose,
  gestureFailure,
  idleGesture,
  sleepGesture,
  personality,
  bounce,
  timeActivity,
  sleepZ
} from '../src/bot/gestures'
