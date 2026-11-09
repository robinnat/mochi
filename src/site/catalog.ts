/**
 * Catalogue du site : libelles ANGLAIS et fabriques de gestes pour les demos.
 * Les ids viennent du moteur (formes, etats, gestes, accessoires) ; le site ne definit
 * aucune mesure. Les libelles de formes, couleurs, etats et styles reprennent ceux de
 * l'application (`src/i18n/locales/en.ts`).
 */
import en from '@/i18n/locales/en'
import { ACCESSOIRES, type AccessoireId } from '@/bot/accessoires'
import {
  ACTIVITES,
  GESTES_REPOS,
  GESTE_NEUTRE,
  REBOND_DUREE,
  gesteEchec,
  gesteSommeil,
  rebond,
  type Geste
} from '@/bot/gestes'
import { PORTE_IDS, type PorteId } from '@/bot/portes'
import { COLOR_BY_ID, SHAPES } from '@/bot/skins'
import { SEQUENCE, STATE_BY_ID, type StateId } from '@/bot/states'
import type { Block } from '@/bot/cycles'
import { CATALOGUE, EMPLACEMENTS, parEmplacement, type Emplacement } from '@/bot/emplacements'
import { MOOD_IDS, REACTION_IDS, type MoodId } from '@/bot/humeurs'
import { RENDUS } from '@/ui/rendu'

export const SHAPE_LABEL = en.shapes as Record<string, string>
export const COLOR_LABEL = en.colors as Record<string, string>
export const STATE_LABEL = en.states as Record<string, string>
export const FORME_IDS = SHAPES.map((s) => s.id)
export const COULEUR_IDS = Object.keys(COLOR_LABEL)
export const hexDe = (id: string) => COLOR_BY_ID.get(id)?.hex ?? '#7a3cff'

/** Les 5 etats du catalogue, tous portes par le visage, dans l'ordre de la sequence. */
export const ETATS: StateId[] = [...SEQUENCE]

/** Un etat joue puis un retour au repos, en boucle : c'est ce qui le fait rejouer. */
export function cycleDe(etat: StateId): Block[] {
  if (etat === 'idle') return [{ state: 'idle', duration: 4 }]
  const d = STATE_BY_ID.get(etat)?.duration ?? 2.4
  return [
    { state: etat, duration: d },
    { state: 'idle', duration: 1.4 }
  ]
}

export interface Animation {
  id: string
  label: string
  /** etat du moteur joue en boucle */
  cycle: Block[]
  geste: ((t: number) => Geste) | null
  expression?: string
}

const LABEL_REPOS: Record<string, string> = {
  cligne: 'Double blink',
  respire: 'Deep breath',
  saut: 'Little hop',
  balance: 'Sway',
  regard: 'Look around',
  hoche: 'Nod',
  etire: 'Stretch'
}

const LABEL_ACTIVITE: Record<string, string> = {
  reflexion: 'Working: thinking',
  frappe: 'Working: typing',
  balayage: 'Working: reading'
}

const idle = (): Block[] => [{ state: 'idle', duration: 4 }]

/** Gestes d'attente : chacun rejoue en boucle, avec une pause de repos entre deux. */
export const GESTES: Animation[] = [
  ...GESTES_REPOS.map((d): Animation => ({
    id: d.id,
    label: LABEL_REPOS[d.id] ?? d.id,
    cycle: idle(),
    geste: (t) => {
      const u = t % (d.duree + 1)
      return u < d.duree ? d.pose(u) : { ...GESTE_NEUTRE }
    }
  })),
  {
    id: 'rebond',
    label: 'Tap bounce',
    cycle: idle(),
    geste: (t) => rebond(t % (REBOND_DUREE + 1.1))
  },
  { id: 'sommeil', label: 'Asleep', cycle: [{ state: 'sleep', duration: 4 }], geste: gesteSommeil },
  { id: 'echec', label: 'Dejected', cycle: idle(), geste: gesteEchec, expression: 'triste' }
]

/** Activites « au travail » : un etat du moteur en boucle et un geste. */
export const ACTIVITES_SITE: Animation[] = ACTIVITES.map((a) => ({
  id: a.id,
  label: LABEL_ACTIVITE[a.id] ?? a.id,
  cycle: [{ state: a.etat, duration: a.boucle }, { state: 'idle', duration: 0.8 }],
  geste: a.geste
}))

export const ACCESSOIRE_LABEL: Record<AccessoireId, string> = {
  carnet: 'Notebook and pencil',
  portable: 'Laptop',
  clap: 'Clapperboard',
  graphique: 'Chart and magnifier',
  avion: 'Paper plane',
  palette: 'Paint palette',
  'presse-papiers': 'Clipboard',
  liste: 'Checklist',
  engrenage: 'Crank and gear'
}

export const ACCESSOIRE_IDS = ACCESSOIRES.map((a) => a.id)

/** Accessoires portes : posés sur le corps, ils suivent les yeux et l'humeur dans tous les rendus. */
export const PORTE_LABEL: Record<PorteId, string> = {
  lunettes: 'Round glasses',
  soleil: 'Sunglasses',
  'haut-de-forme': 'Mini top hat',
  paille: 'Straw hat',
  bonnet: 'Beanie',
  noeud: 'Bow',
  couronne: 'Crown',
  casque: 'Headphones'
}
/** Seuls trois accessoires sont exposes sur le site, en 3D : les autres restent en attente dans le moteur. */
export const PORTE_IDS_SITE: PorteId[] = ['lunettes', 'haut-de-forme', 'noeud']
export const PORTE_IDS_ENGINE = PORTE_IDS

/**
 * Palette des exemples du site : 16 teintes distinctes, pastel et vives, toutes lisibles sur le fond clair
 * ET sur le fond sombre de la page (aucune quasi-blanche ni quasi-noire ; `catalog.test.ts` le verifie).
 */
export const PALETTE_SITE: { nom: string; hex: string }[] = [
  { nom: 'Violet', hex: '#7a3cff' },
  { nom: 'Pink', hex: '#ff3d9a' },
  { nom: 'Teal', hex: '#00cfc0' },
  { nom: 'Amber', hex: '#ffb400' },
  { nom: 'Blue', hex: '#1f8fff' },
  { nom: 'Green', hex: '#10d985' },
  { nom: 'Orange', hex: '#ff7a14' },
  { nom: 'Cyan', hex: '#12c4ff' },
  { nom: 'Lemon', hex: '#ffd91a' },
  { nom: 'Coral', hex: '#ff5468' },
  { nom: 'Lavender', hex: '#a47bff' },
  { nom: 'Red', hex: '#ff3340' },
  { nom: 'Lime', hex: '#84dc12' },
  { nom: 'Indigo', hex: '#4b57ff' },
  { nom: 'Magenta', hex: '#e22bff' },
  { nom: 'Peach', hex: '#ff9466' }
]

/** Les formes 3D du site, chacune avec SA couleur (12 formes, 12 teintes differentes de la palette). */
export const FORMES_3D: { id: string; label: string; couleur: string }[] = [
  { id: 'cercle', label: 'Circle', couleur: '#7a3cff' },
  { id: 'galet', label: 'Pebble', couleur: '#ff3d9a' },
  { id: 'squircle', label: 'Squircle', couleur: '#00cfc0' },
  { id: 'capsule', label: 'Capsule', couleur: '#ffb400' },
  { id: 'triangle', label: 'Triangle', couleur: '#1f8fff' },
  { id: 'hexagone', label: 'Hexagon', couleur: '#10d985' },
  { id: 'nuage', label: 'Cloud', couleur: '#ff7a14' },
  { id: 'goutte', label: 'Droplet', couleur: '#12c4ff' },
  { id: 'etoile', label: 'Star', couleur: '#ffd91a' },
  { id: 'fleur', label: 'Flower', couleur: '#ff5468' },
  { id: 'oeuf', label: 'Egg', couleur: '#a47bff' },
  { id: 'coeur', label: 'Heart', couleur: '#ff3340' }
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
  joues: 'Blush',
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
