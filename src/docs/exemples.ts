/**
 * Contenu de la page docs (anglais) : exemples de code et tableau des props. Tout vient de la VRAIE API du depot :
 * `exemples.test.ts` verifie que chaque prop citee existe dans `MochiBot.vue`, que chaque methode est exposee, et que
 * les ids des exemples (formes, couleurs, humeurs, accessoires, styles) sont ceux des catalogues du moteur.
 */

export const DEPOT = 'https://github.com/robinnat/mochi'

/** Installation depuis le depot : le paquet npm n'est PAS publie (06/11/2026). Essai fait dans une app Vue 3 + Vite neuve. */
export const INSTALL_DEPOT = `# 1. Get the source
git clone https://github.com/robinnat/mochi.git

# 2. Copy the engine and the component into your Vue 3 + Vite app
cp -r mochi/src/bot mochi/src/ui mochi/src/i18n my-app/src/
mkdir -p my-app/src/components
cp mochi/src/components/MochiBot.vue my-app/src/components/
find my-app/src/bot my-app/src/ui my-app/src/i18n -name '*.test.ts' -delete

# 3. Add Three.js (it is only loaded when a 3D Mochi is shown)
cd my-app
npm install three
npm install -D @types/three`

export const INSTALL_NPM = 'npm install mochi-bots'

/** L'alias `@` vers `src/` : celui de create-vue ; le code de Mochi importe avec `@/bot/...`. */
export const VITE_ALIAS = `// vite.config.ts
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  }
})`

export const TSCONFIG_ALIAS = `// tsconfig.json (compilerOptions)
"paths": { "@/*": ["./src/*"] }`

export const EXEMPLE_RAPIDE = `<script setup lang="ts">
import MochiBot from './components/MochiBot.vue'
</script>

<template>
  <MochiBot
    shape="etoile"
    color="#8b5cf6"
    mood="repos"
    :size="200"
    coucou
  />
</template>`

export const EX_FORME_COULEUR = `<!-- a catalogue colour id -->
<MochiBot shape="nuage" color="rose" />

<!-- or any hex colour, long or short -->
<MochiBot shape="coeur" color="#ff8800" />
<MochiBot shape="squircle" color="#f80" />`

export const EX_STYLES = `<!-- Soft is the default -->
<MochiBot rendu="3d" />

<!-- Pixel: pixel sizes gros, moyen or fin (the default) -->
<MochiBot rendu="pixel3d" pixel="moyen" />

<!-- Flat, with a cartoon outline twice as thick -->
<MochiBot rendu="flat3d" contour :epaisseur-contour="2" />

<!-- turn the model: radians around the vertical axis -->
<MochiBot :yaw="0.5" />

<!-- no highlight, no ground shadow, no body shading -->
<MochiBot :reflet="false" :ombre="false" :ombrage="false" />`

export const EX_MOODS = `<script setup lang="ts">
import { ref } from 'vue'
import MochiBot from './components/MochiBot.vue'

const mood = ref('travaille')
<\/script>

<template>
  <!-- French ids, or the English aliases: working, done, sleeping... -->
  <MochiBot :mood="mood" shape="squircle" />

  <!-- travaille shows a small 3D laptop; hide it -->
  <MochiBot mood="travaille" :ordinateur="false" />

  <button @click="mood = 'termine'">Done</button>
</template>`

export const EX_ACCESSOIRES = `<!-- one accessory per slot, in its catalogue colours -->
<MochiBot :accessoires="{ tete: 'casquette', yeux: 'rondes' }" />

<!-- or with your colours: c1 is the main colour, c2 the second one -->
<MochiBot
  :accessoires="{
    tete: { id: 'fleur', c1: '#f48fb1', c2: '#f2b83d' },
    bas: { id: 'echarpe', c1: '#4a8df0' },
    dos: 'cape'
  }"
/>`

export const EX_THEME = `<!-- one avatar -->
<MochiBot theme="dark" />

<!-- or every Mochi without a theme prop, at once -->
<script setup lang="ts">
import { themeCourant } from '@/ui/trois/themeCourant'

themeCourant.value = 'dark'
<\/script>`

export const EX_METHODES = `<script setup lang="ts">
import { ref } from 'vue'
import MochiBot from './components/MochiBot.vue'

const bot = ref<InstanceType<typeof MochiBot> | null>(null)

function celebrate() {
  bot.value?.setMood('termine')   // glide to another mood
  bot.value?.react('rigole')      // play a reaction, then back to the mood
}
function lookAtTopRight() {
  bot.value?.regarder({ nx: 1, ny: -1 }) // -1 to 1, right and down positive
}
<\/script>

<template>
  <MochiBot ref="bot" mood="repos" />
  <button @click="celebrate">Celebrate</button>
</template>`

export const EX_FIGE = `<!-- a still frame: no animation loop, the same image every time -->
<MochiBot mood="termine" :frozen-at="1.2" :size="96" />

<!-- a live Mochi capped at 12 frames per second (the clock does not slow down) -->
<MochiBot mood="repos" :fps="12" />

<!-- no reactions to the pointer -->
<MochiBot :interactions="false" />

<!-- show your own image until the first 3D frame is painted -->
<MochiBot mood="repos" :max-pixel-ratio="1.5" @pret="loaded = true" />`

export const EX_MOTEUR_BUILD = `npx esbuild@0.24.0 tools/moteur.ts --bundle --format=esm --minify \\
  --alias:vue=./tools/vue-stub.ts --outfile=mochi-engine.js`

export const EX_MOTEUR = `import { BotEngine, SHAPE_BY_ID, RAYON } from './mochi-engine.js'

const engine = new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get('etoile').radii)
engine.setState('wink', 2)        // change state at t = 2 s

const frame = engine.sample(2.4)  // pure: same t, same frame
// frame.bodyPath: the SVG path of the body
// frame.eyes: [{ d, matrix, alpha }], holes cut in the body`

export interface PropDoc {
  /** nom de la prop dans `MochiBot.vue` (camelCase) */
  nom: string
  /** nom ecrit dans un template (kebab-case) */
  attr: string
  type: string
  defaut: string
  texte: string
}

/** Les props principales de `<MochiBot>` (les autres, plus anciennes, restent dans `MochiBot.vue`). */
export const PROPS: PropDoc[] = [
  { nom: 'size', attr: 'size', type: 'number', defaut: '320', texte: 'Width and height in pixels.' },
  { nom: 'shape', attr: 'shape', type: 'string', defaut: "'cercle'", texte: 'Shape id, see Shapes.' },
  { nom: 'color', attr: 'color', type: 'string', defaut: "'encre'", texte: 'Colour id, or any hex colour (#ff8800, #f80).' },
  { nom: 'rendu', attr: 'rendu', type: "'3d' | 'pixel3d' | 'flat3d'", defaut: "'3d'", texte: 'Style: Soft, Pixel or Flat.' },
  { nom: 'mood', attr: 'mood', type: 'string | null', defaut: 'null', texte: 'Mood played on a loop, see Moods.' },
  { nom: 'accessoires', attr: 'accessoires', type: 'Selection | null', defaut: 'null', texte: 'Accessories by slot, see Accessories.' },
  { nom: 'theme', attr: 'theme', type: "'light' | 'dark'", defaut: 'themeCourant', texte: 'Dark turns the eyes black.' },
  { nom: 'interactions', attr: 'interactions', type: 'boolean', defaut: 'true', texte: 'Reactions to hover, tap, double tap, long press and shake.' },
  { nom: 'coucou', attr: 'coucou', type: 'boolean', defaut: 'false', texte: 'Says hello once when mounted.' },
  { nom: 'follow', attr: 'follow', type: 'boolean', defaut: 'false', texte: 'The eyes follow the pointer anywhere in the window (turns off the reactions).' },
  { nom: 'frozenAt', attr: 'frozen-at', type: 'number', defaut: 'undefined', texte: 'Renders one exact instant, in seconds, with no loop.' },
  { nom: 'fps', attr: 'fps', type: 'number', defaut: 'undefined', texte: 'Caps the redraws per second.' },
  { nom: 'yaw', attr: 'yaw', type: 'number', defaut: '0', texte: 'Turns the model around its vertical axis, in radians.' },
  { nom: 'ordinateur', attr: 'ordinateur', type: 'boolean', defaut: 'true', texte: 'The laptop of the travaille mood.' },
  { nom: 'contour', attr: 'contour', type: 'boolean', defaut: 'false', texte: 'Cartoon outline (Soft, Flat and Pixel).' },
  { nom: 'epaisseurContour', attr: 'epaisseur-contour', type: 'number', defaut: '1', texte: 'Outline thickness factor, 0.4 to 4.' },
  { nom: 'pixel', attr: 'pixel', type: "'gros' | 'moyen' | 'fin'", defaut: "'fin'", texte: 'Pixel size of the Pixel style.' },
  { nom: 'reflet', attr: 'reflet', type: 'boolean', defaut: 'true', texte: 'Soft highlight of the Soft style.' },
  { nom: 'ombre', attr: 'ombre', type: 'boolean', defaut: 'true', texte: 'Ground shadow under the body.' },
  { nom: 'ombrage', attr: 'ombrage', type: 'boolean', defaut: 'true', texte: 'Shading of the body volume; false gives a flat colour.' },
  { nom: 'maxPixelRatio', attr: 'max-pixel-ratio', type: 'number', defaut: '2', texte: 'Caps the 3D canvas density; 1.5 on phones is lighter.' },
  { nom: 'label', attr: 'label', type: 'string', defaut: 'translated', texte: 'Alternative text for screen readers.' }
]

export interface MethodeDoc {
  nom: string
  signature: string
  texte: string
}

/** Methodes exposees par `defineExpose` (a appeler par une ref de template). */
export const METHODES: MethodeDoc[] = [
  { nom: 'setMood', signature: 'setMood(id: string | null)', texte: 'Glides to another mood; null turns the mood layer off.' },
  { nom: 'react', signature: 'react(id: string): boolean', texte: 'Plays a reaction, then goes back to the mood.' },
  { nom: 'relacher', signature: 'relacher()', texte: 'Ends a held reaction (the long press blush).' },
  { nom: 'regarder', signature: 'regarder({ nx, ny } | null)', texte: 'Aims the eyes, -1 to 1 on each axis; null lets go.' }
]

/** Les sections de la page, pour le sommaire. */
export const SOMMAIRE: { id: string; titre: string }[] = [
  { id: 'install', titre: 'Installation' },
  { id: 'first', titre: 'Your first Mochi' },
  { id: 'shapes', titre: 'Shapes and colours' },
  { id: 'styles', titre: 'Styles' },
  { id: 'moods', titre: 'Moods' },
  { id: 'accessories', titre: 'Accessories' },
  { id: 'theme', titre: 'Light and dark' },
  { id: 'reactions', titre: 'Reactions and methods' },
  { id: 'performance', titre: 'Still frames and performance' },
  { id: 'props', titre: 'All props' },
  { id: 'engine', titre: 'Engine without Vue' }
]
