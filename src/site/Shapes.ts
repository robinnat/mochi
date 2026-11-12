import { computed, ref } from '@/ui/dom/reactive'
import { c, h, type Component } from '@/ui/dom/h'
import { Poster } from './Poster'
import { SHAPES_3D } from './catalog'
import { STYLES_SITE } from './style'
import type { RenderStyleId } from 'mochiz-world/catalog'
import { reveal, useWidth } from './motion'

/** The twelve shapes, frozen images (one render each, no loop), appearing in a cascade. */
export const Shapes: Component<Record<string, never>> = () => {
  const style = ref<RenderStyleId>('3d')
  const width = useWidth()
  const size = computed(() => (width.value >= 1100 ? 128 : width.value >= 760 ? 104 : 88))
  // the `reveal`s are created once: a new one on each drawing would restart observation
  const rv = [reveal(), reveal(1), reveal(2)]
  const rvShape = SHAPES_3D.map((_, i) => reveal(i % 6))
  return () =>
    h(
      'section',
      { id: 'shapes', class: 'sec', 'aria-labelledby': 't-shapes' },
      h(
        'div',
        { class: 'wrap sec-head sec-head-row' },
        h('div', null, h('p', { ref: rv[0], class: 'eyebrow' }, 'Shapes'), h('h2', { id: 't-shapes', ref: rv[1], class: 'title-sec' }, 'Twelve shapes.', h('br'), 'Same soul.')),
        h(
          'div',
          { ref: rv[2], class: 'segment', role: 'group', 'aria-label': 'Style of the shapes' },
          STYLES_SITE.map((s) => h('button', { key: s.id, type: 'button', 'aria-pressed': style.value === s.id, onClick: () => (style.value = s.id) }, s.label))
        )
      ),
      h(
        'div',
        { class: 'wrap' },
        h(
          'ul',
          { class: 'shapes', 'aria-label': 'The twelve shapes' },
          SHAPES_3D.map((f, i) =>
            h(
              'li',
              { key: f.id, ref: rvShape[i] },
              h(
                'div',
                { class: 'shape' },
                h('div', { class: 'shape-image' }, c(Poster, { name: `shape-${f.id}-${style.value}`, size: size.value, alt: `${f.label} Mochi` })),
                h('span', { class: 'shape-name' }, f.label),
                h('code', { class: 'shape-id' }, f.id)
              )
            )
          )
        )
      )
    )
}
