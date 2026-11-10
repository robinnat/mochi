import { ref } from '@/ui/dom/reactif'
import { c, h, type Composant } from '@/ui/dom/h'
import { BotTile } from '@/components/BotTile'
import { POSES, SEQUENCE, STATE_BY_ID, type StateId } from '@/bot/states'
import { t } from '@/i18n'

/** Carte « + » de la piste et sa palette : ajouter depuis la piste evite d'aller jusqu'au panneau de droite. */
export interface BlockPickerProps {
  shape: string
  color: string
  expression: string
  onPick: (state: StateId) => void
}

/** Les animations dans l'ordre de la video. */
const PALETTE = SEQUENCE.map((id) => STATE_BY_ID.get(id)!)
/** Largeur de la palette, en pixels : elle sert aussi a la caler. */
const WIDTH = 288

export const BlockPicker: Composant<BlockPickerProps> = (props) => {
  let trigger: HTMLButtonElement | null = null
  let panel: HTMLElement | null = null
  const position = ref<Record<string, string>>({})
  /** Suivi par l'evenement `toggle` du popover : la fermeture legere (clic a cote, Echap) est faite par le navigateur. */
  const ouvert = ref(false)

  /** Ouvre la palette au-dessus du « + », dans la couche superieure, bornee a la fenetre. */
  function toggle() {
    if (!trigger || !panel) return
    // au clavier, `Entree` ne declenche pas la fermeture legere : `showPopover` leverait une exception
    if (panel.matches(':popover-open')) {
      panel.hidePopover()
      return
    }
    const r = trigger.getBoundingClientRect()
    position.value = {
      position: 'fixed',
      // un popover pose `inset: 0` : on remet le haut et la droite a `auto`
      top: 'auto',
      right: 'auto',
      left: `${Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8))}px`,
      bottom: `${window.innerHeight - r.top + 8}px`
    }
    // la position doit etre posee avant l'ouverture
    Object.assign(panel.style, position.value)
    panel.showPopover()
  }

  function pick(state: StateId) {
    props.onPick(state)
    panel?.hidePopover()
  }

  // `contents` : la carte et sa palette n'ajoutent aucune boite a la piste
  return () =>
    h(
      'div',
      { style: 'display: contents' },
      h(
        'button',
        {
          ref: (el: Element | null) => (trigger = el as HTMLButtonElement | null),
          type: 'button',
          class:
            'flex h-full w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[var(--line)] text-lg leading-none text-[var(--muted)] transition hover:border-[var(--muted)] hover:text-[var(--ink)]',
          'aria-label': t('timeline.addAnimation'),
          'aria-haspopup': 'true',
          'aria-expanded': ouvert.value,
          onClick: toggle
        },
        '+'
      ),
      // `popover` : la palette echappe au conteneur de la piste, qui rogne ; `m-0` annule le centrage
      h(
        'div',
        {
          ref: (el: Element | null) => (panel = el as HTMLElement | null),
          popover: true,
          onToggle: (e: Event) => (ouvert.value = (e as ToggleEvent).newState === 'open'),
          class: 'm-0 w-72 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/5',
          style: position.value
        },
        h(
          'div',
          { class: 'grid grid-cols-4 gap-1.5' },
          PALETTE.map((s) =>
            c(BotTile, {
              key: s.id,
              label: t(`states.${s.id}`),
              selected: false,
              state: s.id,
              shape: props.shape,
              color: props.color,
              expression: props.expression,
              frozenAt: POSES[s.id],
              onClick: () => pick(s.id)
            })
          )
        )
      )
    )
}
