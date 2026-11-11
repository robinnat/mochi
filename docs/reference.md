# Reference

Everything `<mochi-bot>` accepts, in one place. New here? Start with [Getting started](getting-started.md).

Each option is both an attribute (written in HTML, with dashes, as text) and a property (set in JavaScript, in camelCase, with any value): the attribute `frozen-at` is the property `frozenAt`.

## Options

| Attribute | Type | Default | What it does |
| --- | --- | --- | --- |
| `size` | number | `320` | Width and height, in pixels. |
| `shape` | string | `circle` | Shape id, see [Shapes](#shapes). |
| `color` | string | `ink` | Color id, see [Colors](#colors), or any hex color (`#ff8800`, `#f80`). |
| `render-style` | `3d`, `pixel3d` or `flat3d` | `3d` | Style: Soft, Pixel or Flat. |
| `mood` | string | none | Mood played on a loop, see [Moods](#moods). |
| `accessories` | JSON object | none | Accessories by slot, see [Accessories](#accessories). |
| `theme` | `light` or `dark` | `currentTheme` (`auto`: the device's theme) | The dark theme turns the eyes black. |
| `interactions` | boolean | `true` | Reactions to hover, tap, double tap, long press and shake. |
| `wave` | boolean | `false` | Waves once when it appears. |
| `follow` | boolean | `false` | The eyes follow the pointer anywhere in the window (turns the reactions off). |
| `frozen-at` | number | none | Draws one exact instant, in seconds, with no animation loop. |
| `fps` | number | none | Caps the number of frames per second. |
| `yaw` | number | `0` | Turns the model around its vertical axis, in radians. |
| `laptop` | boolean | `true` | Shows the laptop of the `working` mood. |
| `pixel` | `medium` or `fine` | `fine` | Pixel size of the Pixel style. |
| `shadow` | boolean | `true` | Ground shadow under the body, in all three styles (soft in Soft, flat in Flat, made of pixels in Pixel). |
| `shading` | boolean | `true` | Shading of the body volume (the relief), Flat and Pixel styles only. `false` gives one flat color. Soft is always shaded: it ignores `shading`. |
| `max-pixel-ratio` | number | `2` | Caps the sharpness of the 3D canvas (screen pixels per CSS pixel). `1.5` is lighter on phones. |
| `label` | string | `Animated Mochi avatar` | Text read by screen readers instead of the drawing. The default is English, whatever the browser language: pass your own text for a page in another language. |

A boolean (yes-or-no) attribute is on when present (`wave`), and off with `"false"` or `"0"` (`shadow="false"`).

### Advanced options

You rarely need these. The app uses them for its animation editor.

| Attribute | Type | Default | What it does |
| --- | --- | --- | --- |
| `expression` | string | `neutral` | Resting expression, see [Expressions](#expressions). |
| `cycle` | JSON array | the built-in cycle | The animation of the [cycle player](#cycle-player), as a list of blocks. |
| `paper` | string | `#f9f9f9` | Color of the page behind the Mochi, used for the depth haze. |

Two more options exist only as properties, because their value is a function: `gaze` (a scripted gaze) and `gesture` (small moves added to the pose).

## Methods

| Method | What it does |
| --- | --- |
| `setMood(id)` | Glides to another mood. `null` turns the mood off. |
| `react(id)` | Plays a reaction, then goes back to the mood. Returns `true` if the id exists. |
| `release()` | Ends a held reaction (the blush of the long press). |
| `lookAt({ nx, ny })` | Aims the eyes, from -1 to 1 on each axis. `null` lets go. |
| `seek(index, offset)` | Moves the player to block `index`, `offset` seconds in. |
| `renderAt(t)` | Draws the montage at time `t` (seconds), without a clock. Used for exports. |

## Events

Listen to them with `addEventListener`. They are standard `CustomEvent`s and do not bubble (a parent element does not receive them). For the player events, `event.detail` holds the new value.

| Event | When |
| --- | --- |
| `ready` | The first 3D frame is painted. |
| `no3d` | The browser has no WebGL: a message is shown instead of the Mochi. |
| `statechange` | The player moved to another state (detail: the state id). |
| `blockchange` | The player moved to another block of the cycle (detail: its index). |
| `playingchange` | The cycle started or stopped (detail: `true` or `false`). |
| `elapsedchange` | Time spent in the current block, every frame while playing (detail: seconds). |

## Cycle player

The cycle player is how the app builds and exports an animation. Most pages do not need it: moods are simpler.

A **cycle** is a list of **blocks**. A block plays one body state for a number of seconds. The states are `idle`, `thinking`, `wink`, `wide` and `sleep`. When the last block ends, the player starts again from the first one.

```js
const bot = document.querySelector('mochi-bot')
bot.cycle = [
  { state: 'idle', duration: 2 }, // 2 seconds of idle
  { state: 'wink', duration: 1.2 } // then a wink, then back to the start
]
bot.playing = true
```

| Property | Who sets it | What it holds |
| --- | --- | --- |
| `cycle` | you | The blocks, as above. |
| `playing` | you | `true` plays the cycle, `false` pauses it. `false` by default. |
| `block` | you or the player | Index of the current block. Set it to jump to a block. |
| `state` | the player | State of the current block (event `statechange`). |
| `elapsed` | the player | Seconds spent in the current block (event `elapsedchange`). |

- `seek(index, offset)` jumps to block `index`, `offset` seconds in.
- `renderAt(t)` draws the cycle at time `t` (seconds from its start), without playing it: the app uses it to export a video frame by frame.
- A mood wins over the cycle: while `mood` is set, the body stays in `idle` and the blocks do not advance.

## Shapes

| Id | Name |
| --- | --- |
| `circle` | Circle |
| `pebble` | Pebble |
| `squircle` | Squircle |
| `capsule` | Capsule |
| `triangle` | Triangle |
| `hexagon` | Hexagon |
| `cloud` | Cloud |
| `drop` | Droplet |
| `star` | Star |
| `flower` | Flower |
| `egg` | Egg |
| `heart` | Heart |

## Colors

| Id | Name | Hex |
| --- | --- | --- |
| `ink` | Ink | `#0a0a0c` |
| `brown` | Brown | `#8b5e3c` |
| `red` | Tomato | `#ff3b30` |
| `coral` | Coral | `#ff6a3d` |
| `orange` | Orange | `#ff9500` |
| `amber` | Sunny yellow | `#ffd60a` |
| `lime` | Lime | `#b6e800` |
| `apple` | Apple green | `#6fd400` |
| `green` | Emerald | `#00c46a` |
| `turquoise` | Turquoise | `#00c7be` |
| `sky` | Sky | `#21b0ff` |
| `blue` | Royal blue | `#2d5bff` |
| `violet` | Violet | `#8b3dff` |
| `magenta` | Magenta | `#d81bbd` |
| `pink` | Pink | `#ff4d94` |
| `cherry` | Cherry | `#e6194b` |
| `gray` | Gray | `#a3a3a3` |
| `cream` | Cream | `#f1efe9` |

## Moods

| Id | Also accepted | What it does |
| --- | --- | --- |
| `idle` | | Soft breathing, blinks, a gaze that wanders. |
| `thinking` | | Eyes up, squinting, one a little more closed than the other. |
| `working` | | Types on a small 3D laptop seen from behind (hide it with `laptop="false"`). |
| `waiting` | | Looks straight ahead, head tilted, a little impatient. |
| `done` | | Happy crescent eyes and two small jumps of joy. |
| `blocked` | | Frowning, slanted eyes and a shake that comes in bursts. |
| `asleep` | `sleep`, `sleeping` | Eyes closed, slow breathing, a few "z". |

## Reactions

Ids for `react()`. Most also play by themselves when `interactions` is on.

| Id | Plays by itself on |
| --- | --- |
| `startle` | tap |
| `laugh` | double tap |
| `blush` | long press (held) |
| `dizzy` | shake or fast spin |
| `wave` | appearing, with the `wave` option |

## Expressions

Resting faces for the `expression` option: `neutral`, `attentive`, `surprised`, `excited`, `happy`, `laughing`, `angry`, `sad`, `scared`, `suspicious`, `confused`, `curious`, `proud`, `shy`, `unimpressed`, `sleepy`.

## Accessories

One accessory per slot (`head`, `eyes`, `neck`, `back`). Use the id alone, or `{ "id": "...", "c1": "#hex", "c2": "#hex" }` for your own colors (`c1` main, `c2` second).

| Slot | Id | Name |
| --- | --- | --- |
| `head` | `cap` | Cap |
| `head` | `beret` | Beret |
| `head` | `top-hat` | Top hat |
| `head` | `crown` | Crown |
| `head` | `straw` | Straw hat |
| `head` | `antenna` | Antenna |
| `head` | `headphones` | Headphones |
| `head` | `ribbon` | Ribbon bow |
| `head` | `flower` | Flower |
| `head` | `toque` | Chef hat |
| `eyes` | `round` | Round glasses |
| `eyes` | `square` | Square glasses |
| `eyes` | `sunglasses` | Sunglasses |
| `eyes` | `heart` | Heart glasses |
| `eyes` | `star` | Star glasses |
| `eyes` | `monocle` | Monocle |
| `neck` | `bowtie` | Bow tie |
| `neck` | `scarf` | Scarf |
| `neck` | `pearls` | Pearl necklace |
| `neck` | `lei` | Flower necklace |
| `back` | `backpack` | Backpack |
| `back` | `cape` | Cape |

## Engine and catalogs

The library has two public entry points:

- `mochiz` (`dist-lib/mochiz.js`): the `<mochi-bot>` tag, the engine and the catalogs;
- `mochiz/catalog` (`dist-lib/catalog.js`): the catalogs alone, without the tag, to build a picker.

In the copied `standalone` folder they are `mochiz.js` and `catalog.js`, with Three.js included. The files at the root of `dist-lib/` are the same two entries without Three.js, for the npm package (coming soon).

The engine (`src/bot/`) computes each frame of a Mochi. It has no framework and no clock: `engine.sample(t)` gives the same frame for the same time `t`. It plays states, the basic animations of the body (`idle`, `thinking`, `wink`, `wide`, `sleep`); moods are built on top of them.

```js
import { BotEngine, SHAPE_BY_ID, RADIUS } from './vendor/mochiz/mochiz.js'
import { SHAPES, ACCESSORIES, MOOD_IDS } from './vendor/mochiz/catalog.js'

const engine = new BotEngine(RADIUS, 'idle', SHAPE_BY_ID.get('star').radii)
engine.setState('wink', 2) // change state at t = 2 s
const frame = engine.sample(2.4) // same t, same frame (it drives the 3D body)

// a picker built from the catalogs, as the website does
const shapes = SHAPES.map((s) => s.id)
const hats = ACCESSORIES.filter((a) => a.slot === 'head').map((a) => a.id)
```

| Export | What it is |
| --- | --- |
| `SHAPES`, `SHAPE_BY_ID` | The shapes and their radii. |
| `COLORS`, `COLOR_BY_ID`, `colorOf(id)` | The colors; `colorOf` also accepts a hex color. |
| `MOOD_IDS`, `REACTION_IDS`, `resolveMood(id)` | Mood and reaction ids. |
| `ACCESSORIES`, `SLOTS`, `accessoriesInSlot(slot)` | The accessory catalog. |
| `RENDER_STYLES`, `PIXEL_SIZES` | Style and pixel size ids. |
| `currentTheme`, `currentRenderStyle` | Settings shared by every Mochi without its own value. `currentTheme.value` is `auto` (follow the device), `light` or `dark`. |
| `shapePath(radii)` | An SVG path of a shape, for an icon in a picker. |
| `load3d()` | Loads the 3D part early (optional). |
