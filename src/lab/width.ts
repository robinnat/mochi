/**
 * Cote d'une cellule de planche qui tient dans la largeur de l'ecran : `?s=` l'impose, sinon `initial`, reduit sur
 * telephone pour que toutes les colonnes tiennent (la planche ne deborde plus a droite).
 */
export function sizeCell(initial: number, columns: number, header: number, gap = 8): number {
  const forced = Number(new URLSearchParams(location.search).get('s'))
  if (forced) return forced
  const place = window.innerWidth - 32 - header - gap * columns
  return Math.max(48, Math.min(initial, Math.floor(place / columns)))
}
