# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- The project is now called **Mochi World** (the characters are still Mochi). The package name in
  `package.json` is `mochi-world` (not published yet). Page titles, meta tags, the site header and footer
  follow. Code names do not change: `MochiBot.vue`, the `mochi:` storage keys and every prop stay as they are.

### Added

- Community files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue and pull request templates,
  and a Dependabot config (weekly, at most 3 open pull requests).
- French versions of the README and of the community files (`README.fr.md`, `CONTRIBUTING.fr.md`,
  `CODE_OF_CONDUCT.fr.md`, `SECURITY.fr.md`), with an English | Français switch at the top of each.
  English stays the reference.

### Removed (for now)

- The two pairs of wings (angel, bat): out of `CATALOGUE` (23 accessories), kept in `RETIRES`.

- Freckles, beauty mark, moustache and cat whiskers: out of `CATALOGUE` (29 to 25 accessories), kept in `RETIRES`.
- The jumping movement: the "Movement" section of the site, `src/bot/sauts.ts`, the isometric space `EspaceIso`
  and the lab's `#iso` view.

### Fixed

- Changing the shape left the accessories where they were laid out on the half-morphed body; they now re-seat once the morph ends.

### Added

- The `dort` mood shows small rising Z marks (all renderers).

### Changed (site)

- Landing page: seven moods demo, live interactions (hover, tap, double tap, long press, hello on arrival, which now
  grows the Mochi out of the floor), slot-based accessory picker with colours, and a light/dark/auto switch
  (3D eyes turn black in dark). `MochiBot` gains the `accessoires` prop (slot selection) and follows the
  site theme when `theme` is not set. The tie accessory is retired (kept in `RETIRES`).

### Added (moods and interactions, proposal)

- Seven looped moods (`repos`, `reflechit`, `travaille`, `attend`, `termine`, `bloque`, `dort`) and six
  interactions (hover follows the cursor, tap, double tap, long press blushes, shake or fast turn makes
  it dizzy, a greeting on appearance), face and body only. API: `setMood(id)`, `react(id)`, `relacher()`,
  `regarder()` on `MochiBot`; props `mood`, `interactions`, `coucou`, `fps`; `Humeurs` class in
  `src/bot/humeurs.ts`. Respects `prefers-reduced-motion`. See `docs/moods.md`.
- `Geste` gains optional face fields (crescent eyes, mirrored tilt, gaze offset, head tilt, cheek tint);
  without them `sample(t)` is unchanged byte for byte. In 3D the lid, slant and head tilt now apply to the
  front-facing eyes when the layer is on.

### Added (dark theme, proposal)

- `theme: 'light' | 'dark'` (default `'light'`, rendering unchanged): in `'dark'` the eyes are black
  (`#0a0a0c`) in the three styles and the 11 shapes, all moods and blinks included. Lighting, rim glows
  and reflection are the same, but they no longer add light on the eyes. Available as the last arguments
  of `rendreAvatar(..., theme, contrasteOeil)`, `Mochi3d.setTheme`, `EspaceIso` option `theme` and the
  `theme` prop of `MochiBot`.
- Dark theme only: a body whose contrast with the black eye is under 3:1 is lightened just enough to reach
  3:1 (ink, dark navy and dark grey bodies); other colours are untouched. `contrasteOeil = 0` disables it.
- Dark theme only: the black lens of the sunglasses becomes slate so it stays distinct from black eyes.

### Changed (pillow shapes)

- Star, hexagon, cloud and flower are inflated like a cushion: the height is the solution of a Poisson
  equation inside the outline, solved once per shape and cached. No ridge along the medial axis, no
  crease between lobes, no groove on the edge; normals are smoothed. Silhouettes, sizes and ids are
  unchanged.

### Changed (3D only)

- **Three styles, all real 3D**: Soft (default), Flat (`toon`, optional outline) and Pixel (low
  resolution, short palette, 1 px outline). The SVG styles (original, pixel art, clay, bubble) are
  no longer offered; the SVG body stays as the no-WebGL fallback and for the exports.
- **Continuous shading when the model turns**: AO, bottom-right and top-left rim glows and the
  soft highlight are computed in view space in the material, not painted in the face texture
  (which darkened the back and sides and left a seam).
- **Eleven real 3D shapes**: rounder squircle, rounded cone for the triangle, solids of revolution
  for drop, egg and capsule, deeper hexagon, star, flower and cloud.
- **Glasses** sit in front of the face with a real gap, with temples that follow the head to its
  sides; worn accessories share the body's light play in every style.

### Added

- **Worn accessories** (`src/bot/portes.ts`, `porte` prop): round glasses, sunglasses, mini top hat,
  straw hat, beanie, bow, crown and headphones. Only glasses, a top hat and a bow are exposed on the site, in 3D; the 2D layer is kept in the engine but switched off (`PORTE_2D`). They are recomputed from every engine frame
  (body outline and eyes), so they follow squash, hops, shapes, gaze and blinks in flat, pixel
  art, clay, bubble and real 3D. Hats and headphones are real volumes in 3D and turn with the
  model; glasses are painted on the 3D face where the eyes are. Lenses are never opaque.
- **3D section of the site**: drag the model sideways to turn it (inertia, soft return, arrow
  keys, `touch-action: pan-y` so the page still scrolls), pick a mood, a gesture or a worn
  accessory. `MochiBot` takes a `yaw` prop.

### Changed

- **Moods are face moods only.** The catalogue now holds `idle`, `thinking`, `wink`, `wide` and
  `sleep`. `alert`, `notify`, `exclaim`, `egg`, `hexagon`, `play`, `orbit`, `burst` and `comet` are
  gone, with their decor (bars, particles, comet ribbons, notification dot) and the `orbite`,
  `emission`, `tourbillon` and `jeu` activities. Stored montages that mention a removed state drop
  those blocks silently. `swirl` (the app's view transition) stays.
- A gesture and a job accessory now compose, and the tool follows a body moved by the gesture.

### Changed

- **Candy extrusions for star, flower, hexagon** (03/11/2026: the inflated/lens versions
  were rejected): flat front and back faces, a big fully rounded bevel (arrondi 0.95), depth
  0.45 x width, like soft 3D icons. The circle is a geometric
  sphere (polar rings). The star has rounded tips (smoothing 1.0, inner radius 0.5).
- **3D eyes face front, heart removed, pyramid, pointier star** (03/11/2026): in 3D the
  eyes are centred, symmetric, upright and a little above the centre of the front face, whatever
  the 2D gaze (2D unchanged). The soft highlight is bigger and more diffuse. The triangle is a
  real pyramid. The star has sharper points (inner radius 0.5, was 0.62). The heart shape is
  removed (a saved heart falls back to the circle).
- **Real volumes for every 3D shape** (`src/ui/trois/volume.ts`, `docs/styles.md`): the body is
  no longer a flat cushion seen from the side. Height now depends on the distance to the edge
  (flat front, constant-radius rounded edge, straight wall); each shape has a volume profile.
  The squircle is a true cube, triangle/hexagon/star are rounded prisms, flower/cloud are
  domed cushions, balls stay round (circle is still an exact sphere). Eyes are painted on the
  front face only and kept off the rounded edge. Lab view `#tour` shows each shape from four
  angles.

### Added

- **Smooth 3D shading, now the default** (`src/ui/trois/rendu3d.ts`, `docs/styles.md`): new `doux`
  material, a continuous matte falloff (no band, no specular, no rim light, low contrast) with a
  `douceur` parameter (`leger` ~16 % darker at the lowest, `marque` ~24 %). The 3D style now
  uses `doux` / `marque`; `aplat` stays in code only.
- **Flat 3D for the real 3D** (`src/ui/trois/rendu3d.ts`, `docs/styles.md`): the default
  material is now `aplat` (two flat tones, flat 2D colours, flat white eyes), with an optional
  **cartoon outline** (`contour`, a "Cartoon outline" checkbox in the Customize view) and an
  organic shadow edge. `toon`, `toon-contour` and `lowpoly` stay in code only; `realiste` is
  internal. The 3D style is now labelled "3D". Lab view `#formes3d`.
- **Optional gesture layer** (`src/bot/gestes.ts`, `docs/gestes.md`): seeded idle gestures
  every 4 to 12 s with a per-seed personality, a bounce on touch, sleep and failure
  postures, seven working activities. `engine.sample(t, geste)` takes it as an optional
  second argument; without it the frame is byte-identical (tested).
- `tools/moteur.ts`: engine-only entry point (no Vue) to bundle the engine for another page.
- **Job accessories** (`src/bot/accessoires.ts`, `docs/accessoires.md`): nine animated props
  drawn in code (notebook, laptop, clapperboard, chart, paper plane, palette, clipboard,
  list, gear), each with its gesture, a job-to-prop map and a `simple` mode for tiny sizes.
  The hands are two detached capsules in the body colour.

### Fixed

- **The Settings and Animations views were unusable below 64rem.** Everything stacks
  there, but three pieces were still placed as if the three-column desktop grid were
  around them. Measured at 375 × 812: the navigation rail floated over the middle of the
  content (over the animations panel's heading, over the avatar in Settings); the
  montage bar had no background, so the palette scrolled through the track and its
  labels landed on top of the zoom slider; and the wordmark sat 812 px down the
  *document* rather than at the foot of the page, covering the credits and then drifting
  into mid-screen once scrolled.
- **The montage bar took 29 % of a phone screen** and its toolbar overflowed a 327 px
  row. It is 200 px below 64rem — still the ruler plus a card at full thumbnail size —
  the two counters flanking the play button give way to the identical pair already in
  the toolbar, and the export button keeps its icon, its label staying as the accessible
  name.

### Changed

- Below 64rem the navigation rail is a horizontal bar at the top rather than a floating
  column on the left, and the wordmark sits in the flow at the foot of the page,
  centred and cropped at the baseline. Above 64rem nothing moves.

## [0.1.1] — 2026-08-17

First batch of post-launch fixes. Every entry was reproduced and measured before being
fixed, and the measurement is in the commit that fixes it.

### Fixed

- **Playback could never get past a repeated animation.** Writing `#etat=` fired a
  `hashchange` the listener read as an incoming navigation, and the lookup returns a
  state's *first* occurrence — so a montage holding the same animation twice looped
  forever on the first one. One click in the palette was enough to trigger it.
- **Three image defects in the montage export**, none visible short of stepping through
  an MP4 frame by frame: one corrupt frame at every block joint (the eye trajectory
  jumped up to 53.4 units, now 0.6 max), the GIF opening on an eyeless ball, and a
  montage not starting on the resting animation fading in from it anyway.
- **The eyes left the silhouette on non-circular shapes.** The eye is placed by a
  pro-rata of the local body radius, which divides its margin at the edge by the same
  factor — so the capsule, triangle, cloud and teardrop pushed it through the mask.
  Five state × shape pairs let an eye out of the body, up to 14.5 units on a ball of
  radius 100; now none do.
- **A failed montage export said nothing.** The failure went to a component only
  rendered in another view, so the progress bar vanished and nothing explained why.
- **MP4 stayed selected on browsers that cannot encode it.** The option was hidden but
  the value still won, and the export failed on the spot.
- **`versMp4` leaked its encoder on failure.** Chrome caps simultaneous hardware
  encoders, so after a few failures later exports died at startup for an unrelated
  reason.
- **A forbidden `localStorage` made the page blank.** Reading the property throws a
  `SecurityError` when access is denied — blocked cookies, third-party iframe,
  enterprise policy — and that propagated out of setup. Persistence is now optional;
  the application never is.
- **A hand-edited montage could freeze the tab.** 4.65 MB of JSON, inside the storage
  budget, produced 1.5 million tick objects and a track 29 700 000 px wide.
- **A state change landing inside a fade jumped.** The blend restarted from the full
  pose of the state being left instead of the frame actually on screen: 26 to 43 px
  against the 10 to 14 px a spaced change produces.
- **Modals still slid under `prefers-reduced-motion`**, and the setting was read once at
  startup rather than followed.
- **Three popups declared `role="menu"` without the keyboard contract it promises**, so
  the Tab order did not match what was announced.

### Added

- **Continuous integration.** There was none, so a pull request checked nothing.
- **Cancelling a montage export.** Escape used to close the box while the export ran to
  completion and downloaded a file nobody was waiting for.
- **Reordering a block by keyboard** (`Alt` + arrows), the one editing gesture that had
  no keyboard route, plus arrow keys to move the playhead.
- **33 tests** (178 → 211), including the first that mounts the component to check the
  off-screen render — the export defects above were invisible to everything else.

### Changed

- `RAYON` and `DEMI_VIEWBOX` moved to `src/bot/repere.ts`. They define what the engine
  returns, so they could not stay in a `<script setup>` that exports nothing.
- `MIN_BLOCK` is derived from the longest fade in the catalogue instead of written by
  hand — it only worked because the two happened to match.

### Removed

- `StateDef.hint`: 15 hardcoded French strings nothing read, inside a type meant to
  become public.

[unreleased]: https://github.com/robinnat/mochi/commits/main
[0.1.1]: https://github.com/robinnat/mochi/commits/main
