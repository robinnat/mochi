import { c, h, type Component } from '@/ui/dom/h'
import { BotTile } from '@/components/BotTile'
import { EXPRESSIONS } from '@/bot/expressions'
import { COLORS, SHAPES } from '@/bot/skins'
import { t } from '@/i18n'
import { RENDER_STYLES, type RenderStyleId } from '@/ui/renderStyle'

export interface CustomizerProps {
  shape: string
  color: string
  expression: string
  renderStyle: RenderStyleId
  onShape: (v: string) => void
  onColor: (v: string) => void
  onExpression: (v: string) => void
  onRender: (v: RenderStyleId) => void
}

/**
 * Thumbnails are frozen at the same time as the resting pose: they show the shape and the face as they will appear,
 * not an abstract flat swatch.
 */
const PREVIEW_AT = 1

export const Customizer: Component<CustomizerProps> = (props) => () =>
  h(
    'div',
    null,
    // style first: it is the choice that changes the avatar the most
    h('h2', { class: 'text-sm font-semibold' }, t('panel.style')),
    h(
      'div',
      { class: 'mt-2 grid grid-cols-3 gap-1.5' },
      RENDER_STYLES.map((r) =>
        c(BotTile, {
          key: r,
          label: t(`styles.${r}`),
          selected: r === props.renderStyle,
          shape: props.shape,
          color: props.color,
          expression: props.expression,
          renderStyle: r,
          frozenAt: PREVIEW_AT,
          onClick: () => props.onRender(r)
        })
      )
    ),
    h('h2', { class: 'mt-5 text-sm font-semibold' }, t('panel.shape')),
    h(
      'div',
      { class: 'mt-2 grid grid-cols-4 gap-1.5' },
      SHAPES.map((s) =>
        c(BotTile, {
          key: s.id,
          label: t(`shapes.${s.id}`),
          selected: s.id === props.shape,
          shape: s.id,
          color: props.color,
          expression: props.expression,
          frozenAt: PREVIEW_AT,
          onClick: () => props.onShape(s.id)
        })
      )
    ),
    h('h2', { class: 'mt-5 text-sm font-semibold' }, t('panel.expression')),
    h(
      'div',
      { class: 'mt-2 grid grid-cols-4 gap-1.5' },
      EXPRESSIONS.map((e) =>
        c(BotTile, {
          key: e.id,
          label: t(`expressions.${e.id}`),
          selected: e.id === props.expression,
          shape: props.shape,
          color: props.color,
          expression: e.id,
          frozenAt: PREVIEW_AT,
          onClick: () => props.onExpression(e.id)
        })
      )
    ),
    h('h2', { class: 'mt-5 text-sm font-semibold' }, t('panel.color')),
    h(
      'div',
      { class: 'mt-2 grid grid-cols-6 gap-1.5' },
      COLORS.map((col) =>
        h(
          'button',
          {
            key: col.id,
            type: 'button',
            class: [
              'flex aspect-square cursor-pointer items-center justify-center rounded-full border-2 transition',
              col.id === props.color ? 'border-[var(--ink)]' : 'border-transparent hover:border-[var(--line)]'
            ],
            'aria-label': t(`colors.${col.id}`),
            'aria-pressed': col.id === props.color,
            onClick: () => props.onColor(col.id)
          },
          // inner rim: otherwise the cream dot disappears on a light background
          h('span', { class: 'block h-[78%] w-[78%] rounded-full ring-1 ring-black/10 ring-inset', style: { background: col.hex } })
        )
      )
    )
  )
