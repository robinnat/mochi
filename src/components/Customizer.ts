import { c, h, type Composant } from '@/ui/dom/h'
import { BotTile } from '@/components/BotTile'
import { EXPRESSIONS } from '@/bot/expressions'
import { COLORS, SHAPES } from '@/bot/skins'
import { t } from '@/i18n'
import { RENDUS, type RenduId } from '@/ui/rendu'

export interface CustomizerProps {
  shape: string
  color: string
  expression: string
  rendu: RenduId
  contour: boolean
  onShape: (v: string) => void
  onColor: (v: string) => void
  onExpression: (v: string) => void
  onRendu: (v: RenduId) => void
  onContour: (v: boolean) => void
}

/**
 * Les vignettes sont figees a la meme date que la pose de repos : elles montrent
 * la forme et le visage tels qu'ils apparaitront, pas un aplat abstrait.
 */
const PREVIEW_AT = 1

export const Customizer: Composant<CustomizerProps> = (props) => () =>
  h(
    'div',
    null,
    // le style en premier : c'est le choix qui change le plus l'avatar
    h('h2', { class: 'text-sm font-semibold' }, t('panel.style')),
    h(
      'div',
      { class: 'mt-2 grid grid-cols-3 gap-1.5' },
      RENDUS.map((r) =>
        c(BotTile, {
          key: r,
          label: t(`styles.${r}`),
          selected: r === props.rendu,
          shape: props.shape,
          color: props.color,
          expression: props.expression,
          rendu: r,
          frozenAt: PREVIEW_AT,
          onClick: () => props.onRendu(r)
        })
      )
    ),
    // le contour : les trois styles
    h(
      'label',
      { class: 'mt-3 flex cursor-pointer items-center gap-2 text-xs' },
      h('input', {
        type: 'checkbox',
        class: 'size-4 cursor-pointer accent-[var(--ink)]',
        checked: props.contour,
        onChange: (e: Event) => props.onContour((e.target as HTMLInputElement).checked)
      }),
      t('panel.contour')
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
          // lisere interne : sinon la pastille creme disparait sur fond clair
          h('span', { class: 'block h-[78%] w-[78%] rounded-full ring-1 ring-black/10 ring-inset', style: { background: col.hex } })
        )
      )
    )
  )
