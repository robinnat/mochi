/**
 * Accessoires 3D par EMPLACEMENTS combinables. Un accessoire au plus par emplacement, tous les
 * emplacements se cumulent : un Mochi peut porter un chapeau, des lunettes, une moustache, un noeud
 * papillon et un sac en meme temps.
 *
 * Ce fichier ne contient que le catalogue (noms, couleurs) : aucune geometrie, aucun `three`.
 *
 * REGLE DE ROBIN (05/11/2026) : chaque accessoire est tres simplifie, UNE couleur (`c1`), DEUX au
 * maximum (`c2`, par exemple fleur : petales + coeur). Les deux sont reglables par l'API
 * (`{ id, c1, c2 }`, voir `AccessoryChoice`) ; `c2` egal a `c1` veut dire « une seule couleur ».
 * Les volumes sont construits dans `ui/trois/accessoires3d.ts`, ancres sur le corps 3D.
 *
 * Emplacements, chacun sur sa propre zone du corps pour ne pas entrer en collision :
 *   tete   : au-dessus du sommet (chapeaux, coiffes, antenne, fleur)
 *   yeux   : a la hauteur des yeux (lunettes, masques)
 *   visage : joues et dessous des yeux (vide pour le moment : tous ses accessoires sont RETIRES)
 *   bas    : le « cou » du corps, vers 72 % de la hauteur (noeud papillon, cravate, moustache, echarpe, collier...)
 *   dos    : les cotes et le dos (sac, cape)
 */

export type Slot = 'head' | 'eyes' | 'face' | 'neck' | 'back'

/** Tous les emplacements, y compris `face` (vide depuis le 10/11/2026, garde pour les accessoires RETIRES). */
export const ALL_SLOTS: Slot[] = ['head', 'eyes', 'face', 'neck', 'back']

/** Les emplacements PROPOSES : ceux qui ont au moins un accessoire au catalogue. */
export const SLOTS: Slot[] = ['head', 'eyes', 'neck', 'back']

export const SLOT_NAMES: Record<Slot, string> = {
  head: 'Head',
  eyes: 'Eyes',
  face: 'Face and cheeks',
  neck: 'Neck',
  back: 'Sides and back'
}

export interface AccessoryDef {
  id: string
  slot: Slot
  /** nom affiche en legende */
  name: string
  /** couleur principale et couleur d'appoint (reglables a l'usage) */
  c1: string
  c2: string
}

/** Palette vive et sobre, alignee sur P1 « Bonbons et jouets » (09/11/2026) pour les teintes vives. */
export const ACCESSORY_PALETTE = {
  red: '#ff3b30',
  yellow: '#ffd60a',
  turquoise: '#00c7be',
  navy: '#2b3a67',
  pink: '#ff4d94',
  cream: '#f6f1e7',
  black: '#26222f',
  gold: '#ffc933',
  green: '#00c46a',
  orange: '#ff9500',
  violet: '#8b3dff',
  blue: '#2d5bff',
  straw: '#efcf8a'
} as const

const C = ACCESSORY_PALETTE

const def = (slot: Slot, id: string, name: string, c1: string, c2: string): AccessoryDef => ({ id, slot, name, c1, c2 })

export const ACCESSORIES: AccessoryDef[] = [
  // tete
  def('head', 'cap', 'Cap', C.red, C.red),
  def('head', 'beret', 'Beret', C.black, C.black),
  def('head', 'top-hat', 'Top hat', C.black, C.red),
  def('head', 'crown', 'Crown', C.gold, C.gold),
  def('head', 'straw', 'Straw hat', C.straw, C.red),
  def('head', 'antenna', 'Antenna', C.black, C.red),
  def('head', 'headphones', 'Headphones', C.red, C.red),
  def('head', 'ribbon', 'Ribbon bow', C.pink, C.pink),
  def('head', 'flower', 'Flower', C.pink, C.yellow),
  def('head', 'toque', 'Chef hat', C.cream, C.cream),
  // yeux
  def('eyes', 'round', 'Round glasses', C.black, C.black),
  def('eyes', 'square', 'Square glasses', C.navy, C.navy),
  def('eyes', 'sunglasses', 'Sunglasses', C.black, C.black),
  def('eyes', 'heart', 'Heart glasses', C.pink, C.pink),
  def('eyes', 'star', 'Star glasses', C.gold, C.gold),
  def('eyes', 'monocle', 'Monocle', C.gold, C.gold),
  // bas
  def('neck', 'bowtie', 'Bow tie', C.black, C.black),
  def('neck', 'scarf', 'Scarf', C.orange, C.orange),
  def('neck', 'pearls', 'Pearl necklace', C.cream, C.cream),
  def('neck', 'lei', 'Flower necklace', C.pink, C.yellow),
  // dos
  def('back', 'backpack', 'Backpack', C.orange, C.navy),
  def('back', 'cape', 'Cape', C.red, C.red)
]


/**
 * Accessoires RETIRES du catalogue (retours de Robin, 05/11/2026) : ils n'apparaissent plus ni dans le
 * catalogue ni sur les planches. Les definitions et les generateurs 3D restent dans le depot : pour en
 * remettre un, le recopier dans `ACCESSORIES`.
 */
export const REMOVED: AccessoryDef[] = [
  // v14 (10/11/2026, Robin) : joues roses retirees (la rougeur de l'appui long, une EXPRESSION, reste) ; plus
  // aucun accessoire dans l'emplacement visage, qui n'est plus propose (lunettes et monocle restent dans « yeux »)
  def('face', 'cheeks', 'Pink cheeks', C.pink, C.pink),
  // v13 (09/11/2026, Robin) : les deux paires d'ailes (ange et chauve-souris) sont retirees
  def('back', 'wings', 'Angel wings', C.cream, C.cream),
  def('back', 'batwings', 'Bat wings', C.violet, C.violet),
  // v12 (09/11/2026, Robin) : taches de rousseur, grain de beaute, moustache et moustaches de chat retires
  def('face', 'whiskers', 'Cat whiskers', C.black, C.pink),
  def('face', 'freckles', 'Freckles', '#c8733a', '#c8733a'),
  def('face', 'mole', 'Beauty mark', C.black, C.black),
  def('neck', 'mustache', 'Mustache', C.black, C.black),
  // v11 (05/11/2026) : la cravate (essais v9 a v11 refuses)
  def('neck', 'tie', 'Tie', C.red, C.red),
  def('head', 'ears', 'Ear headband', C.pink, C.cream),
  def('eyes', 'ski', 'Ski goggles', C.orange, C.blue),
  def('eyes', 'domino', 'Hero mask', C.red, C.cream),
  def('face', 'bandage', 'Bandage', C.cream, C.pink),
  def('face', 'tear', 'Tear', C.blue, C.blue),
  def('neck', 'medal', 'Medal', C.gold, C.red),
  def('neck', 'bell', 'Bell collar', C.turquoise, C.gold),
  // v3 (05/11/2026)
  def('head', 'party', 'Party hat', C.violet, C.yellow),
  def('head', 'bob', 'Bob', C.yellow, C.cream),
  def('neck', 'bandana', 'Bandana', C.red, C.cream),
  // v4 (05/11/2026)
  def('head', 'beanie', 'Pompom beanie', C.turquoise, C.cream),
  def('back', 'tail', 'Tail', C.orange, C.orange),
  def('eyes', 'sleep', 'Sleep mask', C.violet, C.cream)
]

export const ACCESSORY_BY_KEY = new Map(ACCESSORIES.map((a) => [`${a.slot}:${a.id}`, a]))

export const accessoriesInSlot = (e: Slot) => ACCESSORIES.filter((a) => a.slot === e)

/** Un choix : l'id seul (couleurs du catalogue) ou l'id avec des couleurs imposees. */
export type AccessoryChoice = string | { id: string; c1?: string; c2?: string }

/** Ce qui est porte : au plus un accessoire par emplacement. */
export type AccessorySelection = Partial<Record<Slot, AccessoryChoice>>

/** Choix normalise : definition du catalogue avec les couleurs finales ; `null` si inconnu. */
export function resolveAccessories(e: Slot, choice: AccessoryChoice | undefined | null): AccessoryDef | null {
  if (!choice) return null
  const id = typeof choice === 'string' ? choice : choice.id
  const d = ACCESSORY_BY_KEY.get(`${e}:${id}`)
  if (!d) return null
  if (typeof choice === 'string') return d
  return { ...d, c1: choice.c1 ?? d.c1, c2: choice.c2 ?? d.c2 }
}

/** Toutes les couleurs d'une selection (palette du pixel art). */
export function colorsOf(sel: AccessorySelection): string[] {
  const out = new Set<string>()
  for (const e of SLOTS) {
    const d = resolveAccessories(e, sel[e])
    if (d) {
      out.add(d.c1)
      out.add(d.c2)
    }
  }
  return [...out]
}
