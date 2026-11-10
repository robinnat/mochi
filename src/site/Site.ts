import { c, h, type Component } from '@/ui/dom/h'
import { Nav } from './Nav'
import { Hero } from './Hero'
import { Styles } from './Styles'
import { Shapes } from './Shapes'
import { Moods } from './Moods'
import { Interactions } from './Interactions'
import { Bento } from './Bento'
import { Customization } from './Customization'
import { DocsTeaser } from './DocsTeaser'
import { Footer } from './Footer'
import { initTheme } from './theme'

export const Site: Component<Record<string, never>> = () => {
  initTheme()
  return () =>
    h(
      'div',
      { style: 'display: contents' },
      c(Nav, {}),
      h('main', null, c(Hero, {}), c(Styles, {}), c(Shapes, {}), c(Moods, {}), c(Interactions, {}), c(Bento, {}), c(Customization, {}), c(DocsTeaser, {})),
      c(Footer, {})
    )
}
