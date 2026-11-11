# Gestures: small extra moves (optional layer)

`src/bot/gestures.ts` adds small moves ON TOP of the engine's pose, so a group of avatars does not move as one block. These are chosen settings, not measurements: they live apart and only apply when you pass them to `sample()`.

```ts
import { BotEngine } from './engine'
import { idleGesture, bounce, compose } from './gestures'

const bot = new BotEngine(100, 'idle')
const frame = bot.sample(t, compose(idleGesture(t, seed), bounce(t - touchedAt)))
```

Without a second argument (or with `NEUTRAL_GESTURE`), `sample(t)` gives exactly the same frame as before, byte for byte (tested in `gestures.test.ts`). Everything stays pure: a function of time and a seed, no clock, no state.

To see them: the moods and reactions sections of the [home page](https://mochiz.vercel.app/#moods).

## What a gesture can change

`Gesture = { dx, dy, sx, sy, yaw, pitch, roll, lid }`: body and eye offset (in radii), body scale, aim offsets (degrees), and the maximum eyelid. `compose(a, b)` adds the offsets, multiplies the scales and keeps the most closed eyelid.

## Waiting (`idleGesture(t, seed)`)

Seven short gestures: `blink`, `breathe`, `jump`, `balance`, `gaze`, `nod`, `stretch`. The schedule is O(1): an 8 s window with one gesture at an offset drawn in [0, 4[ s, so 4 to 12 s between two gestures, never before 4 s. The seed picks 4 favorite gestures (`personality`) with weights of 35, 30, 25 and 10 %: each avatar has its own way of waiting, and two different seeds almost never move at the same time.

## Touch (`bounce(u)`)

A squash, then a small damped spring over `BOUNCE_DURATION` (0.7 s). It is the only spring of the body, and it only exists in this layer: the measured states keep their ease-outs.

## Sleep and failure

- `sleepGesture(t)`: slow breathing (4.6 s), eyes closed, body a little squashed. `sleepZ(t)` gives the position of small rising "z".
- `gestureFailure(t)`: slumped, head down, slow sigh. Combine it with the `sad` expression.

## At work (`ACTIVITIES`)

Each activity plays an engine state on a loop (`timeActivity`) and adds a gesture: `reflection` (three pulsing dots), `typing` (eyes down, small taps) and `sweep` (the gaze reads from left to right). They all go through the face. The page that hosts the Mochi picks the activity of each role.

## The engine alone, for another page

`tools/engine.ts` exports the engine, the 3D tints and the gestures, with no framework:

    npx esbuild@0.24.0 tools/engine.ts --bundle --format=esm --minify --outfile=mochi-engine.js

Copy the MIT header of `LICENSE` at the top of the produced file.
