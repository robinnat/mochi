/**
 * Couche de gestes : de petites animations AJOUTEES par-dessus la pose du moteur.
 *
 * Le moteur reproduit la video de reference : ses constantes sont des mesures. Les gestes,
 * eux, sont des REGLAGES choisis (pas des mesures), facultatifs, et rangés a part pour ne
 * rien changer au rendu d'origine : `engine.sample(t)` sans geste reste identique a l'octet
 * pres (un test le verrouille). Usage : `engine.sample(t, gesteRepos(t, graine))`.
 *
 * Tout est pur, fonction du temps et d'une graine : meme image a chaque lecture, aucun etat,
 * aucune horloge. Les amplitudes sont faibles (quelques pour cent du rayon) : un avatar qui
 * attend reste calme ; c'est la variete et le decalage dans le temps qui font la personnalite.
 */
import { TAU, clamp, createRng, easings, loopNoise } from './math'
import type { StateId } from './states'

/** Ecarts appliques par `sample()` : deplacements en rayons de boule, echelles, angles en degres. */
export interface Geste {
  /** deplacement du corps et des yeux, en rayons */
  dx: number
  dy: number
  /** echelles du corps (1 = inchange) */
  sx: number
  sy: number
  /** ecarts de visee, en degres */
  yaw: number
  pitch: number
  roll: number
  /** paupiere maximale : 1 = laisse faire le moteur, 0 = fermee */
  lid: number
}

export const GESTE_NEUTRE: Readonly<Geste> = Object.freeze({ dx: 0, dy: 0, sx: 1, sy: 1, yaw: 0, pitch: 0, roll: 0, lid: 1 })

const g = (p: Partial<Geste>): Geste => ({ ...GESTE_NEUTRE, ...p })

/** Compose deux gestes : deplacements et angles s'ajoutent, echelles se multiplient, paupiere au plus fermee. */
export function composer(a: Geste, b: Geste): Geste {
  return {
    dx: a.dx + b.dx,
    dy: a.dy + b.dy,
    sx: a.sx * b.sx,
    sy: a.sy * b.sy,
    yaw: a.yaw + b.yaw,
    pitch: a.pitch + b.pitch,
    roll: a.roll + b.roll,
    lid: Math.min(a.lid, b.lid)
  }
}

/** Cloche 0 -> 1 -> 0 sur [0, 1], douce aux deux bouts. */
const cloche = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2)

// ---------------------------------------------------------------- gestes d'attente

export type GesteReposId = 'cligne' | 'respire' | 'saut' | 'balance' | 'regard' | 'hoche' | 'etire'

interface GesteDef {
  id: GesteReposId
  /** duree en secondes */
  duree: number
  /** pose a l'instant local u (secondes depuis le debut du geste) */
  pose: (u: number) => Geste
}

export const GESTES_REPOS: GesteDef[] = [
  // double clignement appuye
  {
    id: 'cligne',
    duree: 0.55,
    pose: (u) => {
      const k = (v: number) => (v < 0 || v > 0.18 ? 1 : Math.abs((v / 0.18) * 2 - 1))
      return g({ lid: Math.min(k(u), k(u - 0.3)) })
    }
  },
  // grande inspiration : le corps gonfle un peu puis se relache
  { id: 'respire', duree: 2.2, pose: (u) => { const c = cloche(u / 2.2); return g({ sx: 1 + 0.025 * c, sy: 1 + 0.04 * c, dy: -0.015 * c, pitch: -3 * c }) } },
  // petit saut : tassement, envol, reception
  {
    id: 'saut',
    duree: 0.9,
    pose: (u) => {
      const v = u / 0.9
      const tasse = v < 0.2 ? cloche(v / 0.4) : v > 0.8 ? cloche((v - 0.8) / 0.4 + 0.5) : 0
      const vol = v >= 0.15 && v <= 0.85 ? Math.sin(Math.PI * ((v - 0.15) / 0.7)) : 0
      return g({ dy: -0.12 * vol, sx: 1 + 0.05 * tasse, sy: 1 - 0.07 * tasse + 0.03 * vol })
    }
  },
  // balancement lateral, deux allers-retours
  { id: 'balance', duree: 2.4, pose: (u) => { const e = cloche(u / 2.4); const s = Math.sin((u / 1.2) * TAU); return g({ dx: 0.035 * s * e, roll: 6 * s * e }) } },
  // regard a gauche puis a droite
  {
    id: 'regard',
    duree: 2.6,
    pose: (u) => {
      const v = u / 2.6
      const yaw = v < 0.5 ? -22 * cloche(v / 0.5) : 22 * cloche((v - 0.5) / 0.5)
      return g({ yaw, dx: yaw * 0.0006 })
    }
  },
  // hochement de tete
  { id: 'hoche', duree: 1.2, pose: (u) => { const e = cloche(u / 1.2); return g({ pitch: 9 * Math.sin((u / 0.4) * TAU) * e, dy: 0.01 * e }) } },
  // etirement vers le haut
  { id: 'etire', duree: 1.6, pose: (u) => { const c = cloche(u / 1.6); return g({ sx: 1 - 0.035 * c, sy: 1 + 0.06 * c, dy: -0.03 * c, lid: 1 - 0.5 * c }) } }
]

export const GESTE_REPOS_BY_ID = new Map(GESTES_REPOS.map((d) => [d.id, d]))

/** Calendrier : un geste par fenetre de `FENETRE` s, a un decalage tire dans [0, JEU[ -> 4 a 12 s d'ecart. */
const FENETRE = 8
const JEU = 4

/** Trois gestes preferes par graine (la personnalite), un quatrieme plus rare. */
export function personnalite(graine: number): GesteReposId[] {
  const rng = createRng(graine ^ 0x9e3779b9)
  const ids = GESTES_REPOS.map((d) => d.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  }
  return ids.slice(0, 4)
}

/** Geste de la fenetre `k` pour une graine : date de debut et identifiant. O(1), sans etat. */
export function gesteDeFenetre(graine: number, k: number): { debut: number; id: GesteReposId } {
  const rng = createRng(Math.imul(graine | 0, 0x85ebca6b) ^ Math.imul(k + 1, 0xc2b2ae35))
  const prefs = personnalite(graine)
  const r = rng()
  // poids 0,35 / 0,3 / 0,25 / 0,1 : les gestes preferes reviennent plus souvent
  const id = r < 0.35 ? prefs[0]! : r < 0.65 ? prefs[1]! : r < 0.9 ? prefs[2]! : prefs[3]!
  return { debut: k * FENETRE + rng() * JEU, id }
}

/** Geste d'attente a l'instant t : neutre entre deux gestes. Le premier geste arrive apres 4 s au moins. */
export function gesteRepos(t: number, graine: number): Geste {
  if (!(t >= 0)) return { ...GESTE_NEUTRE }
  const k = Math.floor(t / FENETRE)
  for (const kk of [k, k - 1]) {
    if (kk < 0) continue
    const { debut, id } = gesteDeFenetre(graine, kk)
    if (kk === 0 && debut < 4) continue
    const def = GESTE_REPOS_BY_ID.get(id)!
    const u = t - debut
    if (u >= 0 && u <= def.duree) return def.pose(u)
  }
  return { ...GESTE_NEUTRE }
}

// ---------------------------------------------------------------- rebond au toucher

/** Duree du rebond au toucher. */
export const REBOND_DUREE = 0.7

/** Rebond quand on touche l'avatar : ecrasement puis petit ressort amorti (u : secondes depuis le toucher). */
export function rebond(u: number): Geste {
  if (!(u >= 0) || u > REBOND_DUREE) return { ...GESTE_NEUTRE }
  const v = u / REBOND_DUREE
  const amorti = Math.exp(-4.5 * v) * Math.cos(v * TAU * 1.6)
  return g({ sx: 1 + 0.07 * amorti, sy: 1 - 0.09 * amorti, dy: 0.02 * Math.max(0, amorti) - 0.05 * cloche(v / 0.6) })
}

// ---------------------------------------------------------------- sommeil et echec

/** Sommeil : respiration lente et profonde, yeux fermes, corps un peu tasse. */
export function gesteSommeil(t: number): Geste {
  const souffle = 0.5 - 0.5 * Math.cos((t / 4.6) * TAU)
  return g({ sx: 1 + 0.012 * souffle, sy: 0.97 + 0.03 * souffle, dy: 0.02 - 0.012 * souffle, pitch: -6, roll: -4, lid: 0.04 })
}

/** Petits « z » du sommeil : positions en rayons (a dessiner par le client), qui montent et s'effacent. */
export function zSommeil(t: number, n = 2): Array<{ x: number; y: number; taille: number; opacite: number }> {
  const out = []
  const periode = 3.2
  for (let i = 0; i < n; i++) {
    const v = (((t / periode + i / n) % 1) + 1) % 1
    out.push({
      x: 0.62 + 0.18 * v + 0.04 * Math.sin(v * TAU),
      y: -0.55 - 0.45 * v,
      taille: 0.16 + 0.1 * v,
      opacite: clamp(v / 0.2) * clamp((1 - v) / 0.35) * 0.8
    })
  }
  return out
}

/** Echec : affaissement, tete basse, soupir lent. */
export function gesteEchec(t: number): Geste {
  const soupir = 0.5 - 0.5 * Math.cos((t / 5.2) * TAU)
  return g({ sx: 1.03 + 0.01 * soupir, sy: 0.94 - 0.015 * soupir, dy: 0.04 + 0.01 * soupir, pitch: -8 - 3 * soupir, roll: 3 })
}

// ---------------------------------------------------------------- activites (au travail)

export type ActiviteId = 'orbite' | 'reflexion' | 'frappe' | 'balayage' | 'emission' | 'tourbillon' | 'jeu'

export interface Activite {
  id: ActiviteId
  /** etat du moteur joue en boucle */
  etat: StateId
  /** duree de la boucle en secondes : on lit `sample(depart + t % boucle)` */
  boucle: number
  /** geste ajoute, fonction du temps global */
  geste: (t: number) => Geste
}

/**
 * Activites « au travail » : chacune reste lisible comme un travail en cours (un etat anime du
 * moteur, ou un regard occupe), mais se distingue des autres. L'application choisit laquelle
 * correspond a quel role.
 */
export const ACTIVITES: Activite[] = [
  // anneaux en orbite : le travail generique, celui de la video
  { id: 'orbite', etat: 'orbit', boucle: 3.4, geste: () => ({ ...GESTE_NEUTRE }) },
  // trois points qui pulsent, avec un leger hochement : il ecrit ou il reflechit
  { id: 'reflexion', etat: 'thinking', boucle: 2.6, geste: (t) => g({ dy: 0.012 * Math.sin((t / 1.3) * TAU) }) },
  // petites frappes rapides, regard baisse vers le clavier
  {
    id: 'frappe',
    etat: 'idle',
    boucle: 2.4,
    geste: (t) => {
      const tap = Math.max(0, Math.sin((t / 0.22) * TAU)) * (0.6 + 0.4 * Math.sin((t / 1.7) * TAU) ** 2)
      // amplitude choisie pour rester visible a 48 px (une frappe = 3 % du rayon)
      return g({ pitch: 16, yaw: 7 * loopNoise(t, 3.1, 0.5), dy: 0.03 * tap, sx: 1 + 0.015 * tap, sy: 1 - 0.03 * tap })
    }
  },
  // lecture : le regard balaie de gauche a droite, ligne apres ligne
  {
    id: 'balayage',
    etat: 'idle',
    boucle: 2.4,
    geste: (t) => {
      const v = (t / 1.6) % 1
      const yaw = v < 0.8 ? -18 + 36 * easings.easeInOutCubic(v / 0.8) : 18 - 36 * easings.easeOutCubic((v - 0.8) / 0.2)
      const ligne = Math.floor(t / 1.6) % 3
      return g({ yaw, pitch: 4 + ligne * 4, dx: yaw * 0.0005 })
    }
  },
  // envoi : la pastille de notification revient, le corps pulse a chaque envoi
  { id: 'emission', etat: 'notify', boucle: 2.2, geste: (t) => { const v = (t % 2.2) / 2.2; return g({ sx: 1 + 0.025 * cloche(v / 0.3), sy: 1 + 0.025 * cloche(v / 0.3) }) } },
  // tourbillon d'arcs repete, la tete suit
  { id: 'tourbillon', etat: 'swirl', boucle: 1.3, geste: (t) => g({ roll: 5 * Math.sin((t / 2.6) * TAU) }) },
  // balayage d'arcs devant le corps (effet de defilement), corps en triangle « lecture »
  { id: 'jeu', etat: 'play', boucle: 2, geste: (t) => g({ dy: 0.008 * Math.sin((t / 1) * TAU) }) }
]

export const ACTIVITE_BY_ID = new Map(ACTIVITES.map((a) => [a.id, a]))

/** Instant a lire dans le moteur pour une activite : boucle sans couture, decalee par une graine. */
export function tempsActivite(a: Activite, t: number, depart = 0.6): number {
  return depart + (((t % a.boucle) + a.boucle) % a.boucle)
}
