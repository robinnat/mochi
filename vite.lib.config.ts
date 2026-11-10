import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Library only: `pnpm build:lib` writes `dist-lib/mochis.js` (the `<mochi-bot>` Web Component, the engine and the
 * catalogs), `dist-lib/catalog.js` (the catalogs alone, without the tag) and, next to them, the chunks loaded on demand
 * (the 3D and Three.js). Copy them as they are into a project, whatever its framework, or serve them with
 * `<script type="module">`.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    // minified like the site (v13): the files are often served as is (`<script type="module">`). Vite leaves the
    // whitespace of ES libraries by default, so the output asks for it.
    rolldownOptions: { output: { minify: true } },
    lib: {
      // two public entries: `mochis` (the tag and everything else) and `mochis/catalog` (without the tag)
      entry: {
        'mochis': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
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
})
