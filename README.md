**English** | [Français](README.fr.md)

# Mochi World

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [**Live demo**](https://mochi-red-phi.vercel.app)

Mochi World is a small animated avatar engine for the web. Its characters, the Mochi, are one
solid shape with seven moods, two eyes that move on their own, and reactions when you touch them
(hover, tap, double tap, long press, shake, a hello on arrival). Everything is drawn in real 3D, in
three styles (Soft, Flat and Pixel), in light and dark, with 22 accessories you can stack by slot and
colour, and exports (PNG, SVG, GIF, MP4). No animation library.

**Site and playground: https://mochi-red-phi.vercel.app** (the app is at `/app`).  
**Source: https://github.com/robinnat/mochi**

## Install

```bash
npm install mochi-world   # coming soon: the package is NOT published yet
```

Until then, build the library from the repository. It has no dependency for your app: Three.js
is bundled in a separate file that only loads when a 3D Mochi is shown.

```bash
git clone https://github.com/robinnat/mochi.git
cd mochi
npx -y pnpm@11.17.0 install
npx -y pnpm@11.17.0 build:lib     # writes dist-lib/mochi-world.js and its lazy 3D chunks
cp -r dist-lib ../my-app/public/mochi   # keep the files together
```

## Usage

Mochi is one web component, `<mochi-bot>`. Load `mochi-world.js` once per page: it declares the tag.
Every option is an **attribute** (kebab-case text: `frozen-at="1.2"`, `contour`, `reflet="false"`,
`accessoires='{"tete":"casquette"}'`) and a **property** (camelCase, any value:
`el.accessoires = { tete: 'casquette' }`). Methods (`setMood`, `react`, `relacher`, `regarder`, `seek`,
`rendAt`) are on the element; events are `CustomEvent`s (`pret` when the first 3D frame is painted, and
`statechange`, `blockchange`, `playingchange`, `elapsedchange`). Removed from the page, it stops its loop.

Ids are the ones of the catalogues, which are in French for now (`etoile` is the star,
`rendu` is the render style: `3d` Soft, `flat3d` Flat, `pixel3d` Pixel).

### HTML

```html
<script type="module" src="/mochi/mochi-world.js"></script>

<!-- a mood, Soft 3D, follows the pointer; says hello on arrival -->
<mochi-bot mood="repos" shape="fleur" color="rose" rendu="3d" size="160" follow coucou></mochi-bot>
<!-- types on a small 3D laptop (ordinateur="false" hides it) -->
<mochi-bot id="bot" mood="travaille" shape="squircle" size="200"></mochi-bot>
<!-- accessories by slot and colour (JSON), dark theme -->
<mochi-bot accessoires='{"tete": "casquette", "yeux": "rondes"}' theme="dark" size="200"></mochi-bot>
<!-- a frozen frame: no animation loop, the same image every time -->
<mochi-bot mood="termine" frozen-at="1.2" size="96"></mochi-bot>

<script type="module">
  const bot = document.getElementById('bot')
  bot.addEventListener('pret', () => console.log('first 3D frame'))
  bot.setMood('termine')
  bot.react('rigole')
</script>
```

### React

```jsx
import '/mochi/mochi-world.js'

export function Avatar({ mood }) {
  // React 19 passes props to custom elements as properties and `on<event>` as listeners
  return <mochi-bot shape="etoile" color="#2d5bff" mood={mood} size="160" onpret={() => console.log('ready')} />
}
```

With React 18, set objects (`accessoires`, `cycle`) and listeners through a `ref`.

### Vue

```vue
<script setup>
import '/mochi/mochi-world.js'
import { ref } from 'vue'
const mood = ref('repos')
</script>

<template>
  <mochi-bot shape="nuage" color="rose" :mood="mood" size="160" @pret="console.log('ready')" />
  <button @click="mood = 'termine'">Done</button>
</template>
```

Tell the Vue compiler that `mochi-bot` is a custom element
(`compilerOptions.isCustomElement: (tag) => tag === 'mochi-bot'` in the Vue plugin options).

### Svelte

```svelte
<script>
  import '/mochi/mochi-world.js'
  let mood = $state('repos')
</script>

<mochi-bot shape="nuage" color="rose" {mood} size="160" onpret={() => console.log('ready')}></mochi-bot>
<button onclick={() => (mood = 'termine')}>Done</button>
```

### Engine and catalogues

Two entry points, the same ones the site, the docs and the lab of this repository use (they never import an
internal file, and a test checks it):

- `mochi-world` (`dist-lib/mochi-world.js`): declares `<mochi-bot>` and exports everything below.
- `mochi-world/catalogue` (`dist-lib/catalogue.js`): catalogues and shared settings without the tag (`SHAPES`,
  `COLORS`, `CATALOGUE`, `EMPLACEMENTS`, `MOOD_IDS`, `REACTION_IDS`, `RENDUS`, `themeCourant`, `cheminDeForme`
  for a shape icon, `charger3d` to load the 3D on demand), to build a picker before loading the tag.

`src/bot/` has no framework and no clock: `engine.sample(t)` is a pure function of time, and `BotEngine` is
exported too. Mochi itself is always drawn in 3D: the engine frame drives the 3D body, there is no 2D drawing.

## What is in it

**Render styles** (`rendu`), all real 3D: `3d` (Soft, the default: soft shading, rim glows
and highlight computed in view space so the whole volume is lit the same way from every
side), `flat3d` (Flat: two or three flat tones, optional `contour`) and `pixel3d` (Pixel: low
resolution render, short palette, 1 px outline; `pixel`: `gros` 16, `moyen` 24, `fin` 32
px for the ball). `yaw` turns the model. Everything is 3D, exports included: there is no 2D
drawing. Without WebGL, a short message takes the Mochi's place and the element fires `sans3d`.

**Shapes** (12): `cercle`, `galet`, `squircle`, `capsule`, `triangle`, `hexagone`, `nuage`,
`goutte`, `etoile`, `fleur`, `oeuf`, `coeur`. Every shape has a real volume from all angles: the circle
is a sphere, the squircle a rounded pillow, the triangle a rounded cone, drop, egg and capsule are
solids of revolution, and star, flower, hexagon, cloud and heart are thick, rounded bodies.

**Colours** (18: 14 bright ones and 4 neutrals): `encre`, `brun`, `rouge`, `corail`, `orange`, `ambre`,
`citron`, `pomme`, `vert`, `turquoise`, `ciel`, `bleu`, `violet`, `magenta`, `rose`, `cerise`, `gris`,
`creme`. `color` also takes any hex.

**Moods** (7, looped, face and body): `repos`, `reflechit`, `travaille` (types on a small 3D laptop seen
from behind, `ordinateur` hides it), `attend`, `termine`, `bloque`, `dort`. Set one with
`<mochi-bot mood="travaille">` or `setMood()`. **Interactions** (on by default, `interactions`): hover makes
the gaze follow, tap startles, double tap laughs, long press blushes, a shake or fast spin makes it dizzy, and
`coucou` plays a hello on arrival (it grows out of the floor). That makes 5 reactions: `sursaut`, `rigole`,
`rougit`, `etourdi`, `coucou`. See [docs/moods.md](docs/moods.md).

**3D controls**: `<mochi-bot rendu="3d" yaw="0.5">` turns the model around its vertical axis
(radians; the eyes are painted on the front face only). The site's 3D section drives it by drag.

**Accessories** (22, `accessoires` prop, catalogue in `src/bot/emplacements.ts`): one per slot, all
stackable, each a simple shape in one or two colours you choose.

| Slot | Accessories |
|---|---|
| `tete` (head, 10) | `casquette`, `beret`, `haut-de-forme`, `couronne`, `paille`, `antenne`, `casque`, `ruban`, `fleur`, `toque` |
| `yeux` (eyes, 6) | `rondes`, `carrees`, `soleil`, `coeur`, `etoile`, `monocle` |
| `bas` (neck, 4) | `papillon`, `echarpe`, `perles`, `fleurs` |
| `dos` (back, 2) | `sac`, `cape` |

`el.accessoires = { tete: { id: 'casquette', c1: '#e8505b' }, yeux: 'rondes' }`, or the same in JSON as an attribute.
**Theme**: `theme="dark"` turns the eyes black (without it, the site's current theme). In the light theme the eyes are always
white, for every colour, with no outline.

**Exports**, all from the 3D scene: PNG and SVG (a still of the 3D canvas, embedded as an image in the SVG),
an animated GIF, and a whole montage as GIF or MP4, rendered frame by frame (the video encoder only loads on
first use). The animated SVG is gone: without a 2D drawing there is no vector animation to export.

## Main API

```ts
const engine = new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get('nuage')?.radii, expression)
engine.setState('wink', t)        // change state at time t (morphs with the measured curve)
engine.setShape(radii, t)          // morph to another silhouette
engine.setExpression(expr, t)      // resting expression
engine.setLook({ yaw, pitch, mix, wander }, t) // aim the eyes (null to release)
const frame = engine.sample(t, geste?) // pure: bodyPath, eyes, arcs, dots, notif
```

`<mochi-bot>` options: `size`, `shape`, `color`, `paper`, `frozen-at`, `follow`, `rendu`, `pixel`,
`rendu3d`, `douceur`, `contour`, `epaisseur-contour`, `reflet`, `ombre`, `ombrage`, `yaw`, `theme`, `mood`,
`interactions`, `coucou`, `ordinateur`, `accessoires`, `fps`, `label`, `max-pixel-ratio` (the property is the
camelCase name). `color` is a catalogue id (`violet`) or any hex (`#ff8800`, `#f80`). See
[mochi-bot.ts](src/components/mochi-bot.ts) and the [docs page](https://mochi-red-phi.vercel.app/docs).

The browser storage keys still start with `mochi:`: renaming them would lose saved settings.

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
| [docs/moods.md](docs/moods.md) | Work moods and reactions to the user (face and body only) |
| [docs/intro.md](docs/intro.md) | The arrival sequence |
| [docs/interface.md](docs/interface.md) | App layout and CSS traps |
| [docs/export.md](docs/export.md) | PNG, SVG, GIF and MP4 export, all from the 3D |
| [docs/i18n.md](docs/i18n.md) | The hand-rolled translation layer |

## Development

```bash
npx -y pnpm@11.17.0 install
npx -y pnpm@11.17.0 dev      # http://localhost:5190  (site at /, app at /app.html, lab at /labo.html)
npx -y pnpm@11.17.0 test     # vitest
npx -y pnpm@11.17.0 build    # tsc --noEmit && vite build
npx -y pnpm@11.17.0 build:lib  # the library alone, in dist-lib/
```

TypeScript with no framework: the avatar is a native web component, and the site and app use a small
in-house renderer (`src/ui/dom/`, a few hundred lines). Vite, Tailwind 4 (app only), Three.js (loaded on
demand). `tsc` is the only type gate: run the build before you conclude. [CHANGELOG.md](CHANGELOG.md) has one entry
per version.

## Contributing

Bug reports, ideas and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first
(setup, tests, code style, one pull request per topic, green CI). Everyone taking part follows the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please do not report security problems in a public issue. See [SECURITY.md](SECURITY.md) for the
private reporting form and the supported versions.

## License

MIT, see [LICENSE](LICENSE).
