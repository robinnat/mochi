import { ref, shallowRef } from '@/ui/dom/reactif'
import { h, surDemontage, surMontage, type Composant } from '@/ui/dom/h'
import { PlancheFormes } from './PlancheFormes'

/**
 * Page labo : quatre planches choisies par le hash. `#formes` est la planche de toutes les formes dans les quatre
 * styles, `#tour`, `#moods` et `#formes3d` les planches 3D (chargees a la demande).
 */
type Planche = 'formes' | 'formes3d' | 'tour' | 'moods'
const lire = (): Planche =>
  location.hash.startsWith('#moods') ? 'moods' : location.hash.startsWith('#tour') ? 'tour' : location.hash.startsWith('#formes3d') ? 'formes3d' : 'formes'

const CHARGEURS: Record<Exclude<Planche, 'formes'>, () => Promise<Composant<Record<string, never>>>> = {
  formes3d: () => import('./Planche3dFlat').then((m) => m.Planche3dFlat),
  tour: () => import('./TourFormes').then((m) => m.TourFormes),
  moods: () => import('./Moods').then((m) => m.Moods)
}

export const Labo: Composant<Record<string, never>> = () => {
  const planche = ref<Planche>(lire())
  const charges = shallowRef<Partial<Record<Planche, Composant<Record<string, never>>>>>({ formes: PlancheFormes })
  const charger = (p: Planche) => {
    if (charges.value[p] || p === 'formes') return
    CHARGEURS[p]().then((comp) => (charges.value = { ...charges.value, [p]: comp }))
  }
  charger(planche.value)
  const maj = () => {
    planche.value = lire()
    charger(planche.value)
  }
  surMontage(() => window.addEventListener('hashchange', maj))
  surDemontage(() => window.removeEventListener('hashchange', maj))

  const lien = (p: Planche, texte: string) =>
    h('a', { href: '#' + p, class: planche.value === p ? 'font-bold underline' : 'text-[var(--muted)]' }, texte)

  return () => {
    const comp = charges.value[planche.value]
    return h(
      'div',
      { class: 'min-h-screen bg-[var(--paper)] text-[var(--ink)]' },
      h(
        'nav',
        { class: 'flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--line)] px-4 py-3 text-sm' },
        h('strong', null, 'Mochi labo'),
        lien('formes', 'formes'),
        lien('formes3d', 'formes 3D'),
        lien('moods', 'moods'),
        lien('tour', 'tour')
      ),
      comp ? h(comp as Composant<never>, { key: planche.value }) : null
    )
  }
}
