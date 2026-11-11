import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { pageIdOf, pagesOf, SITE } from './src/docs/markdown'

/** Clean page addresses in `pnpm dev` and `vite preview`, like on Vercel (`cleanUrls`): /app, /docs and /lab. */
const PAGES = ['app', 'docs', 'lab']
function cleanUrls(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const m = req.url?.match(/^\/([a-z]+)\/?(\?.*)?$/)
    if (m && PAGES.includes(m[1]!)) req.url = `/${m[1]}.html${m[2] ?? ''}`
    next()
  }
  return {
    name: 'mochiz-clean-urls',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite)
  }
}

/**
 * sitemap.xml, written at build time: the home page, the app, then every docs page listed by docs/README.md (the same
 * list as the /docs menu), so a new docs page is in the sitemap without anyone thinking of it. The lab is left out:
 * it is a page for contributors and says `noindex`.
 */
export function sitemap(): string {
  const docs = pagesOf(readFileSync(new URL('./docs/README.md', import.meta.url), 'utf8')).map(
    (p) => `${SITE}/docs?page=${pageIdOf(p.file)}`
  )
  const urls = [`${SITE}/`, `${SITE}/app`, `${SITE}/docs`, ...docs]
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${u.replace(/&/g, '&amp;')}</loc></url>`),
    '</urlset>',
    ''
  ].join('\n')
}

function sitemapFile(): Plugin {
  return {
    name: 'mochiz-sitemap',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() })
    }
  }
}

export default defineConfig({
  plugins: [tailwindcss(), cleanUrls(), sitemapFile()],
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
    // the site, the docs and the lab use Mochiz like a user of the package: through its public entries
    alias: [
      // Three.js add-ons (BufferGeometryUtils) import 'three': point it at our single entry, one copy of each class
      { find: /^three$/, replacement: fileURLToPath(new URL('./src/ui/3d/three.ts', import.meta.url)) },
      { find: /^mochiz$/, replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
      { find: /^mochiz\/catalog$/, replacement: fileURLToPath(new URL('./src/catalog.ts', import.meta.url)) },
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }
    ]
  }
})
