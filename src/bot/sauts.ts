/**
 * Saut d'un mochi d'une case a une autre : primitive de DEPLACEMENT, pure.
 *
 * Comme le moteur (`engine.ts`), rien ici ne tient d'horloge ni d'etat : `poseSaut(t, ...)`
 * est une fonction du temps. Elle ne sait rien du rendu (SVG, WebGL, isometrique ou non) ;
 * elle rend une position le long du trajet, une hauteur et un etirement, que le client
 * applique comme il veut. Ce ne sont pas des mesures de la video : ce sont des reglages
 * d'animation, choisis (comme `--ink`), donc modifiables.
 *
 * Un saut a quatre temps :
 *   anticipation : le corps s'ecrase vers le sol (il prend son elan) ;
 *   vol          : parabole, etire en montant puis a la descente, rond au sommet ;
 *   atterrissage : ecrasement a l'impact, amorti en quelques oscillations ;
 *   pause        : repos avant le saut suivant.
 * Le volume est conserve : ce que le corps perd en hauteur, il le gagne en largeur.
 */

export type PhaseSaut = 'anticipation' | 'vol' | 'atterrissage' | 'pause'

export interface ParamsSaut {
  /** secondes */
  anticipation: number
  vol: number
  atterrissage: number
  pause: number
  /** hauteur du sommet, en rayons de mochi */
  hauteur: number
  /** ecrasement maximal a l'anticipation (0 = aucun, 0,3 = tres ecrase) */
  ecrasement: number
  /** etirement maximal en vol */
  etirement: number
  /** ecrasement a l'impact, avant amortissement */
  impact: number
}

export const SAUT_DEFAUT: ParamsSaut = {
  anticipation: 0.18,
  vol: 0.46,
  atterrissage: 0.32,
  pause: 0.22,
  hauteur: 0.9,
  ecrasement: 0.2,
  etirement: 0.14,
  impact: 0.24
}

export interface Case {
  x: number
  y: number
}

export interface PoseSaut {
  phase: PhaseSaut
  /** position au sol, en cases : de `depart` a `arrivee` pendant le vol seulement */
  x: number
  y: number
  /** hauteur au-dessus du sol, en rayons de mochi (0 hors du vol) */
  hauteur: number
  /** echelle verticale, et laterale (la meme sur les deux axes horizontaux) */
  sy: number
  sxz: number
  /** avancement du vol, 0 a 1 (0 avant, 1 apres) */
  avancement: number
}

/** Duree d'un saut complet, pause comprise. */
export const dureeSaut = (p: ParamsSaut = SAUT_DEFAUT) =>
  p.anticipation + p.vol + p.atterrissage + p.pause

const adoucir = (u: number) => u * u * (3 - 2 * u)

/** Largeur qui conserve le volume pour une hauteur `sy`. */
const largeurPour = (sy: number) => 1 / Math.sqrt(sy)

/**
 * Pose au temps `t` (secondes depuis le debut du saut). Avant 0, le mochi est sur
 * `depart` au repos ; apres la fin, sur `arrivee` au repos.
 */
export function poseSaut(
  t: number,
  depart: Case,
  arrivee: Case,
  p: ParamsSaut = SAUT_DEFAUT
): PoseSaut {
  const repos = (c: Case, phase: PhaseSaut, avancement: number): PoseSaut => ({
    phase,
    x: c.x,
    y: c.y,
    hauteur: 0,
    sy: 1,
    sxz: 1,
    avancement
  })
  if (t <= 0) return repos(depart, 'pause', 0)
  const finAnticipation = p.anticipation
  const finVol = finAnticipation + p.vol
  const finAtterrissage = finVol + p.atterrissage
  if (t < finAnticipation) {
    // s'ecrase en douceur : le point bas est atteint a la toute fin
    const sy = 1 - p.ecrasement * adoucir(t / p.anticipation)
    return { ...repos(depart, 'anticipation', 0), sy, sxz: largeurPour(sy) }
  }
  if (t < finVol) {
    const u = (t - finAnticipation) / p.vol
    // parabole : 0 au depart, 1 au sommet, 0 a l'arrivee
    const h = 4 * u * (1 - u)
    // etire au decollage et a l'arrivee (vitesse maximale), rond au sommet
    const sy = 1 + p.etirement * Math.abs(1 - 2 * u)
    // le deplacement horizontal est regulier : une parabole en x donnerait un saut mou
    return {
      phase: 'vol',
      x: depart.x + (arrivee.x - depart.x) * u,
      y: depart.y + (arrivee.y - depart.y) * u,
      hauteur: p.hauteur * h,
      sy,
      sxz: largeurPour(sy),
      avancement: u
    }
  }
  if (t < finAtterrissage) {
    const u = (t - finVol) / p.atterrissage
    // ecrasement amorti : cosinus dans une enveloppe exponentielle, de l'impact (ecrase)
    // jusqu'au repos
    const sy = 1 - p.impact * Math.exp(-4.2 * u) * Math.cos(2 * Math.PI * 1.25 * u)
    return { ...repos(arrivee, 'atterrissage', 1), sy, sxz: largeurPour(sy) }
  }
  return repos(arrivee, 'pause', 1)
}

/**
 * Suite de sauts le long d'un chemin de cases : le saut `i` va de `chemin[i]` a
 * `chemin[i + 1]`. Rend la pose au temps `t` et l'indice du saut en cours. Au-dela du
 * dernier saut, le mochi reste sur la derniere case.
 */
export function poseSurChemin(
  t: number,
  chemin: Case[],
  p: ParamsSaut = SAUT_DEFAUT
): PoseSaut & { saut: number } {
  const n = chemin.length - 1
  if (n < 1) {
    const c = chemin[0] ?? { x: 0, y: 0 }
    return { ...poseSaut(0, c, c, p), saut: 0 }
  }
  const d = dureeSaut(p)
  const saut = Math.min(n - 1, Math.max(0, Math.floor(t / d)))
  return { ...poseSaut(t - saut * d, chemin[saut]!, chemin[saut + 1]!, p), saut }
}

/**
 * Chemin en boucle sur un rectangle de `largeur` x `hauteur` cases a partir de `depart` :
 * droite, bas, gauche, haut, pas d'une case. Sert aux demos ; le futur espace donnera ses
 * propres chemins.
 */
export function cheminEnBoucle(depart: Case, largeur: number, hauteur: number): Case[] {
  const c: Case[] = [{ ...depart }]
  const pas = (dx: number, dy: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const l = c[c.length - 1]!
      c.push({ x: l.x + dx, y: l.y + dy })
    }
  }
  pas(1, 0, largeur - 1)
  pas(0, 1, hauteur - 1)
  pas(-1, 0, largeur - 1)
  pas(0, -1, hauteur - 1)
  return c
}
