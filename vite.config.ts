import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss()],
  // Fixed port: the one the README gives, so it must hold for a bare `pnpm dev`.
  server: { port: 5190 },
  build: {
    // four entries: the site (index.html), its docs page (docs.html, served at /docs), the app (app.html) and the
    // lab (3D sheets), which does not make the app bigger
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        docs: fileURLToPath(new URL('./docs.html', import.meta.url)),
        app: fileURLToPath(new URL('./app.html', import.meta.url)),
        lab: fileURLToPath(new URL('./lab.html', import.meta.url))
      },
      output: {
        // mediabunny (video export) and three in their own chunks: otherwise the bundler puts its small shared functions
        // in the mediabunny chunk, and every page preloaded it (168 kB for nothing)
        advancedChunks: {
          groups: [
            { name: 'mediabunny', test: /node_modules[\\/]mediabunny/ },
            { name: 'three', test: /node_modules[\\/]three/ }
          ]
        }
      }
    }
  },
  resolve: {
    // the site, the docs and the lab use Mochis like a user of the package: through its public entries
    alias: [
      { find: /^mochis$/, replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
      { find: /^mochis\/catalog$/, replacement: fileURLToPath(new URL('./src/catalog.ts', import.meta.url)) },
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }
    ]
  }
})
