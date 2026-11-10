/**
 * Cote d'une cellule de planche qui tient dans la largeur de l'ecran : `?s=` l'impose, sinon `defaut`, reduit sur
 * telephone pour que toutes les colonnes tiennent (la planche ne deborde plus a droite).
 */
export function tailleCellule(defaut: number, colonnes: number, entete: number, ecart = 8): number {
  const impose = Number(new URLSearchParams(location.search).get('s'))
  if (impose) return impose
  const place = window.innerWidth - 32 - entete - ecart * colonnes
  return Math.max(48, Math.min(defaut, Math.floor(place / colonnes)))
}
