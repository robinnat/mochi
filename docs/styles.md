# Styles

Mochis offers three styles, all in REAL 3D (Three.js, loaded on demand, one shared WebGL context):

| Style | `render-style` id | How it is drawn |
| --- | --- | --- |
| **Soft** (default) | `3d` | soft material: smooth shading, glows and a highlight computed in the shader, in camera space |
| **Flat** | `flat3d` | `toon`: three clean tones, optional `outline` |
| **Pixel** | `pixel3d` | rendered at low resolution (the `pixel` grid), reduced to a short palette (3 body tones, accessory tones, white eyes), a 1 px outline, scaled up with `image-rendering: pixelated` (`src/ui/3d/pixel3d.ts`) |

**No 2D.** The old SVG drawings are gone from the code: no 2D fallback, no 2D export. An unknown `render-style` value falls back to the current setting. Without WebGL, a short message replaces the Mochi (`no3d` event). Exports (PNG, SVG, GIF, MP4) are made from the 3D: a still of the canvas, or an off-screen render frame by frame (see [Export](export.md)).

**Eyes.** In the light theme the eyes are ALWAYS white, for every color (yellow `#ffd60a` and lime `#b6e800` included), with no outline: only the normal 3D shading of the eye remains. In the dark theme they are black.

## Shading all around (`src/ui/3d/rim.ts`)

Shading is NOT painted in the face texture (that used to darken the back and sides and left a seam). Everything is computed in the shader, in camera space, on the whole volume: soft occlusion towards the bottom and the edges, a glow at the bottom right (4 o'clock), a light glow at the top left (10 o'clock), and a soft highlight. The texture only holds the color and the eyes.

## 3D shapes

The 12 shapes have a real volume from every angle: a sphere (circle), an ellipsoid (pebble), a very round pillow (squircle), a lying tube (capsule), a rounded cone (triangle), a deep hexagon, cloud, drop, star, flower, egg and heart.

- Star, hexagon, cloud and flower are inflated as a "cushion" (`ProfileVolume.cushion`): the height solves a Poisson equation inside the outline (0 on the edge), computed once per shape and cached, then `z = H * (u / umax) ^ 0.45`. The surface is smooth everywhere, with a rounded edge and no fold between lobes; normals are smoothed on top.
- Drop, egg, triangle and capsule are solids of revolution (`ProfileVolume.revolution`): the depth of a point is the half width of the outline at its height.

The engine does not change: `engine.sample(t)` gives the same frame, and the states, their measurements and durations are the same. Only `mochi-bot.ts` paints the frame differently. The catalog and the current setting live in `src/ui/renderStyle.ts`.

## How the 3D works

- **The body is the outline, inflated** (`volume.ts`, pure and tested under Node): the `bodyPath` of the frame becomes points, then each ray from the center to the edge becomes a series of rings.
- **The eyes are on the front face only.** On a shape with a flat front, the pair of eyes is shifted (same vector, same gap) so it never bites into the rounded edge.
- **The eyes are painted in a texture** projected from the front, at the exact positions given by the engine, and ALSO in an emission texture (white on black): an eye is a light hole, the lighting must not gray it.
- **One WebGL context** for every avatar of the page (`renderAvatar`): each one asks for a frame, which is rendered and copied into its own canvas. The outline and the face are rebuilt only when they changed.
- **Loaded on demand**: `scene3d.ts` is never imported statically (about 133 kB gzip). `mochi-bot.ts` loads it when it mounts; until then the Mochi is not drawn (the `ready` event fires on the first frame).

## Materials

The material of the Soft style is `soft` (option `material`), with a `softness` setting:

- `strong` (default): the darkest tone is 0.56 in linear light, about 24 % darker on screen;
- `light`: 0.70, about 16 % darker.

The shadow is a smooth, matte ramp of `dot(normal, light)`, with the light at the top left, in front. A soft highlight (`highlight.ts`) is painted in the body texture BEFORE the eyes, so the eyes are never touched; its place follows the shape (the highest top-left point where it still fits, away from the eyes).

Other materials stay in the code but are not offered: `flat` (two tones only, judged too heavy), `toon`, `toon-outline`, `lowpoly` and `realistic` (internal only).

The cartoon outline (`outline`) is an inverted shell, colored with the body color darkened in HSL, with a width in pixels that gets lighter at small sizes (`outlineWidthPx`).

Screenshots: `docs/variants/`.

## Known limits

- Cost per frame: measured in a browser without a GPU (a worst case) for three animated 3D Mochis, 2.7 ms of JavaScript update and about 21 ms of software rendering. On a real GPU the rendering is negligible. Still images (`frozen-at`) render only once.
- `<foreignObject>` in Safari on iPhone is not tested yet.
- 3D GIFs are heavy (about 800 kB for 3 s): gradients make many colors, and a GIF keeps 256.
- The highlight is fixed in space: when the body moves or shrinks (asleep), the light does not follow it exactly.
