import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Library only (`pnpm build:lib`). Two builds of the same two public entries, `mochiz` (the `<mochi-bot>` Web
 * Component, the engine and the catalogs) and `mochiz/catalog` (the catalogs alone, without the tag):
 *
 * - default mode -> `dist-lib/`: the npm package. Three.js is NOT inside: it is a peer dependency, imported from the
 *   project's own `three` (`three/src/...`, one file per class, so the project's bundler keeps only what Mochiz draws
 *   with).
 * - `--mode standalone` -> `dist-lib/standalone/`: Three.js included, for a plain HTML page (a `<script type="module">`
 *   from a CDN or a copied folder), where there is no bundler to resolve `three`.
 *
 * In both, the 3D part (and Three.js in the standalone build) is a separate chunk, loaded with the first Mochi shown.
 * The type declarations (`dist-lib/types/`) come from `tools/lib-types.mjs`.
 */
export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone'
  return {
    publicDir: false,
    build: {
      outDir: standalone ? 'dist-lib/standalone' : 'dist-lib',
      emptyOutDir: true,
      rolldownOptions: {
        // minified like the site (v13): the files are often served as is (`<script type="module">`). Vite leaves the
        // whitespace of ES libraries by default, so the output asks for it.
        output: { minify: true },
        // the npm build leaves Three.js to the project (peer dependency); the add-ons we use stay inside, pointed at
        // the same `three/src` files, so there is still one copy of each class
        external: standalone ? [] : [/^three\/src\//]
      },
      lib: {
        // two public entries: `mochiz` (the tag and everything else) and `mochiz/catalog` (without the tag)
        entry: {
          mochiz: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
          catalog: fileURLToPath(new URL('./src/catalog.ts', import.meta.url))
        },
        formats: ['es'],
        fileName: (_format, name) => `${name}.js`
      }
    },
    resolve: {
      alias: [
        // Three.js add-ons (BufferGeometryUtils) import 'three': point it at our single entry, one copy of each class
        { find: /^three$/, replacement: fileURLToPath(new URL('./src/ui/3d/three.ts', import.meta.url)) },
        { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }
      ]
    }
  }
})
