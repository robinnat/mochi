# Moods and interactions (proposal)

A layer on top of the engine that animates only the **face and the body**: no stars, exclamation
marks, orbits, comets or particles. Everything is real-time 3D with the existing shading. It works on
the 11 shapes, in Soft, Flat and Pixel, in light and dark themes (black eyes), and with worn
accessories (they read the rendered body, so they follow every squash, stretch and tilt).

Code: `src/bot/humeurs.ts` (pure, no framework, no clock), wired into `mochi-bot.ts`. It reuses the
`Geste` type of `gestes.ts`, the 16 expressions of `expressions.ts` (`neutre`, `colere`, `heureux`,
`hilare`, `somnolent`, ...) and the state names of `states.ts` (`idle`, `thinking`, `wide`, `wink`,
`sleep`).

## Moods (looped)

| id | meaning | state it extends | face and body |
| --- | --- | --- | --- |
| `repos` | idle | `idle` | soft breathing, blinks, eyes that wander |
| `reflechit` | thinking | `thinking` | eyes up, squinted (one eye tighter), head tilted a little |
| `travaille` | working | `idle` | focused, eyes reading line after line, small regular bounces |
| `attend` | waiting for Robin | `wide` | looking straight ahead, head tilted, foot-tap, quick glance aside |
| `termine` | done | `wink` | crescent eyes, two small hops of joy |
| `bloque` | blocked | `wide` | angry (`colere`, mirrored slanted eyes, a bit bigger), trembling in bursts |
| `dort` | asleep | `sleep` | closed eyes, slow breathing, head tilted |

English aliases are accepted by `moodDe` (`idle`, `thinking`, `working`, `waiting`, `done`, `blocked`,
`sleeping`).

## Interactions

| event | reaction id | what happens |
| --- | --- | --- |
| hover | (follow) | the eyes follow the cursor or finger, the head leans a little |
| tap or click | `sursaut` | startle: stretch, squash, damped rebound, eyes widen |
| double tap | `rigole` | crescent eyes, the body shakes with laughter |
| long press | `rougit` | blushes (cheek tint painted in the body colour, no floating element) and closes the eyes, content; holds while pressed |
| shaken or turned fast | `etourdi` | dizzy: the eyes circle, the body sways, then settles |
| appearance | `coucou` | small hop, then a nod of greeting |

An interaction plays once on top of the mood, then hands back: the mood resumes without a jump.

## API

```ts
// component
<mochi-bot rendu="3d" mood="travaille" interactions coucou fps="12"></mochi-bot>
bot.setMood('termine')        // 'repos' | 'reflechit' | 'travaille' | 'attend' | 'termine' | 'bloque' | 'dort' | null
bot.react('sursaut')          // 'sursaut' | 'rigole' | 'rougit' | 'etourdi' | 'coucou'
bot.relacher()                // end of a held reaction (long press)
bot.regarder({ nx: 0.5, ny: -0.2 })  // hover without a DOM event, null to let go

// engine level
const humeurs = new Humeurs('repos', { reduit: prefersReducedMotion })
humeurs.react('rigole', now)
const image = engine.sample(now, humeurs.sample(now))   // undefined when the layer is idle
```

- Without a mood, reaction or hover, `humeurs.sample(now)` is `undefined` and the engine renders exactly
  what it rendered before (test).
- `interactions` (default `true`) wires the pointer events of the component: hover, tap, double tap,
  long press (450 ms), shake (five quick direction changes in 600 ms) and a fast turn of the `yaw`
  prop (more than one full turn in 0.9 s). `false` turns all of it off. Only real 3D, never a frozen
  thumbnail, and not while `follow` already drives the gaze.
- `prefers-reduced-motion`: a mood becomes a still image (the face stays, the body stops), hover is
  ignored, only the face-only `rougit` is allowed.
- `fps` caps the redraws of one avatar (the dashboard draws up to ~70 at 12 fps in one WebGL context).

## What changed in the engine

`Geste` gets optional face fields (`exp`, `ew`, `eh`, `tilt`, `arc`, `ex`, `ey`, `joues`, `rot`), absent
from `GESTE_NEUTRE`. The engine applies them only when present, so `sample(t)` is byte-identical
without them. `BotFrame.visage` and `RenderedEye.{k, tilt, gx, gy}` are set only then. The 3D eyes stay
"pile en face" (centred on the front face); with the layer they also take the lid, the slant, the
head tilt and the gaze offset. Glasses and accessories keep reading the eye positions without the gaze
offset, so they stay on the face.

Try it: `pnpm dev`, then `/labo.html#moods`. Frames of the proposal videos: `tools/moods.html`.
