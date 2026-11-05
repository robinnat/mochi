/**
 * Accessoires 3D par EMPLACEMENTS combinables. Un accessoire au plus par emplacement, tous les
 * emplacements se cumulent : un Mochi peut porter un chapeau, des lunettes, une moustache, un noeud
 * papillon et des ailes en meme temps.
 *
 * Ce fichier ne contient que le catalogue (noms, couleurs) : aucune geometrie, aucun `three`.
 *
 * REGLE DE ROBIN (05/11/2026) : chaque accessoire est tres simplifie, UNE couleur (`c1`), DEUX au
 * maximum (`c2`, par exemple fleur : petales + coeur). Les deux sont reglables par l'API
 * (`{ id, c1, c2 }`, voir `Choix`) ; `c2` egal a `c1` veut dire « une seule couleur ».
 * Les volumes sont construits dans `ui/trois/accessoires3d.ts`, ancres sur le corps 3D.
 *
 * Emplacements, chacun sur sa propre zone du corps pour ne pas entrer en collision :
 *   tete   : au-dessus du sommet (chapeaux, coiffes, antenne, fleur)
 *   yeux   : a la hauteur des yeux (lunettes, masques)
 *   visage : joues et dessous des yeux (taches de rousseur...)
 *   bas    : le « cou » du corps, vers 72 % de la hauteur (noeud papillon, cravate, moustache, echarpe, collier...)
 *   dos    : les cotes et le dos (ailes, sac, cape, queue)
 */

export type Emplacement = 'tete' | 'yeux' | 'visage' | 'bas' | 'dos'

export const EMPLACEMENTS: Emplacement[] = ['tete', 'yeux', 'visage', 'bas', 'dos']

export const NOMS_EMPLACEMENTS: Record<Emplacement, string> = {
  tete: 'Tête',
  yeux: 'Yeux',
  visage: 'Visage et joues',
  bas: 'Bas et cou',
  dos: 'Côtés et dos'
}

export interface AccessoireDef {
  id: string
  emplacement: Emplacement
  /** nom affiche en legende */
  nom: string
  /** couleur principale et couleur d'appoint (reglables a l'usage) */
  c1: string
  c2: string
}

/** Palette vive et sobre. */
export const COULEURS = {
  rouge: '#e8505b',
  jaune: '#f2b83d',
  turquoise: '#2fb5a0',
  marine: '#2b3a67',
  rose: '#f48fb1',
  creme: '#f6f1e7',
  noir: '#26222f',
  or: '#f2c14e',
  vert: '#4caf7a',
  orange: '#f4883a',
  violet: '#7a5fd0',
  bleu: '#4a8df0',
  paille: '#efcf8a'
} as const

const C = COULEURS

const def = (emplacement: Emplacement, id: string, nom: string, c1: string, c2: string): AccessoireDef => ({ id, emplacement, nom, c1, c2 })

export const CATALOGUE: AccessoireDef[] = [
  // tete
  def('tete', 'casquette', 'Casquette', C.rouge, C.rouge),
  def('tete', 'beret', 'Béret', C.noir, C.noir),
  def('tete', 'haut-de-forme', 'Haut-de-forme', C.noir, C.rouge),
  def('tete', 'couronne', 'Couronne', C.or, C.or),
  def('tete', 'paille', 'Chapeau de paille', C.paille, C.rouge),
  def('tete', 'antenne', 'Antenne', C.noir, C.rouge),
  def('tete', 'casque', 'Casque de musique', C.rouge, C.rouge),
  def('tete', 'ruban', 'Nœud ruban', C.rose, C.rose),
  def('tete', 'fleur', 'Fleur', C.rose, C.jaune),
  def('tete', 'toque', 'Toque de chef', C.creme, C.creme),
  // yeux
  def('yeux', 'rondes', 'Lunettes rondes', C.noir, C.noir),
  def('yeux', 'carrees', 'Lunettes carrées', C.marine, C.marine),
  def('yeux', 'soleil', 'Lunettes de soleil', C.noir, C.noir),
  def('yeux', 'coeur', 'Lunettes cœur', C.rose, C.rose),
  def('yeux', 'etoile', 'Lunettes étoile', C.or, C.or),
  def('yeux', 'monocle', 'Monocle', C.or, C.or),
  // visage
  def('visage', 'chat', 'Moustaches de chat', C.noir, C.rose),
  def('visage', 'rousseur', 'Taches de rousseur', '#c8733a', '#c8733a'),
  def('visage', 'joues', 'Joues roses', C.rose, C.rose),
  def('visage', 'grain', 'Grain de beauté', C.noir, C.noir),
  // bas
  def('bas', 'moustache', 'Moustache', C.noir, C.noir),
  def('bas', 'papillon', 'Nœud papillon', C.noir, C.noir),
  def('bas', 'echarpe', 'Écharpe', C.orange, C.orange),
  def('bas', 'perles', 'Collier de perles', C.creme, C.creme),
  def('bas', 'fleurs', 'Collier de fleurs', C.rose, C.jaune),
  // dos
  def('dos', 'ailes', 'Ailes d’ange', C.creme, C.creme),
  def('dos', 'diable', 'Ailes de chauve-souris', C.violet, C.violet),
  def('dos', 'sac', 'Sac à dos', C.orange, C.marine),
  def('dos', 'cape', 'Cape', C.rouge, C.rouge)
]


/**
 * Accessoires RETIRES du catalogue (retours de Robin, 05/11/2026) : ils n'apparaissent plus ni dans le
 * catalogue ni sur les planches. Les definitions et les generateurs 3D restent dans le depot : pour en
 * remettre un, le recopier dans `CATALOGUE`.
 */
export const RETIRES: AccessoireDef[] = [
  // v11 (05/11/2026) : la cravate (essais v9 a v11 refuses)
  def('bas', 'cravate', 'Cravate', C.rouge, C.rouge),
  def('tete', 'oreilles', 'Serre-tête à oreilles', C.rose, C.creme),
  def('yeux', 'ski', 'Lunettes de ski', C.orange, C.bleu),
  def('yeux', 'domino', 'Masque de héros', C.rouge, C.creme),
  def('visage', 'pansement', 'Pansement', C.creme, C.rose),
  def('visage', 'larme', 'Larme', C.bleu, C.bleu),
  def('bas', 'medaille', 'Médaille', C.or, C.rouge),
  def('bas', 'clochette', 'Collier à clochette', C.turquoise, C.or),
  // v3 (05/11/2026)
  def('tete', 'fete', 'Chapeau de fête', C.violet, C.jaune),
  def('tete', 'bob', 'Bob', C.jaune, C.creme),
  def('bas', 'bandana', 'Bandana', C.rouge, C.creme),
  // v4 (05/11/2026)
  def('tete', 'bonnet', 'Bonnet à pompon', C.turquoise, C.creme),
  def('dos', 'queue', 'Queue', C.orange, C.orange),
  def('yeux', 'sommeil', 'Masque de sommeil', C.violet, C.creme)
]

export const PAR_ID = new Map(CATALOGUE.map((a) => [`${a.emplacement}:${a.id}`, a]))

export const parEmplacement = (e: Emplacement) => CATALOGUE.filter((a) => a.emplacement === e)

/** Un choix : l'id seul (couleurs du catalogue) ou l'id avec des couleurs imposees. */
export type Choix = string | { id: string; c1?: string; c2?: string }

/** Ce qui est porte : au plus un accessoire par emplacement. */
export type Selection = Partial<Record<Emplacement, Choix>>

/** Choix normalise : definition du catalogue avec les couleurs finales ; `null` si inconnu. */
export function resoudre(e: Emplacement, choix: Choix | undefined | null): AccessoireDef | null {
  if (!choix) return null
  const id = typeof choix === 'string' ? choix : choix.id
  const d = PAR_ID.get(`${e}:${id}`)
  if (!d) return null
  if (typeof choix === 'string') return d
  return { ...d, c1: choix.c1 ?? d.c1, c2: choix.c2 ?? d.c2 }
}

/** Toutes les couleurs d'une selection (palette du pixel art). */
export function couleursDe(sel: Selection): string[] {
  const out = new Set<string>()
  for (const e of EMPLACEMENTS) {
    const d = resoudre(e, sel[e])
    if (d) {
      out.add(d.c1)
      out.add(d.c2)
    }
  }
  return [...out]
}
