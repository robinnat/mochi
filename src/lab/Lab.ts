import { ref, shallowRef } from '@/ui/dom/reactive'
import { h, onUnmount, onMount, type Component } from '@/ui/dom/h'
import { ShapeSheet } from './ShapeSheet'

/**
 * Page labo : quatre planches choisies par le hash. `#shapes` est la planche de toutes les formes dans les quatre
 * styles, `#turn`, `#moods` et `#shapes3d` les planches 3D (chargees a la demande).
 */
type Sheet = 'shapes' | 'shapes3d' | 'turn' | 'moods'
const read = (): Sheet =>
  location.hash.startsWith('#moods') ? 'moods' : location.hash.startsWith('#tour') ? 'turn' : location.hash.startsWith('#formes3d') ? 'shapes3d' : 'shapes'

const LOADERS: Record<Exclude<Sheet, 'shapes'>, () => Promise<Component<Record<string, never>>>> = {
  shapes3d: () => import('./FlatSheet3d').then((m) => m.FlatSheet3d),
  turn: () => import('./ShapeTurntable').then((m) => m.ShapeTurntable),
  moods: () => import('./Moods').then((m) => m.Moods)
}

export const Lab: Component<Record<string, never>> = () => {
  const sheet = ref<Sheet>(read())
  const loaded = shallowRef<Partial<Record<Sheet, Component<Record<string, never>>>>>({ shapes: ShapeSheet })
  const load = (p: Sheet) => {
    if (loaded.value[p] || p === 'shapes') return
    LOADERS[p]().then((comp) => (loaded.value = { ...loaded.value, [p]: comp }))
  }
  load(sheet.value)
  const update = () => {
    sheet.value = read()
    load(sheet.value)
  }
  onMount(() => window.addEventListener('hashchange', update))
  onUnmount(() => window.removeEventListener('hashchange', update))

  const link = (p: Sheet, text: string) =>
    h('a', { href: '#' + p, class: sheet.value === p ? 'font-bold underline' : 'text-[var(--muted)]' }, text)

  return () => {
    const comp = loaded.value[sheet.value]
    return h(
      'div',
      { class: 'min-h-screen bg-[var(--paper)] text-[var(--ink)]' },
      h(
        'nav',
        { class: 'flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--line)] px-4 py-3 text-sm' },
        h('strong', null, 'Mochi labo'),
        link('shapes', 'shapes'),
        link('shapes3d', 'shapes 3D'),
        link('moods', 'moods'),
        link('turn', 'turn')
      ),
      comp ? h(comp as Component<never>, { key: sheet.value }) : null
    )
  }
}
