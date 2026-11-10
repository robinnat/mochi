[English](README.md) | **Français**

# Mochi World

[![Licence : MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [**Démo en ligne**](https://mochi-red-phi.vercel.app)

Mochi World est un petit moteur d'avatars animés pour le web. Ses personnages, les Mochi, sont une
forme pleine avec sept humeurs, deux yeux qui bougent tout seuls, et des réactions quand on les touche
(survol, tape, double tape, appui long, secousse, un coucou à l'arrivée). Tout est dessiné en vraie 3D,
en trois styles (Soft, Flat et Pixel), en clair et en sombre, avec 22 accessoires à cumuler par
emplacement et par couleur, et des exports (PNG, SVG, GIF, MP4). Aucune bibliothèque d'animation.

**Site et bac à sable : https://mochi-red-phi.vercel.app** (l'app est sur `/app`).  
**Code source : https://github.com/robinnat/mochi**

## Installation

```bash
npm install mochi-world   # bientôt : le paquet n'est PAS encore publié
```

D'ici là, construisez la bibliothèque depuis le dépôt. Elle n'ajoute aucune dépendance à votre app :
Three.js est dans un fichier à part, chargé seulement quand un Mochi en 3D s'affiche.

```bash
git clone https://github.com/robinnat/mochi.git
cd mochi
npx -y pnpm@11.17.0 install
npx -y pnpm@11.17.0 build:lib     # écrit dist-lib/mochi-world.js et ses morceaux 3D chargés à la demande
cp -r dist-lib ../my-app/public/mochi   # gardez les fichiers ensemble
```

## Utilisation

Mochi est un seul Web Component, `<mochi-bot>`. Chargez `mochi-world.js` une fois par page : il déclare la
balise. Chaque option est un **attribut** (texte en kebab-case : `frozen-at="1.2"`, `contour`,
`reflet="false"`, `accessoires='{"tete":"casquette"}'`) et une **propriété** (camelCase, n'importe quelle
valeur : `el.accessoires = { tete: 'casquette' }`). Les méthodes (`setMood`, `react`, `relacher`,
`regarder`, `seek`, `rendAt`) sont sur l'élément ; les événements sont des `CustomEvent` (`pret` à la
première image 3D peinte, puis `statechange`, `blockchange`, `playingchange`, `elapsedchange`). Retiré de
la page, il arrête sa boucle.

Les identifiants sont ceux des catalogues, en français pour l'instant (`etoile` est l'étoile,
`rendu` est le style de rendu : `3d` Soft, `flat3d` Flat, `pixel3d` Pixel).

### HTML

```html
<script type="module" src="/mochi/mochi-world.js"></script>

<!-- une humeur, 3D Soft, suit le pointeur ; dit bonjour à l'arrivée -->
<mochi-bot mood="repos" shape="fleur" color="rose" rendu="3d" size="160" follow coucou></mochi-bot>
<!-- tape sur un petit ordinateur 3D (ordinateur="false" le cache) -->
<mochi-bot id="bot" mood="travaille" shape="squircle" size="200"></mochi-bot>
<!-- accessoires par emplacement et couleur (JSON), thème sombre -->
<mochi-bot accessoires='{"tete": "casquette", "yeux": "rondes"}' theme="dark" size="200"></mochi-bot>
<!-- une image figée : aucune boucle d'animation, la même image à chaque fois -->
<mochi-bot mood="termine" frozen-at="1.2" size="96"></mochi-bot>

<script type="module">
  const bot = document.getElementById('bot')
  bot.addEventListener('pret', () => console.log('première image 3D'))
  bot.setMood('termine')
  bot.react('rigole')
</script>
```

### React

```jsx
import '/mochi/mochi-world.js'

export function Avatar({ mood }) {
  // React 19 passe les props d'un élément personnalisé en propriétés, et `on<événement>` en écouteurs
  return <mochi-bot shape="etoile" color="#2d5bff" mood={mood} size="160" onpret={() => console.log('prêt')} />
}
```

Avec React 18, passez les objets (`accessoires`, `cycle`) et les écouteurs par une `ref`.

### Vue

```vue
<script setup>
import '/mochi/mochi-world.js'
import { ref } from 'vue'
const mood = ref('repos')
</script>

<template>
  <mochi-bot shape="nuage" color="rose" :mood="mood" size="160" @pret="console.log('prêt')" />
  <button @click="mood = 'termine'">Terminé</button>
</template>
```

Indiquez au compilateur Vue que `mochi-bot` est un élément personnalisé
(`compilerOptions.isCustomElement: (tag) => tag === 'mochi-bot'` dans les options du plugin Vue).

### Svelte

```svelte
<script>
  import '/mochi/mochi-world.js'
  let mood = $state('repos')
</script>

<mochi-bot shape="nuage" color="rose" {mood} size="160" onpret={() => console.log('prêt')}></mochi-bot>
<button onclick={() => (mood = 'termine')}>Terminé</button>
```

### Moteur et catalogues

Deux points d'entrée, ceux-là mêmes qu'utilisent le site, la doc et le labo du dépôt (ils n'importent
jamais un fichier interne, un test le vérifie) :

- `mochi-world` (`dist-lib/mochi-world.js`) : déclare `<mochi-bot>` et exporte tout ce qui suit.
- `mochi-world/catalogue` (`dist-lib/catalogue.js`) : les catalogues et réglages communs sans la balise
  (`SHAPES`, `COLORS`, `CATALOGUE`, `EMPLACEMENTS`, `MOOD_IDS`, `REACTION_IDS`, `RENDUS`, `themeCourant`,
  `cheminDeForme` pour une icône de forme, `charger3d` pour charger la 3D à la demande), pour construire
  un sélecteur avant de charger la balise.

`src/bot/` n'a ni framework ni horloge : `engine.sample(t)` est une fonction pure du temps, et `BotEngine`
est exporté aussi. Le Mochi lui-même est toujours dessiné en 3D : l'image du moteur pilote le corps 3D, il
n'y a pas de dessin 2D.

## Ce qu'il contient

**Styles de rendu** (`rendu`), tous en vraie 3D : `3d` (Soft, par défaut : ombrage doux, lueurs de
bord et reflet calculés dans le repère de la caméra, pour que tout le volume soit éclairé de la même façon
de tous les côtés), `flat3d` (Flat : deux ou trois tons en aplat, `contour` en option) et `pixel3d`
(Pixel : rendu en basse résolution, palette courte, contour de 1 px ; `pixel` : `gros` 16, `moyen` 24,
`fin` 32 px pour la boule). `yaw` fait tourner le modèle. Tout est en 3D, exports compris : il n'y a pas
de dessin 2D. Sans WebGL, un court message remplace le Mochi et l'élément envoie l'événement `sans3d`.

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
choisit une avec `<mochi-bot mood="travaille">` ou `setMood()`. **Interactions** (actives par défaut,
`interactions`) : au survol le regard suit, une tape le fait sursauter, une double tape le fait rire, un
appui long le fait rougir, une secousse ou un tour rapide lui donne le tournis, et `coucou` joue un
bonjour à l'arrivée (il sort du sol en grandissant). Cela fait 5 réactions : `sursaut`, `rigole`,
`rougit`, `etourdi`, `coucou`. Voir [docs/moods.md](docs/moods.md).

**Contrôles 3D** : `<mochi-bot rendu="3d" yaw="0.5">` fait tourner le modèle autour de son axe
vertical (en radians ; les yeux sont peints sur la face avant seulement). La section 3D du site le pilote
au glisser.

**Accessoires** (22, prop `accessoires`, catalogue dans `src/bot/emplacements.ts`) : un par
emplacement, tous cumulables, chacun une forme simple en une ou deux couleurs au choix.

| Emplacement | Accessoires |
|---|---|
| `tete` (tête, 10) | `casquette`, `beret`, `haut-de-forme`, `couronne`, `paille`, `antenne`, `casque`, `ruban`, `fleur`, `toque` |
| `yeux` (yeux, 6) | `rondes`, `carrees`, `soleil`, `coeur`, `etoile`, `monocle` |
| `bas` (cou, 4) | `papillon`, `echarpe`, `perles`, `fleurs` |
| `dos` (dos, 2) | `sac`, `cape` |

`el.accessoires = { tete: { id: 'casquette', c1: '#e8505b' }, yeux: 'rondes' }`, ou la même chose en JSON dans l'attribut.
**Thème** : `theme="dark"` rend les yeux noirs (sans lui, c'est le thème courant du site). En thème clair, les yeux
sont toujours blancs, pour toutes les couleurs, sans contour.

**Exports**, tous depuis la scène 3D : PNG et SVG (une image fixe du canvas 3D, intégrée comme image dans
le SVG), un GIF animé, et un montage entier en GIF ou en MP4, rendus image par image (l'encodeur vidéo ne se
charge qu'à la première utilisation). Le SVG animé n'existe plus : sans dessin 2D, il n'y a pas d'animation
vectorielle à exporter.

## API principale

```ts
const engine = new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get('nuage')?.radii, expression)
engine.setState('wink', t)        // change state at time t (morphs with the measured curve)
engine.setShape(radii, t)          // morph to another silhouette
engine.setExpression(expr, t)      // resting expression
engine.setLook({ yaw, pitch, mix, wander }, t) // aim the eyes (null to release)
const frame = engine.sample(t, geste?) // pure: bodyPath, eyes, arcs, dots, notif
```

Options de `<mochi-bot>` : `size`, `shape`, `color`, `paper`, `frozen-at`, `follow`, `rendu`, `pixel`,
`rendu3d`, `douceur`, `contour`, `epaisseur-contour`, `reflet`, `ombre`, `ombrage`, `yaw`, `theme`, `mood`,
`interactions`, `coucou`, `ordinateur`, `accessoires`, `fps`, `label`, `max-pixel-ratio` (la propriété porte
le même nom en camelCase). `color` est un identifiant du catalogue (`violet`) ou n'importe quel code
hexadécimal (`#ff8800`, `#f80`). Voir [mochi-bot.ts](src/components/mochi-bot.ts) et la
[page docs](https://mochi-red-phi.vercel.app/docs).

Les clés de stockage du navigateur commencent toujours par `mochi:` : les renommer ferait perdre les
réglages enregistrés.

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
| [docs/export.md](docs/export.md) | Export PNG, SVG, GIF et MP4, tout depuis la 3D |
| [docs/i18n.md](docs/i18n.md) | La couche de traduction faite maison |

## Développement

```bash
npx -y pnpm@11.17.0 install
npx -y pnpm@11.17.0 dev      # http://localhost:5190  (site at /, app at /app.html, lab at /labo.html)
npx -y pnpm@11.17.0 test     # vitest
npx -y pnpm@11.17.0 build    # tsc --noEmit && vite build
npx -y pnpm@11.17.0 build:lib  # la bibliothèque seule, dans dist-lib/
```

TypeScript sans framework : l'avatar est un Web Component natif, et le site et l'app utilisent un petit
moteur de rendu maison (`src/ui/dom/`, quelques centaines de lignes). Vite, Tailwind 4 (app seulement),
Three.js (chargé à la demande). `tsc` est le seul contrôle de types : lancez le build avant de conclure. [CHANGELOG.md](CHANGELOG.md) a une entrée
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
