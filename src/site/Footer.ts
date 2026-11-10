import { h, type Component } from '@/ui/dom/h'
import { brandMark } from './Nav'

export const Footer: Component<Record<string, never>> = () => () =>
  h(
    'footer',
    { class: 'footer' },
    h(
      'div',
      { class: 'wrap footer-in' },
      h('div', { class: 'footer-brand' }, brandMark(30), h('span', { class: 'wordmark' }, 'Mochis')),
      h('p', null, 'An animated avatar engine for the web. MIT licensed.'),
      h(
        'nav',
        { class: 'footer-links', 'aria-label': 'Footer' },
        h('a', { href: '/docs' }, 'Docs'),
        h('a', { href: '/app' }, 'App'),
        h('a', { href: 'https://github.com/robinnat/mochi' }, 'GitHub'),
        h('a', { href: 'https://github.com/robinnat/mochi/blob/main/LICENSE' }, 'License')
      )
    )
  )
