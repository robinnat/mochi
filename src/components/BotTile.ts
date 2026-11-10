import { h, type Component } from '@/ui/dom/h'
import '@/components/mochi-bot'
import { DEFAULT_EXPRESSION } from '@/bot/expressions'
import { DEFAULT_COLOR, DEFAULT_SHAPE } from '@/bot/skins'
import type { StateId } from '@/bot/states'
import type { RenderStyleId, PixelSizeId } from '@/ui/renderStyle'

/**
 * Clickable thumbnail of the right bar: a frozen bot, its name below, a border when it is selected. Used for shapes,
 * expressions and animations: the three grids must look identical.
 *
 * `frozenAt` is required: an animated thumbnail would run as many rAF loops as there are cells.
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
  /** absent: the current style, like every thumbnail */
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
    // 12 px: below that, a caption is no longer readable for everyone
    h('span', { class: 'text-center text-xs leading-tight text-[var(--muted)]' }, props.label)
  )
