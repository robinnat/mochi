import { c, h, type Composant } from '@/ui/dom/h'
import { Nav } from './Nav'
import { Hero } from './Hero'
import { Styles } from './Styles'
import { Formes } from './Formes'
import { Moods } from './Moods'
import { Interactions } from './Interactions'
import { Bento } from './Bento'
import { Personnalisation } from './Personnalisation'
import { DocsTeaser } from './DocsTeaser'
import { Pied } from './Pied'
import { initTheme } from './theme'

export const Site: Composant<Record<string, never>> = () => {
  initTheme()
  return () =>
    h(
      'div',
      { style: 'display: contents' },
      c(Nav, {}),
      h('main', null, c(Hero, {}), c(Styles, {}), c(Formes, {}), c(Moods, {}), c(Interactions, {}), c(Bento, {}), c(Personnalisation, {}), c(DocsTeaser, {})),
      c(Pied, {})
    )
}
