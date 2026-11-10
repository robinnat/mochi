import { ref, watch } from '@/ui/dom/reactive'
import { h, onUnmount, type Component } from '@/ui/dom/h'
import type { Cycle } from '@/bot/cycles'
import { nameOfCycle, t } from '@/i18n'

/**
 * Choix du montage. Un `<select>` natif ne peut pas porter la ligne « Nouveau » ni la suppression d'une entree,
 * d'ou ce menu ; il s'ouvre vers le haut, la barre etant en bas de l'ecran.
 */
export interface CycleMenuProps {
  cycles: Cycle[]
  current: Cycle
  activeId: string
  onActiveId: (id: string) => void
  onCreate: () => void
  onRemove: (id: string) => void
  onRename: (id: string) => void
}

export const CycleMenu: Component<CycleMenuProps> = (props) => {
  const open = ref(false)
  let root: HTMLElement | null = null

  function choose(id: string) {
    props.onActiveId(id)
    open.value = false
  }
  function create() {
    open.value = false
    props.onCreate()
  }
  function onOutside(e: PointerEvent) {
    if (!root?.contains(e.target as Node)) open.value = false
  }
  watch(open, (on) => {
    if (on) window.addEventListener('pointerdown', onOutside)
    else window.removeEventListener('pointerdown', onOutside)
  })
  onUnmount(() => window.removeEventListener('pointerdown', onOutside))

  return () =>
    h(
      'div',
      {
        ref: (el: Element | null) => (root = el as HTMLElement | null),
        class: 'relative',
        onKeydown: (e: KeyboardEvent) => {
          if (e.key === 'Escape') open.value = false
        }
      },
      // `text-left` : les navigateurs centrent le texte des boutons
      h(
        'button',
        {
          type: 'button',
          class: 'flex max-w-56 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm font-medium transition hover:bg-black/5',
          'aria-haspopup': 'true',
          'aria-expanded': open.value,
          title: nameOfCycle(props.current),
          onClick: () => (open.value = !open.value)
        },
        h('span', { class: 'truncated' }, nameOfCycle(props.current)),
        h(
          'svg',
          { width: '10', height: '10', viewBox: '0 0 10 10', 'aria-hidden': 'true', class: 'shrink-0 text-[var(--muted)]' },
          h('path', { d: 'M2 3.5 5 6.5l3-3', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
        )
      ),
      open.value
        ? h(
            'div',
            { class: 'absolute bottom-full left-0 z-10 mb-2 w-56 rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/5' },
            props.cycles.map((cy) =>
              h(
                'div',
                { key: cy.id, class: 'group/row flex items-center gap-1' },
                // `min-w-0` : sans lui, un nom long pousse la ligne au lieu d'etre coupe
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-black/5',
                    title: nameOfCycle(cy),
                    onClick: () => choose(cy.id)
                  },
                  h('span', { class: 'w-3 shrink-0 text-[var(--ink)]' }, cy.id === props.activeId ? '✓' : ''),
                  h('span', { class: 'truncated' }, nameOfCycle(cy))
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    class:
                      'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--muted)] opacity-0 transition group-hover/row:opacity-100 hover:bg-black/5 hover:text-[var(--ink)] focus-visible:opacity-100',
                    'aria-label': t('cycles.menuRenameAria', { name: nameOfCycle(cy) }),
                    onClick: () => {
                      open.value = false
                      props.onRename(cy.id)
                    }
                  },
                  h(
                    'svg',
                    { width: '12', height: '12', viewBox: '0 0 12 12', 'aria-hidden': 'true' },
                    h('path', { d: 'M8.2 1.8 10.2 3.8 4.4 9.6 1.8 10.2 2.4 7.6z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.1', 'stroke-linejoin': 'round' })
                  )
                ),
                // le dernier montage ne se supprime pas : il n'y aurait plus rien a jouer
                props.cycles.length > 1
                  ? h(
                      'button',
                      {
                        type: 'button',
                        class:
                          'mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--muted)] opacity-0 transition group-hover/row:opacity-100 hover:bg-black/5 hover:text-[var(--danger)] focus-visible:opacity-100',
                        'aria-label': t('cycles.menuRemoveAria', { name: nameOfCycle(cy) }),
                        onClick: () => {
                          open.value = false
                          props.onRemove(cy.id)
                        }
                      },
                      h(
                        'svg',
                        { width: '13', height: '13', viewBox: '0 0 14 14', 'aria-hidden': 'true' },
                        h('path', {
                          d: 'M2.8 3.9h8.4M5.5 3.9V2.7h3v1.2M4.1 3.9l.5 7.4h4.8l.5-7.4',
                          fill: 'none',
                          stroke: 'currentColor',
                          'stroke-width': '1.1',
                          'stroke-linecap': 'round',
                          'stroke-linejoin': 'round'
                        })
                      )
                    )
                  : null
              )
            ),
            h('div', { class: 'my-1 h-px bg-[var(--line)]' }),
            h(
              'button',
              { type: 'button', class: 'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-black/5', onClick: create },
              h('span', { class: 'w-3 shrink-0 text-[var(--muted)]' }, '+'),
              t('cycles.menuNew')
            )
          )
        : null
    )
}
