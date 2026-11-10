import { h, type Composant } from '@/ui/dom/h'
import '@/components/mochi-bot'
import { SHAPES } from '@/bot/skins'
import type { RenduId } from '@/ui/rendu'
import { tailleCellule } from './largeur'

/** Les quatre styles : plat (l'original), pixel art, pate (argile) et vraie 3D. */
const STYLES: { id: RenduId; nom: string }[] = [
  { id: 'original', nom: 'flat' },
  { id: 'pixel', nom: 'pixel' },
  { id: 'argile', nom: 'pâte' },
  { id: '3d', nom: '3D' }
]

export const PlancheFormes: Composant<Record<string, never>> = () => {
  // `?c=` : couleur de la planche (par defaut, la couleur choisie du moteur)
  const q = new URLSearchParams(location.search)
  const couleur = q.get('c') ?? 'encre'
  const taille = tailleCellule(120, STYLES.length, 90)
  const t = Number(q.get('t')) || 1.2
  return () =>
    h(
      'main',
      { class: 'p-4' },
      h('h1', { class: 'mb-3 text-lg font-bold' }, 'Formes x styles'),
      h(
        'div',
        { class: 'max-w-full overflow-x-auto' },
        h(
          'div',
          { class: 'grid items-center gap-2', style: { gridTemplateColumns: `90px repeat(${STYLES.length}, ${taille}px)` } },
          h('div'),
          STYLES.map((s) => h('div', { key: s.id, class: 'text-center text-xs font-semibold' }, s.nom)),
          SHAPES.map((f) => [
            h('div', { key: f.id, class: 'text-xs text-[var(--muted)]' }, f.id),
            STYLES.map((s) =>
              h('mochi-bot', {
                key: `${f.id}-${s.id}`,
                size: taille,
                shape: f.id,
                color: couleur,
                rendu: s.id,
                frozenAt: t,
                cycle: [{ state: 'idle', duration: 3 }],
                'data-cell': `${f.id}-${s.id}`
              })
            )
          ])
        )
      )
    )
}
