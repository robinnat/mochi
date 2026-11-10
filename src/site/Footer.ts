import { h, type Component } from '@/ui/dom/h'

export const Footer: Component<Record<string, never>> = () => () =>
  h(
    'footer',
    { class: 'footer' },
    h(
      'div',
      { class: 'wrap footer-in' },
      h('div', { class: 'footer-strong' }, h('img', { src: '/favicon.svg', width: '28', height: '28', alt: '' }), h('span', null, 'Mochi World')),
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
