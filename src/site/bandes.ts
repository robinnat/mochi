/**
 * Donnees des bandes d'accessoires du site : une bande par emplacement du paquet (tete, yeux, visage, bas, dos),
 * remplie de variantes (accessoires du catalogue, couleurs, formes, humeurs). Tout est DETERMINISTE : memes
 * bandes a chaque visite, et testable sans navigateur. Aucun rendu ici : `vignettes.ts` dessine, `Habillage.vue` affiche.
 */
import { EMPLACEMENTS, type Emplacement } from '@/bot/emplacements'
import type { MoodId } from '@/bot/humeurs'
import { ACCESSOIRES_SITE, FORMES_3D, PALETTE_SITE, SHAPE_LABEL } from './catalog'

export interface ItemBande {
  /** identifiant stable (cle Vue) */
  cle: string
  emplacement: Emplacement
  accessoire: string
  /** texte alternatif, en anglais */
  label: string
  forme: string
  /** couleur du corps (hex) */
  corps: string
  c1: string
  c2: string
  mood: MoodId
  /** rotation du corps, en radians (la plupart de face, quelques trois quarts) */
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
  { emplacement: 'tete', titre: 'Hats', texte: 'Caps, crowns, berets, headphones, flowers', sens: 'gauche', duree: 44 },
  { emplacement: 'yeux', titre: 'Glasses', texte: 'Round, square, sun, heart, star and a monocle', sens: 'droite', duree: 40 },
  { emplacement: 'visage', titre: 'Face', texte: 'Whiskers, freckles, blush, a beauty mark', sens: 'gauche', duree: 46 },
  { emplacement: 'bas', titre: 'Neck', texte: 'Bows, scarves, necklaces, a moustache', sens: 'droite', duree: 42 },
  { emplacement: 'dos', titre: 'Back', texte: 'Wings, a backpack, a cape', sens: 'gauche', duree: 48 }
]

/** Humeurs de visage seulement (pas de grand saut qui sortirait du cadre). */
const HUMEURS: MoodId[] = ['repos', 'repos', 'reflechit', 'repos', 'attend', 'repos', 'bloque', 'repos']
const YAWS = [0, 0.32, 0, -0.32, 0, 0.2]

/** Pas des cycles de formes (12) et de couleurs (16) : premiers avec eux, donc tout est parcouru sans repetition proche. */
const PAS_FORME = 5
const PAS_COULEUR = 7

const rgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
/** Distance de deux couleurs, de 0 a ~441 : sert a ne jamais poser un accessoire de la couleur du corps. */
export function distanceCouleur(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}
/** Ecart minimal accessoire / corps. */
export const ECART_MIN = 85

/** Premiere couleur de la palette, a partir de `depart`, assez loin des couleurs `eviter`. */
function loin(depart: number, eviter: string[]): string {
  for (let k = 0; k < PALETTE_SITE.length; k++) {
    const h = PALETTE_SITE[(depart + k) % PALETTE_SITE.length]!.hex
    if (eviter.every((e) => distanceCouleur(h, e) >= ECART_MIN)) return h
  }
  return '#26222f'
}

/** `n` variantes pour un emplacement : tout le catalogue de l'emplacement, plusieurs fois, a chaque tour d'autres formes et couleurs. */
export function itemsBande(emplacement: Emplacement, n = 16): ItemBande[] {
  const rang = EMPLACEMENTS.indexOf(emplacement)
  const liste = ACCESSOIRES_SITE(emplacement)
  const out: ItemBande[] = []
  for (let i = 0; i < n; i++) {
    const acc = liste[i % liste.length]!
    const forme = FORMES_3D[(i * PAS_FORME + rang * 3) % FORMES_3D.length]!
    const corps = PALETTE_SITE[(i * PAS_COULEUR + rang * 5) % PALETTE_SITE.length]!.hex
    const deuxCouleurs = acc.c1 !== acc.c2
    // premier tour : les couleurs d'origine du catalogue (si elles tranchent sur le corps) ; ensuite, d'autres teintes
    const tour = Math.floor(i / liste.length)
    let c1 = acc.c1
    if (tour > 0 || distanceCouleur(c1, corps) < ECART_MIN) c1 = loin(i * 3 + rang * 7 + tour * 5 + 2, [corps])
    let c2 = c1
    if (deuxCouleurs) {
      c2 = tour > 0 || distanceCouleur(acc.c2, corps) < ECART_MIN ? loin(i * 5 + rang * 3 + tour * 9 + 4, [corps, c1]) : acc.c2
    }
    out.push({
      cle: `${emplacement}-${i}`,
      emplacement,
      accessoire: acc.id,
      label: `${acc.label} on a ${SHAPE_LABEL[forme.id]!.toLowerCase()} Mochi`,
      forme: forme.id,
      corps,
      c1,
      c2,
      mood: HUMEURS[(i + rang) % HUMEURS.length]!,
      yaw: YAWS[(i * 2 + rang) % YAWS.length]!
    })
  }
  return out
}
