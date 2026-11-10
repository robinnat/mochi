import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // l'environnement reste `node` par defaut ; un DOM se demande fichier par fichier (`// @vitest-environment happy-dom`)
  resolve: {
    // le site, la doc et le labo consomment Mochi comme un utilisateur du paquet : par ses entrees publiques
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
