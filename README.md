# Mochi

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [**Live demo**](https://mochi-red-phi.vercel.app)

Mochi is a small animated avatar engine for the web. One solid shape with seven moods, two eyes
that move on their own, and reactions when you touch it (hover, tap, double tap, long press, shake,
a hello on arrival). Everything is drawn in real 3D, in three styles (Soft, Flat and Pixel), in light
and dark, with accessories you can stack by slot and colour, jumping movement and exports
(SVG, PNG, GIF, MP4). No animation library.

**Site and playground: https://mochi-red-phi.vercel.app** (the app is at `/app`).  
**Source: https://github.com/robinnat/mochi**

## Install

```bash
npm install mochi-bots   # coming soon: the package is NOT published yet
```

Until then, work from the repository (see [Development](#development)). Heads up: the repo
has no library entry point yet (no `main` or `exports` in `package.json`, and `"private": true`),
so even once published the package needs one. What you can build today is the engine alone,
see "Vanilla" below.

## Usage

### Vue

The component lives in `src/components/MochiBot.vue`.

```vue
<script setup lang="ts">
import MochiBot from './components/MochiBot.vue'
</script>

<template>
  <!-- a mood, light 3D, reacts to the pointer; says hello on arrival -->
  <MochiBot mood="repos" shape="fleur" color="rose" rendu="3d" :size="160" follow coucou />
  <!-- a mood with its own prop: types on a small 3D laptop (ordinateur="false" hides it) -->
  <MochiBot mood="travaille" shape="squircle" :size="200" />
  <!-- accessories by slot and colour, dark theme -->
  <MochiBot :accessoires="{ tete: 'casquette', yeux: 'rondes' }" theme="dark" :size="200" />
  <!-- a frozen frame: no animation loop, the same image every time -->
  <MochiBot mood="termine" :frozen-at="1.2" :size="96" />
</template>
```

Ids are the ones of the catalogues, which are in French for now (`etoile` is the star,
`rendu` is the render style: `3d` Soft, `flat3d` Flat, `pixel3d` Pixel).

### Vanilla (engine only, no Vue)

`src/bot/` has no framework and no clock: `engine.sample(t)` is a pure function of time.
`tools/moteur.ts` is an engine-only entry point. Bundle it once:

```bash
npx esbuild@0.24.0 tools/moteur.ts --bundle --format=esm --minify \
  --alias:vue=./tools/vue-stub.ts --outfile=mochi-engine.js
```

Then draw frames yourself. This draws the body and the eyes (rings, particles and the
notification dot are in `frame.arcs`, `frame.dots` and `frame.notif`, and are not drawn here):

```html
<svg id="mochi" width="200" height="200"></svg>
<script type="module">
  import { BotEngine, SHAPE_BY_ID, COLOR_BY_ID, RAYON, DEMI_VIEWBOX } from './mochi-engine.js'

  const engine = new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get('etoile').radii)
  const color = COLOR_BY_ID.get('violet').hex
  const svg = document.getElementById('mochi')
  const V = DEMI_VIEWBOX
  svg.setAttribute('viewBox', `${-V} ${-V} ${V * 2} ${V * 2}`)

  function draw(t) {
    const f = engine.sample(t)
    // the eyes are holes in a mask, so they clip against the silhouette on their own
    const eyes = f.eyes
      .map((e) => `<path d="${e.d}" transform="${e.matrix}" opacity="${e.alpha}" fill="#000"/>`)
      .join('')
    svg.innerHTML =
      `<mask id="m" maskUnits="userSpaceOnUse" x="${-V}" y="${-V}" width="${V * 2}" height="${V * 2}">` +
      `<path d="${f.bodyPath}" fill="#fff"/>${eyes}</mask>` +
      `<rect x="${-V}" y="${-V}" width="${V * 2}" height="${V * 2}" fill="${color}" mask="url(#m)" opacity="${f.bodyAlpha}"/>`
  }

  engine.setState('wink', 2) // at t = 2 s
  const loop = (ms) => { draw(ms / 1000); requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
</script>
```

Serve the folder over HTTP (ES modules do not load from `file://`). Tested in Chrome.
Keep the MIT header of `LICENSE` at the top of the bundle you ship.

## What is in it

**Render styles** (`rendu`), all real 3D: `3d` (Soft, the default: soft shading, rim glows
and highlight computed in view space so the whole volume is lit the same way from every
side), `flat3d` (Flat: two or three flat tones, optional `contour`) and `pixel3d` (Pixel: low
resolution render, short palette, 1 px outline; `pixel`: `gros` 16, `moyen` 24, `fin` 32
px for the ball). `yaw` turns the model. The old SVG drawings (`original`, `argile`, `bulle`,
`pixel`) are no longer offered: they remain only as the fallback when WebGL is missing and
for the SVG/PNG/GIF/MP4 exports, which still serialise the SVG (a 3D mochi exports as clay).

**Shapes** (11): `cercle`, `galet`, `squircle`, `capsule`, `triangle`, `hexagone`, `nuage`,
`goutte`, `etoile`, `fleur`, `oeuf`. Every shape has a real volume from all angles: the circle is a
sphere, the squircle a rounded pillow, the triangle a rounded cone, drop, egg and capsule are
solids of revolution, and star, flower, hexagon and cloud are thick, fully rounded bodies.

**Colours** (12): `encre`, `brun`, `rouge`, `orange`, `ambre`, `vert`, `turquoise`, `bleu`,
`violet`, `rose`, `gris`, `creme`.

**Moods** (7, looped, face and body): `repos`, `reflechit`, `travaille` (types on a small 3D laptop seen
from behind, `ordinateur` hides it), `attend`, `termine`, `bloque`, `dort`. Set one with
`<MochiBot mood="travaille" />` or `setMood()`. **Interactions** (on by default, `interactions`): hover makes
the gaze follow, tap startles, double tap laughs, long press blushes, a shake or fast spin makes it dizzy, and
`coucou` plays a hello on arrival (it grows out of the floor). See [docs/moods.md](docs/moods.md).

**Worn accessories** (`src/bot/portes.ts`, `porte` prop): `lunettes`, `soleil`, `haut-de-forme`,
`paille`, `bonnet`, `noeud`, `couronne`, `casque`. Placed on the body again at every frame, in every
style including 3D (`<MochiBot porte="bonnet" />`). See [docs/accessoires.md](docs/accessoires.md).

**3D controls**: `<MochiBot rendu="3d" :yaw="angle" />` turns the model around its vertical axis
(radians; the eyes are painted on the front face only). The site's 3D section drives it by drag.

**Accessories by slot** (`accessoires` prop, `src/bot/emplacements.ts`): head, eyes, face, neck and back, one per
slot, all stackable, each a simple shape in one or two colours you choose:
`<MochiBot :accessoires="{ tete: { id: 'casquette', c1: '#e8505b' }, yeux: 'rondes' }" />`.
**Theme**: `theme="dark"` turns the eyes black (without it, the site's current theme).

**Jumps and movement** (`src/bot/sauts.ts`, `src/ui/trois/iso.ts`): `poseSaut` and
`poseSurChemin` give squash, stretch, flight and landing with volume conserved;
`EspaceIso` puts 3D mochis on an isometric grid and makes them hop tile to tile.
See [docs/iso.md](docs/iso.md).

**Exports**: SVG, PNG, animated SVG, animated GIF, and a whole montage as GIF or MP4
(the video encoder only loads on first use).

## Main API

```ts
const engine = new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get('nuage')?.radii, expression)
engine.setState('wink', t)        // change state at time t (morphs with the measured curve)
engine.setShape(radii, t)          // morph to another silhouette
engine.setExpression(expr, t)      // resting expression
engine.setLook({ yaw, pitch, mix, wander }, t) // aim the eyes (null to release)
const frame = engine.sample(t, geste?) // pure: bodyPath, eyes, arcs, dots, notif
```

`<MochiBot>` props: `size`, `shape`, `color`, `paper`, `frozenAt`, `follow`, `rendu`, `pixel`,
`rendu3d`, `douceur`, `contour`, `reflet`, `yaw`, `theme`, `mood`, `interactions`, `coucou`,
`ordinateur`, `accessoires`, `fps`, `label`. See
[MochiBot.vue](src/components/MochiBot.vue).

## Why the numbers look arbitrary

They are measured, not chosen: every state was read frame by frame off a reference
animation (silhouettes by sub-pixel ray casting, eyes by capsule fitting, colours and
thicknesses by direct sampling). The constants of `src/bot/` are measurements, so rounding
them loses the accuracy of the motion.

| What you would expect | What the measurement shows |
|---|---|
| Eyes tilt like `//` | They tilt like `\\`, about 26 degrees off vertical |
| The body is a squircle | It is a perfect circle, radial error under 0.7 % |
| Transitions are springs | They are exponential ease-outs, no overshoot |
| The avatar floats at rest | No. Life comes from gaze drift and blinks |

[docs/measurements.md](docs/measurements.md) has the rest.

## Architecture

| | |
|---|---|
| [docs/architecture.md](docs/architecture.md) | The engine, radial-profile morphing, eyes as mask holes |
| [docs/measurements.md](docs/measurements.md) | What was measured, regenerating `profiles.ts` |
| [docs/styles.md](docs/styles.md) | Render styles: Soft, Flat, Pixel (real 3D) |
| [docs/accessoires.md](docs/accessoires.md) | Job accessories |
| [docs/moods.md](docs/moods.md) | Work moods and reactions to the user (face and body only) |
| [docs/iso.md](docs/iso.md) | Jumps and the isometric space |
| [docs/intro.md](docs/intro.md) | The arrival sequence |
| [docs/interface.md](docs/interface.md) | App layout and CSS traps |
| [docs/export.md](docs/export.md) | SVG, PNG, GIF and MP4 export |
| [docs/i18n.md](docs/i18n.md) | The hand-rolled translation layer |

## Development

```bash
npx -y pnpm@11.17.0 install
npx -y pnpm@11.17.0 dev      # http://localhost:5190  (site at /, app at /app.html, lab at /labo.html)
npx -y pnpm@11.17.0 test     # vitest
npx -y pnpm@11.17.0 build    # vue-tsc --noEmit && vite build
```

Vue 3, Vite, TypeScript, Tailwind 4 (app only), Three.js (loaded on demand). `vue-tsc` is the
only gate: run the build before you conclude. [CHANGELOG.md](CHANGELOG.md) has one entry
per version.

## License

MIT, see [LICENSE](LICENSE).
