import type { RenduId, TaillePixelId } from '@/ui/rendu'

export interface OptionsExtrait {
  forme: string
  couleur: string
  rendu: RenduId
  pixel: TaillePixelId
  contour: boolean
  reflet: boolean
  expression: string
  accessoire: string
  porte: string
  etat: string
}

/** L'extrait de code montre par le playground : seulement ce qui differe des valeurs par defaut. */
export function extraitCode(o: OptionsExtrait): string {
  const l = [`<MochiBot`, `  shape="${o.forme}"`, `  color="${o.couleur}"`]
  if (o.rendu !== '3d') l.push(`  rendu="${o.rendu}"`)
  if (o.rendu === 'pixel3d') l.push(`  pixel="${o.pixel}"`)
  if (o.rendu === 'flat3d' && o.contour) l.push('  contour')
  if (o.rendu === '3d' && !o.reflet) l.push('  :reflet="false"')
  if (o.expression !== 'neutre') l.push(`  expression="${o.expression}"`)
  if (o.accessoire) l.push(`  accessoire="${o.accessoire}"`)
  if (o.porte) l.push(`  porte="${o.porte}"`)
  if (o.etat !== 'idle') l.push(`  state="${o.etat}"`)
  return l.join('\n') + '\n  :playing="true"\n/>'
}
