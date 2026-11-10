import { computed } from '@/ui/dom/reactif'
import { h, type Composant } from '@/ui/dom/h'
import { pourcentage, t } from '@/i18n'

/**
 * Reglage de la loupe de la piste. Un `<input type="range">` natif plutot qu'un curseur maison : il apporte le
 * clavier, le pas et l'annonce aux lecteurs d'ecran. Le parent recoit la valeur et decide du point d'ancrage.
 */
export interface ZoomSliderProps {
  zoom: number
  min: number
  max: number
  onZoom: (v: number) => void
}

export const ZoomSlider: Composant<ZoomSliderProps> = (props) => {
  const percent = computed(() => pourcentage(props.zoom))
  return () =>
    h(
      'div',
      { class: 'flex items-center gap-1.5' },
      // les deux pastilles disent le sens : petit a gauche, grand a droite
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
      // largeur fixe, alignee a gauche : le pourcentage reste pres du curseur
      h('span', { class: 'w-11 text-left text-xs tabular-nums text-[var(--muted)]' }, percent.value)
    )
}
