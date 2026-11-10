import { h, type Component } from '@/ui/dom/h'
import '@/components/mochi-bot'
import { DEFAULT_EXPRESSION } from '@/bot/expressions'
import { DEFAULT_COLOR, DEFAULT_SHAPE } from '@/bot/skins'
import type { StateId } from '@/bot/states'
import type { RenderStyleId, PixelSizeId } from '@/ui/renderStyle'

/**
 * Vignette cliquable de la barre de droite : un bot fige, son nom dessous, une
 * bordure quand elle est retenue. Sert aux formes, aux expressions et aux
 * animations : les trois grilles doivent rester identiques a l'oeil.
 *
 * `frozenAt` est obligatoire : une vignette animee ferait tourner autant de
 * boucles rAF qu'il y a de cases.
 */
export interface BotTileProps {
  label: string
  selected: boolean
  frozenAt: number
  state?: StateId
  shape?: string
  color?: string
  expression?: string
  size?: number
  /** absent : le style courant, comme toutes les vignettes */
  renderStyle?: RenderStyleId
  pixel?: PixelSizeId
  onClick?: () => void
}

export const BotTile: Component<BotTileProps> = (props) => () =>
  h(
    'button',
    {
      type: 'button',
      class: [
        'flex cursor-pointer flex-col items-center rounded-xl border-2 p-1 transition',
        props.selected ? 'border-[var(--ink)]' : 'border-transparent hover:border-[var(--line)]'
      ],
      'aria-label': props.label,
      'aria-pressed': props.selected,
      onClick: () => props.onClick?.()
    },
    h('mochi-bot', {
      state: props.state ?? 'idle',
      size: props.size ?? 60,
      shape: props.shape ?? DEFAULT_SHAPE,
      color: props.color ?? DEFAULT_COLOR,
      expression: props.expression ?? DEFAULT_EXPRESSION,
      frozenAt: props.frozenAt,
      renderStyle: props.renderStyle,
      pixel: props.pixel
    }),
    // 12 px : en dessous, une legende n'est plus lisible pour tout le monde
    h('span', { class: 'text-center text-xs leading-tight text-[var(--muted)]' }, props.label)
  )
