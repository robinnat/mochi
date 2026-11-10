/**
 * The frame of everything the engine renders.
 *
 * `engine.sample()` outputs coordinates in viewBox units, and these two numbers define them: without them an engine
 * output means nothing. They used to live in the component, out of reach, and `export.ts` restated one by hand.
 *
 * They live here because `src/bot/` is what is read and used from outside: the `<mochi-bot>` component is ONE client
 * of the engine, not its definition.
 */

/**
 * Radius of the ball at rest, in viewBox units. It is the `scale` the component passes to `BotEngine`.
 *
 * Chosen, not measured: it is the working unit. Everything else in the folder is a fraction of this radius, which
 * makes the measurements taken off the video independent of the display size.
 */
export const RADIUS = 100

/**
 * Half side of the displayed viewBox. The margin beyond the radius holds the rings.
 *
 * Not a free value: the rings of the entry transition grow to 1.4 times the radius, so 140. Nothing bounds them at
 * runtime: the hand-tuned `RINGS` table (`decor.ts`) keeps them under 158, and a test locks it.
 */
export const HALF_VIEWBOX = 158
