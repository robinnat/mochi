import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // the environment stays `node` by default; a DOM is asked for file by file (`// @vitest-environment happy-dom`)
  resolve: {
    // the site and the docs use Mochiz like a user of the package: through its public entries
    alias: [
      // Three.js add-ons (BufferGeometryUtils) import 'three': point it at our single entry, one copy of each class
      { find: /^three$/, replacement: fileURLToPath(new URL('./src/ui/3d/three.ts', import.meta.url)) },
      { find: /^mochiz$/, replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
      { find: /^mochiz\/catalog$/, replacement: fileURLToPath(new URL('./src/catalog.ts', import.meta.url)) },
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }
    ]
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // the Three.js add-ons go through the bundler like in the build, so that their 'three' import gets the alias above
    server: { deps: { inline: [/three[\\/]examples/] } }
  }
})
