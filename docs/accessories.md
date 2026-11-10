# Accessoires de métier : retirés (10/11/2026)

Les accessoires de métier (`src/bot/accessoires.ts` : carnet, portable, clap, loupe, avion, palette,
presse-papiers, liste, engrenage, avec leurs mains et leurs gestes) étaient DESSINÉS EN SVG 2D
par-dessus le corps. Avec la règle « aucune 2D » (Robin, 10/11/2026), ils sont retirés du code avec
la prop `accessoire` de `<mochi-bot>` (historique dans git). L'humeur `travaille` montre un ordinateur
portable en 3D ; les accessoires portés en 3D sont décrits ci-dessous et dans
`docs/accessoires-emplacements.md`.

## Accessoires portes (`portes.ts`)

Huit accessoires posés sur le corps (seuls `lunettes`, `haut-de-forme` et `noeud` sont exposés sur le site ; les autres restent dans le moteur, en attente) : `lunettes`, `soleil`, `haut-de-forme`, `paille`, `bonnet`,
`noeud`, `couronne`, `casque`. Prop `porte` de `<mochi-bot>`. Ils
ne sont pas animés pour eux-mêmes : ils sont recalculés à CHAQUE image depuis `bodyPath` et les
yeux de cette image (`mesuresPorte`, `yeuxDe`). Un saut, un écrasement, une autre forme, un
regard ou un clin d'œil les déplacent donc avec le corps, sans réglage.

- Une seule description (`partiesPorte`, en unités du moteur) sert la 3D (Soft, Flat, Pixel : les
  teintes passent par le matériau du corps) : volumes de `ui/trois/porte3d.ts`, enfants du maillage donc
  tournés avec lui. Les sorties 2D (`porteSvg`, `dessinPorte`, `lunettesDe`) sont retirées (10/11/2026).
- Les lunettes sont une vraie monture 3D en tube épais, posée DEVANT les yeux 3D (toujours de face) avec un
  écart ; leurs branches rentrent dans la tête, d'où elles ressortent à la hauteur des côtés. Une ombre
  douce est peinte sur le visage sous chaque verre.
- Pas de verre dans la version 3D : les yeux restent entièrement visibles (clin d'œil, yeux
  écarquillés). Sans visage (`thinking`, `sleep`) les lunettes
  disparaissent ; le chapeau reste.
- Limites : pas de contour cartoon sur les pièces 3D.
