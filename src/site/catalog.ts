/**
 * Catalogue du site : libelles ANGLAIS. Les ids viennent du paquet (`mochi-world`, l'entree
 * publique de la bibliotheque, comme pour n'importe quel utilisateur) ; le site ne definit
 * aucune mesure. Les libelles de formes, couleurs, etats et styles reprennent ceux de
 * l'application (`src/i18n/locales/en.ts`).
 */
import en from '@/i18n/locales/en'
import { CATALOGUE, EMPLACEMENTS, MOOD_IDS, REACTION_IDS, RENDUS, SHAPES, parEmplacement, type Emplacement, type MoodId } from 'mochi-world/catalogue'

export const SHAPE_LABEL = en.shapes as Record<string, string>
export const COLOR_LABEL = en.colors as Record<string, string>
export const FORME_IDS = SHAPES.map((s) => s.id)

/**
 * Palette des exemples du site : 14 teintes vives (P1 « Bonbons et jouets »), toutes lisibles sur le fond clair
 * ET sur le fond sombre de la page (aucune quasi-blanche ni quasi-noire ; `catalog.test.ts` le verifie).
 */
export const PALETTE_SITE: { nom: string; hex: string }[] = [
  { nom: 'Tomato', hex: '#ff3b30' },
  { nom: 'Coral', hex: '#ff6a3d' },
  { nom: 'Orange', hex: '#ff9500' },
  { nom: 'Sunny yellow', hex: '#ffd60a' },
  { nom: 'Lime', hex: '#b6e800' },
  { nom: 'Apple green', hex: '#6fd400' },
  { nom: 'Emerald', hex: '#00c46a' },
  { nom: 'Turquoise', hex: '#00c7be' },
  { nom: 'Sky', hex: '#21b0ff' },
  { nom: 'Royal blue', hex: '#2d5bff' },
  { nom: 'Violet', hex: '#8b3dff' },
  { nom: 'Magenta', hex: '#d81bbd' },
  { nom: 'Pink', hex: '#ff4d94' },
  { nom: 'Cherry', hex: '#e6194b' }
]

/** Les formes 3D du site, chacune avec SA couleur (12 formes, 12 teintes differentes de la palette). */
export const FORMES_3D: { id: string; label: string; couleur: string }[] = [
  { id: 'cercle', label: 'Circle', couleur: '#00c46a' },
  { id: 'galet', label: 'Pebble', couleur: '#21b0ff' },
  { id: 'squircle', label: 'Squircle', couleur: '#ffd60a' },
  { id: 'capsule', label: 'Capsule', couleur: '#d81bbd' },
  { id: 'triangle', label: 'Triangle', couleur: '#6fd400' },
  { id: 'hexagone', label: 'Hexagon', couleur: '#ff9500' },
  { id: 'nuage', label: 'Cloud', couleur: '#2d5bff' },
  { id: 'goutte', label: 'Droplet', couleur: '#ff4d94' },
  { id: 'etoile', label: 'Star', couleur: '#b6e800' },
  { id: 'fleur', label: 'Flower', couleur: '#00c7be' },
  { id: 'oeuf', label: 'Egg', couleur: '#8b3dff' },
  { id: 'coeur', label: 'Heart', couleur: '#ff3b30' }
]

/* ------------------------------------------------------------------ humeurs, interactions, accessoires par emplacements */


/** Les sept humeurs : nom et une phrase, en anglais. */
export const HUMEURS_SITE: { id: MoodId; label: string; texte: string }[] = [
  { id: 'repos', label: 'Rest', texte: 'Soft breathing, blinks, a gaze that wanders.' },
  { id: 'reflechit', label: 'Thinking', texte: 'Eyes up, squinting, one a little more closed than the other.' },
  { id: 'travaille', label: 'Working', texte: 'Types on a small 3D laptop seen from behind: quick uneven bounces, a lean from side to side, gaze down, and pauses to think. It grows in and out as the mood starts and ends (the ordinateur prop hides it).' },
  { id: 'attend', label: 'Waiting', texte: 'Looking straight ahead, head tilted, a little impatient.' },
  { id: 'termine', label: 'Done', texte: 'Happy crescent eyes and two small jumps of joy.' },
  { id: 'bloque', label: 'Blocked', texte: 'Frowning eyes in mirror and a shake that comes in bursts.' },
  { id: 'dort', label: 'Asleep', texte: 'Eyes closed, slow breathing.' }
]
export const HUMEURS_IDS: MoodId[] = MOOD_IDS

/** Les reactions a l'utilisateur, avec le geste qui les declenche. */
export const INTERACTIONS_SITE: { geste: string; nom: string; texte: string }[] = [
  { geste: 'Hover', nom: 'Follows you', texte: 'The gaze and a small head turn follow the pointer.' },
  { geste: 'Tap', nom: 'Startle', texte: 'A squash and a damped bounce.' },
  { geste: 'Double tap', nom: 'Laugh', texte: 'Crescent eyes and a shaking body.' },
  { geste: 'Long press', nom: 'Blush', texte: 'Closes its eyes, content, for as long as you press.' },
  { geste: 'Shake or spin fast', nom: 'Dizzy', texte: 'Spinning eyes, a swaying body.' },
  { geste: 'On arrival', nom: 'Hello', texte: 'It grows out of the floor with a small rebound, then waves its head.' }
]

export const EMPLACEMENT_LABEL: Record<Emplacement, string> = {
  tete: 'Head',
  yeux: 'Eyes',
  visage: 'Face',
  bas: 'Neck',
  dos: 'Back'
}
export const EMPLACEMENTS_IDS = EMPLACEMENTS

/** Libelles anglais des accessoires du catalogue. */
const ACC_EN: Record<string, string> = {
  casquette: 'Cap',
  beret: 'Beret',
  'haut-de-forme': 'Top hat',
  couronne: 'Crown',
  paille: 'Straw hat',
  antenne: 'Antenna',
  casque: 'Headphones',
  ruban: 'Ribbon bow',
  fleur: 'Flower',
  toque: 'Chef hat',
  rondes: 'Round glasses',
  carrees: 'Square glasses',
  soleil: 'Sunglasses',
  coeur: 'Heart glasses',
  etoile: 'Star glasses',
  monocle: 'Monocle',
  papillon: 'Bow tie',
  echarpe: 'Scarf',
  perles: 'Pearl necklace',
  fleurs: 'Flower necklace',
  sac: 'Backpack',
  cape: 'Cape'
}
export const ACCESSOIRES_SITE = (e: Emplacement) => parEmplacement(e).map((a) => ({ id: a.id, label: ACC_EN[a.id] ?? a.id, c1: a.c1, c2: a.c2 }))
export const ACC_EN_IDS = Object.keys(ACC_EN)

/** Les chiffres du hero : tous lus dans les catalogues du moteur, aucun n'est ecrit a la main. */
export const CHIFFRES: { valeur: number; label: string }[] = [
  { valeur: SHAPES.length, label: 'shapes' },
  { valeur: RENDUS.length, label: '3D styles' },
  { valeur: MOOD_IDS.length, label: 'moods' },
  { valeur: REACTION_IDS.length, label: 'reactions to touch' },
  { valeur: CATALOGUE.length, label: 'accessories' }
]
