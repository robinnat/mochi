import { c, h, type Composant } from '@/ui/dom/h'
import { CodeBlock } from './CodeBlock'
import { EXEMPLE_RAPIDE } from '@/docs/exemples'
import { reveal } from './motion'

export const DocsTeaser: Composant<Record<string, never>> = () => () =>
  h(
    'section',
    { id: 'start', class: 'sec', 'aria-labelledby': 't-start' },
    h(
      'div',
      { class: 'wrap demarrer' },
      h(
        'div',
        null,
        h('p', { ref: reveal(), class: 'surtitre' }, 'Get started'),
        h('h2', { id: 't-start', ref: reveal(1), class: 'titre-sec' }, 'A few lines', h('br'), 'of code.'),
        h(
          'p',
          { ref: reveal(2), class: 'chapo' },
          'One web component, ',
          h('code', null, '<mochi-bot>'),
          ', in plain HTML or any framework (React, Svelte, Angular...). Three.js loads only when a 3D Mochi shows up. The npm package is coming soon; today you build it from the repository.'
        ),
        h(
          'div',
          { ref: reveal(3), class: 'actions gauche' },
          h('a', { class: 'btn primaire', href: '/docs' }, 'Read the docs ', h('span', { 'aria-hidden': 'true' }, '→')),
          h('a', { class: 'btn', href: 'https://github.com/robinnat/mochi' }, 'View on GitHub')
        )
      ),
      h('div', { ref: reveal(2) }, c(CodeBlock, { code: EXEMPLE_RAPIDE, titre: 'index.html' }))
    )
  )
