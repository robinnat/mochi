# Contributing to Mochi World

Thanks for taking the time. Mochi World is a small project maintained in spare time, so reviews
can take a while. Small, focused pull requests are the easiest to review.

## Before you start

- For a bug, open an issue with the bug template (steps, browser, render style).
- For a new feature or a larger change, open a feature request first, so we can agree on the
  idea before you write the code.
- For a security problem, do not open a public issue: see [SECURITY.md](SECURITY.md).

## Setup

You need Node.js 24 (the version the CI uses) and Git. The project uses pnpm 11.17.0, run
through `npx`, so you do not need to install pnpm globally.

```bash
git clone https://github.com/robinnat/mochi.git
cd mochi
npx -y pnpm@11.17.0 install
```

## Run

```bash
npx -y pnpm@11.17.0 dev      # http://localhost:5190 (site at /, app at /app.html, lab at /labo.html)
```

The 3D needs WebGL. If your browser has none, the avatar falls back to its SVG drawing.

## Test

```bash
npx -y pnpm@11.17.0 test     # vitest
npx -y pnpm@11.17.0 build    # vue-tsc --noEmit && vite build
```

Both must pass before you open a pull request. `vue-tsc` (run by `build`) is the only type
check, so run the build, not only the tests. Add a test with every fix when you can.

## Code style

There is no formatter or linter config: follow the code around you.

- TypeScript and Vue 3 single-file components with `<script setup lang="ts">`.
- 2 spaces, single quotes, no semicolons.
- `three`, `src/ui/trois/scene3d.ts` and the rest of the 3D are only ever imported dynamically
  (`await import(...)`), never with a static `import` (`src/site/site.test.ts` checks it for the site).
- The constants in `src/bot/` are measurements, not choices. Do not round or "clean up" them
  (see [docs/measurements.md](docs/measurements.md)).
- Code comments, ids (`etoile`, `rendu`) and most files in `docs/` are in French. You can write
  new comments and docs in English.
- Keep the MIT header in [LICENSE](LICENSE) as it is, both copyright lines included.

## Pull requests

- One pull request per topic. Do not mix a fix, a refactor and a new feature.
- Branch from `main` and open the pull request against `main`.
- Describe what changes and why, and how you tested it. Add a screenshot or a short clip for
  anything visual.
- Add a line to [CHANGELOG.md](CHANGELOG.md) under `[Unreleased]` when users would notice the change.
- The CI must be green. `main` is protected: every change goes through a pull request and the
  `verifie` check (install, build, test) has to pass before it can be merged.

## License

By contributing, you agree that your contribution is released under the [MIT License](LICENSE)
of this project.
