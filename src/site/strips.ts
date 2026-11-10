/**
 * Donnees des bandes d'accessoires du site : une bande par emplacement propose du paquet (tete, yeux, bas, dos),
 * remplie des PIECES SEULES (sans corps), dans beaucoup de variantes de couleurs. Tout est DETERMINISTE : memes
 * bandes a chaque visite, et testable sans navigateur. Aucun rendu ici : `vignettes.ts` dessine, `Habillage.ts` affiche.
 */
import { SLOTS, type Slot } from 'mochis/catalogue'
import { SITE_ACCESSORIES, PALETTE_SITE } from './catalog'

export interface ItemStrip {
  /** identifiant stable (cle de liste) */
  key: string
  slot: Slot
  accessory: string
  /** texte alternatif, en anglais */
  label: string
  c1: string
  c2: string
  /** rotation de la piece, en radians : de trois quarts pour qu'on lise le volume ; les pieces du dos se montrent de dos */
  yaw: number
}

export interface DefStrip {
  slot: Slot
  title: string
  text: string
  /** sens du defilement : alternance gauche, droite, gauche... */
  direction: 'left' | 'right'
  /** secondes pour un tour complet : plus long = plus lent */
  duration: number
}

/** Les bandes, dans l'ordre des emplacements du paquet ; le sens alterne d'une ligne a l'autre. */
export const STRIPS: DefStrip[] = [
  { slot: 'head', title: 'Hats', text: 'Caps, crowns, berets, headphones, flowers', direction: 'left', duration: 64 },
  { slot: 'eyes', title: 'Glasses', text: 'Round, square, sun, heart, star and a monocle', direction: 'right', duration: 60 },
  { slot: 'neck', title: 'Neck', text: 'Bow ties, scarves, necklaces', direction: 'left', duration: 62 },
  { slot: 'back', title: 'Back', text: 'A backpack and a cape, seen from behind', direction: 'right', duration: 68 }
]

/** Angle par emplacement : trois quarts (le signe alterne d'une piece a l'autre) ; visage presque de face ; dos de trois quarts arriere. */
const YAW: Record<Slot, number> = { head: 0.55, eyes: 0.24, face: 0.2, neck: 0.5, back: Math.PI - 0.6 }

/** Pas du cycle de couleurs (14), choisi pour que le cycle ne se referme pas trop vite, donc toute la palette est parcourue sans repetition proche. */
const STEP_COLOR = 6

const rgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
/** Distance de deux couleurs, de 0 a ~441 : sert a ne pas faire une piece a deux couleurs presque unies. */
export function distanceColor(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}
/** Ecart minimal entre les deux couleurs d'une piece a deux couleurs. */
export const GAP_MIN = 85

/** Premiere couleur de la palette, a partir de `startPos`, assez loin des couleurs `avoid`. */
function far(startPos: number, avoid: string[]): string {
  for (let k = 0; k < PALETTE_SITE.length; k++) {
    const h = PALETTE_SITE[(startPos + k) % PALETTE_SITE.length]!.hex
    if (avoid.every((e) => distanceColor(h, e) >= GAP_MIN)) return h
  }
  return '#26222f'
}

/** `n` pieces pour un emplacement : tout le catalogue de l'emplacement, plusieurs fois, a chaque tour dans d'autres couleurs. */
export function itemsStrip(slot: Slot, n = 24): ItemStrip[] {
  const rang = SLOTS.indexOf(slot)
  const list = SITE_ACCESSORIES(slot)
  const out: ItemStrip[] = []
  for (let i = 0; i < n; i++) {
    const acc = list[i % list.length]!
    const turn = Math.floor(i / list.length)
    const twoColors = acc.c1 !== acc.c2
    // premier tour : les couleurs d'origine du catalogue ; ensuite, d'autres teintes de la palette
    const c1 = turn === 0 ? acc.c1 : PALETTE_SITE[(i * STEP_COLOR + rang * 5 + turn * 3) % PALETTE_SITE.length]!.hex
    const c2 = !twoColors ? c1 : turn === 0 ? acc.c2 : far(i * 5 + rang * 3 + turn * 9 + 4, [c1])
    const direction = i % 2 === 0 ? 1 : -1
    out.push({
      key: `${slot}-${i}`,
      slot,
      accessory: acc.id,
      label: `${acc.label}${turn > 0 ? ` (colour ${turn + 1})` : ''}`,
      c1,
      c2,
      yaw: direction * YAW[slot]
    })
  }
  return out
}

/**
 * Une piece seule, dans les couleurs du catalogue, vu de trois quarts : c'est l'icone d'un accessoire dans le
 * selecteur de « Make it yours » (rendue par `vignettes.ts`, comme les anciennes bandes).
 */
export function itemPiece(slot: Slot, id: string): ItemStrip | null {
  const acc = SITE_ACCESSORIES(slot).find((a) => a.id === id)
  if (!acc) return null
  return { key: `${slot}:${id}`, slot, accessory: id, label: acc.label, c1: acc.c1, c2: acc.c2, yaw: YAW[slot] }
}
