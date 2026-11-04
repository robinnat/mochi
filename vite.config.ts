import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Le port est fixe : c'est celui que le README annonce, il doit donc valoir pour
  // un `pnpm dev` nu.
  server: { port: 5190 },
  build: {
    // trois entrees : le site (index.html), l'application (app.html) et le labo (3D, scene
    // isometrique), qui ne la grossit pas
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app.html', import.meta.url)),
        labo: fileURLToPath(new URL('./labo.html', import.meta.url))
      }
    }
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  }
})
