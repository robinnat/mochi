import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Library only: `pnpm build:lib` writes `dist-lib/mochis.js` (the `<mochi-bot>` Web Component, the engine and the
 * catalogs), `dist-lib/catalogue.js` (the catalogs alone, without the tag) and, next to them, the chunks loaded on demand
 * (the 3D and Three.js). Copy them as they are into a project, whatever its framework, or serve them with
 * `<script type="module">`.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    lib: {
      // two public entries: `mochis` (the tag and everything else) and `mochis/catalogue` (without the tag)
      entry: {
        'mochis': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        catalogue: fileURLToPath(new URL('./src/catalogue.ts', import.meta.url))
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`
    }
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  }
})
