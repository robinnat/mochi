# Accessoires 3D par emplacements (propositions)

`src/bot/emplacements.ts` : le catalogue (aucune geometrie). `src/ui/trois/accessoires3d.ts` : les volumes.
`src/ui/trois/ancres.ts` : l'ancrage, calcule par rayons sur le volume du corps de l'image courante.

Cinq emplacements, un accessoire au plus par emplacement, tous cumulables :

| Emplacement | Zone | Exemples |
| --- | --- | --- |
| `tete` | assise au-dessus du sommet (jamais plus bas que 28 % de la hauteur) | casquette, haut-de-forme, couronne |
| `yeux` | ligne des deux yeux | lunettes rondes, carrees, coeur, masque de sommeil, lunettes de ski |
| `visage` | sous les yeux, joues | moustache, pansement, taches de rousseur |
| `bas` | « cou », vers 76 % de la hauteur, anneaux inclines | noeud papillon, echarpe, collier de perles |
| `dos` | cotes et arriere | sac a dos, cape |

```ts
mochi.setAccessoires({ tete: 'casquette', yeux: 'soleil', bas: 'papillon' })
// ou avec des couleurs imposees : { tete: { id: 'casquette', c1: '#e8505b' } }
```

Meme eclairage que le corps (ombrage en repere de vue, `lisere.ts`) en Soft ; Flat et Pixel reutilisent la matiere du
corps (pas de lueurs). Les ombres douces sur le corps passent par la meme texture que les anciens accessoires portes.

Planches de propositions : `tools/accessoires-v1.html?planche=tete|yeux|visage|bas|dos|combos|vues|styles`.

Limites connues : les pieces sont reconstruites quand le contour change (tirs de rayons), donc pas encore adaptees a une
animation fluide ; les « vieux » accessoires portes (`portes.ts`) restent inchanges et independants.
