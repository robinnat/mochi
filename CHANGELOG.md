# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-11

First version ready for npm. Not published yet: the docs keep the install from the repository (copy of
`dist-lib/standalone`) until it is; the npm instructions wait in `docs/drafts/npm-install.md`.

### Added (package)

- **npm package `mochis`**: `exports` for `mochis` and `mochis/catalog`, with real TypeScript declarations
  (`dist-lib/types/`, generated from the sources); `document.querySelector('mochi-bot')` is typed.
- **Three.js is a peer dependency** (`three` `^0.187.0`): the package build imports it from your project
  (`three/src/...`, one file per class), so your bundler keeps one copy and only the classes Mochis draws with.
- **Standalone build** (`mochis/standalone`, `dist-lib/standalone/`): the same two entries with Three.js included. It is
  the folder the docs tell you to copy (plain HTML or `src/vendor/mochis`).
- The package only ships `dist-lib/`, the READMEs, the license and this changelog; `sideEffects` names the two files
  that declare the tag.
- The website moved to https://mochiz.vercel.app (canonical and `og:url` tags added).

### Removed (breaking)

- **`outline` and `outline-width`** (cartoon outline) and the shared `currentOutline` setting, with the checkbox of
  `/app`. The thin outline of the Pixel style stays: it is part of the Pixel drawing, not an option.
- **`highlight`**: the soft shine spot at the top left of the Soft style is gone, always. `shading` only means the
  relief (`shading="false"`: one flat color).
- **Pixel size `large`**: `pixel` takes `medium` or `fine` (default `fine`).
- An old attribute (`outline`, `outline-width`, `highlight`) on a page is simply ignored; an old `pixel="large"` falls
  back to `medium`. Settings saved in the browser by older versions of `/app` are migrated: the outline setting is
  dropped, a saved `large` (or `gros`) pixel size becomes `medium` (`src/ui/legacy.ts`).
- `mediabunny` (video export of `/app`) is no longer a dependency of the package: only the website uses it.

### Fixed (docs)

- `/docs`: the clone URL of the shell examples is no longer colored as a comment, and `#` comments of shell lines are;
  the side menu lights the section being read (it used to light the next one after a jump to an anchor).
- `docs/styles.md`: the cadence goes back to every frame below 6 ms (it said 5; the code says `CADENCE_FULL_MS` = 6).

### Changed (performance)

- **Each Mochi keeps its own 3D body** (meshes, face texture, accessories) while all of them still share one WebGL
  context. Before, every Mochi undid the previous one's work every frame (accessories rebuilt with ray casting, face
  repainted): 6 Mochis with accessories drew at 4 frames per second on a Mac, now 60.
- **Off-screen Mochis draw nothing** (`IntersectionObserver`); their clock keeps going.
- **Adaptive cadence**: when drawing every Mochi at every frame gets too heavy, each one draws every other frame (30 per
  second, steady). A Mochi with its own `fps` keeps it.
- **Faster mesh**: vertex normals, normal smoothing and the depth of the shapes of revolution are computed directly
  on typed arrays (same results).
- **Smaller download**: Three.js enters through `src/ui/3d/three.ts`, one class per source file, so it is tree-shaken
  (site chunk 744 kB to 587 kB); the library build is minified.
- **Site**: the wordmark font (Fredoka 600, Latin letters, 7 kB) is served with the site instead of a blocking Google
  Fonts stylesheet; the first posters of the hero are fetched before the scripts run.

### Changed (breaking)

- **Everything is in English, and the product is now called Mochis.** Public ids, attributes, events, methods and
  entry points were renamed. The package is not published yet, so there are no aliases; settings saved in the browser
  by older versions of `/app` are migrated on the first visit (`src/ui/legacy.ts`).

  | Before | Now |
  | --- | --- |
  | `mochi-world`, `mochi-world/catalogue`, `dist-lib/mochi-world.js` | `mochis`, `mochis/catalogue`, `dist-lib/mochis.js` |
  | shapes `cercle`, `galet`, `hexagone`, `nuage`, `goutte`, `etoile`, `fleur`, `oeuf`, `coeur` | `circle`, `pebble`, `hexagon`, `cloud`, `drop`, `star`, `flower`, `egg`, `heart` |
  | colors `encre`, `brun`, `rouge`, `corail`, `ambre`, `citron`, `pomme`, `vert`, `ciel`, `bleu`, `rose`, `cerise`, `gris`, `creme` | `ink`, `brown`, `red`, `coral`, `amber`, `lime`, `apple`, `green`, `sky`, `blue`, `pink`, `cherry`, `grey`, `cream` |
  | moods `repos`, `reflechit`, `travaille`, `attend`, `termine`, `bloque`, `dort` | `idle`, `thinking`, `working`, `waiting`, `done`, `blocked`, `asleep` |
  | reactions `sursaut`, `rigole`, `rougit`, `etourdi`, `coucou` | `startle`, `laugh`, `blush`, `dizzy`, `wave` |
  | slots `tete`, `yeux`, `visage`, `bas`, `dos` | `head`, `eyes`, `face`, `neck`, `back` |
  | attributes `rendu`, `rendu3d`, `douceur`, `contour`, `epaisseur-contour`, `reflet`, `ombre`, `ombrage`, `accessoires`, `coucou`, `ordinateur`, `porte` | `render-style`, `material`, `softness`, `outline`, `outline-width`, `highlight`, `shadow`, `shading`, `accessories`, `wave`, `laptop`, `worn` |
  | events `pret`, `sans3d` | `ready`, `no3d` |
  | methods `rendAt`, `relacher`, `regarder` | `renderAt`, `release`, `lookAt` |
  | pixel sizes `gros`, `moyen`, `fin` | `large`, `medium`, `fine` |

- **One documentation.** The website's `/docs` page is now built from `README.md` and `docs/*.md` (new
  `docs/getting-started.md` and `docs/reference.md`), with live examples taken from their code blocks. A test fails if
  the site and the repository could say different things, or if the docs and the code disagree.
- The app falls back to English when the browser asks for a language it does not speak.
- **American spelling in the API**: the light entry is `mochis/catalog` (`dist-lib/catalog.js`) and the gray color id is
  `gray`. Settings saved with `grey` are moved to `gray`.
- **The theme follows the device by default.** Without a `theme`, a Mochi uses `currentTheme`, which is now `auto`: dark
  when the visitor's system is in dark mode. Set `currentTheme.value` to `light` or `dark` to choose (the app sets
  `light`).
- **The default `label` is English** (`Animated Mochi avatar`), whatever the browser language. The tag no longer loads
  the app's translations; the app passes its own translated label.
- Install guide: with a bundler, copy `dist-lib/` to `src/vendor/mochis/` and import `./vendor/mochis/mochis.js`
  (importing from `public/` fails in Vite). Plain HTML loads `/mochis/mochis.js`.
- `package.json` declares `engines.node` `>=22.12.0`; the CI runs Node 24.
- The reference has a short "Cycle player" section.
- The lab moved from `/labo` to `/lab` (`/labo` redirects).
- New icons (favicon, app icons, web manifest) and the Mochis name in the site's bar and footer.

### Removed

- The `worn` option (an older set of eight accessories, a duplicate of `accessories`) and its 3D pieces.
- The `material` option: the render style picks the material (`3d` is Soft, `flat3d` Flat, `pixel3d` Pixel), and
  `softness` still tunes Soft. The `Material` type is no longer exported.
- **No 2D any more.** The old SVG drawings (`original`, `pixel`, `argile`, `bubble`, partly derived from bloub) are
  gone, with their pixel-art rasteriser, the 2D drawing of worn accessories and the 2D job accessories (the
  `accessory` prop). Mochi is always drawn in 3D (Soft, Flat, Pixel). An unknown `renderStyle` (old ids included) falls
  back to the current style. Without WebGL, a short message takes the Mochi's place and the element fires `no3d`.
- The animated SVG export: it animated the 2D eyes, and the 3D has no vector drawing to animate.
- The blush accessory (`face: 'cheeks'`) and with it the face slot in pickers: 22 accessories, four slots
  (head, eyes, neck, back). Glasses and the monocle stay under eyes. Blushing on long press (an expression) stays.

### Changed

- Exports come from the 3D: PNG and SVG are a still of the 3D canvas (an image inside the SVG); the animated GIF
  and the montage (GIF, MP4) are rendered frame by frame from an off-screen 3D Mochi, in the screen's style.
- No outline around the eyes any more: in the light theme the eyes are always white, for every colour (yellow
  and lime included); in the dark theme they stay black.
- The site, the docs and the lab use Mochi only through its public entry points, `mochis` and the new
  `mochis/catalogue` (catalogues and shared settings without the tag; `dist-lib/catalogue.js`). A test fails
  if they import an internal file. The docs show each example's result live, from the example's own tags.

### Added

- GitHub star count next to the GitHub icon in the site header (public API, no token, cached one hour; just the
  icon when the call fails).

- **No framework any more.** The avatar is now a native web component, `<mochi-bot>`, with no dependency:
  it works in plain HTML, React, Svelte, Angular or any other framework. Every option is an attribute
  (kebab-case text, JSON for `accessories` and `cycle`) and a property (camelCase, any value); methods
  (`seek`, `renderAt`, `setMood`, `react`, `release`, `lookAt`) are on the element; events are
  `CustomEvent`s (`ready`, `statechange`, `blockchange`, `playingchange`, `elapsedchange`). The drawing is an
  `<svg>` in the light DOM, so exports serialise it as before. Removed from the page, it stops its loop,
  listeners and timers. The site, the app, the docs and the lab are plain TypeScript on a small in-house
  renderer (`src/ui/dom/`). Same pages, texts and URLs. The JavaScript loaded on first visit drops by about
  a third (site: 75 to 49 kB gzip, app: 92 to 65 kB gzip).
- Pages that host a Mochi keep their own language and title: only the app follows its language setting.
- The lab (`/lab`) fits a phone screen.
- Dev dependencies: Vite 8.3, Vitest 4.1.12, happy-dom 21.0.4 (security fixes).

- The project is now called **Mochis** (the characters are still Mochi). The package name in
  `package.json` is `mochis` (not published yet). Page titles, meta tags, the site header and footer
  follow. Code names do not change: the component (`MochiBot`), the `mochi:` storage keys and every prop stay as they are.

### Added

- `pnpm build:lib`: the library alone in `dist-lib/` (`mochis.js` plus the lazy 3D chunks), to copy
  into any project until the npm package is published.

- Community files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue and pull request templates,
  and a Dependabot config (weekly, at most 3 open pull requests).
- French versions of the README and of the community files (`README.fr.md`, `CONTRIBUTING.fr.md`,
  `CODE_OF_CONDUCT.fr.md`, `SECURITY.fr.md`), with an English | Français switch at the top of each.
  English stays the reference.

### Removed (for now)

- The two pairs of wings (angel, bat): out of `ACCESSORIES` (23 accessories), kept in `REMOVED`.

- Freckles, beauty mark, moustache and cat whiskers: out of `ACCESSORIES` (29 to 25 accessories), kept in `REMOVED`.
- The jumping movement: the "Movement" section of the site, `src/bot/sauts.ts`, the isometric space `EspaceIso`
  and the lab's `#iso` view.

### Fixed

- Changing the shape left the accessories where they were laid out on the half-morphed body; they now re-seat once the morph ends.

### Added

- The `asleep` mood shows small rising Z marks (all renderers).

### Changed (site)

- Landing page: seven moods demo, live interactions (hover, tap, double tap, long press, hello on arrival, which now
  grows the Mochi out of the floor), slot-based accessory picker with colours, and a light/dark/auto switch
  (3D eyes turn black in dark). `MochiBot` gains the `accessories` prop (slot selection) and follows the
  site theme when `theme` is not set. The tie accessory is retired (kept in `REMOVED`).

### Added (moods and interactions, proposal)

- Seven looped moods (`idle`, `thinking`, `working`, `waiting`, `done`, `blocked`, `asleep`) and six
  interactions (hover follows the cursor, tap, double tap, long press blushes, shake or fast turn makes
  it dizzy, a greeting on appearance), face and body only. API: `setMood(id)`, `react(id)`, `release()`,
  `lookAt()` on `MochiBot`; props `mood`, `interactions`, `wave`, `fps`; `Moods` class in
  `src/bot/moods.ts`. Respects `prefers-reduced-motion`. See `docs/moods.md`.
- `Gesture` gains optional face fields (crescent eyes, mirrored tilt, gaze offset, head tilt, cheek tint);
  without them `sample(t)` is unchanged byte for byte. In 3D the lid, slant and head tilt now apply to the
  front-facing eyes when the layer is on.

### Added (dark theme, proposal)

- `theme: 'light' | 'dark'` (default `'light'`, rendering unchanged): in `'dark'` the eyes are black
  (`#0a0a0c`) in the three styles and the 11 shapes, all moods and blinks included. Lighting, rim glows
  and reflection are the same, but they no longer add light on the eyes. Available as the last arguments
  of `renderAvatar(..., theme, eyeContrast)`, `Mochi3d.setTheme`, `EspaceIso` option `theme` and the
  `theme` prop of `MochiBot`.
- Dark theme only: a body whose contrast with the black eye is under 3:1 is lightened just enough to reach
  3:1 (ink, dark navy and dark grey bodies); other colours are untouched. `eyeContrast = 0` disables it.
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

- **Worn accessories** (`src/bot/worn.ts`, `worn` prop): round glasses, sunglasses, mini top hat,
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
- **Real volumes for every 3D shape** (`src/ui/3d/volume.ts`, `docs/styles.md`): the body is
  no longer a flat cushion seen from the side. Height now depends on the distance to the edge
  (flat front, constant-radius rounded edge, straight wall); each shape has a volume profile.
  The squircle is a true cube, triangle/hexagon/star are rounded prisms, flower/cloud are
  domed cushions, balls stay round (circle is still an exact sphere). Eyes are painted on the
  front face only and kept off the rounded edge. Lab view `#turn` shows each shape from four
  angles.

### Added

- **Smooth 3D shading, now the default** (`src/ui/3d/material.ts`, `docs/styles.md`): new `soft`
  material, a continuous matte falloff (no band, no specular, no rim light, low contrast) with a
  `softness` parameter (`light` ~16 % darker at the lowest, `strong` ~24 %). The 3D style now
  uses `soft` / `strong`; `flat` stays in code only.
- **Flat 3D for the real 3D** (`src/ui/3d/material.ts`, `docs/styles.md`): the default
  material is now `flat` (two flat tones, flat 2D colours, flat white eyes), with an optional
  **cartoon outline** (`outline`, a "Cartoon outline" checkbox in the Customize view) and an
  organic shadow edge. `toon`, `toon-outline` and `lowpoly` stay in code only; `realistic` is
  internal. The 3D style is now labelled "3D". Lab view `#shapes3d`.
- **Optional gesture layer** (`src/bot/gestures.ts`, `docs/gestures.md`): seeded idle gestures
  every 4 to 12 s with a per-seed personality, a bounce on touch, sleep and failure
  postures, seven working activities. `engine.sample(t, gesture)` takes it as an optional
  second argument; without it the frame is byte-identical (tested).
- `tools/engine.ts`: engine-only entry point (no framework) to bundle the engine for another page.
- **Job accessories** (`src/bot/accessories.ts`, `docs/accessories.md`): nine animated props
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

- **Playback could never get past a repeated animation.** Writing `#state=` fired a
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
- **`toMp4` leaked its encoder on failure.** Chrome caps simultaneous hardware
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

- `RADIUS` and `HALF_VIEWBOX` moved to `src/bot/frame.ts`. They define what the engine
  returns, so they could not stay in a `<script setup>` that exports nothing.
- `MIN_BLOCK` is derived from the longest fade in the catalogue instead of written by
  hand — it only worked because the two happened to match.

### Removed

- `StateDef.hint`: 15 hardcoded French strings nothing read, inside a type meant to
  become public.

[unreleased]: https://github.com/robinnat/mochi/commits/main
[0.2.0]: https://github.com/robinnat/mochi/commits/main
[0.1.1]: https://github.com/robinnat/mochi/commits/main
