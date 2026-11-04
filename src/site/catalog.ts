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

export const SHAPE_LABEL = en.shapes as Record<string, string>
export const COLOR_LABEL = en.colors as Record<string, string>
export const STATE_LABEL = en.states as Record<string, string>
export const FORME_IDS = SHAPES.map((s) => s.id)
export const COULEUR_IDS = Object.keys(COLOR_LABEL)
export const hexDe = (id: string) => COLOR_BY_ID.get(id)?.hex ?? '#8b5cf6'

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
export const PORTE_IDS_SITE = PORTE_IDS

/** Nom de la forme 3D tel qu'on la voit : le moteur n'a qu'un profil par forme. */
export const FORMES_3D: { id: string; label: string; couleur: string }[] = [
  { id: 'cercle', label: 'Sphere', couleur: 'violet' },
  { id: 'squircle', label: 'Cube', couleur: 'bleu' },
  { id: 'triangle', label: 'Pyramid', couleur: 'ambre' },
  { id: 'etoile', label: 'Star', couleur: 'rose' },
  { id: 'fleur', label: 'Flower', couleur: 'turquoise' },
  { id: 'hexagone', label: 'Hexagon', couleur: 'vert' }
]
