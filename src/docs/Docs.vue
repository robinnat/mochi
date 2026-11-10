<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Nav from '@/site/Nav.vue'
import Pied from '@/site/Pied.vue'
import CodeBlock from '@/site/CodeBlock.vue'
import Vivant from '@/site/Vivant.vue'
import { DOCS_BOT } from '@/site/affiches'
import { initTheme } from '@/site/theme'
import { COLOR_LABEL, EMPLACEMENT_LABEL, EMPLACEMENTS_IDS, ACCESSOIRES_SITE, HUMEURS_SITE, SHAPE_LABEL } from '@/site/catalog'
import { COLORS, SHAPES } from '@/bot/skins'
import { closedPath, toPoints } from '@/bot/shape'
import { REACTION_IDS } from '@/bot/humeurs'
import {
  DEPOT,
  EXEMPLE_RAPIDE,
  EX_ACCESSOIRES,
  EX_FIGE,
  EX_FORME_COULEUR,
  EX_METHODES,
  EX_MOODS,
  EX_MOTEUR,
  EX_MOTEUR_BUILD,
  EX_STYLES,
  EX_THEME,
  INSTALL_DEPOT,
  INSTALL_NPM,
  METHODES,
  PROPS,
  SOMMAIRE,
  TSCONFIG_ALIAS,
  VITE_ALIAS
} from './exemples'
import { ALIAS_HUMEURS, REACTIONS_DOC } from './catalogues'

initTheme()

const silhouette = (radii: number[]) => closedPath(toPoints({ radii, rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }, 10))
const FORMES = SHAPES.map((s) => ({ id: s.id, label: SHAPE_LABEL[s.id] ?? s.id, d: silhouette(s.radii) }))
const ACCS = EMPLACEMENTS_IDS.map((e) => ({ e, label: EMPLACEMENT_LABEL[e], items: ACCESSOIRES_SITE(e) }))
const reactions = REACTION_IDS

/** Section courante du sommaire : celle qui traverse le haut de l'ecran. */
const courant = ref(SOMMAIRE[0]!.id)
let obs: IntersectionObserver | null = null
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return
  obs = new IntersectionObserver(
    (es) => {
      for (const e of es) if (e.isIntersecting) courant.value = e.target.id
    },
    { rootMargin: '-20% 0px -70% 0px' }
  )
  for (const s of SOMMAIRE) {
    const el = document.getElementById(s.id)
    if (el) obs.observe(el)
  }
})
onBeforeUnmount(() => obs?.disconnect())
</script>

<template>
  <Nav accueil="/" page="docs" />
  <main class="docs">
    <header class="docs-tete wrap">
      <p class="surtitre">Documentation</p>
      <h1 class="docs-titre">Put a Mochi<br />in your app.</h1>
      <p class="chapo">
        Mochi World is one Vue 3 component, <code>&lt;MochiBot&gt;</code>, on top of a small engine with no framework and no clock.
        This page covers everything you need: installation, the main options, and copyable examples.
      </p>
    </header>

    <div class="wrap docs-grille">
      <aside class="docs-sommaire" aria-label="On this page">
        <p class="docs-sommaire-titre">On this page</p>
        <ul>
          <li v-for="s in SOMMAIRE" :key="s.id">
            <a :href="'#' + s.id" :aria-current="courant === s.id ? 'true' : undefined">{{ s.titre }}</a>
          </li>
        </ul>
      </aside>

      <article class="docs-corps">
        <section id="install" class="doc">
          <h2>Installation</h2>
          <div class="encart">
            <strong>The npm package is coming soon.</strong>
            <span><code>mochi-world</code> is not published yet, so <code>{{ INSTALL_NPM }}</code> does not work today. Until then, add Mochi from the repository.</span>
          </div>
          <p>
            Mochi needs <strong>Vue 3</strong> and <strong>Three.js</strong>, in an app built with Vite. Copy the engine and the
            component into your project:
          </p>
          <CodeBlock :code="INSTALL_DEPOT" titre="Terminal" />
          <p>
            The code imports its own files with <code>@/</code>, pointing at <code>src/</code>. Apps made with
            <code>npm create vue@latest</code> already have this alias; otherwise add it:
          </p>
          <CodeBlock :code="VITE_ALIAS" titre="vite.config.ts" />
          <CodeBlock :code="TSCONFIG_ALIAS" titre="tsconfig.json" />
          <p class="note">
            Copying the folders keeps the MIT license notice of <a :href="DEPOT + '/blob/main/LICENSE'">LICENSE</a>: ship it with
            your app.
          </p>
        </section>

        <section id="first" class="doc">
          <h2>Your first Mochi</h2>
          <div class="doc-duo">
            <CodeBlock :code="EXEMPLE_RAPIDE" titre="App.vue" />
            <div class="doc-apercu">
              <Vivant :taille="180" affiche="docs" v-bind="DOCS_BOT" alt="A purple star Mochi, the result of the example" />
              <span>Result: live, it reacts to touch.</span>
            </div>
          </div>
          <p>
            That is a breathing, blinking 3D star that says hello when it appears and reacts when you touch it. Every option below is
            a prop of the same component.
          </p>
        </section>

        <section id="shapes" class="doc">
          <h2>Shapes and colours</h2>
          <p><code>shape</code> takes one of the {{ FORMES.length }} shape ids. <code>color</code> takes a colour id or any hex colour.</p>
          <CodeBlock :code="EX_FORME_COULEUR" titre="Template" />
          <h3>Shapes</h3>
          <ul class="ids-formes">
            <li v-for="f in FORMES" :key="f.id">
              <svg viewBox="-13 -13 26 26" width="28" height="28" aria-hidden="true"><path :d="f.d" fill="currentColor" /></svg>
              <code>{{ f.id }}</code>
              <span>{{ f.label }}</span>
            </li>
          </ul>
          <h3>Colours</h3>
          <ul class="ids-couleurs">
            <li v-for="c in COLORS" :key="c.id">
              <span class="pastille-doc" :style="{ background: c.hex }" aria-hidden="true" />
              <code>{{ c.id }}</code>
              <span>{{ COLOR_LABEL[c.id] }}</span>
            </li>
          </ul>
        </section>

        <section id="styles" class="doc">
          <h2>Styles</h2>
          <p>
            All three styles are real 3D: <code>3d</code> (Soft, the default), <code>pixel3d</code> (Pixel) and <code>flat3d</code>
            (Flat). The model is the same, only the drawing changes.
          </p>
          <CodeBlock :code="EX_STYLES" titre="Template" />
          <p class="note">
            Three.js is a dynamic import: it is downloaded the first time a 3D Mochi is shown, never before. Without WebGL, Mochi
            falls back to an SVG drawing.
          </p>
        </section>

        <section id="moods" class="doc">
          <h2>Moods</h2>
          <p>A mood changes the face and the way the body moves. It loops until you change it, and the change glides.</p>
          <CodeBlock :code="EX_MOODS" titre="Moods.vue" />
          <div class="tableau">
            <table>
              <thead><tr><th>Id</th><th>Also accepted</th><th>What it does</th></tr></thead>
              <tbody>
                <tr v-for="h in HUMEURS_SITE" :key="h.id">
                  <td><code>{{ h.id }}</code></td>
                  <td><code v-for="a in ALIAS_HUMEURS[h.id]" :key="a" class="alias">{{ a }}</code></td>
                  <td>{{ h.texte }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="accessories" class="doc">
          <h2>Accessories</h2>
          <p>
            Five slots, one accessory per slot, all stackable. Pass the id alone for the catalogue colours, or an object with your
            own <code>c1</code> (main colour) and <code>c2</code> (second colour, for two-colour pieces).
          </p>
          <CodeBlock :code="EX_ACCESSOIRES" titre="Template" />
          <div class="slots">
            <div v-for="s in ACCS" :key="s.e" class="slot-doc">
              <h3><code>{{ s.e }}</code> <span>{{ s.label }}</span></h3>
              <ul>
                <li v-for="a in s.items" :key="a.id">
                  <span class="duo-pastilles" aria-hidden="true">
                    <span :style="{ background: a.c1 }" />
                    <span v-if="a.c2 !== a.c1" :style="{ background: a.c2 }" />
                  </span>
                  <code>{{ a.id }}</code>
                  <span>{{ a.label }}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section id="theme" class="doc">
          <h2>Light and dark</h2>
          <p>
            In dark mode the eyes turn black, and the body is lightened only if it would not contrast enough with them. Set it on one
            Mochi with <code>theme</code>, or for all of them with <code>themeCourant</code> (light by default).
          </p>
          <CodeBlock :code="EX_THEME" titre="Template" />
        </section>

        <section id="reactions" class="doc">
          <h2>Reactions and methods</h2>
          <p>
            With <code>interactions</code> on (the default), Mochi reacts by itself: hover, tap, double tap, long press, shake. You can
            also drive it from your code through a template ref.
          </p>
          <CodeBlock :code="EX_METHODES" titre="Celebrate.vue" />
          <div class="tableau">
            <table>
              <thead><tr><th>Method</th><th>What it does</th></tr></thead>
              <tbody>
                <tr v-for="m in METHODES" :key="m.nom">
                  <td><code>{{ m.signature }}</code></td>
                  <td>{{ m.texte }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>Reaction ids for <code>react()</code>:</p>
          <ul class="ids-ligne">
            <li v-for="r in reactions" :key="r"><code>{{ r }}</code> <span>{{ REACTIONS_DOC[r] }}</span></li>
          </ul>
        </section>

        <section id="performance" class="doc">
          <h2>Still frames and performance</h2>
          <p>
            The engine is a pure function of time, so <code>frozen-at</code> renders one exact instant with no animation loop: ideal
            for lists and thumbnails. All 3D Mochis share one WebGL context. The <code>pret</code> event fires when the first 3D
            frame is painted: until then you can show a still image, as this site does.
          </p>
          <CodeBlock :code="EX_FIGE" titre="Template" />
        </section>

        <section id="props" class="doc">
          <h2>All props</h2>
          <p>The main props of <code>&lt;MochiBot&gt;</code>. A few older ones remain in <a :href="DEPOT + '/blob/main/src/components/MochiBot.vue'">MochiBot.vue</a>.</p>
          <div class="tableau">
            <table class="props">
              <thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
              <tbody>
                <tr v-for="p in PROPS" :key="p.nom">
                  <td><code>{{ p.attr }}</code></td>
                  <td><code class="type">{{ p.type }}</code></td>
                  <td><code class="type">{{ p.defaut }}</code></td>
                  <td>{{ p.texte }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="engine" class="doc">
          <h2>Engine without Vue</h2>
          <p>
            <code>src/bot/</code> has no framework and no clock. <code>tools/moteur.ts</code> is an engine-only entry point; bundle
            it once from the repository, then draw the frames yourself (SVG, canvas). This gives the 2D drawing, not the 3D styles.
          </p>
          <CodeBlock :code="EX_MOTEUR_BUILD" titre="Terminal" />
          <CodeBlock :code="EX_MOTEUR" titre="main.js" />
          <p class="note">The README has a complete SVG drawing loop: <a :href="DEPOT + '#vanilla-engine-only-no-vue'">Vanilla</a>.</p>
        </section>
      </article>
    </div>
  </main>
  <Pied />
</template>
