import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // the environment stays `node` by default; a DOM is asked for file by file (`// @vitest-environment happy-dom`)
  resolve: {
    // the site, the docs and the lab use Mochis like a user of the package: through its public entries
    alias: [
      { find: /^mochis$/, replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
      { find: /^mochis\/catalogue$/, replacement: fileURLToPath(new URL('./src/catalogue.ts', import.meta.url)) },
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }
    ]
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
