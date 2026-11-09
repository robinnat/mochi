import { PROFILE_SAMPLES } from './profiles'
import {
  hullOfCircles,
  profileFromPolygon,
  regularPolygonProfile,
  superellipseProfile,
  unionOfCirclesProfile
} from './shape'

/**
 * Formes et couleurs proposees par le personnalisateur du bot.
 *
 * A la difference des silhouettes d'animation (`profiles.ts`), celles-ci ne sont
 * PAS relevees sur la video : elles sont construites analytiquement d'apres la
 * grille du personnalisateur d'origine. Deux sources distinctes, donc, et c'est
 * volontaire — les etats animes doivent rester fideles a la video, les formes de
 * base sont un choix d'utilisateur.
 */

/**
 * Les identifiants sont enumeres plutot que deduits du tableau : c'est ce qui
 * permet a la couche i18n de verifier A LA COMPILATION que chaque forme a bien
 * sa traduction dans les trois langues (`t(\`shapes.${id}\`)` ne compile que si
 * la cle existe). Un `as const` sur le tableau aurait le meme effet mais
 * rendrait `radii` en lecture seule, alors que le moteur le passe tel quel.
 */
export type ShapeId =
  | 'cercle'
  | 'galet'
  | 'squircle'
  | 'capsule'
  | 'triangle'
  | 'hexagone'
  | 'nuage'
  | 'goutte'
  | 'etoile'
  | 'fleur'
  | 'oeuf'
  | 'coeur'

export interface BotShape {
  id: ShapeId
  radii: number[]
}

/** Ramene le rayon maximal a `max` pour que toutes les formes pesent pareil a l'oeil. */
function normalize(radii: number[], max = 1): number[] {
  const peak = Math.max(...radii)
  if (peak <= 0) return radii
  const k = max / peak
  return radii.map((r) => r * k)
}

const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * Math.PI * 2)

/** Galet : cercle deforme par deux harmoniques basses, donc irregulier mais lisse. */
const pebble = normalize(
  ANGLES.map((a) => 1 + 0.075 * Math.cos(2 * a + 0.5) + 0.035 * Math.cos(3 * a + 2.1)),
  1.02
)

/** Nuage : union de bosses, large en bas, deux lobes en haut. */
const cloud = normalize(
  unionOfCirclesProfile([
    { x: -0.44, y: 0.2, r: 0.54 },
    { x: 0.46, y: 0.2, r: 0.5 },
    { x: 0.02, y: 0.3, r: 0.6 },
    { x: -0.24, y: -0.3, r: 0.48 },
    { x: 0.3, y: -0.24, r: 0.44 }
  ]),
  1.02
)

/** Goutte : gros disque en bas, pointe effilee en haut. */
const droplet = normalize(
  profileFromPolygon(hullOfCircles(0, 0.28, 0.66, 0, -0.96, 0.05), 0, 0),
  1.04
)

/**
 * Lissage circulaire d'un profil : moyenne ponderee gaussienne sur les echantillons
 * voisins. Arrondit les pointes et les creux d'un polygone sans toucher a sa forme
 * generale, ce qui garde les yeux lisibles et le morphing doux.
 */
function smooth(radii: number[], sigma: number): number[] {
  const n = radii.length
  const span = Math.ceil(sigma * 3)
  const w = Array.from({ length: span * 2 + 1 }, (_, i) => Math.exp(-((i - span) ** 2) / (2 * sigma * sigma)))
  const total = w.reduce((a, b) => a + b, 0)
  return radii.map((_, k) => {
    let acc = 0
    for (let i = -span; i <= span; i++) acc += radii[(k + i + n) % n]! * w[i + span]!
    return acc / total
  })
}

/**
 * Etoile a cinq branches, une pointe en haut. Branches franches mais aux POINTES ARRONDIES (creux a 0.5 du sommet,
 * lissage 1.0 : choix de design du 03/11/2026, une etoile plus franche). Le volume reste
 * epais et ses aretes adoucies (`volume.ts`) ; les yeux se reduisent pour tenir au centre.
 */
const star = normalize(
  smooth(
    profileFromPolygon(
      Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const r = i % 2 === 0 ? 1 : 0.6
        return { x: Math.cos(a) * r, y: Math.sin(a) * r }
      }),
      0,
      0
    ),
    2.0
  ),
  1.1
)

/** Fleur : cinq petales ronds autour d'un coeur large, un petale vers le haut. */
const flower = normalize(
  unionOfCirclesProfile([
    { x: 0, y: 0, r: 0.66 },
    ...Array.from({ length: 5 }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
      return { x: Math.cos(a) * 0.56, y: Math.sin(a) * 0.56, r: 0.44 }
    })
  ]),
  1.06
)

/** Oeuf : debout, plus large en bas qu'en haut. */
const egg = normalize(
  profileFromPolygon(
    Array.from({ length: 160 }, (_, i) => {
      const t = (i / 160) * Math.PI * 2
      return { x: 0.8 * Math.cos(t) * (1 + 0.14 * Math.sin(t)), y: Math.sin(t) }
    }),
    0,
    0.06
  ),
  1.06
)

/**
 * Coeur : la courbe classique (16 sin^3 t, 13 cos t - 5 cos 2t - 2 cos 3t - cos 4t), retournee pour l'ecran
 * (y vers le bas), vue depuis un centre un peu sous l'echancrure pour que chaque rayon ne croise le contour
 * qu'une fois. Creux doux en haut, pointe en bas ARRONDIE (lissage), deux lobes bien pleins : les yeux
 * tiennent dans la partie large. Volume gonfle comme les autres formes (`volume.ts`, profil coussin).
 */
const heart = normalize(
  smooth(
    profileFromPolygon(
      Array.from({ length: 200 }, (_, i) => {
        const t = (i / 200) * Math.PI * 2
        return {
          x: (16 * Math.sin(t) ** 3) / 17,
          y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17
        }
      }),
      0,
      0.12
    ),
    1.6
  ),
  1.06
)

/** Capsule couchee : enveloppe de deux disques cote a cote. */
const capsule = profileFromPolygon(hullOfCircles(-0.42, 0, 0.62, 0.42, 0, 0.62), 0, 0)

export const SHAPES: BotShape[] = [
  { id: 'cercle', radii: new Array(PROFILE_SAMPLES).fill(1) },
  { id: 'galet', radii: pebble },
  // 1.15 et pas 1.02 : sur une superellipse le rayon maximal est la diagonale,
  // donc normaliser dessus donne une forme qui parait plus petite que le cercle.
  { id: 'squircle', radii: normalize(superellipseProfile(3.3), 1.15) },
  { id: 'capsule', radii: capsule },
  // -90deg : un sommet vers le haut de l'ecran (y est oriente vers le bas)
  { id: 'triangle', radii: regularPolygonProfile(3, 1.12, 0.34, -90) },
  // 0deg : sommets a gauche et a droite, donc aretes du haut et du bas plates
  { id: 'hexagone', radii: regularPolygonProfile(6, 1.04, 0.26, 0) },
  { id: 'nuage', radii: cloud },
  { id: 'goutte', radii: droplet },
  { id: 'etoile', radii: star },
  { id: 'fleur', radii: flower },
  { id: 'oeuf', radii: egg },
  { id: 'coeur', radii: heart }
]

// Map indexee par `string` et non par `ShapeId` : les appelants interrogent avec
// une valeur relue du localStorage ou d'une prop, donc non validee.
export const SHAPE_BY_ID = new Map<string, BotShape>(SHAPES.map((s) => [s.id, s]))
export const DEFAULT_SHAPE = 'cercle'

export type ColorId =
  | 'encre'
  | 'creme'
  | 'brun'
  | 'rouge'
  | 'orange'
  | 'ambre'
  | 'vert'
  | 'turquoise'
  | 'bleu'
  | 'violet'
  | 'rose'
  | 'gris'

export interface BotColor {
  id: ColorId
  hex: string
}

/** Palette du personnalisateur d'origine. */
export const COLORS: BotColor[] = [
  { id: 'encre', hex: '#0a0a0c' },
  { id: 'brun', hex: '#8b5e3c' },
  { id: 'rouge', hex: '#ff3b4e' },
  { id: 'orange', hex: '#ff7a14' },
  { id: 'ambre', hex: '#ffb400' },
  { id: 'vert', hex: '#10d985' },
  { id: 'turquoise', hex: '#00cfc0' },
  { id: 'bleu', hex: '#1f8fff' },
  { id: 'violet', hex: '#7a3cff' },
  { id: 'rose', hex: '#ff3d9a' },
  { id: 'gris', hex: '#a3a3a3' },
  { id: 'creme', hex: '#f1efe9' }
]

export const COLOR_BY_ID = new Map<string, BotColor>(COLORS.map((c) => [c.id, c]))
export const DEFAULT_COLOR = 'encre'

/**
 * Couleur libre : `#rgb` ou `#rrggbb` (casse libre, `#` facultatif a la saisie) -> `#rrggbb` en minuscules ;
 * `null` si ce n'est pas une couleur. Sert a la prop `color` (id du catalogue OU hex) et au champ hex du site.
 */
export function hexValide(v: string | null | undefined): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((v ?? '').trim())
  if (!m) return null
  const h = m[1]!.toLowerCase()
  return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`
}

/** Couleur du corps : un id du catalogue, sinon un hex libre, sinon l'encre. */
export const couleurDe = (v: string): string => COLOR_BY_ID.get(v)?.hex ?? hexValide(v) ?? '#0a0a0c'

/** Melange deux couleurs hex. Sert a la brume de profondeur des particules. */
export function mixHex(from: string, to: string, t: number): string {
  const parse = (h: string) => {
    const v = parseInt(h.slice(1), 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
  }
  const a = parse(from)
  const b = parse(to)
  const c = a.map((x, i) => Math.round(x + (b[i]! - x) * t))
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}
