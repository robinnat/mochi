import { computed } from '@/ui/dom/reactive'
import { h, type Component } from '@/ui/dom/h'
import { percentage, t } from '@/i18n'

/**
 * Zoom setting of the track. A native `<input type="range">` rather than a custom slider: it brings keyboard, step
 * and screen reader announcements. The parent gets the value and decides the anchor.
 */
export interface ZoomSliderProps {
  zoom: number
  min: number
  max: number
  onZoom: (v: number) => void
}

export const ZoomSlider: Component<ZoomSliderProps> = (props) => {
  const percent = computed(() => percentage(props.zoom))
  return () =>
    h(
      'div',
      { class: 'flex items-center gap-1.5' },
      // the two dots tell the direction: small on the left, big on the right
      h('span', { class: 'h-1 w-1 shrink-0 rounded-full bg-[var(--muted)]', 'aria-hidden': 'true' }),
      h('input', {
        type: 'range',
        class: 'h-1 w-28 cursor-pointer accent-[var(--ink)] max-sm:w-20',
        min: props.min,
        max: props.max,
        step: '0.01',
        value: String(props.zoom),
        'aria-label': t('timeline.zoom'),
        'aria-valuetext': percent.value,
        onInput: (e: Event) => props.onZoom(Number((e.target as HTMLInputElement).value))
      }),
      h('span', { class: 'h-2 w-2 shrink-0 rounded-full bg-[var(--muted)]', 'aria-hidden': 'true' }),
      // fixed width, left aligned: the percentage stays near the slider
      h('span', { class: 'w-11 text-left text-xs tabular-nums text-[var(--muted)]' }, percent.value)
    )
}
