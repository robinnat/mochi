# Moods and interactions

For the list of ids, see the [reference](reference.md#moods). This page explains how moods work inside the code.

Moods are a layer on top of the engine that animates only the **face and the body**: no stars, exclamation
marks, orbits, comets or particles. Everything is real-time 3D with the existing shading. It works on
the 12 shapes, in Soft, Flat and Pixel, in light and dark themes (black eyes), and with
accessories (they read the rendered body, so they follow every squash, stretch and tilt).

Code: `src/bot/moods.ts` (pure, no framework, no clock), wired into `mochi-bot.ts`. It reuses the
`Gesture` type of `gestures.ts`, the 16 expressions of `expressions.ts` (`neutral`, `angry`, `happy`,
`laughing`, `sleepy`, ...) and the state names of `states.ts` (`idle`, `thinking`, `wide`, `wink`,
`sleep`).

## Moods (looped)

| id | meaning | state it extends | face and body |
| --- | --- | --- | --- |
| `idle` | idle | `idle` | soft breathing, blinks, eyes that wander |
| `thinking` | thinking | `thinking` | eyes up, squinted (one eye tighter), head tilted a little |
| `working` | working | `idle` | focused, eyes reading line after line, small regular bounces |
| `waiting` | waiting | `wide` | looking straight ahead, head tilted, foot-tap, quick glance aside |
| `done` | done | `wink` | crescent eyes, two small hops of joy |
| `blocked` | blocked | `wide` | angry (`angry`, mirrored slanted eyes, a bit bigger), trembling in bursts |
| `asleep` | asleep | `sleep` | closed eyes, slow breathing, head tilted |

`resolveMood` also accepts `sleep` and `sleeping` for `asleep`.

## Interactions

| event | reaction id | what happens |
| --- | --- | --- |
| hover | (follow) | the eyes follow the cursor or finger, the head leans a little |
| tap or click | `startle` | startle: stretch, squash, damped rebound, eyes widen |
| double tap | `laugh` | crescent eyes, the body shakes with laughter |
| long press | `blush` | blushes (cheek tint painted in the body color, no floating element) and closes the eyes, content; holds while pressed |
| shaken or turned fast | `dizzy` | dizzy: the eyes circle, the body sways, then settles |
| appearance | `wave` | small hop, then a nod of greeting |

An interaction plays once on top of the mood, then hands back: the mood resumes without a jump.

## API

On the element:

```html
<mochi-bot id="bot" render-style="3d" mood="working" wave fps="12"></mochi-bot>
```

```js
const bot = document.getElementById('bot')
bot.setMood('done')                // 'idle' | 'thinking' | 'working' | 'waiting' | 'done' | 'blocked' | 'asleep' | null
bot.react('startle')               // 'startle' | 'laugh' | 'blush' | 'dizzy' | 'wave'
bot.release()                      // ends a held reaction (long press)
bot.lookAt({ nx: 0.5, ny: -0.2 })  // aims the eyes without a pointer event; null lets go
```

Inside the engine:

```ts
const moods = new Moods('idle', { reduced: prefersReducedMotion })
moods.react('laugh', now)
const frame = engine.sample(now, moods.sample(now)) // moods.sample is undefined when the layer is idle
```

- Without a mood, reaction or hover, `moods.sample(now)` is `undefined` and the engine renders exactly
  what it rendered before (test).
- `interactions` (default `true`) wires the pointer events of the component: hover, tap, double tap,
  long press (450 ms), shake (five quick direction changes in 600 ms) and a fast turn of the `yaw`
  prop (more than one full turn in 0.9 s). `false` turns all of it off. Only real 3D, never a frozen
  thumbnail, and not while `follow` already drives the gaze.
- `prefers-reduced-motion`: a mood becomes a still image (the face stays, the body stops), hover is
  ignored, only the face-only `blush` is allowed.
- `fps` caps the redraws of one avatar (a page can draw about 70 at 12 fps in one WebGL context).

## What changed in the engine

`Gesture` gets optional face fields (`exp`, `ew`, `eh`, `tilt`, `arc`, `ex`, `ey`, `cheeks`, `rot`), absent
from `NEUTRAL_GESTURE`. The engine applies them only when present, so `sample(t)` is byte-identical
without them. `BotFrame.face` and `RenderedEye.{k, tilt, gx, gy}` are set only then. The 3D eyes stay
straight in front (centered on the front face); with the layer they also take the lid, the slant, the
head tilt and the gaze offset. Glasses and accessories keep reading the eye positions without the gaze
offset, so they stay on the face.

Try it: `pnpm dev`, then `/lab.html#moods`. Frames of the proposal videos: `tools/moods.html`.
