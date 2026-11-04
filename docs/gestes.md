# Gestes : animations variées (couche facultative)

`src/bot/gestes.ts` ajoute de petites animations PAR-DESSUS la pose du moteur, pour qu'un
groupe d'avatars ne bouge pas d'un seul bloc. Ce sont des réglages choisis, pas des
mesures : ils sont rangés à part et n'entrent en jeu que si on les passe à `sample()`.

```ts
import { BotEngine } from './engine'
import { gesteRepos, rebond, composer } from './gestes'

const bot = new BotEngine(100, 'idle')
const image = bot.sample(t, composer(gesteRepos(t, graine), rebond(t - toucheA)))
```

Sans second argument (ou avec `GESTE_NEUTRE`), `sample(t)` rend exactement la même image
qu'avant, octet pour octet (test dans `gestes.test.ts`). Tout reste pur : fonction du temps
et d'une graine, aucune horloge, aucun état.

![Gestes, activités, sommeil, échec et rebond](gestes.png)

## Ce qu'un geste peut changer

`Geste = { dx, dy, sx, sy, yaw, pitch, roll, lid }` : déplacement du corps et des yeux (en
rayons), échelles du corps, écarts de visée (degrés), paupière maximale. `composer(a, b)`
additionne, multiplie et garde la paupière la plus fermée.

## Attente (`gesteRepos(t, graine)`)

Sept gestes courts : `cligne`, `respire`, `saut`, `balance`, `regard`, `hoche`, `etire`.
Calendrier en O(1) : une fenêtre de 8 s, un geste à un décalage tiré dans [0, 4[ s, donc 4 à
12 s entre deux gestes, jamais avant 4 s. La graine choisit 4 gestes préférés
(`personnalite`) avec des poids 35, 30, 25 et 10 % : chaque avatar a sa façon d'attendre,
et deux graines différentes ne gesticulent presque jamais en même temps.

## Toucher (`rebond(u)`)

Écrasement puis petit ressort amorti sur `REBOND_DUREE` (0,7 s). C'est le seul ressort du
corps, et il n'existe que dans cette couche : les états mesurés gardent leurs ease-out.

## Sommeil et échec

- `gesteSommeil(t)` : respiration lente (4,6 s), yeux fermés, corps un peu tassé ;
  `zSommeil(t)` donne la position de petits « z » qui montent (à dessiner par l'application).
- `gesteEchec(t)` : affaissement, tête basse, soupir lent. À combiner avec l'expression `triste`.

## Au travail (`ACTIVITES`)

Chaque activité joue un état du moteur en boucle (`tempsActivite`) et ajoute un geste :
`reflexion` (trois points qui pulsent), `frappe` (regard baissé, petites frappes) et
`balayage` (le regard lit de gauche à droite). Elles passent toutes par le visage.
L'application choisit l'activité de chaque rôle.

## Moteur seul pour une autre page

`tools/moteur.ts` exporte le moteur, les teintes 3D et les gestes, sans Vue :

    npx esbuild@0.24.0 tools/moteur.ts --bundle --format=esm --minify --alias:vue=./tools/vue-stub.ts --outfile=mochi-engine.js

Recopier l'en-tête MIT de `LICENSE` en tête du fichier produit.
