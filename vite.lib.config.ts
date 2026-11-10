import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Bibliotheque seule : `pnpm build:lib` ecrit `dist-lib/mochi-world.js` (le Web Component `<mochi-bot>`, le moteur et les
 * catalogues), `dist-lib/catalogue.js` (les catalogues seuls, sans la balise)
 * et, a cote, les morceaux charges a la demande (la 3D et Three.js). A copier tel quel dans un projet, quel que soit
 * son framework, ou a servir avec `<script type="module">`.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    lib: {
      // deux entrees publiques : `mochi-world` (la balise et tout le reste) et `mochi-world/catalogue` (sans la balise)
      entry: {
        'mochi-world': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
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
