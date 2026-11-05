import type { RenduId, TaillePixelId } from '@/ui/rendu'

export interface OptionsExtrait {
  forme: string
  couleur: string
  rendu: RenduId
  pixel: TaillePixelId
  contour: boolean
  reflet: boolean
  mood: string
  /** le salut a l'arrivee est rejoue */
  coucou?: boolean
}

/** L'extrait de code montre par le playground : seulement ce qui differe des valeurs par defaut. */
export function extraitCode(o: OptionsExtrait): string {
  const l = [`<MochiBot`, `  shape="${o.forme}"`, `  color="${o.couleur}"`]
  if (o.rendu !== '3d') l.push(`  rendu="${o.rendu}"`)
  if (o.rendu === 'pixel3d') l.push(`  pixel="${o.pixel}"`)
  if (o.rendu === 'flat3d' && o.contour) l.push('  contour')
  if (o.rendu === '3d' && !o.reflet) l.push('  :reflet="false"')
  l.push(`  mood="${o.mood}"`)
  if (o.coucou) l.push('  coucou')
  return l.join('\n') + '\n/>'
}
