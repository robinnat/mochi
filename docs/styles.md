# Styles de rendu

Depuis la refonte « 3D seule », l'interface ne propose plus que trois styles, tous en VRAIE 3D
(Three.js, import dynamique, un seul contexte WebGL partagé) :

| Style | id `rendu` | Principe |
|---|---|---|
| **Soft** (défaut) | `3d` | matière douce : ombrage lisse, lueurs et reflet calculés en shader dans le repère de la caméra |
| **Flat** | `flat3d` | `toon` : trois tons nets, contour optionnel (`contour`) |
| **Pixel** | `pixel3d` | rendu à basse résolution (grille de `pixel`), réduit à une palette courte (3 tons du corps, tons des accessoires, blanc des yeux), contour de 1 px, agrandi avec `image-rendering: pixelated` (`src/ui/trois/pixel3d.ts`) |

**Aucune 2D (Robin, 10/11/2026).** Les anciens dessins SVG (`original`, `pixel`, `argile`, `bulle`,
issus en partie de bloub) sont RETIRÉS du code : plus de repli 2D, plus d'export 2D. Une valeur
`rendu` inconnue (dont ces anciens ids) retombe sur le réglage courant. Sans WebGL, un court message
remplace le Mochi (événement `sans3d`). Les exports (PNG, SVG, GIF, MP4) sont produits depuis la 3D :
image fixe du canvas, ou rendu image par image hors écran (`docs/export.md`). Le SVG animé est retiré.

**Yeux (Robin, 10/11/2026).** En thème clair, les yeux sont TOUJOURS blancs, pour toutes les couleurs
(jaune `#ffd60a` et citron vert `#b6e800` compris), sans contour ni liseré ; seul l'ombrage 3D normal
de l'œil reste. En thème sombre, ils sont noirs. Le contour du 09/11 et l'essai « yeux noirs en clair »
du 10/11 sont retirés.

## Ombrage continu sur 360 degrés (`src/ui/trois/lisere.ts`)

L'ombrage n'est PAS peint dans la texture de visage (c'est ce qui assombrissait le dos et les
flancs et laissait une couture) : tout est calculé dans le shader, en repère de la caméra, sur tout
le volume. Ombrage doux (AO) vers le bas et les bords, lueur bas-droite (4 h), lueur légère
haut-gauche (10 h), reflet doux. La texture ne porte que la couleur et les yeux.

## Formes 3D

Les 12 formes du catalogue ont un vrai volume sous tous les angles : sphère (cercle), galet
(ellipsoïde), squircle (galet-cube très arrondi), capsule (tube couché), triangle (cône arrondi),
hexagone (profond), nuage, goutte, étoile, fleur, œuf. Étoile, hexagone, nuage et fleur sont gonflés en « coussin » (`ProfilVolume.coussin`) : la hauteur est
la solution d'une équation de Poisson sur l'intérieur du contour (u = 0 au bord), calculée une fois par
forme et mise en cache (`champCoussin`, `hauteurCoussin`), puis z = H·(u/umax)^0,45. Surface lisse partout,
sans arête sur l'axe médian ni pli entre lobes, bord arrondi à tangente verticale, sans gorge sur la
tranche ; les normales sont en plus lissées. Goutte, œuf, triangle et capsule sont des
solides de révolution (`ProfilVolume.revolution`) : la profondeur d'un point est la demi-largeur
du contour à sa hauteur.

Le moteur ne change pas : `engine.sample(t)` rend la même image et les 5 états, leurs
mesures et leurs durées sont identiques. Seul `mochi-bot.ts` peint l'image autrement.
Le catalogue et le réglage courant vivent dans `src/ui/rendu.ts`.

> Les sections « Pixel art SVG » et « 3D douce en SVG » ont été retirées avec le code le 10/11/2026
> (historique dans git). La section suivante garde l'historique de la vraie 3D.

## [LEGACY] Vraie 3D, historique (WebGL, Three.js)

Le style `3d` (`src/ui/trois/`) rend le corps en volume réel, avec une caméra et une
lumière, là où la 3D douce n'est qu'un dessin de dégradés. Le moteur ne change pas : on
lit `engine.sample(t)` et on le dessine.

- **Le corps est le contour gonflé** (`volume.ts`, pur et testé sous `node`) : le
  `bodyPath` de l'image est évalué en points, puis chaque rayon centre -> bord devient une
  suite d'anneaux. La hauteur d'un sommet ne dépend que de sa DISTANCE au bord : face avant
  plane, arête en quart de cercle de rayon constant, mur droit, face arrière symétrique
  (un cercle donne exactement une sphère). Chaque forme a un **profil de volume**
  (`PROFILS` : profondeur en fraction de la plus petite dimension, rayon d'arête, face
  arrière) : le carré est un VRAI cube (profondeur = largeur, aretes arrondies), triangle,
  hexagone et étoile des prismes arrondis (profondeur 0,7 à 0,8), cœur, fleur et nuage des
  coussins bombés, les boules (cercle, œuf, galet, goutte, capsule) restent toutes rondes.
  Profondeur minimale 0,6 x la largeur, verrouillée par un test. Les anneaux internes sont
  arrondis pour qu'une forme à angles ne prenne pas de plis en éventail.
- **Les yeux sont sur la face avant seulement** : le bord avant et le mur sont dédoublés
  (même position, texture différente), donc le visage s'arrête à l'arête et les côtés et le
  dos sont de la couleur du corps. Sur une forme à face plane, la paire d'yeux est décalée
  (même vecteur, écart conservé) pour ne jamais mordre sur l'arête arrondie. Labo `#tour` :
  chaque forme sous quatre angles.
- **Les yeux sont peints dans une texture** projetée de face, aux positions exactes du
  moteur, et AUSSI dans une texture d'émission (blanc sur noir) : un œil est un trou clair,
  la lumière ne doit pas le griser. Sans cela, les yeux disparaissaient sur le dos du
  corps et de trois quarts.
- **Un seul contexte WebGL** pour tous les avatars de la page (`rendreAvatar`) : chaque
  vignette demande une image, elle est rendue puis recopiée dans son canvas 2D. Le contour
  et le visage ne sont refaits que s'ils ont changé d'une image à l'autre.
- **Chargement à la demande** : `scene3d.ts` n'est jamais importé statiquement
  (133 ko gzip). `mochi-bot.ts` le charge au montage ; tant qu'il n'est pas là, le Mochi
  n'est pas dessiné (événement `pret` à la première image), et sans WebGL un message le remplace.
- **Intégration** : le canvas est dans un `<foreignObject>` calé sur le viewBox, entre la
  moitié arrière et la moitié avant des anneaux, qui restent en SVG.

### 3D flat : `aplat` (ancien défaut, remplacé par `doux` le 03/11/2026)

Décision sur la matière réaliste : pas de 3D réaliste, plutôt de la 3D flat. Quatre
variantes ont été comparées (A toon, B toon + contour, C low poly, D aplat) ; **D a été retenue, avec le contour cartoon en option**. Même volume et même moteur (`volume.ts`,
`scene3d.ts`, `iso.ts`), choisis par `rendu3d` (`src/ui/trois/rendu3d.ts`, pur et testé) :
prop `rendu3d` et `contour` de `MochiBot`, options `rendu3d` et `contour` de `EspaceIso`,
arguments de `rendreAvatar`.

- **`aplat`** (n'est plus le défaut) : deux tons seulement, la couleur choisie telle quelle et une teinte
  d'ombre ; ombre au sol en ellipse pleine semi-transparente ; yeux blancs en aplat (texture
  et émission), sans creux ombré.
- **Contour cartoon** (`contour: boolean`, défaut `false`) : coque inversée, teinte du corps
  assombrie en HSL (`couleurContour` : l'ambre reste de l'ambre fonce, pas du brun),
  épaisseur en pixels qui s'allège en petite taille (2 % du diamètre, entre 1,3 et 3,4 px,
  `epaisseurContourPx`).
- **Limite d'ombre organique** : la normale d'éclairage est perturbée par un bruit basse
  fréquence ancré sur le corps (`organiser` dans `scene3d.ts`), de sorte que la limite
  ondule au lieu de former une ligne droite sur l'étoile et la fleur. Les yeux (émission)
  ne bougent pas.
- **Interface** : style « 3D » = aplat, avec la case « Contour cartoon » (persistée sous
  `mochi:contour`). `toon` et `lowpoly` ne sont plus proposés ni dans l'interface ni dans le
  labo ; ils restent dans le code (une ligne de table chacun, aucun coût) et `?r=toon`,
  `?r=toon-contour`, `?r=lowpoly`, `?r=realiste` les montrent dans `#gros` et `#iso`. Le
  `realiste` est disponible en interne seulement (`rendu3d="realiste"`).
- Les tons sont des multiples de la couleur du flat (1 = la couleur telle quelle) : pas plus
  pastel. Dans la scène isométrique, les dalles prennent la même rampe et l'ombre au sol est
  l'ellipse pleine (pas d'ombre portée du soleil).

Captures : `docs/variantes/3d-choix-D-etoile.png` (avant et après l'adoucissement) ; `3d-flat-*.png` : la comparaison
A, B, C, D qui a mené au choix.
À voir : `labo.html#formes3d` (`?v=lignes` : une ligne par style, portrait), `#gros` et
`#iso` (`?contour=1`, `?r=<id>`).

### Matière `doux` : ombrage lisse (PR feat/ombrage-lisse, 03/11/2026)

Constat sur l'aplat : un gros bloc d'ombre n'est pas très joli, un ombrage LISSE est préférable. `doux` = même volume et même moteur, mais l'ombre est un passage
progressif et mat : une rampe continue de `dot(normale, lumière)` (smoothstep de -0,75 à
0,70, lue en filtrage linéaire dans le `gradientMap`), sans palier, sans reflet, sans rim
light, sans bruit de limite. Lumière en haut à gauche, devant ; la couleur du flat domine
(ton plein du centre au haut gauche), l'ombre ne s'installe que vers le bas droite. Yeux
blancs et nets (émission), ombre au sol en dégradé radial très léger, `contour` compatible.

Une seule matière, un paramètre `douceur` (prop `douceur` de `MochiBot`, option de
`EspaceIso`, argument de `rendreAvatar`) : `leger` (ton le plus sombre = 0,70 en linéaire,
soit environ 16 % plus sombre à l'écran) et `marque` (0,56, environ 24 %). **Défaut depuis le 03/11/2026 (choix de design)** : `doux`
marqué ; le style « 3D » de Personnaliser = doux marqué. `leger` reste un paramètre, `aplat`
(jugé trop lourd, un gros bloc d'ombre) reste dans le code hors interface. À voir : `labo.html#formes3d` (lignes : aplat, aplat +
contour, doux léger, doux marqué ; `?x=1,3,4` filtre les lignes, `?f=etoile` une forme),
`#gros` et `#iso` avec `?r=doux&d=marque`. Captures : `docs/variantes/3d-doux-*.png`.

### Reflet doux de `doux` (PR feat/reflet-doux, 03/11/2026)

Objectif : une petite lumière en haut à gauche, comme sur les Mochi 2D. La matière
`doux` porte une tache claire : un dégradé radial blanc semi-transparent (0,46 au centre, 0 au
bord), allongé le long de la lumière (inclinée de -32 degrés, comme le reflet de la pâte), mat, sans
éclat spéculaire. Elle est peinte dans la texture du corps AVANT les yeux (`reflet.ts`,
`peindreReflet`), donc les yeux (texture et émission) ne sont jamais touchés. Sa place
(`positionReflet`, pur et testé) suit la forme : le point le plus en haut à gauche qui reste assez à
l'intérieur pour que la tache tienne (marge 43 % du plus grand cercle inscrit), loin des yeux ;
étoile, cœur, fleur, goutte et morphing en profitent sans cas particulier. Option `reflet: boolean`
(défaut `true`) : prop de `MochiBot`, option d'`EspaceIso`, dernier argument de `rendreAvatar`.
Seule la matière `doux` le porte. À voir : `labo.html#formes3d` (ligne « avec reflet » et ligne « sans
reflet », `?f=cercle,etoile,nuage`), captures `docs/variantes/3d-doux-reflet-*.png`.

### Où la regarder

`labo.html` (entrée Vite séparée, l'application ne grossit pas) : `#formes` est la planche
des formes dans les quatre styles (flat, pixel, pâte, 3D ; `?c=<couleur>`, `?s=<taille>`),
`#gros` un gros plan en trois quarts.

### Risques connus

- **Coût par image** : mesuré en navigateur sans GPU (swiftshader, donc un pire cas) pour
  trois mochis 3D animés : 2,7 ms de mise à jour côté JS (contour, texture) et environ
  21 ms de rendu logiciel. Sur GPU réel le rendu est négligeable ; la mise à jour JS reste.
  Une planche de dizaines de vignettes 3D animées en même temps coûterait cher : les
  vignettes figées (`frozenAt`) ne rendent qu'une fois.
- **`<foreignObject>` dans Safari / iPhone** : non testé (aucun Safari ici). WebKit est
  connu pour mal placer un contenu HTML dans un `foreignObject` quand le SVG est mis à
  l'échelle ou transformé. Repli prévu si besoin : poser le canvas au-dessus du SVG,
  en `position: absolute`, avec les mêmes proportions. À tester sur un vrai iPhone avant de
  proposer la 3D au public.

## Limites connues

- Les GIF en 3D pèsent lourd (environ 800 ko pour 3 s) : les dégradés font beaucoup de
  couleurs, le GIF en garde 256.
- Le reflet et le dégradé 3D sont fixes dans l'espace : sur un état où le corps se déplace
  ou se réduit (veille), la lumière ne le suit pas exactement.
Captures : `docs/variantes/` (3D seulement ; les captures des anciens styles 2D sont retirées).
