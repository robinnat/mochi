# Sauts et espace isométrique

Deux briques, pour une future scene de type tableau de bord, dans une application hote (version ordinateur). Ici, une preuve
d'architecture : quelques dalles, trois mochis qui sautent, pas une scène.

## `src/bot/sauts.ts` : le saut (pur, testé)

Comme `engine.sample(t)`, c'est une fonction du temps, sans horloge ni état, qui ne sait rien
du rendu.

```ts
poseSaut(t, depart, arrivee, params?)   // -> { phase, x, y, hauteur, sy, sxz, avancement }
poseSurChemin(t, chemin, params?)       // enchaîne les sauts case par case
cheminEnBoucle(depart, largeur, hauteur)
dureeSaut(params?)
```

Un saut : **anticipation** (le corps s'écrase), **vol** (parabole, étiré en montant et à la
descente, rond au sommet), **atterrissage** (écrasement à l'impact, amorti en quelques
oscillations), **pause**. Le volume est conservé (`sy * sxz² = 1`). `x` et `y` sont en cases ;
`hauteur` en rayons de mochi. Les réglages (`SAUT_DEFAUT`) sont choisis, pas mesurés, donc
modifiables.

## `src/ui/trois/iso.ts` : l'espace (charge Three.js)

```ts
const espace = new EspaceIso(canvas, { largeur: 5, hauteur: 5 })
espace.ajouter('a', { forme: 'etoile', couleur: 'violet', case: { x: 0, y: 0 } })
espace.poser('a', { x: 2, y: 3 })       // pose sur une case, sans animation
espace.sauter('a', { x: 3, y: 3 }, t)   // lance un saut vers une case
espace.enSaut('a', t)                   // vrai pendant le saut
espace.dessiner(t)                      // image au temps t, renvoie le nombre de sauts en cours
espace.liberer()
```

- **Le temps vient de l'appelant** (secondes) : pas de boucle ni d'horloge dans l'espace ;
  la scène se rejoue image par image (captures, tests).
- **Caméra orthographique** (vraie isométrie, pas de fuite), à 45°. Cases de côté 1, grille
  centrée sur l'origine ; un mochi fait 0,42 case de rayon (`RAYON_CASE`).
- **Lumière** : ciel et sol doux (pas d'ombre noire) et un soleil directionnel qui porte les
  ombres (carte de 1024, PCF doux). Chaque mochi a en plus une tache d'ombre de contact qui
  s'efface quand il décolle : l'ombre portée seule décolle du corps au point de contact.
- **Chaque mochi** = un `BotEngine` (état `idle`, donc clignements et regard) et un `Mochi3d`
  (maillage et textures). Le pivot est le bas du corps : l'écrasement garde les pieds au sol.
- **Import dynamique obligatoire** : `iso.ts` et `scene3d.ts` apportent Three.js (133 ko
  gzip). Ne jamais les importer statiquement depuis l'application.

## Voir la démo

`pnpm dev` puis `/labo.html#iso` (animée ; `?t=0.45` fige à cette date, `?bench=1` mesure).
`#gros` : gros plan en trois quarts. `#formes` : planche des formes.

## Pour aller plus loin (hors de ce lot)

Collisions et files d'attente de cases, cases de hauteurs différentes (le saut prendrait
l'altitude de départ et d'arrivée), choix du chemin, orientation vers la case visée
(`orienter`), interactions et état du mochi pendant le déplacement (le moteur a déjà ses
quatorze états), et les performances à plus de quelques dizaines de mochis animés
(instancier ou figer les formes qui ne changent pas).
