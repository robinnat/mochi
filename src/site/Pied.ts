import { h, type Composant } from '@/ui/dom/h'

export const Pied: Composant<Record<string, never>> = () => () =>
  h(
    'footer',
    { class: 'pied' },
    h(
      'div',
      { class: 'wrap pied-in' },
      h('div', { class: 'pied-marque' }, h('img', { src: '/favicon.svg', width: '28', height: '28', alt: '' }), h('span', null, 'Mochi World')),
      h('p', null, 'An animated avatar engine for the web. MIT licensed.'),
      h(
        'nav',
        { class: 'pied-liens', 'aria-label': 'Footer' },
        h('a', { href: '/docs' }, 'Docs'),
        h('a', { href: '/app' }, 'App'),
        h('a', { href: 'https://github.com/robinnat/mochi' }, 'GitHub'),
        h('a', { href: 'https://github.com/robinnat/mochi/blob/main/LICENSE' }, 'License')
      )
    )
  )
