import { h, type Composant } from '@/ui/dom/h'
import { CHIFFRES } from './catalog'
import { reveal } from './motion'

export const HeroChiffres: Composant<Record<string, never>> = () => () =>
  h(
    'ul',
    { class: 'chiffres wrap', 'aria-label': 'Mochi in numbers' },
    CHIFFRES.map((ch, i) => h('li', { key: ch.label, ref: reveal(i) }, h('strong', null, ch.valeur), h('span', null, ch.label)))
  )
