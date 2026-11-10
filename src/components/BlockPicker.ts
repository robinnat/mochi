import { ref } from '@/ui/dom/reactive'
import { c, h, type Component } from '@/ui/dom/h'
import { BotTile } from '@/components/BotTile'
import { POSES, SEQUENCE, STATE_BY_ID, type StateId } from '@/bot/states'
import { t } from '@/i18n'

/** "+" card of the track and its palette: adding from the track saves going to the right panel. */
export interface BlockPickerProps {
  shape: string
  color: string
  expression: string
  onPick: (state: StateId) => void
}

/** The animations in the video's order. */
const PALETTE = SEQUENCE.map((id) => STATE_BY_ID.get(id)!)
/** Width of the palette, in pixels: also used to place it. */
const WIDTH = 288

export const BlockPicker: Component<BlockPickerProps> = (props) => {
  let trigger: HTMLButtonElement | null = null
  let panel: HTMLElement | null = null
  const position = ref<Record<string, string>>({})
  /**
 * Tracked through the popover's `toggle` event: light dismiss (click outside, Escape) is done by the browser.
 */
  const open = ref(false)

  /** Opens the palette above the "+", in the top layer, bounded by the window. */
  function toggle() {
    if (!trigger || !panel) return
    // with the keyboard, `Enter` does not trigger light dismiss: `showPopover` would throw
    if (panel.matches(':popover-open')) {
      panel.hidePopover()
      return
    }
    const r = trigger.getBoundingClientRect()
    position.value = {
      position: 'fixed',
      // a popover sets `inset: 0`: we put top and right back to `auto`
      top: 'auto',
      right: 'auto',
      left: `${Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8))}px`,
      bottom: `${window.innerHeight - r.top + 8}px`
    }
    // the position must be set before opening
    Object.assign(panel.style, position.value)
    panel.showPopover()
  }

  function pick(state: StateId) {
    props.onPick(state)
    panel?.hidePopover()
  }

  // `contents`: the card and its palette add no box to the track
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
          'aria-expanded': open.value,
          onClick: toggle
        },
        '+'
      ),
      // `popover`: the palette escapes the track's container, which clips; `m-0` cancels centering
      h(
        'div',
        {
          ref: (el: Element | null) => (panel = el as HTMLElement | null),
          popover: true,
          onToggle: (e: Event) => (open.value = (e as ToggleEvent).newState === 'open'),
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
