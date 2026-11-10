import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss()],
  // Le port est fixe : c'est celui que le README annonce, il doit donc valoir pour
  // un `pnpm dev` nu.
  server: { port: 5190 },
  build: {
    // quatre entrees : le site (index.html), sa page docs (docs.html, servie sur /docs), l'application
    // (app.html) et le labo (planches 3D), qui ne la grossit pas
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        docs: fileURLToPath(new URL('./docs.html', import.meta.url)),
        app: fileURLToPath(new URL('./app.html', import.meta.url)),
        lab: fileURLToPath(new URL('./lab.html', import.meta.url))
      },
      output: {
        // mediabunny (export video) et three dans leurs propres morceaux : sinon l'outil de decoupage range ses petites
        // fonctions communes dans le morceau de mediabunny, et chaque page le prechargeait (168 ko pour rien)
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
    // le site, la doc et le labo consomment Mochi comme un utilisateur du paquet : par ses entrees publiques
    alias: [
      { find: /^mochi-world$/, replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
      { find: /^mochi-world\/catalogue$/, replacement: fileURLToPath(new URL('./src/catalogue.ts', import.meta.url)) },
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }
    ]
  }
})
