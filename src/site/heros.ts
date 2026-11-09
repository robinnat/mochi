/**
 * Directions de hero a l'essai : `/?hero=a`, `?hero=b` ou `?hero=c` (apercu local). Sans parametre (ou autre valeur),
 * le hero actuel reste affiche : rien ne change tant que Robin n'a pas choisi.
 */
export type HeroId = 'a' | 'b' | 'c'
export function heroChoisi(): HeroId | null {
  if (typeof location === 'undefined') return null
  try {
    const v = new URLSearchParams(location.search).get('hero')
    return v === 'a' || v === 'b' || v === 'c' ? v : null
  } catch {
    return null
  }
}
