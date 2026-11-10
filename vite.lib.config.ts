import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Bibliotheque seule : `pnpm build:lib` ecrit `dist-lib/mochi-world.js` (le Web Component `<mochi-bot>` et le moteur)
 * et, a cote, les morceaux charges a la demande (la 3D et Three.js). A copier tel quel dans un projet, quel que soit
 * son framework, ou a servir avec `<script type="module">`.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'mochi-world.js'
    }
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  }
})
