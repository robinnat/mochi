import { h, type Component } from '@/ui/dom/h'
import { FIGURES } from './catalog'
import { reveal } from './motion'

export const HeroFigures: Component<Record<string, never>> = () => () =>
  h(
    'ul',
    { class: 'figures wrap', 'aria-label': 'Mochi in numbers' },
    FIGURES.map((ch, i) => h('li', { key: ch.label, ref: reveal(i) }, h('strong', null, ch.value), h('span', null, ch.label)))
  )
