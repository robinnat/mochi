[English](README.md) | **Français**

# Mochi World

[![Licence : MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [**Démo en ligne**](https://mochi-red-phi.vercel.app)

Mochi World est un petit moteur d'avatars animés pour le web. Ses personnages, les Mochi, sont une
forme pleine avec sept humeurs, deux yeux qui bougent tout seuls, et des réactions quand on les touche
(survol, tape, double tape, appui long, secousse, un coucou à l'arrivée). Tout est dessiné en vraie 3D,
en trois styles (Soft, Flat et Pixel), en clair et en sombre, avec 23 accessoires à cumuler par
emplacement et par couleur, et des exports (SVG, PNG, GIF, MP4). Aucune bibliothèque d'animation.

**Site et bac à sable : https://mochi-red-phi.vercel.app** (l'app est sur `/app`).  
**Code source : https://github.com/robinnat/mochi**

## Installation

```bash
npm install mochi-world   # bientôt : le paquet n'est PAS encore publié
```

D'ici là, travaillez depuis le dépôt (voir [Développement](#développement)). Attention : le dépôt
n'a pas encore de point d'entrée de bibliothèque (ni `main` ni `exports` dans `package.json`, et
`"private": true`), donc même une fois publié, le paquet en aura besoin. Ce que vous pouvez construire
aujourd'hui, c'est le moteur seul, voir « Vanilla » plus bas.

## Utilisation

### Vue

Le composant se trouve dans `src/components/MochiBot.vue`.

```vue
<script setup lang="ts">
import MochiBot from './components/MochiBot.vue'
</script>

<template>
  <!-- a mood, light 3D, reacts to the pointer; says hello on arrival -->
  <MochiBot mood="repos" shape="fleur" color="rose" rendu="3d" :size="160" follow coucou />
  <!-- a mood with its own prop: types on a small 3D laptop (ordinateur="false" hides it) -->
  <MochiBot mood="travaille" shape="squircle" :size="200" />
  <!-- accessories by slot and colour, dark theme -->
  <MochiBot :accessoires="{ tete: 'casquette', yeux: 'rondes' }" theme="dark" :size="200" />
  <!-- a frozen frame: no animation loop, the same image every time -->
  <MochiBot mood="termine" :frozen-at="1.2" :size="96" />
</template>
```

Les identifiants sont ceux des catalogues, en français pour l'instant (`etoile` est l'étoile,
`rendu` est le style de rendu : `3d` Soft, `flat3d` Flat, `pixel3d` Pixel).

### Vanilla (moteur seul, sans Vue)

`src/bot/` n'a ni framework ni horloge : `engine.sample(t)` est une fonction pure du temps.
`tools/moteur.ts` est un point d'entrée du moteur seul. Empaquetez-le une fois :

```bash
npx esbuild@0.24.0 tools/moteur.ts --bundle --format=esm --minify \
  --alias:vue=./tools/vue-stub.ts --outfile=mochi-engine.js
```

Puis dessinez les images vous-même. Cet exemple dessine le corps et les yeux (les anneaux, les
particules et la pastille de notification sont dans `frame.arcs`, `frame.dots` et `frame.notif`, et ne
sont pas dessinés ici) :

```html
<svg id="mochi" width="200" height="200"></svg>
<script type="module">
  import { BotEngine, SHAPE_BY_ID, COLOR_BY_ID, RAYON, DEMI_VIEWBOX } from './mochi-engine.js'

  const engine = new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get('etoile').radii)
  const color = COLOR_BY_ID.get('violet').hex
  const svg = document.getElementById('mochi')
  const V = DEMI_VIEWBOX
  svg.setAttribute('viewBox', `${-V} ${-V} ${V * 2} ${V * 2}`)

  function draw(t) {
    const f = engine.sample(t)
    // the eyes are holes in a mask, so they clip against the silhouette on their own
    const eyes = f.eyes
      .map((e) => `<path d="${e.d}" transform="${e.matrix}" opacity="${e.alpha}" fill="#000"/>`)
      .join('')
    svg.innerHTML =
      `<mask id="m" maskUnits="userSpaceOnUse" x="${-V}" y="${-V}" width="${V * 2}" height="${V * 2}">` +
      `<path d="${f.bodyPath}" fill="#fff"/>${eyes}</mask>` +
      `<rect x="${-V}" y="${-V}" width="${V * 2}" height="${V * 2}" fill="${color}" mask="url(#m)" opacity="${f.bodyAlpha}"/>`
  }

  engine.setState('wink', 2) // at t = 2 s
  const loop = (ms) => { draw(ms / 1000); requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
</script>
```

Servez le dossier en HTTP (les modules ES ne se chargent pas depuis `file://`). Testé dans Chrome.
Gardez l'en-tête MIT de `LICENSE` en haut du fichier que vous distribuez.

## Ce qu'il contient

**Styles de rendu** (`rendu`), tous en vraie 3D : `3d` (Soft, par défaut : ombrage doux, lueurs de
bord et reflet calculés dans le repère de la vue, pour que tout le volume soit éclairé de la même façon
de tous les côtés), `flat3d` (Flat : deux ou trois tons en aplat, `contour` en option) et `pixel3d`
(Pixel : rendu en basse résolution, palette courte, contour de 1 px ; `pixel` : `gros` 16, `moyen` 24,
`fin` 32 px pour la boule). `yaw` fait tourner le modèle. Sans WebGL, et pour les exports SVG, PNG, GIF
et MP4, l'avatar revient à son dessin SVG : il n'y a pas encore d'export 3D.

**Formes** (12) : `cercle`, `galet`, `squircle`, `capsule`, `triangle`, `hexagone`, `nuage`,
`goutte`, `etoile`, `fleur`, `oeuf`, `coeur`. Chaque forme a un vrai volume sous tous les angles : le
cercle est une sphère, le squircle un coussin arrondi, le triangle un cône arrondi, la goutte, l'œuf et
la capsule sont des solides de révolution, et l'étoile, la fleur, l'hexagone, le nuage et le cœur sont
des corps épais et arrondis.

**Couleurs** (18 : 14 vives et 4 neutres) : `encre`, `brun`, `rouge`, `corail`, `orange`, `ambre`,
`citron`, `pomme`, `vert`, `turquoise`, `ciel`, `bleu`, `violet`, `magenta`, `rose`, `cerise`, `gris`,
`creme`. `color` accepte aussi n'importe quel code hexadécimal.

**Humeurs** (7, en boucle, visage et corps) : `repos`, `reflechit`, `travaille` (tape sur un petit
ordinateur portable 3D vu de dos, `ordinateur` le cache), `attend`, `termine`, `bloque`, `dort`. On en
choisit une avec `<MochiBot mood="travaille" />` ou `setMood()`. **Interactions** (actives par défaut,
`interactions`) : au survol le regard suit, une tape le fait sursauter, une double tape le fait rire, un
appui long le fait rougir, une secousse ou un tour rapide lui donne le tournis, et `coucou` joue un
bonjour à l'arrivée (il sort du sol en grandissant). Cela fait 5 réactions : `sursaut`, `rigole`,
`rougit`, `etourdi`, `coucou`. Voir [docs/moods.md](docs/moods.md).

**Contrôles 3D** : `<MochiBot rendu="3d" :yaw="angle" />` fait tourner le modèle autour de son axe
vertical (en radians ; les yeux sont peints sur la face avant seulement). La section 3D du site le pilote
au glisser.

**Accessoires** (23, prop `accessoires`, catalogue dans `src/bot/emplacements.ts`) : un par
emplacement, tous cumulables, chacun une forme simple en une ou deux couleurs au choix.

| Emplacement | Accessoires |
|---|---|
| `tete` (tête, 10) | `casquette`, `beret`, `haut-de-forme`, `couronne`, `paille`, `antenne`, `casque`, `ruban`, `fleur`, `toque` |
| `yeux` (yeux, 6) | `rondes`, `carrees`, `soleil`, `coeur`, `etoile`, `monocle` |
| `visage` (visage, 1) | `joues` |
| `bas` (cou, 4) | `papillon`, `echarpe`, `perles`, `fleurs` |
| `dos` (dos, 2) | `sac`, `cape` |

`<MochiBot :accessoires="{ tete: { id: 'casquette', c1: '#e8505b' }, yeux: 'rondes' }" />`.
**Thème** : `theme="dark"` rend les yeux noirs (sans lui, c'est le thème courant du site).

**Exports** : SVG, PNG, SVG animé, GIF animé, et un montage entier en GIF ou en MP4 (l'encodeur
vidéo ne se charge qu'à la première utilisation).

## API principale

```ts
const engine = new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get('nuage')?.radii, expression)
engine.setState('wink', t)        // change state at time t (morphs with the measured curve)
engine.setShape(radii, t)          // morph to another silhouette
engine.setExpression(expr, t)      // resting expression
engine.setLook({ yaw, pitch, mix, wander }, t) // aim the eyes (null to release)
const frame = engine.sample(t, geste?) // pure: bodyPath, eyes, arcs, dots, notif
```

Props de `<MochiBot>` : `size`, `shape`, `color`, `paper`, `frozenAt`, `follow`, `rendu`, `pixel`,
`rendu3d`, `douceur`, `contour`, `reflet`, `yaw`, `theme`, `mood`, `interactions`, `coucou`,
`ordinateur`, `accessoires`, `fps`, `label`. `color` est un identifiant du catalogue (`violet`) ou
n'importe quel code hexadécimal (`#ff8800`, `#f80`). Voir [MochiBot.vue](src/components/MochiBot.vue).

Le code garde ses noms : le composant s'appelle toujours `MochiBot.vue` et les clés de stockage du
navigateur commencent toujours par `mochi:`. Les renommer casserait le code existant, ce n'est donc pas
compris dans le passage au nom Mochi World.

## Pourquoi les nombres ont l'air arbitraires

Ils sont mesurés, pas choisis : chaque état a été relevé image par image sur une animation de
référence (silhouettes par lancer de rayons au sous-pixel, yeux par ajustement de capsules, couleurs et
épaisseurs par échantillonnage direct). Les constantes de `src/bot/` sont des mesures : les arrondir fait
perdre la précision du mouvement.

| Ce qu'on attendrait | Ce que montre la mesure |
|---|---|
| Les yeux penchent comme `//` | Ils penchent comme `\\`, à environ 26 degrés de la verticale |
| Le corps est un squircle | C'est un cercle parfait, erreur radiale sous 0,7 % |
| Les transitions sont des ressorts | Ce sont des ralentis exponentiels, sans dépassement |
| L'avatar flotte au repos | Non. La vie vient de la dérive du regard et des clignements |

[docs/measurements.md](docs/measurements.md) donne le reste.

## Architecture

La documentation technique de `docs/` est en français.

| | |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Le moteur, le morphing par profil radial, les yeux comme trous de masque |
| [docs/measurements.md](docs/measurements.md) | Ce qui a été mesuré, régénérer `profiles.ts` |
| [docs/styles.md](docs/styles.md) | Styles de rendu : Soft, Flat, Pixel (vraie 3D) |
| [docs/moods.md](docs/moods.md) | Humeurs de travail et réactions à l'utilisateur (visage et corps seulement) |
| [docs/intro.md](docs/intro.md) | La séquence d'arrivée |
| [docs/interface.md](docs/interface.md) | Mise en page de l'app et pièges CSS |
| [docs/export.md](docs/export.md) | Export SVG, PNG, GIF et MP4 |
| [docs/i18n.md](docs/i18n.md) | La couche de traduction faite maison |

## Développement

```bash
npx -y pnpm@11.17.0 install
npx -y pnpm@11.17.0 dev      # http://localhost:5190  (site at /, app at /app.html, lab at /labo.html)
npx -y pnpm@11.17.0 test     # vitest
npx -y pnpm@11.17.0 build    # vue-tsc --noEmit && vite build
```

Vue 3, Vite, TypeScript, Tailwind 4 (app seulement), Three.js (chargé à la demande). `vue-tsc` est le
seul contrôle de types : lancez le build avant de conclure. [CHANGELOG.md](CHANGELOG.md) a une entrée
par version.

## Contribuer

Les signalements de bugs, les idées et les pull requests sont les bienvenus. Lisez d'abord
[CONTRIBUTING.fr.md](CONTRIBUTING.fr.md) (installation, tests, style du code, une pull request par
sujet, CI verte). Tous les participants suivent le [Code de conduite](CODE_OF_CONDUCT.fr.md).

## Sécurité

Merci de ne pas signaler un problème de sécurité dans une issue publique. Voir
[SECURITY.fr.md](SECURITY.fr.md) pour le formulaire de signalement privé et les versions suivies.

## Licence

MIT, voir [LICENSE](LICENSE).
