/**
 * Donnees des bandes d'accessoires du site : une bande par emplacement du paquet (tete, yeux, visage, bas, dos),
 * remplie des PIECES SEULES (sans corps), dans beaucoup de variantes de couleurs. Tout est DETERMINISTE : memes
 * bandes a chaque visite, et testable sans navigateur. Aucun rendu ici : `vignettes.ts` dessine, `Habillage.vue` affiche.
 */
import { EMPLACEMENTS, type Emplacement } from '@/bot/emplacements'
import { ACCESSOIRES_SITE, PALETTE_SITE } from './catalog'

export interface ItemBande {
  /** identifiant stable (cle Vue) */
  cle: string
  emplacement: Emplacement
  accessoire: string
  /** texte alternatif, en anglais */
  label: string
  c1: string
  c2: string
  /** rotation de la piece, en radians : de trois quarts pour qu'on lise le volume ; les pieces du dos se montrent de dos */
  yaw: number
}

export interface DefBande {
  emplacement: Emplacement
  titre: string
  texte: string
  /** sens du defilement : alternance gauche, droite, gauche... */
  sens: 'gauche' | 'droite'
  /** secondes pour un tour complet : plus long = plus lent */
  duree: number
}

/** Les bandes, dans l'ordre des emplacements du paquet ; le sens alterne d'une ligne a l'autre. */
export const BANDES: DefBande[] = [
  { emplacement: 'tete', titre: 'Hats', texte: 'Caps, crowns, berets, headphones, flowers', sens: 'gauche', duree: 64 },
  { emplacement: 'yeux', titre: 'Glasses', texte: 'Round, square, sun, heart, star and a monocle', sens: 'droite', duree: 60 },
  { emplacement: 'visage', titre: 'Face', texte: 'Blush', sens: 'gauche', duree: 66 },
  { emplacement: 'bas', titre: 'Neck', texte: 'Bow ties, scarves, necklaces', sens: 'droite', duree: 62 },
  { emplacement: 'dos', titre: 'Back', texte: 'A backpack and a cape, seen from behind', sens: 'gauche', duree: 68 }
]

/** Angle de vue par emplacement : trois quarts (le signe alterne d'une piece a l'autre) ; visage presque de face ; dos de trois quarts arriere. */
const YAW: Record<Emplacement, number> = { tete: 0.55, yeux: 0.24, visage: 0.2, bas: 0.5, dos: Math.PI - 0.6 }

/** Pas du cycle de couleurs (16) : premier avec 16, donc toute la palette est parcourue sans repetition proche. */
const PAS_COULEUR = 7

const rgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
/** Distance de deux couleurs, de 0 a ~441 : sert a ne pas faire une piece a deux couleurs presque unies. */
export function distanceCouleur(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}
/** Ecart minimal entre les deux couleurs d'une piece a deux couleurs. */
export const ECART_MIN = 85

/** Premiere couleur de la palette, a partir de `depart`, assez loin des couleurs `eviter`. */
function loin(depart: number, eviter: string[]): string {
  for (let k = 0; k < PALETTE_SITE.length; k++) {
    const h = PALETTE_SITE[(depart + k) % PALETTE_SITE.length]!.hex
    if (eviter.every((e) => distanceCouleur(h, e) >= ECART_MIN)) return h
  }
  return '#26222f'
}

/** `n` pieces pour un emplacement : tout le catalogue de l'emplacement, plusieurs fois, a chaque tour dans d'autres couleurs. */
export function itemsBande(emplacement: Emplacement, n = 24): ItemBande[] {
  const rang = EMPLACEMENTS.indexOf(emplacement)
  const liste = ACCESSOIRES_SITE(emplacement)
  const out: ItemBande[] = []
  for (let i = 0; i < n; i++) {
    const acc = liste[i % liste.length]!
    const tour = Math.floor(i / liste.length)
    const deuxCouleurs = acc.c1 !== acc.c2
    // premier tour : les couleurs d'origine du catalogue ; ensuite, d'autres teintes de la palette
    const c1 = tour === 0 ? acc.c1 : PALETTE_SITE[(i * PAS_COULEUR + rang * 5 + tour * 3) % PALETTE_SITE.length]!.hex
    const c2 = !deuxCouleurs ? c1 : tour === 0 ? acc.c2 : loin(i * 5 + rang * 3 + tour * 9 + 4, [c1])
    const sens = i % 2 === 0 ? 1 : -1
    out.push({
      cle: `${emplacement}-${i}`,
      emplacement,
      accessoire: acc.id,
      label: `${acc.label}${tour > 0 ? ` (colour ${tour + 1})` : ''}`,
      c1,
      c2,
      yaw: sens * YAW[emplacement]
    })
  }
  return out
}

/**
 * Une piece seule, dans les couleurs du catalogue, vue de trois quarts : c'est l'icone d'un accessoire dans le
 * selecteur de « Make it yours » (rendue par `vignettes.ts`, comme les anciennes bandes).
 */
export function itemPiece(emplacement: Emplacement, id: string): ItemBande | null {
  const acc = ACCESSOIRES_SITE(emplacement).find((a) => a.id === id)
  if (!acc) return null
  return { cle: `${emplacement}:${id}`, emplacement, accessoire: id, label: acc.label, c1: acc.c1, c2: acc.c2, yaw: YAW[emplacement] }
}
