/**
 * Contenu de la page docs (anglais) : exemples de code et tableau des options. Tout vient de la VRAIE API du depot :
 * `exemples.test.ts` verifie que chaque option citee est declaree par `<mochi-bot>` (`PROPRIETES`), que chaque
 * methode existe sur l'element, et que les ids des exemples (formes, couleurs, humeurs, accessoires, styles) sont
 * ceux des catalogues du moteur.
 */

export const DEPOT = 'https://github.com/robinnat/mochi'

/** Installation depuis le depot : le paquet npm n'est PAS publie. On construit le fichier de la bibliotheque. */
export const INSTALL_DEPOT = `# 1. Get the source and build the library
git clone https://github.com/robinnat/mochi.git
cd mochi
npx pnpm@11.17.0 install
npx pnpm@11.17.0 build:lib

# 2. Copy the built files into your project (keep them together:
#    the 3D part and Three.js are separate files, loaded on demand)
cp -r dist-lib ../my-app/public/mochi`

export const INSTALL_NPM = 'npm install mochi-world'

/** Charger le composant : une balise de script, ou un import dans une app construite. */
export const CHARGER = `<!-- plain HTML -->
<script type="module" src="/mochi/mochi-world.js"></script>

// or, in an app with a bundler (React, Svelte, Angular...)
import '/mochi/mochi-world.js'`

export const EXEMPLE_RAPIDE = `<script type="module" src="/mochi/mochi-world.js"></script>

<mochi-bot
  shape="etoile"
  color="#2d5bff"
  mood="repos"
  size="200"
  coucou
></mochi-bot>`

export const EX_FORME_COULEUR = `<!-- a catalogue colour id -->
<mochi-bot shape="nuage" color="rose"></mochi-bot>

<!-- or any hex colour, long or short -->
<mochi-bot shape="coeur" color="#ff8800"></mochi-bot>
<mochi-bot shape="squircle" color="#f80"></mochi-bot>`

export const EX_STYLES = `<!-- Soft is the default -->
<mochi-bot rendu="3d"></mochi-bot>

<!-- Pixel: pixel sizes gros, moyen or fin (the default) -->
<mochi-bot rendu="pixel3d" pixel="moyen"></mochi-bot>

<!-- Flat, with a cartoon outline twice as thick -->
<mochi-bot rendu="flat3d" contour epaisseur-contour="2"></mochi-bot>

<!-- turn the model: radians around the vertical axis -->
<mochi-bot yaw="0.5"></mochi-bot>

<!-- no highlight, no ground shadow, no body shading -->
<mochi-bot reflet="false" ombre="false" ombrage="false"></mochi-bot>`

export const EX_MOODS = `<!-- French ids, or the English aliases: working, done, sleeping... -->
<mochi-bot id="bot" mood="travaille" shape="squircle"></mochi-bot>

<!-- travaille shows a small 3D laptop; hide it -->
<mochi-bot mood="travaille" ordinateur="false"></mochi-bot>

<button onclick="bot.setAttribute('mood', 'termine')">Done</button>`

export const EX_ACCESSOIRES = `<!-- one accessory per slot, in its catalogue colours (JSON) -->
<mochi-bot accessoires='{"tete": "casquette", "yeux": "rondes"}'></mochi-bot>

<script type="module">
  // or as a property, with your colours: c1 is the main colour, c2 the second one
  document.querySelector('mochi-bot').accessoires = {
    tete: { id: 'fleur', c1: '#ff4d94', c2: '#ffd60a' },
    bas: { id: 'echarpe', c1: '#2d5bff' },
    dos: 'cape'
  }
</script>`

export const EX_THEME = `<!-- one avatar -->
<mochi-bot theme="dark"></mochi-bot>

<script type="module">
  // or every Mochi without a theme, at once
  import { themeCourant } from '/mochi/mochi-world.js'
  themeCourant.value = 'dark'
</script>`

export const EX_METHODES = `<mochi-bot id="bot" mood="repos"></mochi-bot>
<button id="celebrate">Celebrate</button>

<script type="module">
  const bot = document.getElementById('bot')
  document.getElementById('celebrate').addEventListener('click', () => {
    bot.setMood('termine')            // glide to another mood
    bot.react('rigole')               // play a reaction, then back to the mood
  })
  bot.regarder({ nx: 1, ny: -1 })     // -1 to 1, right and down positive
</script>`

export const EX_FIGE = `<!-- a still frame: no animation loop, the same image every time -->
<mochi-bot mood="termine" frozen-at="1.2" size="96"></mochi-bot>

<!-- a live Mochi capped at 12 frames per second (the clock does not slow down) -->
<mochi-bot mood="repos" fps="12"></mochi-bot>

<!-- no reactions to the pointer -->
<mochi-bot interactions="false"></mochi-bot>

<!-- show your own image until the first 3D frame is painted -->
<mochi-bot id="live" mood="repos" max-pixel-ratio="1.5"></mochi-bot>
<script type="module">
  document.getElementById('live').addEventListener('pret', () => (loaded = true))
</script>`

export const EX_REACT = `// React 19
import '/mochi/mochi-world.js'

export function Avatar({ mood }) {
  // attributes as in HTML; objects go through a ref or as properties (React 19)
  return <mochi-bot shape="etoile" color="#2d5bff" mood={mood} size="160" onpret={() => console.log('ready')} />
}`

export const EX_SVELTE = `<!-- Svelte -->
<script>
  import '/mochi/mochi-world.js'
  let mood = $state('repos')
</script>

<mochi-bot shape="nuage" color="rose" {mood} size="160"></mochi-bot>
<button onclick={() => (mood = 'termine')}>Done</button>`

export const EX_MOTEUR_BUILD = `npx pnpm@11.17.0 build:lib   # dist-lib/mochi-world.js (tag, engine, catalogues), dist-lib/catalogue.js (catalogues only)`

export const EX_MOTEUR = `import { BotEngine, SHAPE_BY_ID, RAYON } from '/mochi/mochi-world.js'
import { SHAPES, CATALOGUE, MOOD_IDS } from '/mochi/catalogue.js'

const engine = new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get('etoile').radii)
engine.setState('wink', 2)        // change state at t = 2 s
const frame = engine.sample(2.4)  // pure: same t, same frame (it drives the 3D body)

// a picker built from the catalogues, as this site does
const shapes = SHAPES.map((s) => s.id)
const hats = CATALOGUE.filter((a) => a.emplacement === 'tete').map((a) => a.id)`

export interface PropDoc {
  /** nom de la propriete JavaScript de `<mochi-bot>` (camelCase) */
  nom: string
  /** nom de l'attribut HTML (kebab-case) */
  attr: string
  type: string
  defaut: string
  texte: string
}

/** Les options principales de `<mochi-bot>` (les autres, plus anciennes, sont dans `src/components/mochi-bot.ts`). */
export const PROPS: PropDoc[] = [
  { nom: 'size', attr: 'size', type: 'number', defaut: '320', texte: 'Width and height in pixels.' },
  { nom: 'shape', attr: 'shape', type: 'string', defaut: "'cercle'", texte: 'Shape id, see Shapes.' },
  { nom: 'color', attr: 'color', type: 'string', defaut: "'encre'", texte: 'Colour id, or any hex colour (#ff8800, #f80).' },
  { nom: 'rendu', attr: 'rendu', type: "'3d' | 'pixel3d' | 'flat3d'", defaut: "'3d'", texte: 'Style: Soft, Pixel or Flat.' },
  { nom: 'mood', attr: 'mood', type: 'string | null', defaut: 'null', texte: 'Mood played on a loop, see Moods.' },
  { nom: 'accessoires', attr: 'accessoires', type: 'Selection | null (JSON)', defaut: 'null', texte: 'Accessories by slot, see Accessories.' },
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

/** Evenements (`CustomEvent`, `event.detail` = nouvelle valeur). */
export const EVENEMENTS: { nom: string; texte: string }[] = [
  { nom: 'pret', texte: 'The first 3D frame is painted.' },
  { nom: 'statechange', texte: 'The player moved to another state (detail: the state id).' },
  { nom: 'blockchange', texte: 'The player moved to another block of the cycle (detail: its index).' },
  { nom: 'playingchange', texte: 'The cycle started or stopped (detail: true or false).' },
  { nom: 'elapsedchange', texte: 'Time spent in the current block, every frame while playing (detail: seconds).' }
]

export interface MethodeDoc {
  nom: string
  signature: string
  texte: string
}

/** Methodes de l'element `<mochi-bot>`. */
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
  { id: 'frameworks', titre: 'In a framework' },
  { id: 'shapes', titre: 'Shapes and colours' },
  { id: 'styles', titre: 'Styles' },
  { id: 'moods', titre: 'Moods' },
  { id: 'accessories', titre: 'Accessories' },
  { id: 'theme', titre: 'Light and dark' },
  { id: 'reactions', titre: 'Reactions and methods' },
  { id: 'performance', titre: 'Still frames and performance' },
  { id: 'props', titre: 'All options' },
  { id: 'events', titre: 'Events' },
  { id: 'engine', titre: 'Engine and catalogues' }
]
