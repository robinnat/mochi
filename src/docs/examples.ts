/**
 * Contenu de la page docs (anglais) : exemples de code et tableau des options. Tout vient de la VRAIE API du depot :
 * `exemples.test.ts` verifie que chaque option citee est declaree par `<mochi-bot>` (`PROPERTIES`), que chaque
 * methode existe sur l'element, et que les ids des exemples (formes, couleurs, humeurs, accessoires, styles) sont
 * ceux des catalogues du moteur.
 */

export const REPO = 'https://github.com/robinnat/mochi'

/** Installation depuis le depot : le paquet npm n'est PAS publie. On construit le fichier de la bibliotheque. */
export const INSTALL_REPO = `# 1. Get the source and build the library
git clone https://github.com/robinnat/mochi.git
cd mochi
npx pnpm@11.17.0 install
npx pnpm@11.17.0 build:lib

# 2. Copy the built files into your project (keep them together:
#    the 3D part and Three.js are separate files, loaded on demand)
cp -r dist-lib ../my-app/public/mochi`

export const INSTALL_NPM = 'npm install mochi-world'

/** Charger le composant : une balise de script, ou un import dans une app construite. */
export const LOAD = `<!-- plain HTML -->
<script type="module" src="/mochi/mochi-world.js"></script>

// or, in an app with a bundler (React, Svelte, Angular...)
import '/mochi/mochi-world.js'`

export const QUICK_EXAMPLE = `<script type="module" src="/mochi/mochi-world.js"></script>

<mochi-bot
  shape="star"
  color="#2d5bff"
  mood="idle"
  size="200"
  wave
></mochi-bot>`

export const EX_SHAPE_COLOR = `<!-- a catalogue colour id -->
<mochi-bot shape="cloud" color="pink"></mochi-bot>

<!-- or any hex colour, long or short -->
<mochi-bot shape="heart" color="#ff8800"></mochi-bot>
<mochi-bot shape="squircle" color="#f80"></mochi-bot>`

export const EX_STYLES = `<!-- Soft is the default -->
<mochi-bot renderStyle="3d"></mochi-bot>

<!-- Pixel: pixel sizes large, medium or fin (the default) -->
<mochi-bot renderStyle="pixel3d" pixel="medium"></mochi-bot>

<!-- Flat, with a cartoon outline twice as thick -->
<mochi-bot renderStyle="flat3d" outline outline-width="2"></mochi-bot>

<!-- turn the model: radians around the vertical axis -->
<mochi-bot yaw="0.5"></mochi-bot>

<!-- no highlight, no ground shadow, no body shading -->
<mochi-bot highlight="false" shadow="false" shading="false"></mochi-bot>`

export const EX_MOODS = `<!-- French ids, or the English aliases: working, done, sleeping... -->
<mochi-bot id="bot" mood="working" shape="squircle"></mochi-bot>

<!-- working shows a small 3D laptop; hide it -->
<mochi-bot mood="working" laptop="false"></mochi-bot>

<button onclick="bot.setAttribute('mood', 'done')">Done</button>`

export const EX_ACCESSORIES = `<!-- one accessory per slot, in its catalogue colours (JSON) -->
<mochi-bot accessories='{"head": "cap", "eyes": "round"}'></mochi-bot>

<script type="module">
  // or as a property, with your colours: c1 is the main colour, c2 the second one
  document.querySelector('mochi-bot').accessories = {
    head: { id: 'flower', c1: '#ff4d94', c2: '#ffd60a' },
    bas: { id: 'scarf', c1: '#2d5bff' },
    dos: 'cape'
  }
</script>`

export const EX_THEME = `<!-- one avatar -->
<mochi-bot theme="dark"></mochi-bot>

<script type="module">
  // or every Mochi without a theme, at once
  import { currentTheme } from '/mochi/mochi-world.js'
  currentTheme.value = 'dark'
</script>`

export const EX_METHODS = `<mochi-bot id="bot" mood="idle"></mochi-bot>
<button id="celebrate">Celebrate</button>

<script type="module">
  const bot = document.getElementById('bot')
  document.getElementById('celebrate').addEventListener('click', () => {
    bot.setMood('done')            // glide to another mood
    bot.react('laugh')               // play a reaction, then back to the mood
  })
  bot.lookAt({ nx: 1, ny: -1 })     // -1 to 1, right and down positive
</script>`

export const EX_FROZEN = `<!-- a still frame: no animation loop, the same image every time -->
<mochi-bot mood="done" frozen-at="1.2" size="96"></mochi-bot>

<!-- a live Mochi capped at 12 frames per second (the clock does not slow down) -->
<mochi-bot mood="idle" fps="12"></mochi-bot>

<!-- no reactions to the pointer -->
<mochi-bot interactions="false"></mochi-bot>

<!-- show your own image until the first 3D frame is painted -->
<mochi-bot id="live" mood="idle" max-pixel-ratio="1.5"></mochi-bot>
<script type="module">
  document.getElementById('live').addEventListener('ready', () => (loaded = true))
</script>`

export const EX_REACT = `// React 19
import '/mochi/mochi-world.js'

export function Avatar({ mood }) {
  // attributes as in HTML; objects go through a ref or as properties (React 19)
  return <mochi-bot shape="star" color="#2d5bff" mood={mood} size="160" onpret={() => console.log('ready')} />
}`

export const EX_SVELTE = `<!-- Svelte -->
<script>
  import '/mochi/mochi-world.js'
  let mood = $state('idle')
</script>

<mochi-bot shape="cloud" color="pink" {mood} size="160"></mochi-bot>
<button onclick={() => (mood = 'done')}>Done</button>`

export const EX_ENGINE_BUILD = `npx pnpm@11.17.0 build:lib   # dist-lib/mochi-world.js (tag, engine, catalogues), dist-lib/catalogue.js (catalogues only)`

export const EX_ENGINE = `import { BotEngine, SHAPE_BY_ID, RADIUS } from '/mochi/mochi-world.js'
import { SHAPES, ACCESSORIES, MOOD_IDS } from '/mochi/catalogue.js'

const engine = new BotEngine(RADIUS, 'idle', SHAPE_BY_ID.get('star').radii)
engine.setState('wink', 2)        // change state at t = 2 s
const frame = engine.sample(2.4)  // pure: same t, same frame (it drives the 3D body)

// a picker built from the catalogues, as this site does
const shapes = SHAPES.map((s) => s.id)
const hats = ACCESSORIES.filter((a) => a.slot === 'head').map((a) => a.id)`

export interface PropDoc {
  /** nom de la propriete JavaScript de `<mochi-bot>` (camelCase) */
  name: string
  /** nom de l'attribut HTML (kebab-case) */
  attr: string
  type: string
  initial: string
  text: string
}

/** Les options principales de `<mochi-bot>` (les autres, plus anciennes, sont dans `src/components/mochi-bot.ts`). */
export const PROPS: PropDoc[] = [
  { name: 'size', attr: 'size', type: 'number', initial: '320', text: 'Width and height in pixels.' },
  { name: 'shape', attr: 'shape', type: 'string', initial: "'cercle'", text: 'Shape id, see Shapes.' },
  { name: 'color', attr: 'color', type: 'string', initial: "'encre'", text: 'Colour id, or any hex colour (#ff8800, #f80).' },
  { name: 'renderStyle', attr: 'renderStyle', type: "'3d' | 'pixel3d' | 'flat3d'", initial: "'3d'", text: 'Style: Soft, Pixel or Flat.' },
  { name: 'mood', attr: 'mood', type: 'string | null', initial: 'null', text: 'Mood played on a loop, see Moods.' },
  { name: 'accessories', attr: 'accessories', type: 'Selection | null (JSON)', initial: 'null', text: 'Accessories by slot, see Accessories.' },
  { name: 'theme', attr: 'theme', type: "'light' | 'dark'", initial: 'currentTheme', text: 'Dark turns the eyes black.' },
  { name: 'interactions', attr: 'interactions', type: 'boolean', initial: 'true', text: 'Reactions to hover, tap, double tap, long press and shake.' },
  { name: 'wave', attr: 'wave', type: 'boolean', initial: 'false', text: 'Says hello once when mounted.' },
  { name: 'follow', attr: 'follow', type: 'boolean', initial: 'false', text: 'The eyes follow the pointer anywhere in the window (turns off the reactions).' },
  { name: 'frozenAt', attr: 'frozen-at', type: 'number', initial: 'undefined', text: 'Renders one exact instant, in seconds, with no loop.' },
  { name: 'fps', attr: 'fps', type: 'number', initial: 'undefined', text: 'Caps the redraws per second.' },
  { name: 'yaw', attr: 'yaw', type: 'number', initial: '0', text: 'Turns the model around its vertical axis, in radians.' },
  { name: 'laptop', attr: 'laptop', type: 'boolean', initial: 'true', text: 'The laptop of the travaille mood.' },
  { name: 'outline', attr: 'outline', type: 'boolean', initial: 'false', text: 'Cartoon outline (Soft, Flat and Pixel).' },
  { name: 'outlineWidth', attr: 'outline-width', type: 'number', initial: '1', text: 'Outline thickness factor, 0.4 to 4.' },
  { name: 'pixel', attr: 'pixel', type: "'gros' | 'moyen' | 'fin'", initial: "'fin'", text: 'Pixel size of the Pixel style.' },
  { name: 'highlight', attr: 'highlight', type: 'boolean', initial: 'true', text: 'Soft highlight of the Soft style.' },
  { name: 'shadow', attr: 'shadow', type: 'boolean', initial: 'true', text: 'Ground shadow under the body.' },
  { name: 'shading', attr: 'shading', type: 'boolean', initial: 'true', text: 'Shading of the body volume; false gives a flat colour.' },
  { name: 'maxPixelRatio', attr: 'max-pixel-ratio', type: 'number', initial: '2', text: 'Caps the 3D canvas density; 1.5 on phones is lighter.' },
  { name: 'label', attr: 'label', type: 'string', initial: 'translated', text: 'Alternative text for screen readers.' }
]

/** Evenements (`CustomEvent`, `event.detail` = nouvelle valeur). */
export const EVENTS: { name: string; text: string }[] = [
  { name: 'ready', text: 'The first 3D frame is painted.' },
  { name: 'statechange', text: 'The player moved to another state (detail: the state id).' },
  { name: 'blockchange', text: 'The player moved to another block of the cycle (detail: its index).' },
  { name: 'playingchange', text: 'The cycle started or stopped (detail: true or false).' },
  { name: 'elapsedchange', text: 'Time spent in the current block, every frame while playing (detail: seconds).' }
]

export interface MethodDoc {
  name: string
  signature: string
  text: string
}

/** Methodes de l'element `<mochi-bot>`. */
export const METHODS: MethodDoc[] = [
  { name: 'setMood', signature: 'setMood(id: string | null)', text: 'Glides to another mood; null turns the mood layer off.' },
  { name: 'react', signature: 'react(id: string): boolean', text: 'Plays a reaction, then goes back to the mood.' },
  { name: 'release', signature: 'relacher()', text: 'Ends a held reaction (the long press blush).' },
  { name: 'lookAt', signature: 'regarder({ nx, ny } | null)', text: 'Aims the eyes, -1 to 1 on each axis; null lets go.' }
]

/** Les sections de la page, pour le sommaire. */
export const TOC: { id: string; title: string }[] = [
  { id: 'install', title: 'Installation' },
  { id: 'first', title: 'Your first Mochi' },
  { id: 'frameworks', title: 'In a framework' },
  { id: 'shapes', title: 'Shapes and colours' },
  { id: 'styles', title: 'Styles' },
  { id: 'moods', title: 'Moods' },
  { id: 'accessories', title: 'Accessories' },
  { id: 'theme', title: 'Light and dark' },
  { id: 'reactions', title: 'Reactions and methods' },
  { id: 'performance', title: 'Still frames and performance' },
  { id: 'props', title: 'All options' },
  { id: 'events', title: 'Events' },
  { id: 'engine', title: 'Engine and catalogues' }
]
