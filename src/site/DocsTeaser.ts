/// <reference types="vite/client" />
import { c, h, type Component } from '@/ui/dom/h'
import { CodeBlock } from './CodeBlock'
import guide from '../../docs/getting-started.md?raw'
import { parseMarkdown } from '@/docs/markdown'
import { reveal } from './motion'

/** The first live example of the guide (docs/getting-started.md): the home page shows the same code as the docs. */
export const QUICK_EXAMPLE = (parseMarkdown(guide).find((b) => b.t === 'code' && b.live) as { code: string }).code

export const DocsTeaser: Component<Record<string, never>> = () => () =>
  h(
    'section',
    { id: 'start', class: 'sec', 'aria-labelledby': 't-start' },
    h(
      'div',
      { class: 'wrap begin' },
      h(
        'div',
        null,
        h('p', { ref: reveal(), class: 'eyebrow' }, 'Get started'),
        h('h2', { id: 't-start', ref: reveal(1), class: 'title-sec' }, 'A few lines', h('br'), 'of code.'),
        h(
          'p',
          { ref: reveal(2), class: 'lede' },
          'One web component, ',
          h('code', null, '<mochi-bot>'),
          ', in plain HTML or any framework (React, Svelte, Angular...). Three.js loads only when a 3D Mochi shows up. The npm package is coming soon; today you build it from the repository.'
        ),
        h(
          'div',
          { ref: reveal(3), class: 'actions left' },
          h('a', { class: 'btn primary', href: '/docs' }, 'Read the docs ', h('span', { 'aria-hidden': 'true' }, '→')),
          h('a', { class: 'btn', href: 'https://github.com/robinnat/mochi' }, 'View on GitHub')
        )
      ),
      h('div', { ref: reveal(2) }, c(CodeBlock, { code: QUICK_EXAMPLE, title: 'index.html' }))
    )
  )
